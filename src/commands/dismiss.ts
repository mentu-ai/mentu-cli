import type { Command } from 'commander';
import type { DismissOperation, DismissOutput } from '../types.js';
import { MentuError } from '../types.js';
import { generateId } from '../utils/id.js';
import { timestamp } from '../utils/time.js';
import { resolveActor } from '../utils/actor.js';
import { findWorkspace, readConfig, getWorkspaceName } from '../core/config.js';
import { readLedger, appendOperation } from '../core/ledger.js';
import { readGenesisKey } from '../core/genesis.js';
import { validateOperation } from '../core/validate.js';

interface DismissOptions {
  reason: string;
  tags?: string;
  actor?: string;
}

function outputResult(result: DismissOutput, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result));
  } else {
    console.log(`Dismissed memory ${result.memory}`);
    console.log(`Reason: ${result.reason}`);
  }
}

function outputError(error: MentuError, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ ...error.toJSON(), op: 'dismiss' }));
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
}

export function registerDismissCommand(program: Command): void {
  program
    .command('dismiss <memory>')
    .description('Dismiss a memory as not actionable')
    .requiredOption('-r, --reason <text>', 'Why this memory is not actionable')
    .option('-t, --tags <tags>', 'Comma-separated tags for categorization')
    .option('--actor <id>', 'Override actor identity')
    .action((memory: string, options: DismissOptions) => {
      const json = program.opts().json || false;

      try {
        const workspacePath = findWorkspace(process.cwd());
        const config = readConfig(workspacePath);
        const genesis = readGenesisKey(workspacePath);
        const actor = resolveActor(options.actor, config ?? undefined);
        const workspace = getWorkspaceName(workspacePath);
        const ledger = readLedger(workspacePath);

        const id = generateId('op');
        const ts = timestamp();

        // Parse tags if provided
        const tags = options.tags ? options.tags.split(',').map(t => t.trim()) : undefined;

        const operation: DismissOperation = {
          id,
          op: 'dismiss',
          ts,
          actor,
          workspace,
          payload: {
            memory,
            reason: options.reason,
            ...(tags && { tags }),
          },
        };

        // Validate operation
        const validation = validateOperation(operation, ledger, genesis);
        if (!validation.valid && validation.error) {
          throw validation.error;
        }

        appendOperation(workspacePath, operation);

        const result: DismissOutput = {
          id,
          op: 'dismiss',
          ts,
          actor,
          memory,
          reason: options.reason,
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
