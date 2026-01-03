import type { Command } from 'commander';
import type { PublishOperation, PublishOutput } from '../types.js';
import { MentuError } from '../types.js';
import { generateId } from '../utils/id.js';
import { timestamp } from '../utils/time.js';
import { resolveActor } from '../utils/actor.js';
import { findWorkspace, readConfig, getWorkspaceName } from '../core/config.js';
import { readLedger, appendOperation } from '../core/ledger.js';
import { readGenesisKey } from '../core/genesis.js';
import { validateOperation } from '../core/validate.js';
import { memoryExists, commitmentExists } from '../core/state.js';

interface PublishOptions {
  module: string;
  path: string;
  content?: string;
  source?: string;
  actor?: string;
}

function outputResult(result: PublishOutput, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result));
  } else {
    console.log(`Published: ${result.pub_id}`);
    console.log(`URL: ${result.url}`);
    console.log(`Module: ${result.module}`);
    if (result.source) {
      console.log(`Source: ${result.source.id}`);
    }
  }
}

function outputError(error: MentuError, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ ...error.toJSON(), op: 'publish' }));
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
}

export function registerPublishCommand(program: Command): void {
  program
    .command('publish')
    .description('Publish content to the publishing layer')
    .requiredOption('-m, --module <module>', 'Module type: docs, evidence, artifacts, assets')
    .requiredOption('-p, --path <path>', 'Publication path (e.g., auth-system/overview)')
    .option('-c, --content <content>', 'Content to publish (markdown)')
    .option('-s, --source <id>', 'Source commitment or memory ID')
    .option('--actor <id>', 'Override actor identity')
    .action(async (options: PublishOptions) => {
      const json = program.opts().json || false;

      try {
        // Validate module
        const validModules = ['docs', 'evidence', 'artifacts', 'assets'];
        if (!validModules.includes(options.module)) {
          throw new MentuError(
            'E_INVALID_OP',
            `Invalid module: ${options.module}. Must be one of: ${validModules.join(', ')}`,
            { field: 'module', value: options.module }
          );
        }

        // Validate path
        if (!options.path || options.path.trim() === '') {
          throw new MentuError('E_MISSING_FIELD', 'Path cannot be empty', { field: 'path' });
        }

        const workspacePath = findWorkspace(process.cwd());
        const config = readConfig(workspacePath);
        const genesis = readGenesisKey(workspacePath);
        const actor = resolveActor(options.actor, config ?? undefined);
        const workspace = getWorkspaceName(workspacePath);
        const ledger = readLedger(workspacePath);

        // Validate source if provided
        let sourceInfo: { type: 'commitment' | 'memory'; id: string } | undefined;
        if (options.source) {
          if (options.source.startsWith('cmt_')) {
            if (!commitmentExists(ledger, options.source)) {
              throw new MentuError(
                'E_REF_NOT_FOUND',
                `Source commitment ${options.source} does not exist`,
                { field: 'source', value: options.source }
              );
            }
            sourceInfo = { type: 'commitment', id: options.source };
          } else if (options.source.startsWith('mem_')) {
            if (!memoryExists(ledger, options.source)) {
              throw new MentuError(
                'E_REF_NOT_FOUND',
                `Source memory ${options.source} does not exist`,
                { field: 'source', value: options.source }
              );
            }
            sourceInfo = { type: 'memory', id: options.source };
          } else {
            throw new MentuError(
              'E_INVALID_OP',
              'Source must be a commitment (cmt_) or memory (mem_) ID',
              { field: 'source', value: options.source }
            );
          }
        }

        const opId = generateId('op');
        const pubId = generateId('pub');
        const ts = timestamp();

        // Build publication URL
        // Format: mentu.ai/p/{workspace}/{module}/{path}
        const url = `mentu.ai/p/${workspace}/${options.module}/${options.path}`;

        const operation: PublishOperation = {
          id: opId,
          op: 'publish',
          ts,
          actor,
          workspace,
          payload: {
            id: pubId,
            module: options.module,
            path: options.path,
            version: 1,
            url,
            ...(options.content && { content: options.content }),
            ...(sourceInfo && { source: sourceInfo }),
          },
        };

        // Validate with Genesis Key
        const validation = validateOperation(operation, ledger, genesis);
        if (!validation.valid && validation.error) {
          throw validation.error;
        }

        appendOperation(workspacePath, operation);

        const result: PublishOutput = {
          id: opId,
          op: 'publish',
          ts,
          actor,
          pub_id: pubId,
          module: options.module,
          path: options.path,
          url,
          version: 1,
          ...(sourceInfo && { source: sourceInfo }),
        };

        outputResult(result, json);
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
