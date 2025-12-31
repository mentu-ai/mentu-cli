import type { Command } from 'commander';
import type { CloseOperation, CloseOutput } from '../types.js';
import { MentuError } from '../types.js';
import { generateId } from '../utils/id.js';
import { timestamp } from '../utils/time.js';
import { resolveActor } from '../utils/actor.js';
import { findWorkspace, readConfig, getWorkspaceName } from '../core/config.js';
import { readLedger, appendOperation } from '../core/ledger.js';
import { commitmentExists, memoryExists, computeCommitmentState, getCommitment, getMemory } from '../core/state.js';
import { readGenesisKey } from '../core/genesis.js';
import { validateOperation } from '../core/validate.js';
import { getExternalRef } from '../core/external.js';
import { GitHubClient, buildGitHubConfig, formatEvidenceComment } from '../integrations/github/index.js';

interface CloseOptions {
  evidence?: string;
  duplicateOf?: string;
  actor?: string;
}

function outputResult(result: CloseOutput, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result));
  } else {
    console.log(`Closed commitment ${result.commitment}`);
    console.log(`Evidence: ${result.evidence}`);
  }
}

function outputError(error: MentuError, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ ...error.toJSON(), op: 'close' }));
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
}

export function registerCloseCommand(program: Command): void {
  program
    .command('close <commitment>')
    .description('Resolve a commitment with evidence or as duplicate')
    .option('-e, --evidence <id>', 'Evidence memory ID')
    .option('-d, --duplicate-of <id>', 'Close as duplicate of another commitment')
    .option('--actor <id>', 'Override actor identity')
    .action(async (commitmentId: string, options: CloseOptions) => {
      const json = program.opts().json || false;

      try {
        // Validate that exactly one of evidence or duplicate-of is provided
        if (!options.evidence && !options.duplicateOf) {
          throw new MentuError(
            'E_MISSING_FIELD',
            'Must specify --evidence or --duplicate-of',
            { field: 'evidence' }
          );
        }

        if (options.evidence && options.duplicateOf) {
          throw new MentuError(
            'E_INVALID_OP',
            'Cannot specify both --evidence and --duplicate-of'
          );
        }

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

        // Validate evidence exists (only for normal close)
        if (options.evidence && !memoryExists(ledger, options.evidence)) {
          throw new MentuError(
            'E_REF_NOT_FOUND',
            `Evidence memory ${options.evidence} does not exist`,
            { field: 'evidence', value: options.evidence }
          );
        }

        // Validate duplicate target exists (only for duplicate close)
        if (options.duplicateOf && !commitmentExists(ledger, options.duplicateOf)) {
          throw new MentuError(
            'E_REF_NOT_FOUND',
            `Duplicate target commitment ${options.duplicateOf} does not exist`,
            { field: 'duplicate_of', value: options.duplicateOf }
          );
        }

        // Check state constraints
        const state = computeCommitmentState(ledger, commitmentId);

        if (state.state === 'closed' || state.state === 'duplicate') {
          throw new MentuError(
            'E_ALREADY_CLOSED',
            `Commitment ${commitmentId} is closed`,
            { commitment: commitmentId }
          );
        }

        const id = generateId('op');
        const ts = timestamp();

        const operation: CloseOperation = {
          id,
          op: 'close',
          ts,
          actor,
          workspace,
          payload: {
            commitment: commitmentId,
            ...(options.evidence && { evidence: options.evidence }),
            ...(options.duplicateOf && { duplicate_of: options.duplicateOf }),
          },
        };

        // Validate with Genesis Key (includes constraint checks)
        const validation = validateOperation(operation, ledger, genesis);
        if (!validation.valid && validation.error) {
          throw validation.error;
        }

        appendOperation(workspacePath, operation);

        // Sync to GitHub if enabled (only for normal closes with evidence)
        if (options.evidence) {
          const githubConfig = buildGitHubConfig(config?.integrations?.github);
          if (githubConfig?.sync.push.on_close) {
            const ref = getExternalRef(ledger, commitmentId, 'github');
            if (ref) {
              try {
                const client = new GitHubClient(githubConfig);
                const commitment = getCommitment(ledger, commitmentId);
                const evidence = getMemory(ledger, options.evidence);
                const issueNumber = parseInt(ref.id, 10);

                if (commitment && evidence) {
                  // Update the commitment's closed_by for the comment
                  const updatedCommitment = { ...commitment, closed_by: actor };
                  const comment = formatEvidenceComment(updatedCommitment, evidence);
                  await client.closeIssueWithEvidence(issueNumber, comment);

                  // Sync project status to "Done"
                  if (githubConfig.project) {
                    const issue = await client.getIssue(issueNumber);
                    await client.syncProjectStatus(issueNumber, issue.node_id, 'closed');
                  }
                }
              } catch (syncErr) {
                // Log warning but don't fail the close
                console.error(`Warning: Failed to sync close to GitHub: ${syncErr instanceof Error ? syncErr.message : 'Unknown error'}`);
              }
            }
          }
        }

        const result: CloseOutput = {
          id,
          op: 'close',
          ts,
          actor,
          commitment: commitmentId,
          evidence: options.evidence || '',
        };

        if (options.duplicateOf) {
          if (json) {
            console.log(JSON.stringify({
              ...result,
              evidence: undefined,
              duplicate_of: options.duplicateOf,
            }));
          } else {
            console.log(`Closed commitment ${commitmentId} as duplicate of ${options.duplicateOf}`);
          }
        } else {
          outputResult(result, json);
        }
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
