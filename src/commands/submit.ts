import type { Command } from 'commander';
import type { CaptureOperation, SubmitOperation, ApproveOperation } from '../types.js';
import { MentuError } from '../types.js';
import { generateId } from '../utils/id.js';
import { timestamp } from '../utils/time.js';
import { resolveActor } from '../utils/actor.js';
import { findWorkspace, readConfig, getWorkspaceName } from '../core/config.js';
import { readLedger, appendOperation } from '../core/ledger.js';
import { readGenesisKey } from '../core/genesis.js';
import { validateOperation } from '../core/validate.js';
import { computeCommitmentState, getCommitment } from '../core/state.js';
import { execSync } from 'child_process';

interface SubmitOptions {
  summary?: string;
  evidence?: string;
  includeFiles?: boolean;
  includeTests?: boolean;
  actor?: string;
  tier?: string;
}

interface SubmitOutput {
  commitment: string;
  evidence: string[];
  summary: string;
  state: string;
  tier: string;
}

function gatherFileChanges(): string[] {
  try {
    const result = execSync('git diff --name-only HEAD~5 2>/dev/null || git diff --name-only', {
      encoding: 'utf-8',
      timeout: 10000,
    });
    return result.trim().split('\n').filter(Boolean).slice(0, 10);
  } catch {
    return [];
  }
}

function gatherTestResults(): { count: number; passing: boolean } {
  try {
    const result = execSync('npm test 2>&1 || true', {
      encoding: 'utf-8',
      timeout: 300000,
    });
    const lines = result.split('\n');
    const passCount = lines.filter(l => l.includes('✓') || l.includes('PASS')).length;
    const failCount = lines.filter(l => l.includes('✗') || l.includes('FAIL')).length;
    return { count: passCount, passing: failCount === 0 };
  } catch {
    return { count: 0, passing: false };
  }
}

function outputResult(result: SubmitOutput, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result));
  } else {
    console.log(`Submitted: ${result.commitment}`);
    console.log(`Evidence: ${result.evidence.join(', ')}`);
    console.log(`Summary: ${result.summary}`);
    console.log(`State: ${result.state}`);
    console.log(`Tier: ${result.tier}`);
    if (result.state === 'in_review') {
      console.log(`Note: Awaiting approval. Run 'mentu approve ${result.commitment}' to approve.`);
    }
  }
}

function outputError(error: MentuError, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ ...error.toJSON(), op: 'submit' }));
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
}

