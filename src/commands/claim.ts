import type { Command } from 'commander';
import type { ClaimOperation, ClaimOutput } from '../types.js';
import { MentuError } from '../types.js';
import { generateId } from '../utils/id.js';
import { timestamp } from '../utils/time.js';
import { resolveActor } from '../utils/actor.js';
import { findWorkspace, readConfig, getWorkspaceName } from '../core/config.js';
import { readLedger, appendOperation } from '../core/ledger.js';
import { commitmentExists, computeCommitmentState } from '../core/state.js';
import { readGenesisKey } from '../core/genesis.js';
import { validateOperation } from '../core/validate.js';
import { getExternalRef } from '../core/external.js';
import { GitHubClient, buildGitHubConfig } from '../integrations/github/index.js';

interface ClaimOptions {
  actor?: string;
}

function outputResult(result: ClaimOutput, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result));
  } else {
    console.log(`Claimed commitment ${result.commitment}`);
  }
}

function outputError(error: MentuError, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ ...error.toJSON(), op: 'claim' }));
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
}

export function registerClaimCommand(program: Command): void {
  program
    .command('claim <commitment>')
    .description('Take responsibility for a commitment')
    .option('--actor <id>', 'Override actor identity')
    .action(async (commitmentId: string, options: ClaimOptions) => {
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
            `Commitment ${commitmentId} is closed`,
            { commitment: commitmentId }
          );
        }

        if (state.owner && state.owner !== actor) {
          throw new MentuError(
            'E_ALREADY_CLAIMED',
            `Commitment ${commitmentId} is claimed by ${state.owner}`,
            { commitment: commitmentId, owner: state.owner }
          );
        }

        const id = generateId('op');
        const ts = timestamp();

        const operation: ClaimOperation = {
          id,
          op: 'claim',
          ts,
          actor,
          workspace,
          payload: {
            commitment: commitmentId,
          },
        };

        // Validate with Genesis Key
        const validation = validateOperation(operation, ledger, genesis);
        if (!validation.valid && validation.error) {
          throw validation.error;
        }

        appendOperation(workspacePath, operation);

        // Sync to GitHub if enabled
        const githubConfig = buildGitHubConfig(config?.integrations?.github);
        if (githubConfig?.sync.push.on_claim) {
          const ref = getExternalRef(ledger, commitmentId, 'github');
          if (ref) {
            try {
              const client = new GitHubClient(githubConfig);
              const issueNumber = parseInt(ref.id, 10);
              await client.assignIssue(issueNumber, actor);

              // Sync project status to "In Progress"
              if (githubConfig.project) {
                const issue = await client.getIssue(issueNumber);
                await client.syncProjectStatus(issueNumber, issue.node_id, 'claimed');
              }
            } catch (syncErr) {
              // Log warning but don't fail the claim
              console.error(`Warning: Failed to sync claim to GitHub: ${syncErr instanceof Error ? syncErr.message : 'Unknown error'}`);
            }
          }
        }

        const result: ClaimOutput = {
          id,
          op: 'claim',
          ts,
          actor,
          commitment: commitmentId,
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
