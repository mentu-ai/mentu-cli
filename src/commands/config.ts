import type { Command } from 'commander';
import { MentuError } from '../types.js';
import { findWorkspace, readConfig, writeConfig, getConfigValue, setConfigValue } from '../core/config.js';

interface ConfigGetOptions {
  // No additional options
}

interface ConfigSetOptions {
  // No additional options
}

interface ConfigListOptions {
  // No additional options
}

function parseValue(value: string): unknown {
  // Try to parse as JSON for complex values
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
  // Try JSON parse for objects/arrays
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === 'object') return parsed;
  } catch {
    // Not JSON, treat as string
  }
  return value;
}

function getGitHubEnvConfig(): Record<string, unknown> {
  const enabled = process.env.GITHUB_ENABLED === 'true';
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  return {
    GITHUB_ENABLED: enabled,
    GITHUB_OWNER: owner ?? null,
    GITHUB_REPO: repo ?? null,
    GITHUB_TOKEN: token ? '***' : null,
  };
}

function outputResult(result: unknown, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result));
  } else {
    if (typeof result === 'object' && result !== null) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(String(result));
    }
  }
}

function outputError(error: MentuError, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(error.toJSON()));
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
}

export function registerConfigCommand(program: Command): void {
  const configCmd = program
    .command('config')
    .description('Get and set configuration values');

  // mentu config get <key>
  configCmd
    .command('get <key>')
    .description('Get a configuration value')
    .action((key: string, _options: ConfigGetOptions) => {
      const json = program.opts().json || false;

      try {
        const workspacePath = findWorkspace(process.cwd());
        const config = readConfig(workspacePath);

        if (!config) {
          throw new MentuError(
            'E_NO_WORKSPACE',
            'No config found. Run "mentu init" first.'
          );
        }

        const value = getConfigValue(config, key);

        outputResult({ key, value: value ?? null }, json);
      } catch (err) {
        if (err instanceof MentuError) {
          outputError(err, json);
        } else {
          const error = new MentuError(
            'E_INVALID_OP',
            err instanceof Error ? err.message : 'Unknown error'
          );
          outputError(error, json);
        }
      }
    });

  // mentu config set <key> <value>
  configCmd
    .command('set <key> <value>')
    .description('Set a configuration value')
    .action((key: string, value: string, _options: ConfigSetOptions) => {
      const json = program.opts().json || false;

      try {
        const workspacePath = findWorkspace(process.cwd());
        let config = readConfig(workspacePath);

        if (!config) {
          throw new MentuError(
            'E_NO_WORKSPACE',
            'No config found. Run "mentu init" first.'
          );
        }

        const previous = getConfigValue(config, key);
        const parsedValue = parseValue(value);

        config = setConfigValue(config, key, parsedValue);
        writeConfig(workspacePath, config);

        outputResult({ key, value: parsedValue, previous: previous ?? null }, json);
      } catch (err) {
        if (err instanceof MentuError) {
          outputError(err, json);
        } else {
          const error = new MentuError(
            'E_INVALID_OP',
            err instanceof Error ? err.message : 'Unknown error'
          );
          outputError(error, json);
        }
      }
    });

  // mentu config list
  configCmd
    .command('list')
    .description('List all configuration values')
    .action((_options: ConfigListOptions) => {
      const json = program.opts().json || false;

      try {
        const workspacePath = findWorkspace(process.cwd());
        const config = readConfig(workspacePath);

        if (!config) {
          throw new MentuError(
            'E_NO_WORKSPACE',
            'No config found. Run "mentu init" first.'
          );
        }

        // Merge env-based GitHub config into output
        const output = {
          ...config,
          integrations: {
            ...config.integrations,
            github: {
              ...config.integrations?.github,
              env: getGitHubEnvConfig(),
            },
          },
        };

        outputResult(output, json);
      } catch (err) {
        if (err instanceof MentuError) {
          outputError(err, json);
        } else {
          const error = new MentuError(
            'E_INVALID_OP',
            err instanceof Error ? err.message : 'Unknown error'
          );
          outputError(error, json);
        }
      }
    });
}
