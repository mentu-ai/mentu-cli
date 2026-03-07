import { Hono } from 'hono';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { MentuError } from '../../types.js';
import { getWorktreePath, worktreeExists, getHeadCommit } from '../../utils/worktree.js';

/**
 * Size limits for diff content (matches VibeKanban thresholds).
 */
const DIFF_LIMITS = {
  SINGLE_FILE_BYTES: 2 * 1024 * 1024, // 2MB per file
  CUMULATIVE_BYTES: 200 * 1024 * 1024, // 200MB total
} as const;

/**
 * Kind of change for a file.
 */
type DiffChangeKind = 'added' | 'deleted' | 'modified' | 'renamed' | 'copied' | 'permission_change';

/**
 * A single file in the diff.
 */
interface DiffFile {
  path: string;
  kind: DiffChangeKind;
  additions: number;
  deletions: number;
  content?: string;
  content_omitted: boolean;
  old_path?: string;
}

/**
 * Get the base commit for a worktree (the commit it branched from).
 */
function getBaseCommit(worktreePath: string): string | null {
  try {
    // Get the merge-base with the main branch
    // First, try to find the main/master branch
    const branches = execSync('git branch -r', {
      cwd: worktreePath,
      stdio: 'pipe',
      encoding: 'utf-8',
    });

    let mainBranch = 'main';
    if (branches.includes('origin/master') && !branches.includes('origin/main')) {
      mainBranch = 'master';
    }

    // Get merge-base
    const baseCommit = execSync(`git merge-base HEAD origin/${mainBranch} 2>/dev/null || git rev-parse HEAD~1 2>/dev/null || git rev-parse HEAD`, {
      cwd: worktreePath,
      stdio: 'pipe',
      encoding: 'utf-8',
    }).trim();

    return baseCommit || null;
  } catch {
    return null;
  }
}

/**
 * Parse git diff --numstat output to get file stats.
 */
function parseDiffNumstat(output: string): Map<string, { additions: number; deletions: number }> {
  const stats = new Map<string, { additions: number; deletions: number }>();

  for (const line of output.split('\n')) {
    if (!line.trim()) continue;

    // Format: additions<tab>deletions<tab>filename
    // Binary files show - - filename
    const match = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
    if (match) {
      const additions = match[1] === '-' ? 0 : parseInt(match[1], 10);
      const deletions = match[2] === '-' ? 0 : parseInt(match[2], 10);
      const filepath = match[3];

      // Handle renames: old => new
      const renameParts = filepath.split(' => ');
      const effectivePath = renameParts.length > 1 ? renameParts[1] : filepath;

      stats.set(effectivePath, { additions, deletions });
    }
  }

  return stats;
}

/**
 * Detect the kind of change for a file.
 */
function detectChangeKind(worktreePath: string, filepath: string): { kind: DiffChangeKind; old_path?: string } {
  try {
    // Use git status --porcelain to detect change type
    const status = execSync(`git status --porcelain -- "${filepath}"`, {
      cwd: worktreePath,
      stdio: 'pipe',
      encoding: 'utf-8',
    }).trim();

    if (!status) {
      return { kind: 'modified' };
    }

    const statusCode = status.substring(0, 2);

    if (statusCode.includes('A') || statusCode === '??') {
      return { kind: 'added' };
    }
    if (statusCode.includes('D')) {
      return { kind: 'deleted' };
    }
    if (statusCode.includes('R')) {
      // Renamed - extract old path
      const parts = status.substring(3).split(' -> ');
      return { kind: 'renamed', old_path: parts[0] };
    }
    if (statusCode.includes('C')) {
      // Copied
      const parts = status.substring(3).split(' -> ');
      return { kind: 'copied', old_path: parts[0] };
    }

    return { kind: 'modified' };
  } catch {
    return { kind: 'modified' };
  }
}

/**
 * Get unified diff content for a file.
 */
function getFileDiffContent(worktreePath: string, filepath: string, baseCommit: string | null): string | null {
  try {
    // If we have a base commit, diff against it; otherwise diff against HEAD (staged/unstaged)
    const diffCmd = baseCommit
      ? `git diff ${baseCommit} -- "${filepath}"`
      : `git diff HEAD -- "${filepath}"`;

    const content = execSync(diffCmd, {
      cwd: worktreePath,
      stdio: 'pipe',
      encoding: 'utf-8',
      maxBuffer: DIFF_LIMITS.SINGLE_FILE_BYTES,
    });

    return content || null;
  } catch {
    return null;
  }
}

