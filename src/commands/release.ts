import type { Command } from 'commander';
import type { ReleaseOperation, ReleaseOutput } from '../types.js';
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

interface ReleaseOptions {
  reason?: string;
  actor?: string;
}

function outputResult(result: ReleaseOutput, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result));
  } else {
    console.log(`Released commitment ${result.commitment}`);
    if (result.reason) {
      console.log(`Reason: ${result.reason}`);
    }
  }
}

function outputError(error: MentuError, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ ...error.toJSON(), op: 'release' }));
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
}

export function registerReleaseCommand(program: Command): void {
  program
    .command('release <commitment>')
    .description('Give up responsibility for a commitment')
    .option('-r, --reason <reason>', 'Reason for releasing')
    .option('--actor <id>', 'Override actor identity')
    .action(async (commitmentId: string, options: ReleaseOptions) => {
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

        if (state.owner !== actor) {
          throw new MentuError(
            'E_NOT_OWNER',
            `Actor ${actor} is not the owner of commitment ${commitmentId}`,
            { commitment: commitmentId, owner: state.owner, actor }
          );
        }

        const id = generateId('op');
        const ts = timestamp();

        const operation: ReleaseOperation = {
          id,
          op: 'release',
          ts,
          actor,
          workspace,
          payload: {
            commitment: commitmentId,
          },
        };

        if (options.reason) {
          operation.payload.reason = options.reason;
        }

        // Validate with Genesis Key
        const validation = validateOperation(operation, ledger, genesis);
        if (!validation.valid && validation.error) {
          throw validation.error;
        }

        appendOperation(workspacePath, operation);

        // Sync to GitHub if enabled
        const githubConfig = buildGitHubConfig(config?.integrations?.github);
        if (githubConfig?.sync.push.on_release) {
          const ref = getExternalRef(ledger, commitmentId, 'github');
          if (ref) {
            try {
              const client = new GitHubClient(githubConfig);
              await client.unassignIssue(parseInt(ref.id, 10));
            } catch (syncErr) {
              // Log warning but don't fail the release
              console.error(`Warning: Failed to sync release to GitHub: ${syncErr instanceof Error ? syncErr.message : 'Unknown error'}`);
            }
          }
        }

        const result: ReleaseOutput = {
          id,
          op: 'release',
          ts,
          actor,
          commitment: commitmentId,
        };

        if (options.reason) {
          result.reason = options.reason;
        }

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
