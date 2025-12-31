import type { Command } from 'commander';
import { MentuError } from '../types.js';
import { findWorkspace, readConfig } from '../core/config.js';
import { readLedger } from '../core/ledger.js';
import { getCommitment } from '../core/state.js';
import { getCommitmentsWithExternalRef } from '../core/external.js';
import { GitHubClient, buildGitHubConfig } from '../integrations/github/index.js';
import type { PullSyncResult, SyncWarning } from '../integrations/github/types.js';

interface PullOptions {
  github?: boolean;
  dryRun?: boolean;
}

function outputResult(result: PullSyncResult, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result));
  } else {
    console.log(`Synced: ${result.synced} commitments`);

    if (result.warnings.length > 0) {
      console.log('\nWarnings:');
      for (const warning of result.warnings) {
        console.log(`  - ${warning.commitment}: Issue #${warning.issue} - ${warning.reason} (${warning.action})`);
      }
    }

    if (result.errors.length > 0) {
      console.log('\nErrors:');
      for (const error of result.errors) {
        console.log(`  - ${error.commitment}: ${error.error}`);
      }
    }
  }
}

function outputError(error: MentuError, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ ...error.toJSON(), op: 'pull' }));
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
}

export function registerPullCommand(program: Command): void {
  program
    .command('pull')
    .description('Sync state from external systems')
    .option('--github', 'Sync from GitHub')
    .option('--dry-run', 'Show what would happen without making changes')
    .action(async (options: PullOptions) => {
      const json = program.opts().json || false;

      try {
        // Default to GitHub if no system specified
        if (!options.github) {
          options.github = true;
        }

        const workspacePath = findWorkspace(process.cwd());
        const config = readConfig(workspacePath);
        const ledger = readLedger(workspacePath);

        // Build GitHub config from env
        const githubConfig = buildGitHubConfig(config?.integrations?.github);
        if (!githubConfig) {
          throw new MentuError(
            'E_GITHUB_NOT_CONFIGURED',
            'GitHub integration not configured. Set GITHUB_ENABLED=true, GITHUB_OWNER, and GITHUB_REPO'
          );
        }

        const client = new GitHubClient(githubConfig);

        // Find all commitments with GitHub external refs
        const linkedCommitments = getCommitmentsWithExternalRef(ledger, 'github');

        const result: PullSyncResult = {
          synced: 0,
          warnings: [],
          errors: [],
        };

        for (const { commitmentId, ref } of linkedCommitments) {
          try {
            // Get commitment state
            const commitment = getCommitment(ledger, commitmentId);
            if (!commitment) {
              result.errors.push({
                commitment: commitmentId,
                error: 'Commitment not found in ledger',
              });
              continue;
            }

            // Get issue state from GitHub
            const issueNumber = parseInt(ref.id, 10);
            const issue = await client.getIssue(issueNumber);

            // Check for unauthorized close
            // CRITICAL: NEVER close the commitment here.
            // GitHub cannot bypass the evidence requirement.
            if (issue.state === 'closed' && commitment.state !== 'closed') {
              const warning: SyncWarning = {
                commitment: commitmentId,
                issue: issueNumber,
                action: 'ignore',
                reason: 'Issue closed without evidence',
              };

              if (!options.dryRun) {
                // Handle based on config
                const handled = await client.handleUnauthorizedClose(issueNumber, commitmentId);
                warning.action = handled.action;
              } else {
                // Dry run - show what would happen
                warning.action = githubConfig.sync.pull.on_issue_closed;
              }

              result.warnings.push(warning);
            }

            result.synced++;
          } catch (err) {
            if (err instanceof MentuError) {
              result.errors.push({
                commitment: commitmentId,
                error: err.message,
              });
            } else {
              result.errors.push({
                commitment: commitmentId,
                error: err instanceof Error ? err.message : 'Unknown error',
              });
            }
          }
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
