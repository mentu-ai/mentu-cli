import type { Command } from 'commander';
import type { ReopenOperation } from '../types.js';
import { MentuError } from '../types.js';
import { generateId } from '../utils/id.js';
import { timestamp } from '../utils/time.js';
import { resolveActor } from '../utils/actor.js';
import { findWorkspace, readConfig, getWorkspaceName } from '../core/config.js';
import { readLedger, appendOperation } from '../core/ledger.js';
import { readGenesisKey } from '../core/genesis.js';
import { validateOperation } from '../core/validate.js';
import { computeCommitmentState, getCommitment } from '../core/state.js';

interface ReopenOptions {
  reason: string;
  actor?: string;
}

interface ReopenOutput {
  commitment: string;
  state: string;
  reason: string;
  from_state: string;
}

function outputResult(result: ReopenOutput, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result));
  } else {
    console.log(`Reopened: ${result.commitment}`);
    console.log(`Reason: ${result.reason}`);
    console.log(`From state: ${result.from_state}`);
    console.log(`Status: reopened (can be reclaimed)`);
  }
}

function outputError(error: MentuError, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ ...error.toJSON(), op: 'reopen' }));
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
}

export function registerReopenCommand(program: Command): void {
  program
    .command('reopen <commitment>')
    .description('Reopen a submitted or closed commitment (dispute or request rework)')
    .requiredOption('-r, --reason <reason>', 'Reason for reopening (required)')
    .option('--actor <id>', 'Override actor identity')
    .action(async (commitmentId: string, options: ReopenOptions) => {
      const json = program.opts().json || false;

      try {
        const workspacePath = findWorkspace(process.cwd());
        const config = readConfig(workspacePath);
        const genesis = readGenesisKey(workspacePath);
        const actor = resolveActor(options.actor, config ?? undefined);
        const workspace = getWorkspaceName(workspacePath);
        const ledger = readLedger(workspacePath);

        // Verify commitment exists
        const commitment = getCommitment(ledger, commitmentId);
        if (!commitment) {
          throw new MentuError('E_REF_NOT_FOUND', `Commitment ${commitmentId} not found`);
        }

        // Verify commitment is in in_review or closed state
        const state = computeCommitmentState(ledger, commitmentId);
        if (state.state !== 'in_review' && state.state !== 'closed') {
          throw new MentuError(
            'E_INVALID_OP',
            `Commitment ${commitmentId} cannot be reopened (state: ${state.state}). Can only reopen in_review or closed commitments.`
          );
        }

        // Create reopen operation
        const reopenOp: ReopenOperation = {
          id: generateId('op'),
          op: 'reopen',
          ts: timestamp(),
          actor,
          workspace,
          payload: {
            commitment: commitmentId,
            reason: options.reason,
            from_state: state.state as 'in_review' | 'closed',
          },
        };

        const validation = validateOperation(reopenOp, ledger, genesis);
        if (!validation.valid && validation.error) {
          throw validation.error;
        }

        appendOperation(workspacePath, reopenOp);

        const result: ReopenOutput = {
          commitment: commitmentId,
          state: 'reopened',
          reason: options.reason,
          from_state: state.state,
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
