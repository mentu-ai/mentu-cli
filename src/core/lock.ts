import fs from 'fs';
import path from 'path';
import { MentuError } from '../types.js';
import { getMentuDir } from './config.js';

const LOCK_FILE = '.lock';

/**
 * Check if a process is running by PID.
 */
function processRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the lock file path.
 */
function getLockPath(workspacePath: string): string {
  return path.join(getMentuDir(workspacePath), LOCK_FILE);
}

/**
 * Check if workspace is locked.
 */
export function isLocked(workspacePath: string): boolean {
  const lockPath = getLockPath(workspacePath);

  if (!fs.existsSync(lockPath)) {
    return false;
  }

  try {
    const content = fs.readFileSync(lockPath, 'utf-8').trim();
    const pid = parseInt(content, 10);

    if (isNaN(pid)) {
      // Invalid lock file, remove it
      fs.unlinkSync(lockPath);
      return false;
    }

    if (processRunning(pid)) {
      return true;
    }

    // Stale lock, remove it
    fs.unlinkSync(lockPath);
    return false;
  } catch {
    return false;
  }
}

/**
 * Acquire exclusive write lock, execute function, release lock.
 */
export async function withLock<T>(
  workspacePath: string,
  fn: () => Promise<T>
): Promise<T> {
  const lockPath = getLockPath(workspacePath);

  // Check for existing lock
  if (fs.existsSync(lockPath)) {
    try {
      const content = fs.readFileSync(lockPath, 'utf-8').trim();
      const pid = parseInt(content, 10);

      if (!isNaN(pid) && processRunning(pid)) {
        throw new MentuError(
          'E_WORKSPACE_LOCKED',
          `Workspace locked by process ${pid}`
        );
      }

      // Stale lock, remove it
      fs.unlinkSync(lockPath);
    } catch (err) {
      if (err instanceof MentuError) {
        throw err;
      }
      // Other errors, try to proceed
    }
  }

  // Acquire lock
  fs.writeFileSync(lockPath, process.pid.toString(), 'utf-8');

  try {
    return await fn();
  } finally {
    // Release lock
    try {
      fs.unlinkSync(lockPath);
    } catch {
      // Ignore errors during cleanup
    }
  }
}

/**
 * Synchronous version of withLock.
 */
export function withLockSync<T>(workspacePath: string, fn: () => T): T {
  const lockPath = getLockPath(workspacePath);

  // Check for existing lock
  if (fs.existsSync(lockPath)) {
    try {
      const content = fs.readFileSync(lockPath, 'utf-8').trim();
      const pid = parseInt(content, 10);

      if (!isNaN(pid) && processRunning(pid)) {
        throw new MentuError(
          'E_WORKSPACE_LOCKED',
          `Workspace locked by process ${pid}`
        );
      }

      // Stale lock, remove it
      fs.unlinkSync(lockPath);
    } catch (err) {
      if (err instanceof MentuError) {
        throw err;
      }
      // Other errors, try to proceed
    }
  }

  // Acquire lock
  fs.writeFileSync(lockPath, process.pid.toString(), 'utf-8');

  try {
    return fn();
  } finally {
    // Release lock
    try {
      fs.unlinkSync(lockPath);
    } catch {
      // Ignore errors during cleanup
    }
  }
}
