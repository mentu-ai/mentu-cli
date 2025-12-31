import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Operation } from '../../src/types.js';
import {
  getLedgerPath,
  readLedger,
  appendOperation,
  idExists,
  sourceKeyExists,
  getMemoryIds,
  getCommitmentIds,
  getAllRecordIds,
} from '../../src/core/ledger.js';

describe('Ledger', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mentu-test-'));
    fs.mkdirSync(path.join(testDir, '.mentu'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('getLedgerPath', () => {
    it('should return correct ledger path', () => {
      const ledgerPath = getLedgerPath(testDir);
      expect(ledgerPath).toBe(path.join(testDir, '.mentu', 'ledger.jsonl'));
    });
  });

  describe('readLedger', () => {
    it('should return empty array when ledger does not exist', () => {
      const ops = readLedger(testDir);
      expect(ops).toEqual([]);
    });

    it('should parse valid JSONL file', () => {
      const ledgerPath = getLedgerPath(testDir);
      const op1: Operation = {
        id: 'mem_001',
        op: 'capture',
        ts: '2025-01-01T00:00:00.000Z',
        actor: 'alice',
        workspace: 'test',
        payload: { body: 'Test memory' },
      };
      const op2: Operation = {
        id: 'cmt_001',
        op: 'commit',
        ts: '2025-01-01T00:01:00.000Z',
        actor: 'alice',
        workspace: 'test',
        payload: { body: 'Test commitment', source: 'mem_001' },
      };

      fs.writeFileSync(ledgerPath, JSON.stringify(op1) + '\n' + JSON.stringify(op2) + '\n', 'utf-8');

      const ops = readLedger(testDir);
      expect(ops).toHaveLength(2);
      expect(ops[0]).toEqual(op1);
      expect(ops[1]).toEqual(op2);
    });

    it('should filter empty lines', () => {
      const ledgerPath = getLedgerPath(testDir);
      const op: Operation = {
        id: 'mem_001',
        op: 'capture',
        ts: '2025-01-01T00:00:00.000Z',
        actor: 'alice',
        workspace: 'test',
        payload: { body: 'Test memory' },
      };

      fs.writeFileSync(ledgerPath, '\n' + JSON.stringify(op) + '\n\n', 'utf-8');

      const ops = readLedger(testDir);
      expect(ops).toHaveLength(1);
      expect(ops[0]).toEqual(op);
    });

    it('should throw error on invalid JSON', () => {
      const ledgerPath = getLedgerPath(testDir);
      fs.writeFileSync(ledgerPath, 'invalid json\n', 'utf-8');

      expect(() => readLedger(testDir)).toThrow('Invalid JSON at line 1');
    });

    it('should handle malformed JSON at specific line', () => {
      const ledgerPath = getLedgerPath(testDir);
      const op: Operation = {
        id: 'mem_001',
        op: 'capture',
        ts: '2025-01-01T00:00:00.000Z',
        actor: 'alice',
        workspace: 'test',
        payload: { body: 'Test memory' },
      };

      fs.writeFileSync(ledgerPath, JSON.stringify(op) + '\n{malformed}\n', 'utf-8');

      expect(() => readLedger(testDir)).toThrow('Invalid JSON at line 2');
    });

    it('should handle whitespace-only lines', () => {
      const ledgerPath = getLedgerPath(testDir);
      const op: Operation = {
        id: 'mem_001',
        op: 'capture',
        ts: '2025-01-01T00:00:00.000Z',
        actor: 'alice',
        workspace: 'test',
        payload: { body: 'Test memory' },
      };

      fs.writeFileSync(ledgerPath, '   \n' + JSON.stringify(op) + '\n\t\t\n', 'utf-8');

      const ops = readLedger(testDir);
      expect(ops).toHaveLength(1);
      expect(ops[0]).toEqual(op);
    });
  });

  describe('appendOperation', () => {
    it('should create ledger file if it does not exist', () => {
      const ledgerPath = getLedgerPath(testDir);
      expect(fs.existsSync(ledgerPath)).toBe(false);

      const op: Operation = {
        id: 'mem_001',
        op: 'capture',
        ts: '2025-01-01T00:00:00.000Z',
        actor: 'alice',
        workspace: 'test',
        payload: { body: 'Test memory' },
      };

      appendOperation(testDir, op);

      expect(fs.existsSync(ledgerPath)).toBe(true);
    });

    it('should append operation to ledger', () => {
      const op1: Operation = {
        id: 'mem_001',
        op: 'capture',
        ts: '2025-01-01T00:00:00.000Z',
        actor: 'alice',
        workspace: 'test',
        payload: { body: 'Test memory' },
      };

      appendOperation(testDir, op1);

      const ops = readLedger(testDir);
      expect(ops).toHaveLength(1);
      expect(ops[0]).toEqual(op1);
    });

    it('should append multiple operations', () => {
      const op1: Operation = {
        id: 'mem_001',
        op: 'capture',
        ts: '2025-01-01T00:00:00.000Z',
        actor: 'alice',
        workspace: 'test',
        payload: { body: 'Test memory' },
      };
      const op2: Operation = {
        id: 'cmt_001',
        op: 'commit',
        ts: '2025-01-01T00:01:00.000Z',
        actor: 'alice',
        workspace: 'test',
        payload: { body: 'Test commitment', source: 'mem_001' },
      };

      appendOperation(testDir, op1);
      appendOperation(testDir, op2);

      const ops = readLedger(testDir);
      expect(ops).toHaveLength(2);
      expect(ops[0]).toEqual(op1);
      expect(ops[1]).toEqual(op2);
    });

    it('should append with newline', () => {
      const ledgerPath = getLedgerPath(testDir);
      const op: Operation = {
        id: 'mem_001',
        op: 'capture',
        ts: '2025-01-01T00:00:00.000Z',
        actor: 'alice',
        workspace: 'test',
        payload: { body: 'Test memory' },
      };

      appendOperation(testDir, op);

      const content = fs.readFileSync(ledgerPath, 'utf-8');
      expect(content.endsWith('\n')).toBe(true);
    });

    it('should preserve existing operations', () => {
      const ledgerPath = getLedgerPath(testDir);
      const op1: Operation = {
        id: 'mem_001',
        op: 'capture',
        ts: '2025-01-01T00:00:00.000Z',
        actor: 'alice',
        workspace: 'test',
        payload: { body: 'Test memory' },
      };

      fs.writeFileSync(ledgerPath, JSON.stringify(op1) + '\n', 'utf-8');

      const op2: Operation = {
        id: 'cmt_001',
        op: 'commit',
        ts: '2025-01-01T00:01:00.000Z',
        actor: 'alice',
        workspace: 'test',
        payload: { body: 'Test commitment', source: 'mem_001' },
      };

      appendOperation(testDir, op2);

      const ops = readLedger(testDir);
      expect(ops).toHaveLength(2);
      expect(ops[0]).toEqual(op1);
      expect(ops[1]).toEqual(op2);
    });
  });

  describe('idExists', () => {
    it('should return false for empty ledger', () => {
      expect(idExists([], 'mem_001')).toBe(false);
    });

    it('should return true when ID exists', () => {
      const ops: Operation[] = [
        {
          id: 'mem_001',
          op: 'capture',
          ts: '2025-01-01T00:00:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test memory' },
        },
      ];

      expect(idExists(ops, 'mem_001')).toBe(true);
    });

    it('should return false when ID does not exist', () => {
      const ops: Operation[] = [
        {
          id: 'mem_001',
          op: 'capture',
          ts: '2025-01-01T00:00:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test memory' },
        },
      ];

      expect(idExists(ops, 'mem_002')).toBe(false);
    });

    it('should work with multiple operations', () => {
      const ops: Operation[] = [
        {
          id: 'mem_001',
          op: 'capture',
          ts: '2025-01-01T00:00:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test memory' },
        },
        {
          id: 'cmt_001',
          op: 'commit',
          ts: '2025-01-01T00:01:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test commitment', source: 'mem_001' },
        },
      ];

      expect(idExists(ops, 'mem_001')).toBe(true);
      expect(idExists(ops, 'cmt_001')).toBe(true);
      expect(idExists(ops, 'mem_002')).toBe(false);
    });

    it('should match exact IDs only', () => {
      const ops: Operation[] = [
        {
          id: 'mem_001',
          op: 'capture',
          ts: '2025-01-01T00:00:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test memory' },
        },
      ];

      expect(idExists(ops, 'mem_001')).toBe(true);
      expect(idExists(ops, 'mem_01')).toBe(false);
      expect(idExists(ops, 'mem_0011')).toBe(false);
    });
  });

  describe('sourceKeyExists', () => {
    it('should return false for empty ledger', () => {
      expect(sourceKeyExists([], 'key1')).toBe(false);
    });

    it('should return true when source_key exists', () => {
      const ops: Operation[] = [
        {
          id: 'mem_001',
          op: 'capture',
          ts: '2025-01-01T00:00:00.000Z',
          actor: 'alice',
          workspace: 'test',
          source_key: 'key1',
          payload: { body: 'Test memory' },
        },
      ];

      expect(sourceKeyExists(ops, 'key1')).toBe(true);
    });

    it('should return false when source_key does not exist', () => {
      const ops: Operation[] = [
        {
          id: 'mem_001',
          op: 'capture',
          ts: '2025-01-01T00:00:00.000Z',
          actor: 'alice',
          workspace: 'test',
          source_key: 'key1',
          payload: { body: 'Test memory' },
        },
      ];

      expect(sourceKeyExists(ops, 'key2')).toBe(false);
    });

    it('should return false when operation has no source_key', () => {
      const ops: Operation[] = [
        {
          id: 'mem_001',
          op: 'capture',
          ts: '2025-01-01T00:00:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test memory' },
        },
      ];

      expect(sourceKeyExists(ops, 'key1')).toBe(false);
    });

    it('should work across multiple operations', () => {
      const ops: Operation[] = [
        {
          id: 'mem_001',
          op: 'capture',
          ts: '2025-01-01T00:00:00.000Z',
          actor: 'alice',
          workspace: 'test',
          source_key: 'key1',
          payload: { body: 'Test memory' },
        },
        {
          id: 'cmt_001',
          op: 'commit',
          ts: '2025-01-01T00:01:00.000Z',
          actor: 'alice',
          workspace: 'test',
          source_key: 'key2',
          payload: { body: 'Test commitment', source: 'mem_001' },
        },
      ];

      expect(sourceKeyExists(ops, 'key1')).toBe(true);
      expect(sourceKeyExists(ops, 'key2')).toBe(true);
      expect(sourceKeyExists(ops, 'key3')).toBe(false);
    });
  });

  describe('getMemoryIds', () => {
    it('should return empty set for empty ledger', () => {
      const ids = getMemoryIds([]);
      expect(ids.size).toBe(0);
    });

    it('should return memory IDs from capture operations', () => {
      const ops: Operation[] = [
        {
          id: 'mem_001',
          op: 'capture',
          ts: '2025-01-01T00:00:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test memory' },
        },
        {
          id: 'mem_002',
          op: 'capture',
          ts: '2025-01-01T00:01:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test memory 2' },
        },
      ];

      const ids = getMemoryIds(ops);
      expect(ids.size).toBe(2);
      expect(ids.has('mem_001')).toBe(true);
      expect(ids.has('mem_002')).toBe(true);
    });

    it('should not include commitment IDs', () => {
      const ops: Operation[] = [
        {
          id: 'mem_001',
          op: 'capture',
          ts: '2025-01-01T00:00:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test memory' },
        },
        {
          id: 'cmt_001',
          op: 'commit',
          ts: '2025-01-01T00:01:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test commitment', source: 'mem_001' },
        },
      ];

      const ids = getMemoryIds(ops);
      expect(ids.size).toBe(1);
      expect(ids.has('mem_001')).toBe(true);
      expect(ids.has('cmt_001')).toBe(false);
    });

    it('should not include operation IDs', () => {
      const ops: Operation[] = [
        {
          id: 'mem_001',
          op: 'capture',
          ts: '2025-01-01T00:00:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test memory' },
        },
        {
          id: 'op_001',
          op: 'claim',
          ts: '2025-01-01T00:01:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { commitment: 'cmt_001' },
        },
      ];

      const ids = getMemoryIds(ops);
      expect(ids.size).toBe(1);
      expect(ids.has('mem_001')).toBe(true);
      expect(ids.has('op_001')).toBe(false);
    });

    it('should handle mixed operations', () => {
      const ops: Operation[] = [
        {
          id: 'mem_001',
          op: 'capture',
          ts: '2025-01-01T00:00:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test memory' },
        },
        {
          id: 'cmt_001',
          op: 'commit',
          ts: '2025-01-01T00:01:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test commitment', source: 'mem_001' },
        },
        {
          id: 'mem_002',
          op: 'capture',
          ts: '2025-01-01T00:02:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test memory 2' },
        },
      ];

      const ids = getMemoryIds(ops);
      expect(ids.size).toBe(2);
      expect(ids.has('mem_001')).toBe(true);
      expect(ids.has('mem_002')).toBe(true);
    });
  });

  describe('getCommitmentIds', () => {
    it('should return empty set for empty ledger', () => {
      const ids = getCommitmentIds([]);
      expect(ids.size).toBe(0);
    });

    it('should return commitment IDs from commit operations', () => {
      const ops: Operation[] = [
        {
          id: 'mem_001',
          op: 'capture',
          ts: '2025-01-01T00:00:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test memory' },
        },
        {
          id: 'cmt_001',
          op: 'commit',
          ts: '2025-01-01T00:01:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test commitment', source: 'mem_001' },
        },
      ];

      const ids = getCommitmentIds(ops);
      expect(ids.size).toBe(1);
      expect(ids.has('cmt_001')).toBe(true);
    });

    it('should not include memory IDs', () => {
      const ops: Operation[] = [
        {
          id: 'mem_001',
          op: 'capture',
          ts: '2025-01-01T00:00:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test memory' },
        },
        {
          id: 'cmt_001',
          op: 'commit',
          ts: '2025-01-01T00:01:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test commitment', source: 'mem_001' },
        },
      ];

      const ids = getCommitmentIds(ops);
      expect(ids.size).toBe(1);
      expect(ids.has('cmt_001')).toBe(true);
      expect(ids.has('mem_001')).toBe(false);
    });

    it('should handle multiple commitments', () => {
      const ops: Operation[] = [
        {
          id: 'mem_001',
          op: 'capture',
          ts: '2025-01-01T00:00:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test memory' },
        },
        {
          id: 'cmt_001',
          op: 'commit',
          ts: '2025-01-01T00:01:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test commitment', source: 'mem_001' },
        },
        {
          id: 'cmt_002',
          op: 'commit',
          ts: '2025-01-01T00:02:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test commitment 2', source: 'mem_001' },
        },
      ];

      const ids = getCommitmentIds(ops);
      expect(ids.size).toBe(2);
      expect(ids.has('cmt_001')).toBe(true);
      expect(ids.has('cmt_002')).toBe(true);
    });
  });

  describe('getAllRecordIds', () => {
    it('should return empty set for empty ledger', () => {
      const ids = getAllRecordIds([]);
      expect(ids.size).toBe(0);
    });

    it('should return both memory and commitment IDs', () => {
      const ops: Operation[] = [
        {
          id: 'mem_001',
          op: 'capture',
          ts: '2025-01-01T00:00:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test memory' },
        },
        {
          id: 'cmt_001',
          op: 'commit',
          ts: '2025-01-01T00:01:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test commitment', source: 'mem_001' },
        },
      ];

      const ids = getAllRecordIds(ops);
      expect(ids.size).toBe(2);
      expect(ids.has('mem_001')).toBe(true);
      expect(ids.has('cmt_001')).toBe(true);
    });

    it('should not include operation IDs', () => {
      const ops: Operation[] = [
        {
          id: 'mem_001',
          op: 'capture',
          ts: '2025-01-01T00:00:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test memory' },
        },
        {
          id: 'op_001',
          op: 'claim',
          ts: '2025-01-01T00:01:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { commitment: 'cmt_001' },
        },
      ];

      const ids = getAllRecordIds(ops);
      expect(ids.size).toBe(1);
      expect(ids.has('mem_001')).toBe(true);
      expect(ids.has('op_001')).toBe(false);
    });

    it('should handle mixed operations', () => {
      const ops: Operation[] = [
        {
          id: 'mem_001',
          op: 'capture',
          ts: '2025-01-01T00:00:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test memory' },
        },
        {
          id: 'cmt_001',
          op: 'commit',
          ts: '2025-01-01T00:01:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test commitment', source: 'mem_001' },
        },
        {
          id: 'op_001',
          op: 'claim',
          ts: '2025-01-01T00:02:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { commitment: 'cmt_001' },
        },
        {
          id: 'mem_002',
          op: 'capture',
          ts: '2025-01-01T00:03:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test memory 2' },
        },
      ];

      const ids = getAllRecordIds(ops);
      expect(ids.size).toBe(3);
      expect(ids.has('mem_001')).toBe(true);
      expect(ids.has('cmt_001')).toBe(true);
      expect(ids.has('mem_002')).toBe(true);
      expect(ids.has('op_001')).toBe(false);
    });
  });
});
