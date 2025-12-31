// Sync State Management for Mentu v0.4

import fs from 'fs';
import path from 'path';
import os from 'os';
import type { SyncState } from '../cloud/types.js';
import { getMentuDir } from './config.js';
import { readLedger } from './ledger.js';

const SYNC_STATE_FILE = 'sync-state.json';

/**
 * Generate a unique client ID for this device.
 * Format: hostname-nanoid8
 */
export function generateClientId(): string {
  const hostname = os.hostname().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const suffix = generateShortId(8);
  return `${hostname}-${suffix}`;
}

/**
 * Generate a short random ID (base36).
 */
function generateShortId(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Get the sync state file path.
 */
export function getSyncStatePath(workspacePath: string): string {
  return path.join(getMentuDir(workspacePath), SYNC_STATE_FILE);
}

/**
 * Load sync state from disk, or create initial state if not exists.
 */
export function loadSyncState(workspacePath: string): SyncState {
  const filePath = getSyncStatePath(workspacePath);

  if (!fs.existsSync(filePath)) {
    // Create initial sync state
    return {
      workspaceId: '',
      clientId: generateClientId(),
      lastSyncedCursor: null,
      lastSyncAt: null,
      pendingOperations: 0,
      status: 'pending',
    };
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as SyncState;
  } catch {
    // If file is corrupted, return fresh state
    return {
      workspaceId: '',
      clientId: generateClientId(),
      lastSyncedCursor: null,
      lastSyncAt: null,
      pendingOperations: 0,
      status: 'pending',
    };
  }
}

/**
 * Save sync state to disk.
 */
export function saveSyncState(workspacePath: string, state: SyncState): void {
  const filePath = getSyncStatePath(workspacePath);
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * Count operations that haven't been synced yet.
 */
export function countPendingOperations(workspacePath: string, syncState: SyncState): number {
  const ledger = readLedger(workspacePath);

  if (ledger.length === 0) {
    return 0;
  }

  if (!syncState.lastSyncedCursor) {
    // No sync has happened yet, all operations are pending
    return ledger.length;
  }

  const cursorIndex = ledger.findIndex(op => op.id === syncState.lastSyncedCursor);

  if (cursorIndex === -1) {
    // Cursor not found in ledger, assume all are pending
    return ledger.length;
  }

  return ledger.length - cursorIndex - 1;
}

/**
 * Get operations that need to be pushed (after cursor).
 */
export function getUnsyncedOperations(workspacePath: string, syncState: SyncState): ReturnType<typeof readLedger> {
  const ledger = readLedger(workspacePath);

  if (ledger.length === 0) {
    return [];
  }

  if (!syncState.lastSyncedCursor) {
    // No sync has happened yet, all operations need to be pushed
    return ledger;
  }

  const cursorIndex = ledger.findIndex(op => op.id === syncState.lastSyncedCursor);

  if (cursorIndex === -1) {
    // Cursor not found, push all
    return ledger;
  }

  // Return operations after the cursor
  return ledger.slice(cursorIndex + 1);
}

/**
 * Update sync state after successful push.
 */
export function updateSyncStateAfterPush(
  workspacePath: string,
  syncState: SyncState,
  newCursor: string
): SyncState {
  const updated: SyncState = {
    ...syncState,
    lastSyncedCursor: newCursor,
    lastSyncAt: new Date().toISOString(),
    pendingOperations: countPendingOperations(workspacePath, { ...syncState, lastSyncedCursor: newCursor }),
    status: 'synced',
  };

  saveSyncState(workspacePath, updated);
  return updated;
}

/**
 * Update sync state after successful pull.
 */
export function updateSyncStateAfterPull(
  workspacePath: string,
  syncState: SyncState,
  newCursor: string
): SyncState {
  const updated: SyncState = {
    ...syncState,
    lastSyncedCursor: newCursor,
    lastSyncAt: new Date().toISOString(),
    status: 'synced',
  };

  saveSyncState(workspacePath, updated);
  return updated;
}

/**
 * Set sync state to error status.
 */
export function setSyncStateError(workspacePath: string, syncState: SyncState): SyncState {
  const updated: SyncState = {
    ...syncState,
    status: 'error',
  };

  saveSyncState(workspacePath, updated);
  return updated;
}

/**
 * Set sync state to syncing status.
 */
export function setSyncStateSyncing(workspacePath: string, syncState: SyncState): SyncState {
  const updated: SyncState = {
    ...syncState,
    status: 'syncing',
  };

  saveSyncState(workspacePath, updated);
  return updated;
}

/**
 * Set sync state to offline status.
 */
export function setSyncStateOffline(workspacePath: string, syncState: SyncState): SyncState {
  const updated: SyncState = {
    ...syncState,
    status: 'offline',
  };

  saveSyncState(workspacePath, updated);
  return updated;
}

/**
 * Initialize sync state for a workspace.
 */
export function initSyncState(workspacePath: string, workspaceId: string): SyncState {
  const state: SyncState = {
    workspaceId,
    clientId: generateClientId(),
    lastSyncedCursor: null,
    lastSyncAt: null,
    pendingOperations: 0,
    status: 'pending',
  };

  saveSyncState(workspacePath, state);
  return state;
}

/**
 * Clear sync state (for disconnect/reset).
 */
export function clearSyncState(workspacePath: string): void {
  const filePath = getSyncStatePath(workspacePath);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