/**
 * Capture full diff for a worktree.
 */
function captureDiffDetailed(
  worktreePath: string,
  baseCommit: string | null
): { files: DiffFile[]; total_additions: number; total_deletions: number } {
  try {
    // Get numstat for all changed files
    const numstatCmd = baseCommit
      ? `git diff --numstat ${baseCommit}`
      : `git diff --numstat HEAD`;

    const numstatOutput = execSync(numstatCmd, {
      cwd: worktreePath,
      stdio: 'pipe',
      encoding: 'utf-8',
    });

    // Also check for untracked files
    const untrackedOutput = execSync('git ls-files --others --exclude-standard', {
      cwd: worktreePath,
      stdio: 'pipe',
      encoding: 'utf-8',
    });

    const stats = parseDiffNumstat(numstatOutput);

    // Add untracked files
    for (const filepath of untrackedOutput.split('\n')) {
      if (filepath.trim()) {
        // Count lines in untracked file
        try {
          const fullPath = path.join(worktreePath, filepath);
          const content = fs.readFileSync(fullPath, 'utf-8');
          const lineCount = content.split('\n').length;
          stats.set(filepath, { additions: lineCount, deletions: 0 });
        } catch {
          stats.set(filepath, { additions: 0, deletions: 0 });
        }
      }
    }

    const files: DiffFile[] = [];
    let totalAdditions = 0;
    let totalDeletions = 0;
    let cumulativeSize = 0;

    for (const [filepath, fileStat] of stats) {
      totalAdditions += fileStat.additions;
      totalDeletions += fileStat.deletions;

      const { kind, old_path } = detectChangeKind(worktreePath, filepath);

      // Check if we should include content
      let content: string | undefined;
      let contentOmitted = false;

      if (cumulativeSize < DIFF_LIMITS.CUMULATIVE_BYTES) {
        const diffContent = getFileDiffContent(worktreePath, filepath, baseCommit);
        if (diffContent && diffContent.length < DIFF_LIMITS.SINGLE_FILE_BYTES) {
          content = diffContent;
          cumulativeSize += diffContent.length;
        } else {
          contentOmitted = true;
        }
      } else {
        contentOmitted = true;
      }

      files.push({
        path: filepath,
        kind,
        additions: fileStat.additions,
        deletions: fileStat.deletions,
        content,
        content_omitted: contentOmitted,
        old_path,
      });
    }

    return { files, total_additions: totalAdditions, total_deletions: totalDeletions };
  } catch {
    return { files: [], total_additions: 0, total_deletions: 0 };
  }
}

/**
 * Diff routes for commitment worktrees.
 */
export function diffRoutes(workspacePath: string) {
  const router = new Hono();

  // GET /diff/:commitmentId
  // Returns the current diff for a commitment's worktree
  router.get('/:commitmentId', (c) => {
    const commitmentId = c.req.param('commitmentId');

    // Validate commitment ID format
    if (!/^cmt_[a-f0-9]{8}$/.test(commitmentId)) {
      throw new MentuError('E_INVALID_OP', `Invalid commitment ID format: ${commitmentId}`);
    }

    // Check if worktree exists
    if (!worktreeExists(workspacePath, commitmentId)) {
      // Return empty diff if no worktree exists
      return c.json({
        commitment_id: commitmentId,
        worktree_path: null,
        base_commit: null,
        files: [],
        total_additions: 0,
        total_deletions: 0,
        captured_at: new Date().toISOString(),
      });
    }

    const worktreePath = getWorktreePath(workspacePath, commitmentId);
    const baseCommit = getBaseCommit(worktreePath);
    const diff = captureDiffDetailed(worktreePath, baseCommit);

    return c.json({
      commitment_id: commitmentId,
      worktree_path: worktreePath,
      base_commit: baseCommit,
      files: diff.files,
      total_additions: diff.total_additions,
      total_deletions: diff.total_deletions,
      captured_at: new Date().toISOString(),
    });
  });

  return router;
}
