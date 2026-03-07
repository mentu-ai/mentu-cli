/**
 * Parallel Execution Command
 *
 * Spawns multiple Claude agents via git worktrees, one per commitment.
 * Each agent runs in isolation with its own working directory.
 */

import type { Command } from 'commander';
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { findWorkspace } from '../core/config.js';
import { readLedger } from '../core/ledger.js';
import { computeCommitments } from '../core/state.js';

interface ParallelOptions {
  commitments?: string;
  maxParallel?: string;
  dryRun?: boolean;
}

interface WorktreeInfo {
  path: string;
  branch: string;
  commitment: string;
  status: 'created' | 'running' | 'complete' | 'failed';
}

export function registerParallelCommand(program: Command): void {
  const parallel = program
    .command('parallel')
    .description('Manage parallel agent execution via git worktrees');

  // mentu parallel spawn
  parallel
    .command('spawn')
    .description('Spawn worktrees for open commitments')
    .option('-c, --commitments <ids>', 'Comma-separated commitment IDs (default: all open with HANDOFFs)')
    .option('-m, --max-parallel <n>', 'Maximum parallel agents', '5')
    .option('--dry-run', 'Show what would be done without executing')
    .action(async (options: ParallelOptions) => {
      await spawnWorktrees(options);
    });

  // mentu parallel status
  parallel
    .command('status')
    .description('Show status of parallel worktrees')
    .action(async () => {
      await showParallelStatus();
    });

  // mentu parallel cleanup
  parallel
    .command('cleanup')
    .description('Remove completed worktrees')
    .option('--all', 'Remove all mentu worktrees')
    .action(async (options: { all?: boolean }) => {
      await cleanupWorktrees(options.all);
    });

  // mentu parallel run <commitment>
  parallel
    .command('run <commitment>')
    .description('Run agent in a specific worktree')
    .option('-p, --prompt <prompt>', 'Custom prompt (default: read HANDOFF)')
    .action(async (commitment: string, options: { prompt?: string }) => {
      await runInWorktree(commitment, options.prompt);
    });
}

async function spawnWorktrees(options: ParallelOptions): Promise<void> {
  const workspace = findWorkspace(process.cwd());
  if (!workspace) {
    console.error('Not in a Mentu workspace');
    process.exit(1);
  }

  // Check if we're in a git repo
  try {
    execSync('git rev-parse --git-dir', { stdio: 'pipe' });
  } catch {
    console.error('Not in a git repository');
    process.exit(1);
  }

  // Get commitments to spawn
  let commitmentIds: string[];

  if (options.commitments) {
    commitmentIds = options.commitments.split(',').map(c => c.trim());
  } else {
    // Find open commitments with HANDOFFs
    const ops = readLedger(workspace);
    const commitments = computeCommitments(ops);
    const openCommitments = commitments.filter(c => c.state === 'open');

    // Filter to those with HANDOFFs
    commitmentIds = openCommitments
      .filter(c => {
        // Check if HANDOFF exists for this commitment
        const handoffPattern = `docs/HANDOFF-*.md`;
        try {
          const files = execSync(`grep -l "commitment: ${c.id}" docs/HANDOFF-*.md 2>/dev/null || true`,
            { encoding: 'utf-8' });
          return files.trim().length > 0;
        } catch {
          return false;
        }
      })
      .map(c => c.id);
  }

  if (commitmentIds.length === 0) {
    console.log('No commitments to spawn. Create HANDOFFs for open commitments first.');
    return;
  }

  const maxParallel = parseInt(options.maxParallel || '5', 10);
  const toSpawn = commitmentIds.slice(0, maxParallel);

  console.log(`Spawning ${toSpawn.length} worktrees (max: ${maxParallel}):\n`);

  const repoName = path.basename(process.cwd());
  const parentDir = path.dirname(process.cwd());

  for (const cmtId of toSpawn) {
    const worktreePath = path.join(parentDir, `${repoName}-wt-${cmtId.replace('cmt_', '')}`);
    const branch = `mentu/${cmtId}`;

    console.log(`  ${cmtId}:`);
    console.log(`    Branch: ${branch}`);
    console.log(`    Path: ${worktreePath}`);

    if (options.dryRun) {
      console.log(`    [DRY RUN] Would create worktree\n`);
      continue;
    }

    try {
      // Create worktree
      execSync(`git worktree add "${worktreePath}" -b "${branch}" 2>&1`, { stdio: 'pipe' });

      // Copy .mentu state
      const mentuSrc = path.join(process.cwd(), '.mentu');
      const mentuDst = path.join(worktreePath, '.mentu');
      execSync(`cp -r "${mentuSrc}" "${mentuDst}"`);

      console.log(`    ✓ Created\n`);
    } catch (err: any) {
      // Branch might already exist
      try {
        execSync(`git worktree add "${worktreePath}" "${branch}" 2>&1`, { stdio: 'pipe' });
        const mentuSrc = path.join(process.cwd(), '.mentu');
        const mentuDst = path.join(worktreePath, '.mentu');
        execSync(`cp -r "${mentuSrc}" "${mentuDst}"`);
        console.log(`    ✓ Created (existing branch)\n`);
      } catch (err2: any) {
        console.log(`    ✗ Failed: ${err2.message}\n`);
      }
    }
  }

  console.log('\nTo run agents:');
  for (const cmtId of toSpawn) {
    const worktreePath = path.join(parentDir, `${repoName}-wt-${cmtId.replace('cmt_', '')}`);
    console.log(`  cd ${worktreePath} && mentu claim ${cmtId} && claude`);
  }

  console.log('\nOr run all with:');
  console.log('  mentu parallel run-all');
}

