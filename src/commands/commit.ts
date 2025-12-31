import type { Command } from 'commander';
import type { CommitOperation, CommitOutput } from '../types.js';
import { MentuError } from '../types.js';
import { generateId } from '../utils/id.js';
import { timestamp } from '../utils/time.js';
import { resolveActor } from '../utils/actor.js';
import { findWorkspace, readConfig, getWorkspaceName } from '../core/config.js';
import { readLedger, appendOperation } from '../core/ledger.js';
import { memoryExists } from '../core/state.js';
import { readGenesisKey } from '../core/genesis.js';
import { validateOperation } from '../core/validate.js';

interface CommitOptions {
  source: string;
  tags?: string;
  actor?: string;
}

function outputResult(result: CommitOutput, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result));
  } else {
    console.log(`Created commitment ${result.id}`);
    console.log(`Source: ${result.source}`);
  }
}

function outputError(error: MentuError, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ ...error.toJSON(), op: 'commit' }));
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
}

export function registerCommitCommand(program: Command): void {
  program
    .command('commit <body>')
    .description('Create a commitment')
    .requiredOption('-s, --source <id>', 'Source memory ID')
    .option('-t, --tags <tags>', 'Comma-separated tags')
    .option('--actor <id>', 'Override actor identity')
    .action((body: string, options: CommitOptions) => {
      const json = program.opts().json || false;

      try {
        const workspacePath = findWorkspace(process.cwd());
        const config = readConfig(workspacePath);
        const genesis = readGenesisKey(workspacePath);
        const actor = resolveActor(options.actor, config ?? undefined);
        const workspace = getWorkspaceName(workspacePath);
        const ledger = readLedger(workspacePath);

        // Validate body
        if (!body || body.trim() === '') {
          throw new MentuError('E_EMPTY_BODY', 'Body cannot be empty', {
            field: 'body',
          });
        }

        // Validate source exists
        if (!memoryExists(ledger, options.source)) {
          throw new MentuError(
            'E_REF_NOT_FOUND',
            `Source memory ${options.source} does not exist`,
            { field: 'source', value: options.source }
          );
        }

        const id = generateId('cmt');
        const ts = timestamp();

        // Parse tags
        const tags = options.tags
          ? options.tags.split(',').map((t) => t.trim())
          : undefined;

        const operation: CommitOperation = {
          id,
          op: 'commit',
          ts,
          actor,
          workspace,
          payload: {
            body: body.trim(),
            source: options.source,
          },
        };

        if (tags) {
          operation.payload.tags = tags;
        }

        // Validate with Genesis Key
        const validation = validateOperation(operation, ledger, genesis);
        if (!validation.valid && validation.error) {
          throw validation.error;
        }

        appendOperation(workspacePath, operation);

        const result: CommitOutput = {
          id,
          op: 'commit',
          ts,
          actor,
          body: body.trim(),
          source: options.source,
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
