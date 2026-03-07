/**
 * Spawn Command
 *
 * Queue a commitment for remote execution on the bridge daemon.
 * Uses the proxy's /bridge/spawn endpoint to insert a command.
 */

import type { Command } from 'commander';
import { MentuError } from '../types.js';
import { findWorkspace, readConfig } from '../core/config.js';
import { readLedger } from '../core/ledger.js';
import { getCommitment, computeCommitmentState } from '../core/state.js';

interface SpawnOptions {
  status?: string;          // Check status of a command
  dryRun?: boolean;         // Preview without executing
  directory?: string;       // Override working directory
  flags?: string;           // Additional Claude flags (comma-separated)
  approvalRequired?: boolean;
  onApprove?: string;       // Command to run after approval
  actor?: string;
  noWorktree?: boolean;     // Disable worktree creation (worktree is default)
}

interface SpawnResponse {
  command_id: string;
  status: string;
  commitment_id: string;
  handoff_path: string | null;
  prompt_preview: string;
}

interface DryRunResponse {
  dry_run: boolean;
  commitment_id: string;
  handoff_path: string | null;
  prompt_preview: string;
  working_directory?: string;
  approval_required: boolean;
}

interface CommandStatus {
  id: string;
  status: string;
  prompt?: string;
  working_directory?: string;
  created_at?: string;
  started_at?: string;
  completed_at?: string;
  exit_code?: number;
  approval_status?: string;
}

function outputResult(result: SpawnResponse | DryRunResponse, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result));
  } else {
    if ('dry_run' in result && result.dry_run) {
      console.log('[DRY RUN] Would spawn command:');
      console.log(`  Commitment: ${result.commitment_id}`);
      console.log(`  HANDOFF: ${result.handoff_path || 'none (using commitment body)'}`);
      console.log(`  Prompt preview: ${result.prompt_preview.substring(0, 100)}...`);
      if (result.working_directory) {
        console.log(`  Working directory: ${result.working_directory}`);
      }
      console.log(`  Approval required: ${result.approval_required}`);
    } else {
      const spawnResult = result as SpawnResponse;
      console.log(`Spawned command: ${spawnResult.command_id}`);
      console.log(`  Status: ${spawnResult.status}`);
      console.log(`  Commitment: ${spawnResult.commitment_id}`);
      console.log(`  HANDOFF: ${spawnResult.handoff_path || 'none'}`);
      console.log(`\nCheck status with: mentu spawn --status ${spawnResult.command_id}`);
    }
  }
}

function outputStatus(status: CommandStatus, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(status));
  } else {
    console.log(`Command: ${status.id}`);
    console.log(`  Status: ${status.status}`);
    if (status.created_at) {
      console.log(`  Created: ${status.created_at}`);
    }
    if (status.started_at) {
      console.log(`  Started: ${status.started_at}`);
    }
    if (status.completed_at) {
      console.log(`  Completed: ${status.completed_at}`);
    }
    if (status.exit_code !== undefined) {
      console.log(`  Exit code: ${status.exit_code}`);
    }
    if (status.approval_status) {
      console.log(`  Approval: ${status.approval_status}`);
    }
  }
}

function outputError(error: MentuError, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ ...error.toJSON(), op: 'spawn' }));
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
}

async function getProxyConfig(workspacePath: string): Promise<{ url: string; token: string }> {
  // Check environment variables first
  const envUrl = process.env.MENTU_API_URL || process.env.MENTU_PROXY_URL;
  const envToken = process.env.MENTU_PROXY_TOKEN;

  if (envUrl && envToken) {
    return { url: envUrl, token: envToken };
  }

  // Fall back to config file
  const config = readConfig(workspacePath);
  if (config?.cloud?.enabled && config.cloud.endpoint) {
    // Token must come from env for security
    if (!envToken) {
      throw new MentuError(
        'E_UNAUTHORIZED',
        'MENTU_PROXY_TOKEN environment variable required for remote spawn'
      );
    }
    return { url: config.cloud.endpoint, token: envToken };
  }

  throw new MentuError(
    'E_GITHUB_NOT_CONFIGURED',
    'Proxy not configured. Set MENTU_API_URL and MENTU_PROXY_TOKEN environment variables.'
  );
}