export function registerSubmitCommand(program: Command): void {
  program
    .command('submit <commitment>')
    .description('Submit a commitment for review (enters in_review state)')
    .option('-s, --summary <text>', 'Summary of work done')
    .option('-e, --evidence <ids>', 'Evidence memory IDs (comma-separated)')
    .option('--include-files', 'Include list of changed files in evidence')
    .option('--include-tests', 'Include test results in evidence')
    .option('--actor <id>', 'Override actor identity')
    .option('--tier <tier>', 'Validation tier (tier_1, tier_2, tier_3)', 'tier_2')
    .action(async (commitmentId: string, options: SubmitOptions) => {
      const json = program.opts().json || false;

      try {
        const workspacePath = findWorkspace(process.cwd());
        const config = readConfig(workspacePath);
        const genesis = readGenesisKey(workspacePath);
        const actor = resolveActor(options.actor, config ?? undefined);
        const workspace = getWorkspaceName(workspacePath);
        const ledger = readLedger(workspacePath);

        // Verify commitment exists and is claimed
        const commitment = getCommitment(ledger, commitmentId);
        if (!commitment) {
          throw new MentuError('E_REF_NOT_FOUND', `Commitment ${commitmentId} not found`);
        }

        const state = computeCommitmentState(ledger, commitmentId);
        if (state.state === 'closed') {
          throw new MentuError('E_ALREADY_CLOSED', `Commitment ${commitmentId} is already closed`);
        }
        if (state.state === 'in_review') {
          throw new MentuError('E_INVALID_OP', `Commitment ${commitmentId} is already in review`);
        }
        if (state.state !== 'claimed') {
          throw new MentuError('E_INVALID_OP', `Commitment ${commitmentId} must be claimed before submitting (state: ${state.state})`);
        }
        if (state.owner !== actor) {
          throw new MentuError('E_NOT_OWNER', `Only owner ${state.owner} can submit this commitment`);
        }

        // Build summary body
        const evidenceParts: string[] = [];

        if (options.summary) {
          evidenceParts.push(options.summary);
        } else {
          evidenceParts.push('Task completed.');
        }

        if (options.includeFiles) {
          const files = gatherFileChanges();
          if (files.length > 0) {
            evidenceParts.push(`Files changed: ${files.join(', ')}`);
          }
        }

        if (options.includeTests) {
          const tests = gatherTestResults();
          evidenceParts.push(`Tests: ${tests.count} passing${tests.passing ? '' : ' (some failures)'}`);
        }

        const evidenceBody = evidenceParts.join(' | ');

        let evidenceIds: string[] = [];
        let updatedLedger = ledger;

        if (options.evidence) {
          evidenceIds = options.evidence
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean);

          if (evidenceIds.length === 0) {
            throw new MentuError('E_MISSING_FIELD', 'submit requires evidence', { field: 'evidence' });
          }

          for (const evidenceId of evidenceIds) {
            const evidenceOp = updatedLedger.find((o) => o.op === 'capture' && o.id === evidenceId);
            if (!evidenceOp) {
              throw new MentuError('E_REF_NOT_FOUND', `Evidence memory ${evidenceId} not found`, {
                field: 'evidence',
                value: evidenceId,
              });
            }
          }
        } else {
          // Create evidence capture
          const evidenceId = generateId('mem');
          const evidenceTs = timestamp();

          const captureOp: CaptureOperation = {
            id: evidenceId,
            op: 'capture',
            ts: evidenceTs,
            actor,
            workspace,
            payload: {
              body: evidenceBody,
              kind: 'evidence',
            },
          };

          const captureValidation = validateOperation(captureOp, ledger, genesis);
          if (!captureValidation.valid && captureValidation.error) {
            throw captureValidation.error;
          }

          appendOperation(workspacePath, captureOp);
          evidenceIds = [evidenceId];

          // Re-read ledger with new capture
          updatedLedger = readLedger(workspacePath);
        }

        // Create submit operation (NOT close)
        const submitId = generateId('op');
        const submitTs = timestamp();
        const tier = options.tier || 'tier_2';

        const submitOp: SubmitOperation = {
          id: submitId,
          op: 'submit',
          ts: submitTs,
          actor,
          workspace,
          payload: {
            commitment: commitmentId,
            evidence: evidenceIds,
            summary: evidenceBody,
            tier,
          },
        };

        const submitValidation = validateOperation(submitOp, updatedLedger, genesis);
        if (!submitValidation.valid && submitValidation.error) {
          throw submitValidation.error;
        }

        appendOperation(workspacePath, submitOp);

        // For Tier 1, auto-approve immediately
        let finalState = 'in_review';
        if (tier === 'tier_1') {
          const approveOp: ApproveOperation = {
            id: generateId('op'),
            op: 'approve',
            ts: timestamp(),
            actor: 'system',
            workspace,
            payload: {
              commitment: commitmentId,
              auto: true,
              tier: 'tier_1',
            },
          };
          // Re-read ledger and append
          const ledgerWithSubmit = readLedger(workspacePath);
          const approveValidation = validateOperation(approveOp, ledgerWithSubmit, genesis);
          if (approveValidation.valid) {
            appendOperation(workspacePath, approveOp);
            finalState = 'closed';
          }
        }

        const result: SubmitOutput = {
          commitment: commitmentId,
          evidence: evidenceIds,
          summary: evidenceBody,
          state: finalState,
          tier,
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
