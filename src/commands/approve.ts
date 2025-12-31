import type { Command } from 'commander';
import type { ApproveOperation } from '../types.js';
import { MentuError } from '../types.js';
import { generateId } from '../utils/id.js';
import { timestamp } from '../utils/time.js';
import { resolveActor } from '../utils/actor.js';
import { findWorkspace, readConfig, getWorkspaceName } from '../core/config.js';
import { readLedger, appendOperation } from '../core/ledger.js';
import { readGenesisKey } from '../core/genesis.js';
import { validateOperation } from '../core/validate.js';
import { computeCommitmentState, getCommitment } from '../core/state.js';

interface ApproveOptions {
  comment?: string;
  actor?: string;
}

interface ApproveOutput {
  commitment: string;
  state: string;
  comment?: string;
}

function outputResult(result: ApproveOutput, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result));
  } else {
    console.log(`Approved: ${result.commitment}`);
    console.log(`Status: ${result.state}`);
    if (result.comment) {
      console.log(`Comment: ${result.comment}`);
    }
  }
}

function outputError(error: MentuError, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ ...error.toJSON(), op: 'approve' }));
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
}

export function registerApproveCommand(program: Command): void {
  program
    .command('approve <commitment>')
    .description('Approve a submitted commitment (transition from in_review to closed)')
    .option('-c, --comment <text>', 'Optional approval comment')
    .option('--actor <id>', 'Override actor identity')
    .action(async (commitmentId: string, options: ApproveOptions) => {
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

        // Verify commitment is in in_review state
        const state = computeCommitmentState(ledger, commitmentId);
        if (state.state !== 'in_review') {
          throw new MentuError(
            'E_INVALID_OP',
            `Commitment ${commitmentId} is not in review (state: ${state.state}). Can only approve in_review commitments.`
          );
        }

        // Create approve operation
        const approveOp: ApproveOperation = {
          id: generateId('op'),
          op: 'approve',
          ts: timestamp(),
          actor,
          workspace,
          payload: {
            commitment: commitmentId,
            comment: options.comment,
          },
        };

        const validation = validateOperation(approveOp, ledger, genesis);
        if (!validation.valid && validation.error) {
          throw validation.error;
        }

        appendOperation(workspacePath, approveOp);

        const result: ApproveOutput = {
          commitment: commitmentId,
          state: 'closed',
          comment: options.comment,
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