export function registerSpawnCommand(program: Command): void {
  program
    .command('spawn [commitment]')
    .description('Queue a commitment for remote execution on the bridge daemon')
    .option('-s, --status <command_id>', 'Check status of a spawned command')
    .option('--dry-run', 'Preview what would be spawned without executing')
    .option('-d, --directory <path>', 'Override working directory on daemon')
    .option('-f, --flags <flags>', 'Additional Claude flags (comma-separated)')
    .option('--approval-required', 'Require approval before closing')
    .option('--on-approve <command>', 'Command to run after approval')
    .option('--actor <id>', 'Override actor identity')
    .option('--no-worktree', 'Disable worktree creation (worktree is default)')
    .action(async (commitmentId: string | undefined, options: SpawnOptions) => {
      const json = program.opts().json || false;

      try {
        const workspacePath = findWorkspace(process.cwd());
        const proxyConfig = await getProxyConfig(workspacePath);

        // Status check mode
        if (options.status) {
          const response = await fetch(
            `${proxyConfig.url}/bridge/spawn/${options.status}`,
            {
              method: 'GET',
              headers: {
                'X-Proxy-Token': proxyConfig.token,
              },
            }
          );

          if (!response.ok) {
            const errorData = await response.json() as { error: string };
            throw new MentuError('E_NOT_FOUND', errorData.error || 'Command not found');
          }

          const status = await response.json() as CommandStatus;
          outputStatus(status, json);
          return;
        }

        // Spawn mode - commitment ID is required
        if (!commitmentId) {
          throw new MentuError('E_MISSING_FIELD', 'Commitment ID required. Usage: mentu spawn <commitment>');
        }

        // Validate commitment exists locally
        const ledger = readLedger(workspacePath);
        const commitment = getCommitment(ledger, commitmentId);
        if (!commitment) {
          throw new MentuError('E_REF_NOT_FOUND', `Commitment ${commitmentId} not found in local ledger`);
        }

        // Check commitment state
        const state = computeCommitmentState(ledger, commitmentId);
        if (state.state === 'closed') {
          throw new MentuError('E_ALREADY_CLOSED', `Commitment ${commitmentId} is already closed`);
        }
        if (state.state === 'in_review') {
          throw new MentuError(
            'E_INVALID_OP',
            `Commitment ${commitmentId} is in review. Approve or reopen before spawning.`
          );
        }

        // Build request body
        const requestBody: Record<string, unknown> = {
          commitment_id: commitmentId,
        };

        if (options.directory) {
          requestBody.working_directory = options.directory;
        }
        if (options.flags) {
          requestBody.flags = options.flags.split(',').map(f => f.trim());
        }
        if (options.approvalRequired) {
          requestBody.approval_required = true;
        }
        if (options.onApprove) {
          requestBody.on_approve = options.onApprove;
        }
        if (options.actor) {
          requestBody.actor = options.actor;
        }

        // Worktree creation is ON by default; only disable with --no-worktree
        requestBody.with_worktree = !options.noWorktree;

        // Call proxy endpoint
        const url = options.dryRun
          ? `${proxyConfig.url}/bridge/spawn?dry_run=true`
          : `${proxyConfig.url}/bridge/spawn`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Proxy-Token': proxyConfig.token,
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorData = await response.json() as { error: string };
          throw new MentuError('E_INVALID_OP', errorData.error || 'Spawn failed');
        }

        const result = await response.json() as SpawnResponse | DryRunResponse;
        outputResult(result, json);
      } catch (err) {
        if (err instanceof MentuError) {
          outputError(err, json);
        } else {
          const error = new MentuError(
            'E_INTERNAL',
            err instanceof Error ? err.message : 'Unknown error'
          );
          outputError(error, json);
        }
      }
    });
}
