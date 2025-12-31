import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  loadSyncState,
  saveSyncState,
  countPendingOperations,
  getUnsyncedOperations,
  generateClientId,
  initSyncState,
  clearSyncState,
} from '../src/core/sync-state.js';
import { appendOperation } from '../src/core/ledger.js';
import type { SyncState } from '../src/cloud/types.js';
import type { CaptureOperation } from '../src/types.js';

describe('Sync State', () => {
  let testDir: string;
  let mentuDir: string;

  beforeEach(() => {
    // Create a temporary test workspace
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mentu-test-'));
    mentuDir = path.join(testDir, '.mentu');
    fs.mkdirSync(mentuDir, { recursive: true });

    // Create empty ledger file
    fs.writeFileSync(path.join(mentuDir, 'ledger.jsonl'), '');
  });

  afterEach(() => {
    // Clean up test directory
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('generateClientId', () => {
    it('generates unique client IDs', () => {
      const id1 = generateClientId();
      const id2 = generateClientId();

      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
    });

    it('includes hostname in client ID', () => {
      const id = generateClientId();
      const hostname = os.hostname().toLowerCase().replace(/[^a-z0-9-]/g, '-');

      expect(id.startsWith(hostname)).toBe(true);
    });
  });

  describe('loadSyncState', () => {
    it('creates initial sync state if not exists', () => {
      const state = loadSyncState(testDir);

      expect(state.clientId).toBeTruthy();
      expect(state.status).toBe('pending');
      expect(state.lastSyncedCursor).toBeNull();
      expect(state.lastSyncAt).toBeNull();
      expect(state.pendingOperations).toBe(0);
    });

    it('loads existing sync state', () => {
      const existingState: SyncState = {
        workspaceId: 'test-workspace',
        clientId: 'test-client',
        lastSyncedCursor: 'op_123',
        lastSyncAt: '2025-01-01T00:00:00Z',
        pendingOperations: 5,
        status: 'synced',
      };

      fs.writeFileSync(
        path.join(mentuDir, 'sync-state.json'),
        JSON.stringify(existingState)
      );

      const state = loadSyncState(testDir);

      expect(state.workspaceId).toBe('test-workspace');
      expect(state.clientId).toBe('test-client');
      expect(state.lastSyncedCursor).toBe('op_123');
      expect(state.status).toBe('synced');
    });

    it('handles corrupted sync state file', () => {
      fs.writeFileSync(
        path.join(mentuDir, 'sync-state.json'),
        'invalid json'
      );

      const state = loadSyncState(testDir);

      expect(state.clientId).toBeTruthy();
      expect(state.status).toBe('pending');
    });
  });

  describe('saveSyncState', () => {
    it('saves sync state to file', () => {
      const state: SyncState = {
        workspaceId: 'test-workspace',
        clientId: 'test-client',
        lastSyncedCursor: 'op_456',
        lastSyncAt: '2025-01-01T12:00:00Z',
        pendingOperations: 3,
        status: 'synced',
      };

      saveSyncState(testDir, state);

      const loaded = loadSyncState(testDir);
      expect(loaded.workspaceId).toBe('test-workspace');
      expect(loaded.lastSyncedCursor).toBe('op_456');
    });
  });

  describe('countPendingOperations', () => {
    it('returns 0 for empty ledger', () => {
      const state = loadSyncState(testDir);
      const count = countPendingOperations(testDir, state);

      expect(count).toBe(0);
    });

    it('returns all operations count when no cursor', () => {
      // Add some operations
      const ops = createTestOperations(3);
      for (const op of ops) {
        appendOperation(testDir, op);
      }

      const state = loadSyncState(testDir);
      const count = countPendingOperations(testDir, state);

      expect(count).toBe(3);
    });

    it('returns operations after cursor', () => {
      // Add some operations
      const ops = createTestOperations(5);
      for (const op of ops) {
        appendOperation(testDir, op);
      }

      const state: SyncState = {
        workspaceId: 'test',
        clientId: 'test-client',
        lastSyncedCursor: ops[2].id, // Cursor at 3rd operation
        lastSyncAt: null,
        pendingOperations: 0,
        status: 'pending',
      };

      const count = countPendingOperations(testDir, state);

      expect(count).toBe(2); // 4th and 5th operations
    });
  });

  describe('getUnsyncedOperations', () => {
    it('returns empty array for empty ledger', () => {
      const state = loadSyncState(testDir);
      const ops = getUnsyncedOperations(testDir, state);

      expect(ops).toEqual([]);
    });

    it('returns all operations when no cursor', () => {
      const testOps = createTestOperations(3);
      for (const op of testOps) {
        appendOperation(testDir, op);
      }

      const state = loadSyncState(testDir);
      const ops = getUnsyncedOperations(testDir, state);

      expect(ops.length).toBe(3);
    });

    it('returns only operations after cursor', () => {
      const testOps = createTestOperations(5);
      for (const op of testOps) {
        appendOperation(testDir, op);
      }

      const state: SyncState = {
        workspaceId: 'test',
        clientId: 'test-client',
        lastSyncedCursor: testOps[2].id,
        lastSyncAt: null,
        pendingOperations: 0,
        status: 'pending',
      };

      const ops = getUnsyncedOperations(testDir, state);

      expect(ops.length).toBe(2);
      expect(ops[0].id).toBe(testOps[3].id);
      expect(ops[1].id).toBe(testOps[4].id);
    });
  });

  describe('initSyncState', () => {
    it('initializes sync state with workspace ID', () => {
      const state = initSyncState(testDir, 'my-workspace-id');

      expect(state.workspaceId).toBe('my-workspace-id');
      expect(state.clientId).toBeTruthy();
      expect(state.status).toBe('pending');

      // Verify it was saved
      const loaded = loadSyncState(testDir);
      expect(loaded.workspaceId).toBe('my-workspace-id');
    });
  });

  describe('clearSyncState', () => {
    it('removes sync state file', () => {
      // Create sync state
      initSyncState(testDir, 'test-workspace');

      const statePath = path.join(mentuDir, 'sync-state.json');
      expect(fs.existsSync(statePath)).toBe(true);

      clearSyncState(testDir);

      expect(fs.existsSync(statePath)).toBe(false);
    });

    it('does not throw if file does not exist', () => {
      expect(() => clearSyncState(testDir)).not.toThrow();
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