async function showParallelStatus(): Promise<void> {
  try {
    const output = execSync('git worktree list --porcelain', { encoding: 'utf-8' });
    const worktrees = parseWorktreeList(output);

    const mentuWorktrees = worktrees.filter(wt => wt.branch.includes('mentu/'));

    if (mentuWorktrees.length === 0) {
      console.log('No active Mentu worktrees.');
      return;
    }

    console.log('Active Mentu Worktrees:\n');
    console.log('| Commitment | Branch | Path | Status |');
    console.log('|------------|--------|------|--------|');

    for (const wt of mentuWorktrees) {
      const cmtId = wt.branch.replace('mentu/', '');
      const status = getWorktreeStatus(wt.path);
      console.log(`| ${cmtId} | ${wt.branch} | ${wt.path} | ${status} |`);
    }
  } catch (err) {
    console.error('Failed to list worktrees');
  }
}

async function cleanupWorktrees(all?: boolean): Promise<void> {
  try {
    const output = execSync('git worktree list --porcelain', { encoding: 'utf-8' });
    const worktrees = parseWorktreeList(output);

    const mentuWorktrees = worktrees.filter(wt => wt.branch.includes('mentu/'));

    for (const wt of mentuWorktrees) {
      const status = getWorktreeStatus(wt.path);

      if (all || status === 'complete') {
        console.log(`Removing: ${wt.path}`);
        try {
          execSync(`git worktree remove "${wt.path}" --force`);
          console.log(`  ✓ Removed`);
        } catch (err: any) {
          console.log(`  ✗ Failed: ${err.message}`);
        }
      }
    }
  } catch (err) {
    console.error('Failed to cleanup worktrees');
  }
}

async function runInWorktree(commitment: string, prompt?: string): Promise<void> {
  const repoName = path.basename(process.cwd());
  const parentDir = path.dirname(process.cwd());
  const worktreePath = path.join(parentDir, `${repoName}-wt-${commitment.replace('cmt_', '')}`);

  if (!fs.existsSync(worktreePath)) {
    console.error(`Worktree not found: ${worktreePath}`);
    console.error('Run `mentu parallel spawn` first.');
    process.exit(1);
  }

  const defaultPrompt = `Read the HANDOFF for commitment ${commitment} and execute. Claim the commitment first.`;
  const finalPrompt = prompt || defaultPrompt;

  console.log(`Running agent in: ${worktreePath}`);
  console.log(`Prompt: ${finalPrompt}\n`);

  // Spawn claude in the worktree
  const child = spawn('claude', [finalPrompt], {
    cwd: worktreePath,
    stdio: 'inherit',
    shell: true,
  });

  child.on('exit', (code) => {
    console.log(`\nAgent exited with code: ${code}`);
  });
}

function parseWorktreeList(output: string): Array<{ path: string; branch: string }> {
  const worktrees: Array<{ path: string; branch: string }> = [];
  const lines = output.split('\n');

  let currentPath = '';
  let currentBranch = '';

  for (const line of lines) {
    if (line.startsWith('worktree ')) {
      currentPath = line.replace('worktree ', '');
    } else if (line.startsWith('branch refs/heads/')) {
      currentBranch = line.replace('branch refs/heads/', '');
    } else if (line === '') {
      if (currentPath && currentBranch) {
        worktrees.push({ path: currentPath, branch: currentBranch });
      }
      currentPath = '';
      currentBranch = '';
    }
  }

  return worktrees;
}

function getWorktreeStatus(worktreePath: string): string {
  try {
    // Check if there are uncommitted changes
    const status = execSync(`git -C "${worktreePath}" status --porcelain`, { encoding: 'utf-8' });
    if (status.trim().length > 0) {
      return 'in_progress';
    }

    // Check if commitment is closed
    // This is a simplified check - would need to read ledger
    return 'ready';
  } catch {
    return 'unknown';
  }
}
