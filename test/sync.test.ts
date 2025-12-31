import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getStatus, isCloudEnabled } from '../src/cloud/sync.js';
import { loadSyncState, saveSyncState, initSyncState } from '../src/core/sync-state.js';
import { appendOperation } from '../src/core/ledger.js';
import type { SyncState } from '../src/cloud/types.js';
import type { CaptureOperation } from '../src/types.js';

describe('Sync Protocol', () => {
  let testDir: string;
  let mentuDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mentu-sync-test-'));
    mentuDir = path.join(testDir, '.mentu');
    fs.mkdirSync(mentuDir, { recursive: true });
    fs.writeFileSync(path.join(mentuDir, 'ledger.jsonl'), '');
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('getStatus', () => {
    it('returns initial status for new workspace', async () => {
      initSyncState(testDir, 'test-workspace');

      const status = await getStatus(testDir);

      expect(status.status).toBe('pending');
      expect(status.pendingOperations).toBe(0);
      expect(status.lastSyncAt).toBeNull();
    });

    it('counts pending operations correctly', async () => {
      initSyncState(testDir, 'test-workspace');

      // Add some operations
      const ops = createTestOperations(5);
      for (const op of ops) {
        appendOperation(testDir, op);
      }

      const status = await getStatus(testDir);

      expect(status.pendingOperations).toBe(5);
    });

    it('returns synced status after sync', async () => {
      const ops = createTestOperations(3);
      for (const op of ops) {
        appendOperation(testDir, op);
      }

      const state: SyncState = {
        workspaceId: 'test-workspace',
        clientId: 'test-client',
        lastSyncedCursor: ops[ops.length - 1].id,
        lastSyncAt: new Date().toISOString(),
        pendingOperations: 0,
        status: 'synced',
      };

      saveSyncState(testDir, state);

      const status = await getStatus(testDir);

      expect(status.status).toBe('synced');
      expect(status.pendingOperations).toBe(0);
    });
  });

  describe('isCloudEnabled', () => {
    it('returns false when no config exists', () => {
      expect(isCloudEnabled(testDir)).toBe(false);
    });

    it('returns false when cloud not enabled in config', () => {
      const config = `
workspace: test
created: 2025-01-01T00:00:00Z
`;
      fs.writeFileSync(path.join(mentuDir, 'config.yaml'), config);

      expect(isCloudEnabled(testDir)).toBe(false);
    });

    it('returns true when cloud is enabled', () => {
      const config = `
workspace: test
created: 2025-01-01T00:00:00Z
cloud:
  enabled: true
  endpoint: https://example.supabase.co
  workspace_id: test-uuid
`;
      fs.writeFileSync(path.join(mentuDir, 'config.yaml'), config);

      expect(isCloudEnabled(testDir)).toBe(true);
    });
  });

  describe('sync state transitions', () => {
    it('transitions from pending to syncing', () => {
      const state = initSyncState(testDir, 'test-workspace');
      expect(state.status).toBe('pending');

      const syncing: SyncState = { ...state, status: 'syncing' };
      saveSyncState(testDir, syncing);

      const loaded = loadSyncState(testDir);
      expect(loaded.status).toBe('syncing');
    });

    it('transitions from syncing to synced', () => {
      const state: SyncState = {
        workspaceId: 'test-workspace',
        clientId: 'test-client',
        lastSyncedCursor: null,
        lastSyncAt: null,
        pendingOperations: 0,
        status: 'syncing',
      };

      saveSyncState(testDir, state);

      const synced: SyncState = {
        ...state,
        status: 'synced',
        lastSyncAt: new Date().toISOString(),
      };

      saveSyncState(testDir, synced);

      const loaded = loadSyncState(testDir);
      expect(loaded.status).toBe('synced');
      expect(loaded.lastSyncAt).not.toBeNull();
    });

    it('transitions to error on failure', () => {
      const state: SyncState = {
        workspaceId: 'test-workspace',
        clientId: 'test-client',
        lastSyncedCursor: 'op_123',
        lastSyncAt: '2025-01-01T00:00:00Z',
        pendingOperations: 5,
        status: 'syncing',
      };

      saveSyncState(testDir, state);

      const error: SyncState = { ...state, status: 'error' };
      saveSyncState(testDir, error);

      const loaded = loadSyncState(testDir);
      expect(loaded.status).toBe('error');
      // Previous cursor should be preserved
      expect(loaded.lastSyncedCursor).toBe('op_123');
    });

    it('transitions to offline when network unavailable', () => {
      const state: SyncState = {
        workspaceId: 'test-workspace',
        clientId: 'test-client',
        lastSyncedCursor: 'op_456',
        lastSyncAt: '2025-01-01T00:00:00Z',
        pendingOperations: 3,
        status: 'synced',
      };

      saveSyncState(testDir, state);

      const offline: SyncState = { ...state, status: 'offline' };
      saveSyncState(testDir, offline);

      const loaded = loadSyncState(testDir);
      expect(loaded.status).toBe('offline');
    });
  });

  describe('cursor management', () => {
    it('updates cursor after push', () => {
      const ops = createTestOperations(3);
      for (const op of ops) {
        appendOperation(testDir, op);
      }

      const state = initSyncState(testDir, 'test-workspace');
      expect(state.lastSyncedCursor).toBeNull();

      // Simulate push completion
      const updated: SyncState = {
        ...state,
        lastSyncedCursor: ops[2].id,
        lastSyncAt: new Date().toISOString(),
        status: 'synced',
      };

      saveSyncState(testDir, updated);

      const loaded = loadSyncState(testDir);
      expect(loaded.lastSyncedCursor).toBe(ops[2].id);
    });

    it('maintains cursor on partial sync', () => {
      const ops = createTestOperations(5);
      for (const op of ops) {
        appendOperation(testDir, op);
      }

      const state: SyncState = {
        workspaceId: 'test-workspace',
        clientId: 'test-client',
        lastSyncedCursor: ops[2].id, // Synced up to 3rd op
        lastSyncAt: new Date().toISOString(),
        pendingOperations: 2,
        status: 'synced',
      };

      saveSyncState(testDir, state);

      // Simulate error during sync (should preserve cursor)
      const error: SyncState = { ...state, status: 'error' };
      saveSyncState(testDir, error);

      const loaded = loadSyncState(testDir);
      expect(loaded.lastSyncedCursor).toBe(ops[2].id);
    });
  });
});

// Helper to create test operations
function createTestOperations(count: number): CaptureOperation[] {
  const ops: CaptureOperation[] = [];
  for (let i = 0; i < count; i++) {
    ops.push({
      id: `mem_${String(i).padStart(8, '0')}`,
      op: 'capture',
      ts: new Date(Date.now() + i * 1000).toISOString(),
      actor: 'test-user',
      workspace: 'test-workspace',
      payload: {
        body: `Test memory ${i}`,
      },
    });
  }
  return ops;
}
