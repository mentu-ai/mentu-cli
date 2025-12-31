import type { Command } from 'commander';
import type { AnnotateOperation, ExternalRef } from '../types.js';
import { MentuError } from '../types.js';
import { generateId } from '../utils/id.js';
import { timestamp } from '../utils/time.js';
import { resolveActor } from '../utils/actor.js';
import { findWorkspace, readConfig, getWorkspaceName } from '../core/config.js';
import { readLedger, appendOperation } from '../core/ledger.js';
import { getCommitment, getMemory } from '../core/state.js';
import { getExternalRef } from '../core/external.js';
import { readGenesisKey } from '../core/genesis.js';
import { validateOperation } from '../core/validate.js';
import {
  GitHubClient,
  buildGitHubConfig,
  formatIssueBody,
  formatIssueTitle,
  mapTagsToLabels,
} from '../integrations/github/index.js';

interface PushOptions {
  to: string;
  project?: string;
  dryRun?: boolean;
  actor?: string;
}

interface PushOutput {
  id?: string;
  op: 'annotate';
  commitment: string;
  action: 'created' | 'updated';
  external_ref: ExternalRef;
  dry_run?: boolean;
}

function outputResult(result: PushOutput, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result));
  } else {
    if (result.dry_run) {
      console.log(`[DRY RUN] Would ${result.action} GitHub issue for commitment ${result.commitment}`);
    } else {
      console.log(`${result.action === 'created' ? 'Created' : 'Updated'} GitHub issue #${result.external_ref.id}`);
      console.log(`URL: ${result.external_ref.url}`);
    }
  }
}

function outputError(error: MentuError, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ ...error.toJSON(), op: 'push' }));
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
}

export function registerPushCommand(program: Command): void {
  program
    .command('push <commitment>')
    .description('Push a commitment to an external system')
    .requiredOption('--to <system>', 'Target system (github)')
    .option('--project <name>', 'Add to GitHub Project')
    .option('--dry-run', 'Show what would happen without making changes')
    .option('--actor <id>', 'Override actor identity')
    .action(async (commitmentId: string, options: PushOptions) => {
      const json = program.opts().json || false;

      try {
        if (options.to !== 'github') {
          throw new MentuError(
            'E_INVALID_OP',
            `Unsupported target system: ${options.to}. Only 'github' is supported.`,
            { value: options.to }
          );
        }

        const workspacePath = findWorkspace(process.cwd());
        const config = readConfig(workspacePath);
        const genesis = readGenesisKey(workspacePath);
        const actor = resolveActor(options.actor, config ?? undefined);
        const workspace = getWorkspaceName(workspacePath);
        const ledger = readLedger(workspacePath);

        // Get commitment
        const commitment = getCommitment(ledger, commitmentId);
        if (!commitment) {
          throw new MentuError(
            'E_REF_NOT_FOUND',
            `Commitment ${commitmentId} does not exist`,
            { field: 'commitment', value: commitmentId }
          );
        }

        // Get source memory
        const memory = getMemory(ledger, commitment.source);
        if (!memory) {
          throw new MentuError(
            'E_REF_NOT_FOUND',
            `Source memory ${commitment.source} not found`,
            { field: 'source', value: commitment.source }
          );
        }

        // Build GitHub config from env
        const githubConfig = buildGitHubConfig(config?.integrations?.github);
        if (!githubConfig) {
          throw new MentuError(
            'E_GITHUB_NOT_CONFIGURED',
            'GitHub integration not configured. Set GITHUB_ENABLED=true, GITHUB_OWNER, and GITHUB_REPO'
          );
        }

        // Check if already linked
        const existingRef = getExternalRef(ledger, commitmentId, 'github');
        const isUpdate = existingRef !== null;

        if (options.dryRun) {
          // Dry run - just show what would happen
          const result: PushOutput = {
            op: 'annotate',
            commitment: commitmentId,
            action: isUpdate ? 'updated' : 'created',
            external_ref: existingRef ?? {
              system: 'github',
              type: 'issue',
              id: '<new>',
              url: `https://github.com/${githubConfig.owner}/${githubConfig.repo}/issues/<new>`,
              synced_at: timestamp(),
            },
            dry_run: true,
          };

          outputResult(result, json);
          return;
        }

        const client = new GitHubClient(githubConfig);
        const title = formatIssueTitle(commitment.body);
        const body = formatIssueBody(commitment, memory);
        const labels = mapTagsToLabels(commitment.tags);

        let externalRef: ExternalRef;

        if (isUpdate) {
          // Update existing issue
          const issueNumber = parseInt(existingRef.id, 10);
          await client.updateIssue(issueNumber, { title, body, labels });

          externalRef = {
            ...existingRef,
            synced_at: timestamp(),
          };

          const result: PushOutput = {
            op: 'annotate',
            commitment: commitmentId,
            action: 'updated',
            external_ref: externalRef,
          };

          outputResult(result, json);
        } else {
          // Create new issue
          const assignee = commitment.owner ?? undefined;
          const issue = await client.createIssue({ title, body, labels, assignee });

          externalRef = {
            system: 'github',
            type: 'issue',
            id: String(issue.number),
            url: issue.html_url,
            synced_at: timestamp(),
          };

          // Create annotate operation to store external ref
          const id = generateId('op');
          const ts = timestamp();

          const operation: AnnotateOperation = {
            id,
            op: 'annotate',
            ts,
            actor,
            workspace,
            payload: {
              target: commitmentId,
              body: `Pushed to GitHub issue #${issue.number}`,
              meta: {
                kind: 'external_ref',
                external_ref: externalRef,
              },
            },
          };

          // Validate with Genesis Key
          const validation = validateOperation(operation, ledger, genesis);
          if (!validation.valid && validation.error) {
            throw validation.error;
          }

          appendOperation(workspacePath, operation);

          const result: PushOutput = {
            id,
            op: 'annotate',
            commitment: commitmentId,
            action: 'created',
            external_ref: externalRef,
          };

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
