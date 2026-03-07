// Cancel command for marking commitments as cancelled (Temporal Primitives v1.0)
import type { Command } from 'commander';
import type { CancelOperation, CancelOutput } from '../types.js';
import { MentuError } from '../types.js';
import { generateId } from '../utils/id.js';
import { timestamp } from '../utils/time.js';
import { resolveActor } from '../utils/actor.js';
import { findWorkspace, readConfig, getWorkspaceName } from '../core/config.js';
import { readLedger, appendOperation } from '../core/ledger.js';
import { commitmentExists, computeCommitmentState } from '../core/state.js';
import { readGenesisKey } from '../core/genesis.js';
import { validateOperation } from '../core/validate.js';

type CancellationReason = 'manual' | 'superseded' | 'missed_window' | 'dependency_failed';

interface CancelOptions {
  reason: string;
  actor?: string;
}

function outputResult(result: CancelOutput, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result));
  } else {
    console.log(`Cancelled commitment ${result.commitment}`);
    console.log(`Reason: ${result.reason}`);
  }
}

function outputError(error: MentuError, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ ...error.toJSON(), op: 'cancel' }));
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
}

export function registerCancelCommand(program: Command): void {
  program
    .command('cancel <commitment>')
    .description('Cancel a commitment (permanently exclude from scheduling)')
    .requiredOption('--reason <reason>', 'Cancellation reason: manual, superseded, missed_window, dependency_failed')
    .option('--actor <id>', 'Override actor identity')
    .action((commitmentId: string, options: CancelOptions) => {
      const json = program.opts().json || false;

      try {
        const workspacePath = findWorkspace(process.cwd());
        const config = readConfig(workspacePath);
        const genesis = readGenesisKey(workspacePath);
        const actor = resolveActor(options.actor, config ?? undefined);
        const workspace = getWorkspaceName(workspacePath);
        const ledger = readLedger(workspacePath);

        // Validate commitment exists
        if (!commitmentExists(ledger, commitmentId)) {
          throw new MentuError(
            'E_REF_NOT_FOUND',
            `Commitment ${commitmentId} does not exist`,
            { field: 'commitment', value: commitmentId }
          );
        }

        // Check state constraints
        const state = computeCommitmentState(ledger, commitmentId);

        if (state.state === 'closed') {
          throw new MentuError(
            'E_ALREADY_CLOSED',
            `Commitment ${commitmentId} is already closed`,
            { commitment: commitmentId }
          );
        }

        // Validate reason
        const validReasons: CancellationReason[] = ['manual', 'superseded', 'missed_window', 'dependency_failed'];
        if (!validReasons.includes(options.reason as CancellationReason)) {
          throw new MentuError(
            'E_INVALID_OP',
            `Invalid cancellation reason: ${options.reason}. Must be one of: ${validReasons.join(', ')}`,
            { field: 'reason', value: options.reason }
          );
        }

        const id = generateId('op');
        const ts = timestamp();
        const reason = options.reason as CancellationReason;

        const operation: CancelOperation = {
          id,
          op: 'cancel',
          ts,
          actor,
          workspace,
          payload: {
            commitment: commitmentId,
            reason,
          },
        };

        // Validate with Genesis Key
        const validation = validateOperation(operation, ledger, genesis);
        if (!validation.valid && validation.error) {
          throw validation.error;
        }

        appendOperation(workspacePath, operation);

        const result: CancelOutput = {
          id,
          op: 'cancel',
          ts,
          actor,
          commitment: commitmentId,
          reason,
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
