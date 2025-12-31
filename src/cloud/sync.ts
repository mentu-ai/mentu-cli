// Sync Protocol Implementation for Mentu v0.4

import fs from 'fs';
import path from 'path';
import type { CloudClient } from './client.js';
import type { SyncState, SyncPushResult, SyncPullResult } from './types.js';
import type { Operation } from '../types.js';
import { readLedger, getLedgerPath } from '../core/ledger.js';
import { getMentuDir } from '../core/config.js';
import {
  loadSyncState,
  saveSyncState,
  getUnsyncedOperations,
  countPendingOperations,
} from '../core/sync-state.js';
import { withLockSync } from '../core/lock.js';

/**
 * Push local operations to the cloud.
 */
export async function push(
  client: CloudClient,
  workspacePath: string,
  syncState: SyncState,
  dryRun: boolean = false
): Promise<SyncPushResult> {
  const unsyncedOps = getUnsyncedOperations(workspacePath, syncState);

  if (unsyncedOps.length === 0) {
    return {
      pushed: 0,
      accepted: [],
      rejected: [],
      warnings: [],
      newCursor: syncState.lastSyncedCursor || '',
    };
  }

  if (dryRun) {
    return {
      pushed: unsyncedOps.length,
      accepted: unsyncedOps.map(op => op.id),
      rejected: [],
      warnings: ['DRY RUN: No operations were actually pushed'],
      newCursor: unsyncedOps[unsyncedOps.length - 1].id,
    };
  }

  const result = await client.pushOperations(
    unsyncedOps,
    syncState.lastSyncedCursor,
    syncState.clientId
  );

  if (result.error) {
    throw new Error(`Push failed: ${result.error}`);
  }

  const data = result.data!;

  return {
    pushed: data.accepted.length,
    accepted: data.accepted,
    rejected: data.rejected,
    warnings: data.warnings,
    newCursor: data.new_cursor,
  };
}

/**
 * Pull remote operations from the cloud.
 */
export async function pull(
  client: CloudClient,
  workspacePath: string,
  syncState: SyncState,
  dryRun: boolean = false
): Promise<SyncPullResult> {
  const result = await client.pullOperations(
    syncState.lastSyncedCursor,
    syncState.clientId
  );

  if (result.error) {
    throw new Error(`Pull failed: ${result.error}`);
  }

  const data = result.data!;

  if (data.operations.length === 0) {
    return {
      pulled: 0,
      operations: [],
      newCursor: syncState.lastSyncedCursor || '',
      hasMore: false,
    };
  }

  if (dryRun) {
    return {
      pulled: data.operations.length,
      operations: data.operations,
      newCursor: data.new_cursor,
      hasMore: data.has_more,
    };
  }

  // Append pulled operations to local ledger
  appendOperationsToLedger(workspacePath, data.operations);

  return {
    pulled: data.operations.length,
    operations: data.operations,
    newCursor: data.new_cursor,
    hasMore: data.has_more,
  };
}

/**
 * Append operations to the local ledger.
 * Uses locking to prevent concurrent writes.
 */
function appendOperationsToLedger(workspacePath: string, operations: Operation[]): void {
  if (operations.length === 0) {
    return;
  }

  withLockSync(workspacePath, () => {
    const ledgerPath = getLedgerPath(workspacePath);
    const existingLedger = readLedger(workspacePath);
    const existingIds = new Set(existingLedger.map(op => op.id));

    // Filter out duplicates
    const newOps = operations.filter(op => !existingIds.has(op.id));

    if (newOps.length > 0) {
      const lines = newOps.map(op => JSON.stringify(op)).join('\n') + '\n';
      fs.appendFileSync(ledgerPath, lines, 'utf-8');
    }
  });
}

/**
 * Get sync status without performing sync.
 */
export async function getStatus(
  workspacePath: string
): Promise<{
  status: string;
  pendingOperations: number;
  lastSyncAt: string | null;
  workspaceId: string;
  clientId: string;
}> {
  const syncState = loadSyncState(workspacePath);
  const pending = countPendingOperations(workspacePath, syncState);

  return {
    status: syncState.status,
    pendingOperations: pending,
    lastSyncAt: syncState.lastSyncAt,
    workspaceId: syncState.workspaceId,
    clientId: syncState.clientId,
  };
}

/**
 * Perform full bidirectional sync.
 */
export async function fullSync(
  client: CloudClient,
  workspacePath: string,
  options: {
    pushOnly?: boolean;
    pullOnly?: boolean;
    dryRun?: boolean;
  } = {}
): Promise<{
  pushResult?: SyncPushResult;
  pullResult?: SyncPullResult;
}> {
  const syncState = loadSyncState(workspacePath);

  // Update status to syncing
  saveSyncState(workspacePath, { ...syncState, status: 'syncing' });

  try {
    let pushResult: SyncPushResult | undefined;
    let pullResult: SyncPullResult | undefined;

    // Push first (to avoid conflicts)
    if (!options.pullOnly) {
      pushResult = await push(client, workspacePath, syncState, options.dryRun);

      if (!options.dryRun && pushResult.pushed > 0) {
        // Update sync state after push
        saveSyncState(workspacePath, {
          ...syncState,
          lastSyncedCursor: pushResult.newCursor,
          lastSyncAt: new Date().toISOString(),
        });
      }
    }

    // Then pull
    if (!options.pushOnly) {
      // Reload sync state in case push updated it
      const updatedSyncState = loadSyncState(workspacePath);
      pullResult = await pull(client, workspacePath, updatedSyncState, options.dryRun);

      // Handle pagination - keep pulling while there's more
      while (pullResult.hasMore && !options.dryRun) {
        const morePulled = await pull(
          client,
          workspacePath,
          { ...updatedSyncState, lastSyncedCursor: pullResult.newCursor },
          options.dryRun
        );

        pullResult.pulled += morePulled.pulled;
        pullResult.operations.push(...morePulled.operations);
        pullResult.newCursor = morePulled.newCursor;
        pullResult.hasMore = morePulled.hasMore;
      }

      if (!options.dryRun && pullResult.pulled > 0) {
        // Update sync state after pull
        saveSyncState(workspacePath, {
          ...loadSyncState(workspacePath),
          lastSyncedCursor: pullResult.newCursor,
          lastSyncAt: new Date().toISOString(),
        });
      }
    }

    // Update final status
    const finalState = loadSyncState(workspacePath);
    saveSyncState(workspacePath, {
      ...finalState,
      status: 'synced',
      pendingOperations: countPendingOperations(workspacePath, finalState),
      lastSyncAt: new Date().toISOString(),
    });

    return { pushResult, pullResult };
  } catch (error) {
    // Update status to error
    const currentState = loadSyncState(workspacePath);
    saveSyncState(workspacePath, { ...currentState, status: 'error' });
    throw error;
  }
}

/**
 * Check if workspace is connected to cloud.
 */
export function isCloudEnabled(workspacePath: string): boolean {
  const configPath = path.join(getMentuDir(workspacePath), 'config.yaml');

  if (!fs.existsSync(configPath)) {
    return false;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    // Simple check - a proper implementation would parse YAML
    return content.includes('cloud:') && content.includes('enabled: true');
  } catch {
    return false;
  }
}
