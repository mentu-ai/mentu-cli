import type { Command } from 'commander';
import type { TriageOperation, TriageOutput } from '../types.js';
import { MentuError } from '../types.js';
import { generateId } from '../utils/id.js';
import { timestamp } from '../utils/time.js';
import { resolveActor } from '../utils/actor.js';
import { findWorkspace, readConfig, getWorkspaceName } from '../core/config.js';
import { readLedger, appendOperation } from '../core/ledger.js';
import { readGenesisKey } from '../core/genesis.js';
import { validateOperation } from '../core/validate.js';

interface TriageOptions {
  reviewed: string;
  summary: string;
  actor?: string;
}

function outputResult(result: TriageOutput, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result));
  } else {
    console.log(`Recorded triage session`);
    console.log(`Reviewed: ${result.reviewed_count} memories`);
    console.log(`Summary: ${result.summary}`);
  }
}

function outputError(error: MentuError, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ ...error.toJSON(), op: 'triage' }));
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
}

export function registerTriageCommand(program: Command): void {
  program
    .command('triage')
    .description('Record a triage session')
    .requiredOption('--reviewed <ids>', 'Comma-separated memory IDs that were reviewed')
    .requiredOption('--summary <text>', 'Summary of triage decisions')
    .option('--actor <id>', 'Override actor identity')
    .action((options: TriageOptions) => {
      const json = program.opts().json || false;

      try {
        const workspacePath = findWorkspace(process.cwd());
        const config = readConfig(workspacePath);
        const genesis = readGenesisKey(workspacePath);
        const actor = resolveActor(options.actor, config ?? undefined);
        const workspace = getWorkspaceName(workspacePath);
        const ledger = readLedger(workspacePath);

        // Parse reviewed memory IDs
        const reviewed = options.reviewed.split(',').map(id => id.trim());

        const id = generateId('op');
        const ts = timestamp();

        const operation: TriageOperation = {
          id,
          op: 'triage',
          ts,
          actor,
          workspace,
          payload: {
            reviewed,
            summary: options.summary,
            decisions: [], // Decisions recorded separately via link/dismiss ops
          },
        };

        // Validate operation
        const validation = validateOperation(operation, ledger, genesis);
        if (!validation.valid && validation.error) {
          throw validation.error;
        }

        appendOperation(workspacePath, operation);

        const result: TriageOutput = {
          id,
          op: 'triage',
          ts,
          actor,
          reviewed_count: reviewed.length,
          summary: options.summary,
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
