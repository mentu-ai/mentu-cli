import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { timestamp } from './time.js';
import { generateId } from './id.js';
import { isValidId } from './id.js';
import { appendOperation } from '../core/ledger.js';
import type { AnnotateOperation, Operation } from '../types.js';

/**
 * Validate commitment ID is safe for use in paths and shell commands.
 * Only allows alphanumeric characters and underscores (cmt_xxxxxxxx format).
 */
function validateCommitmentId(commitmentId: string): void {
  // Commitment IDs must match the format cmt_xxxxxxxx
  if (!isValidId(commitmentId)) {
    throw new Error(`Invalid commitment ID format: ${commitmentId}`);
  }
  // Additional safety: no path separators or shell metacharacters
  if (/[\/\\$`;"'&|<>(){}[\]!#~*?\s]/.test(commitmentId)) {
    throw new Error(`Commitment ID contains unsafe characters: ${commitmentId}`);
  }
}

/**
 * Validate a path stays within its parent directory (prevent path traversal).
 */
function validatePathWithinParent(childPath: string, parentPath: string): void {
  const resolvedChild = path.resolve(childPath);
  const resolvedParent = path.resolve(parentPath);
  if (!resolvedChild.startsWith(resolvedParent + path.sep) && resolvedChild !== resolvedParent) {
    throw new Error(`Path traversal detected: ${childPath} escapes ${parentPath}`);
  }
}

/**
 * Validate .mentu source is a real directory (not a symlink pointing elsewhere).
 */
function validateMentuSource(mentuPath: string, workspacePath: string): void {
  const realMentuPath = fs.realpathSync(mentuPath);
  const expectedPath = path.join(fs.realpathSync(workspacePath), '.mentu');
  if (realMentuPath !== expectedPath) {
    throw new Error(`.mentu source is not in expected location: ${realMentuPath} !== ${expectedPath}`);
  }
}

export interface WorktreeMetadata {
  worktree_path: string;       // /worktrees/{cmt_id}
  worktree_branch: string;     // {cmt_id} (same as commitment ID)
  worktree_created_at: string;
  base_commit?: string;
}

export interface WorktreeConfig {
  worktrees_dir: string;       // Default: /worktrees or ../worktrees
  merge_strategy: 'squash' | 'merge' | 'rebase';
  auto_cleanup: boolean;
}

/**
 * Check if the current directory is a git repository
 */
export function isGitRepo(workspacePath: string): boolean {
  try {
    execSync('git rev-parse --git-dir', {
      cwd: workspacePath,
      stdio: 'pipe'
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the current HEAD commit SHA
 */
export function getHeadCommit(workspacePath: string): string | null {
  try {
    return execSync('git rev-parse HEAD', {
      cwd: workspacePath,
      stdio: 'pipe',
      encoding: 'utf-8'
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Get worktrees directory from config or default
 */
export function getWorktreesDir(workspacePath: string): string {
  // TODO: Read from genesis.key worktree.worktrees_dir
  return path.join(path.dirname(workspacePath), 'worktrees');
}

/**
 * Get worktree path for a commitment
 *
 * NAMING: /worktrees/{cmt_id}
 * The commitment ID IS the directory name. No suffixes. No prefixes.
 */
export function getWorktreePath(workspacePath: string, commitmentId: string): string {
  // Validate commitment ID format to prevent command injection and path traversal
  validateCommitmentId(commitmentId);

  const worktreesDir = getWorktreesDir(workspacePath);
  const worktreePath = path.join(worktreesDir, commitmentId);

  // Validate path stays within worktrees directory
  validatePathWithinParent(worktreePath, worktreesDir);

  return worktreePath;
}

/**
 * Create an isolated worktree for a commitment
 *
 * CRITICAL: .mentu is SYMLINKED, not copied!
 */
export function createWorktree(
  workspacePath: string,
  commitmentId: string
): WorktreeMetadata {
  const worktreesDir = getWorktreesDir(workspacePath);
  const worktreePath = getWorktreePath(workspacePath, commitmentId);

  // Branch name = commitment ID (no prefix!)
  const branch = commitmentId;

  // Ensure worktrees directory exists
  if (!fs.existsSync(worktreesDir)) {
    fs.mkdirSync(worktreesDir, { recursive: true });
  }

  // Get base commit before creating worktree
  const baseCommit = getHeadCommit(workspacePath);

  // Create worktree with new branch (or use existing branch)
  try {
    execSync(`git worktree add "${worktreePath}" -b "${branch}" 2>&1`, {
      cwd: workspacePath,
      stdio: 'pipe'
    });
  } catch {
    // Branch might already exist (from reopen), try without -b
    try {
      execSync(`git worktree add "${worktreePath}" "${branch}" 2>&1`, {
        cwd: workspacePath,
        stdio: 'pipe'
      });
    } catch (e) {
      throw new Error(`Failed to create worktree: ${e}`);
    }
  }

  // CRITICAL: SYMLINK .mentu (not copy!)
  const mentuSrc = path.join(workspacePath, '.mentu');
  const mentuDst = path.join(worktreePath, '.mentu');
  if (fs.existsSync(mentuSrc)) {
    // Validate .mentu source is the real directory (prevent symlink-to-symlink attacks)
    validateMentuSource(mentuSrc, workspacePath);
    // Create symlink to parent .mentu
    fs.symlinkSync(mentuSrc, mentuDst);
  }

  return {
    worktree_path: worktreePath,
    worktree_branch: branch,
    worktree_created_at: timestamp(),
    base_commit: baseCommit || undefined,
  };
}

/**
 * Clean up a worktree (idempotent)
 */
export function cleanupWorktree(
  workspacePath: string,
  commitmentId: string
): void {
  const worktreePath = getWorktreePath(workspacePath, commitmentId);

  if (!fs.existsSync(worktreePath)) {
    return; // Already cleaned up
  }

  try {
    // Remove worktree via git
    execSync(`git worktree remove "${worktreePath}" --force`, {
      cwd: workspacePath,
      stdio: 'pipe'
    });
  } catch {
    // Fallback: manual cleanup
    try {
      fs.rmSync(worktreePath, { recursive: true, force: true });
      execSync('git worktree prune', { cwd: workspacePath, stdio: 'pipe' });
    } catch {
      // Best effort - worktree might be in use
    }
  }
}

/**
 * Get worktree metadata from ledger annotations
 */
export function getWorktreeMetadata(
  ledger: Operation[],
  commitmentId: string
): WorktreeMetadata | null {
  // Search backwards for most recent worktree annotation
  for (let i = ledger.length - 1; i >= 0; i--) {
    const op = ledger[i];
    if (
      op.op === 'annotate' &&
      op.payload.target === commitmentId &&
      op.payload.meta?.kind === 'worktree_info'
    ) {
      return op.payload.meta.worktree as WorktreeMetadata;
    }
  }
  return null;
}

/**
 * Annotate commitment with worktree metadata
 */
export function annotateWorktree(
  workspacePath: string,
  commitmentId: string,
  worktree: WorktreeMetadata,
  workspace: string,
  actor: string
): void {
  const operation: AnnotateOperation = {
    id: generateId('op'),
    op: 'annotate',
    ts: timestamp(),
    actor,
    workspace,
    payload: {
      target: commitmentId,
      body: `Worktree created at ${worktree.worktree_path}`,
      kind: 'worktree_info',
      meta: {
        kind: 'worktree_info',
        worktree,
      },
    },
  };
  appendOperation(workspacePath, operation);
}

/**
 * Check if a worktree exists for a commitment
 */
export function worktreeExists(
  workspacePath: string,
  commitmentId: string
): boolean {
  const worktreePath = getWorktreePath(workspacePath, commitmentId);
  return fs.existsSync(worktreePath);
}

/**
 * List all worktrees
 */
export function listWorktrees(workspacePath: string): string[] {
  try {
    const output = execSync('git worktree list --porcelain', {
      cwd: workspacePath,
      stdio: 'pipe',
      encoding: 'utf-8'
    });

    const worktrees: string[] = [];
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        worktrees.push(line.replace('worktree ', ''));
      }
    }
    return worktrees;
  } catch {
    return [];
  }
}

/**
 * Capture current diff as evidence
 */
export function captureDiff(
  worktreePath: string
): { additions: number; deletions: number; files: string[] } | null {
  try {
    const diffStat = execSync('git diff --stat HEAD', {
      cwd: worktreePath,
      stdio: 'pipe',
      encoding: 'utf-8'
    });

    const files: string[] = [];
    let additions = 0;
    let deletions = 0;

    // Parse diff stat output
    const lines = diffStat.split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*(.+?)\s+\|\s+\d+\s+(\+*)(-*)/);
      if (match) {
        files.push(match[1].trim());
        additions += (match[2] || '').length;
        deletions += (match[3] || '').length;
      }
    }

    if (files.length === 0) {
      return null;
    }

    return { additions, deletions, files };
  } catch {
    return null;
  }
}
