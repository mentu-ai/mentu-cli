import type { Command } from 'commander';
import { findWorkspace, readConfig, writeConfig } from '../core/config.js';
import { generateApiKey } from '../utils/id.js';
import { hashApiKey, type ApiKeyStored } from '../server/types.js';
import { MentuError, type Config } from '../types.js';

interface CreateOptions {
  actor: string;
  name: string;
  json: boolean;
}

interface ListOptions {
  json: boolean;
}

interface RevokeOptions {
  json: boolean;
}

export function registerApiKeyCommand(program: Command): void {
  const apiKey = program.command('api-key').description('Manage API keys');

  apiKey
    .command('create')
    .description('Create a new API key')
    .requiredOption('--actor <actor>', 'Actor identity for this key')
    .option('--name <name>', 'Key name', 'API Key')
    .option('--json', 'Output as JSON')
    .action((options: CreateOptions) => {
      try {
        const workspacePath = findWorkspace(process.cwd());
        const config = (readConfig(workspacePath) || {}) as Config & {
          api?: { keys?: ApiKeyStored[] };
        };

        // Generate the full key (shown only once)
        const fullKey = `mentu_key_${generateApiKey()}`;

        // Store only the hash
        const storedKey: ApiKeyStored = {
          id: `key_${Date.now()}`,
          name: options.name,
          key_hash: hashApiKey(fullKey),
          key_prefix: fullKey.slice(0, 16), // For identification
          actor: options.actor,
          permissions: ['read', 'write'],
          created: new Date().toISOString(),
        };

        // Initialize api.keys array if needed
        if (!config.api) {
          config.api = {};
        }
        if (!config.api.keys) {
          config.api.keys = [];
        }
        config.api.keys.push(storedKey);

        writeConfig(workspacePath, config as Config);

        if (options.json) {
          console.log(
            JSON.stringify(
              {
                id: storedKey.id,
                key: fullKey, // Full key shown only at creation
                actor: storedKey.actor,
                warning: 'Save this key - it cannot be retrieved later',
              },
              null,
              2
            )
          );
        } else {
          console.log(`API Key created:`);
          console.log(`  ID: ${storedKey.id}`);
          console.log(`  Key: ${fullKey}`);
          console.log(`  Actor: ${storedKey.actor}`);
          console.log(`  Warning: SAVE THIS KEY - it cannot be retrieved later`);
        }
      } catch (err) {
        if (err instanceof MentuError) {
          if (options.json) {
            console.log(JSON.stringify(err.toJSON()));
          } else {
            console.error(`Error: ${err.message}`);
          }
          process.exit(1);
        }
        throw err;
      }
    });

  apiKey
    .command('list')
    .description('List all API keys')
    .option('--json', 'Output as JSON')
    .action((options: ListOptions) => {
      try {
        const workspacePath = findWorkspace(process.cwd());
        const config = readConfig(workspacePath) as Config & {
          api?: { keys?: ApiKeyStored[] };
        } | null;
        const keys: ApiKeyStored[] = config?.api?.keys || [];

        if (options.json) {
          console.log(
            JSON.stringify(
              {
                keys: keys.map((k) => ({
                  id: k.id,
                  name: k.name,
                  key_prefix: k.key_prefix,
                  actor: k.actor,
                  permissions: k.permissions,
                  created: k.created,
                })),
              },
              null,
              2
            )
          );
        } else {
          if (keys.length === 0) {
            console.log('No API keys configured');
            return;
          }

          console.log('API Keys:');
          for (const key of keys) {
            console.log(
              `  ${key.id}: ${key.name} (${key.key_prefix}...) -> actor: ${key.actor}`
            );
          }
        }
      } catch (err) {
        if (err instanceof MentuError) {
          if (options.json) {
            console.log(JSON.stringify(err.toJSON()));
          } else {
            console.error(`Error: ${err.message}`);
          }
          process.exit(1);
        }
        throw err;
      }
    });

  apiKey
    .command('revoke <key_id>')
    .description('Revoke an API key')
    .option('--json', 'Output as JSON')
    .action((keyId: string, options: RevokeOptions) => {
      try {
        const workspacePath = findWorkspace(process.cwd());
        const config = (readConfig(workspacePath) || {}) as Config & {
          api?: { keys?: ApiKeyStored[] };
        };

        const keys: ApiKeyStored[] = config?.api?.keys || [];
        const index = keys.findIndex((k) => k.id === keyId);

        if (index === -1) {
          if (options.json) {
            console.log(
              JSON.stringify({ error: 'E_NOT_FOUND', message: `Key ${keyId} not found` })
            );
          } else {
            console.error(`Error: Key ${keyId} not found`);
          }
          process.exit(1);
        }

        keys.splice(index, 1);
        if (!config.api) {
          config.api = {};
        }
        config.api.keys = keys;
        writeConfig(workspacePath, config as Config);

        if (options.json) {
          console.log(JSON.stringify({ revoked: keyId }));
        } else {
          console.log(`Revoked key: ${keyId}`);
        }
      } catch (err) {
        if (err instanceof MentuError) {
          if (options.json) {
            console.log(JSON.stringify(err.toJSON()));
          } else {
            console.error(`Error: ${err.message}`);
          }
          process.exit(1);
        }
        throw err;
      }
    });
}
