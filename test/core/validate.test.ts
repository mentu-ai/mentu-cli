import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Operation, GenesisKey } from '../../src/types.js';
import { validateOperation } from '../../src/core/validate.js';

describe('Validation', () => {
  describe('Envelope Validation', () => {
    const baseOp = {
      id: 'mem_12345678',
      op: 'capture',
      ts: '2024-01-01T00:00:00Z',
      actor: 'test',
      workspace: 'test',
      payload: { body: 'test' },
    };

    it('should reject missing id', () => {
      const op = { ...baseOp, id: undefined } as unknown as Operation;
      const result = validateOperation(op, [], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_MISSING_FIELD');
      expect(result.error?.details?.field).toBe('id');
    });

    it('should reject missing op', () => {
      const op = { ...baseOp, op: undefined } as unknown as Operation;
      const result = validateOperation(op, [], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_MISSING_FIELD');
      expect(result.error?.details?.field).toBe('op');
    });

    it('should reject missing ts', () => {
      const op = { ...baseOp, ts: undefined } as unknown as Operation;
      const result = validateOperation(op, [], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_MISSING_FIELD');
      expect(result.error?.details?.field).toBe('ts');
    });

    it('should reject missing actor', () => {
      const op = { ...baseOp, actor: undefined } as unknown as Operation;
      const result = validateOperation(op, [], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_MISSING_FIELD');
      expect(result.error?.details?.field).toBe('actor');
    });

    it('should reject invalid operation type', () => {
      const op = { ...baseOp, op: 'invalid' } as unknown as Operation;
      const result = validateOperation(op, [], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_INVALID_OP');
    });

    it('should reject duplicate id', () => {
      const ledger: Operation[] = [baseOp as Operation];
      const result = validateOperation(baseOp as Operation, ledger, null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_DUPLICATE_ID');
      expect(result.error?.details?.id).toBe('mem_12345678');
    });

    it('should reject duplicate source_key', () => {
      const op1 = { ...baseOp, id: 'mem_aaaaaaaa', source_key: 'key1' } as Operation;
      const op2 = { ...baseOp, id: 'mem_bbbbbbbb', source_key: 'key1' } as Operation;
      const ledger: Operation[] = [op1];
      const result = validateOperation(op2, ledger, null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_DUPLICATE_SOURCE_KEY');
      expect(result.error?.details?.source_key).toBe('key1');
    });

    it('should accept valid operation', () => {
      const result = validateOperation(baseOp as Operation, [], null);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('Capture Validation', () => {
    const baseLedger: Operation[] = [];

    it('should reject empty body', () => {
      const op: Operation = {
        id: 'mem_12345678',
        op: 'capture',
        ts: '2024-01-01T00:00:00Z',
        actor: 'test',
        workspace: 'test',
        payload: { body: '' },
      };
      const result = validateOperation(op, baseLedger, null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_EMPTY_BODY');
      expect(result.error?.details?.field).toBe('body');
    });

    it('should reject whitespace-only body', () => {
      const op: Operation = {
        id: 'mem_12345678',
        op: 'capture',
        ts: '2024-01-01T00:00:00Z',
        actor: 'test',
        workspace: 'test',
        payload: { body: '   \n\t  ' },
      };
      const result = validateOperation(op, baseLedger, null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_EMPTY_BODY');
    });

    it('should accept body with special characters', () => {
      const op: Operation = {
        id: 'mem_12345678',
        op: 'capture',
        ts: '2024-01-01T00:00:00Z',
        actor: 'test',
        workspace: 'test',
        payload: { body: 'Test with émojis 🎉 and symbols @#$%' },
      };
      const result = validateOperation(op, baseLedger, null);
      expect(result.valid).toBe(true);
    });

    it('should accept body with newlines', () => {
      const op: Operation = {
        id: 'mem_12345678',
        op: 'capture',
        ts: '2024-01-01T00:00:00Z',
        actor: 'test',
        workspace: 'test',
        payload: { body: 'Line 1\nLine 2\nLine 3' },
      };
      const result = validateOperation(op, baseLedger, null);
      expect(result.valid).toBe(true);
    });

    it('should accept capture with kind', () => {
      const op: Operation = {
        id: 'mem_12345678',
        op: 'capture',
        ts: '2024-01-01T00:00:00Z',
        actor: 'test',
        workspace: 'test',
        payload: { body: 'Test', kind: 'evidence' },
      };
      const result = validateOperation(op, baseLedger, null);
      expect(result.valid).toBe(true);
    });

    it('should accept capture with refs', () => {
      const op: Operation = {
        id: 'mem_12345678',
        op: 'capture',
        ts: '2024-01-01T00:00:00Z',
        actor: 'test',
        workspace: 'test',
        payload: { body: 'Test', refs: ['mem_aaaaaaaa', 'cmt_bbbbbbbb'] },
      };
      const result = validateOperation(op, baseLedger, null);
      expect(result.valid).toBe(true);
    });

    it('should accept capture with meta', () => {
      const op: Operation = {
        id: 'mem_12345678',
        op: 'capture',
        ts: '2024-01-01T00:00:00Z',
        actor: 'test',
        workspace: 'test',
        payload: { body: 'Test', meta: { key: 'value', count: 42 } },
      };
      const result = validateOperation(op, baseLedger, null);
      expect(result.valid).toBe(true);
    });
  });

  describe('Commit Validation', () => {
    const baseMemory: Operation = {
      id: 'mem_source01',
      op: 'capture',
      ts: '2024-01-01T00:00:00Z',
      actor: 'test',
      workspace: 'test',
      payload: { body: 'Source memory' },
    };

    it('should reject empty body', () => {
      const op: Operation = {
        id: 'cmt_12345678',
        op: 'commit',
        ts: '2024-01-01T00:00:01Z',
        actor: 'test',
        workspace: 'test',
        payload: { body: '', source: 'mem_source01' },
      };
      const result = validateOperation(op, [baseMemory], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_EMPTY_BODY');
    });

    it('should reject whitespace-only body', () => {
      const op: Operation = {
        id: 'cmt_12345678',
        op: 'commit',
        ts: '2024-01-01T00:00:01Z',
        actor: 'test',
        workspace: 'test',
        payload: { body: '   ', source: 'mem_source01' },
      };
      const result = validateOperation(op, [baseMemory], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_EMPTY_BODY');
    });

    it('should reject missing source', () => {
      const op: Operation = {
        id: 'cmt_12345678',
        op: 'commit',
        ts: '2024-01-01T00:00:01Z',
        actor: 'test',
        workspace: 'test',
        payload: { body: 'Test commit' } as any,
      };
      const result = validateOperation(op, [baseMemory], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_MISSING_FIELD');
      expect(result.error?.details?.field).toBe('source');
    });

    it('should reject nonexistent source', () => {
      const op: Operation = {
        id: 'cmt_12345678',
        op: 'commit',
        ts: '2024-01-01T00:00:01Z',
        actor: 'test',
        workspace: 'test',
        payload: { body: 'Test commit', source: 'mem_nonexist' },
      };
      const result = validateOperation(op, [baseMemory], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_REF_NOT_FOUND');
      expect(result.error?.details?.field).toBe('source');
      expect(result.error?.details?.value).toBe('mem_nonexist');
    });

    it('should accept valid commit', () => {
      const op: Operation = {
        id: 'cmt_12345678',
        op: 'commit',
        ts: '2024-01-01T00:00:01Z',
        actor: 'test',
        workspace: 'test',
        payload: { body: 'Fix the bug', source: 'mem_source01' },
      };
      const result = validateOperation(op, [baseMemory], null);
      expect(result.valid).toBe(true);
    });

    it('should accept commit with tags', () => {
      const op: Operation = {
        id: 'cmt_12345678',
        op: 'commit',
        ts: '2024-01-01T00:00:01Z',
        actor: 'test',
        workspace: 'test',
        payload: { body: 'Fix the bug', source: 'mem_source01', tags: ['urgent', 'bug'] },
      };
      const result = validateOperation(op, [baseMemory], null);
      expect(result.valid).toBe(true);
    });

    it('should accept commit with meta', () => {
      const op: Operation = {
        id: 'cmt_12345678',
        op: 'commit',
        ts: '2024-01-01T00:00:01Z',
        actor: 'test',
        workspace: 'test',
        payload: { body: 'Fix the bug', source: 'mem_source01', meta: { priority: 'high' } },
      };
      const result = validateOperation(op, [baseMemory], null);
      expect(result.valid).toBe(true);
    });
  });

  describe('Claim Validation', () => {
    const baseMemory: Operation = {
      id: 'mem_source01',
      op: 'capture',
      ts: '2024-01-01T00:00:00Z',
      actor: 'test',
      workspace: 'test',
      payload: { body: 'Source memory' },
    };

    const baseCommit: Operation = {
      id: 'cmt_12345678',
      op: 'commit',
      ts: '2024-01-01T00:00:01Z',
      actor: 'test',
      workspace: 'test',
      payload: { body: 'Fix the bug', source: 'mem_source01' },
    };

    it('should reject missing commitment', () => {
      const op: Operation = {
        id: 'op_12345678',
        op: 'claim',
        ts: '2024-01-01T00:00:02Z',
        actor: 'alice',
        workspace: 'test',
        payload: {} as any,
      };
      const result = validateOperation(op, [baseMemory, baseCommit], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_MISSING_FIELD');
      expect(result.error?.details?.field).toBe('commitment');
    });

    it('should reject nonexistent commitment', () => {
      const op: Operation = {
        id: 'op_12345678',
        op: 'claim',
        ts: '2024-01-01T00:00:02Z',
        actor: 'alice',
        workspace: 'test',
        payload: { commitment: 'cmt_nonexist' },
      };
      const result = validateOperation(op, [baseMemory, baseCommit], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_REF_NOT_FOUND');
      expect(result.error?.details?.field).toBe('commitment');
      expect(result.error?.details?.value).toBe('cmt_nonexist');
    });

    it('should reject claim on already claimed commitment', () => {
      const claim1: Operation = {
        id: 'op_claim001',
        op: 'claim',
        ts: '2024-01-01T00:00:02Z',
        actor: 'alice',
        workspace: 'test',
        payload: { commitment: 'cmt_12345678' },
      };
      const claim2: Operation = {
        id: 'op_claim002',
        op: 'claim',
        ts: '2024-01-01T00:00:03Z',
        actor: 'bob',
        workspace: 'test',
        payload: { commitment: 'cmt_12345678' },
      };
      const result = validateOperation(claim2, [baseMemory, baseCommit, claim1], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_ALREADY_CLAIMED');
      expect(result.error?.details?.commitment).toBe('cmt_12345678');
      expect(result.error?.details?.owner).toBe('alice');
    });

    it('should reject claim on closed commitment', () => {
      const evidence: Operation = {
        id: 'mem_evidence1',
        op: 'capture',
        ts: '2024-01-01T00:00:02Z',
        actor: 'test',
        workspace: 'test',
        payload: { body: 'Fixed', kind: 'evidence' },
      };
      const close: Operation = {
        id: 'op_close001',
        op: 'close',
        ts: '2024-01-01T00:00:03Z',
        actor: 'test',
        workspace: 'test',
        payload: { commitment: 'cmt_12345678', evidence: 'mem_evidence1' },
      };
      const claim: Operation = {
        id: 'op_claim001',
        op: 'claim',
        ts: '2024-01-01T00:00:04Z',
        actor: 'alice',
        workspace: 'test',
        payload: { commitment: 'cmt_12345678' },
      };
      const result = validateOperation(claim, [baseMemory, baseCommit, evidence, close], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_ALREADY_CLOSED');
    });

    it('should accept valid claim', () => {
      const op: Operation = {
        id: 'op_12345678',
        op: 'claim',
        ts: '2024-01-01T00:00:02Z',
        actor: 'alice',
        workspace: 'test',
        payload: { commitment: 'cmt_12345678' },
      };
      const result = validateOperation(op, [baseMemory, baseCommit], null);
      expect(result.valid).toBe(true);
    });

    it('should accept same actor claiming again (idempotent)', () => {
      const claim1: Operation = {
        id: 'op_claim001',
        op: 'claim',
        ts: '2024-01-01T00:00:02Z',
        actor: 'alice',
        workspace: 'test',
        payload: { commitment: 'cmt_12345678' },
      };
      const claim2: Operation = {
        id: 'op_claim002',
        op: 'claim',
        ts: '2024-01-01T00:00:03Z',
        actor: 'alice',
        workspace: 'test',
        payload: { commitment: 'cmt_12345678' },
      };
      const result = validateOperation(claim2, [baseMemory, baseCommit, claim1], null);
      expect(result.valid).toBe(true);
    });
  });

  describe('Release Validation', () => {
    const baseMemory: Operation = {
      id: 'mem_source01',
      op: 'capture',
      ts: '2024-01-01T00:00:00Z',
      actor: 'test',
      workspace: 'test',
      payload: { body: 'Source memory' },
    };

    const baseCommit: Operation = {
      id: 'cmt_12345678',
      op: 'commit',
      ts: '2024-01-01T00:00:01Z',
      actor: 'test',
      workspace: 'test',
      payload: { body: 'Fix the bug', source: 'mem_source01' },
    };

    const claim: Operation = {
      id: 'op_claim001',
      op: 'claim',
      ts: '2024-01-01T00:00:02Z',
      actor: 'alice',
      workspace: 'test',
      payload: { commitment: 'cmt_12345678' },
    };

    it('should reject missing commitment', () => {
      const op: Operation = {
        id: 'op_release01',
        op: 'release',
        ts: '2024-01-01T00:00:03Z',
        actor: 'alice',
        workspace: 'test',
        payload: {} as any,
      };
      const result = validateOperation(op, [baseMemory, baseCommit, claim], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_MISSING_FIELD');
      expect(result.error?.details?.field).toBe('commitment');
    });

    it('should reject nonexistent commitment', () => {
      const op: Operation = {
        id: 'op_release01',
        op: 'release',
        ts: '2024-01-01T00:00:03Z',
        actor: 'alice',
        workspace: 'test',
        payload: { commitment: 'cmt_nonexist' },
      };
      const result = validateOperation(op, [baseMemory, baseCommit, claim], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_REF_NOT_FOUND');
    });

    it('should reject release by non-owner', () => {
      const op: Operation = {
        id: 'op_release01',
        op: 'release',
        ts: '2024-01-01T00:00:03Z',
        actor: 'bob',
        workspace: 'test',
        payload: { commitment: 'cmt_12345678' },
      };
      const result = validateOperation(op, [baseMemory, baseCommit, claim], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_NOT_OWNER');
      expect(result.error?.details?.owner).toBe('alice');
      expect(result.error?.details?.actor).toBe('bob');
    });

    it('should reject release on closed commitment', () => {
      const evidence: Operation = {
        id: 'mem_evidence1',
        op: 'capture',
        ts: '2024-01-01T00:00:03Z',
        actor: 'alice',
        workspace: 'test',
        payload: { body: 'Fixed', kind: 'evidence' },
      };
      const close: Operation = {
        id: 'op_close001',
        op: 'close',
        ts: '2024-01-01T00:00:04Z',
        actor: 'alice',
        workspace: 'test',
        payload: { commitment: 'cmt_12345678', evidence: 'mem_evidence1' },
      };
      const release: Operation = {
        id: 'op_release01',
        op: 'release',
        ts: '2024-01-01T00:00:05Z',
        actor: 'alice',
        workspace: 'test',
        payload: { commitment: 'cmt_12345678' },
      };
      const result = validateOperation(release, [baseMemory, baseCommit, claim, evidence, close], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_ALREADY_CLOSED');
    });

    it('should accept valid release', () => {
      const op: Operation = {
        id: 'op_release01',
        op: 'release',
        ts: '2024-01-01T00:00:03Z',
        actor: 'alice',
        workspace: 'test',
        payload: { commitment: 'cmt_12345678' },
      };
      const result = validateOperation(op, [baseMemory, baseCommit, claim], null);
      expect(result.valid).toBe(true);
    });

    it('should accept release with reason', () => {
      const op: Operation = {
        id: 'op_release01',
        op: 'release',
        ts: '2024-01-01T00:00:03Z',
        actor: 'alice',
        workspace: 'test',
        payload: { commitment: 'cmt_12345678', reason: 'Not enough time' },
      };
      const result = validateOperation(op, [baseMemory, baseCommit, claim], null);
      expect(result.valid).toBe(true);
    });

    it('should reject release on unclaimed commitment', () => {
      const op: Operation = {
        id: 'op_release01',
        op: 'release',
        ts: '2024-01-01T00:00:03Z',
        actor: 'alice',
        workspace: 'test',
        payload: { commitment: 'cmt_12345678' },
      };
      const result = validateOperation(op, [baseMemory, baseCommit], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_NOT_OWNER');
    });
  });

  describe('Close Validation', () => {
    const baseMemory: Operation = {
      id: 'mem_source01',
      op: 'capture',
      ts: '2024-01-01T00:00:00Z',
      actor: 'test',
      workspace: 'test',
      payload: { body: 'Source memory' },
    };

    const baseCommit: Operation = {
      id: 'cmt_12345678',
      op: 'commit',
      ts: '2024-01-01T00:00:01Z',
      actor: 'test',
      workspace: 'test',
      payload: { body: 'Fix the bug', source: 'mem_source01' },
    };

    const evidence: Operation = {
      id: 'mem_evidence1',
      op: 'capture',
      ts: '2024-01-01T00:00:02Z',
      actor: 'test',
      workspace: 'test',
      payload: { body: 'Fixed', kind: 'evidence' },
    };

    const duplicate: Operation = {
      id: 'cmt_duplicat',
      op: 'commit',
      ts: '2024-01-01T00:00:02Z',
      actor: 'test',
      workspace: 'test',
      payload: { body: 'Another bug fix', source: 'mem_source01' },
    };

    it('should reject missing commitment', () => {
      const op: Operation = {
        id: 'op_close001',
        op: 'close',
        ts: '2024-01-01T00:00:03Z',
        actor: 'test',
        workspace: 'test',
        payload: { evidence: 'mem_evidence1' } as any,
      };
      const result = validateOperation(op, [baseMemory, baseCommit, evidence], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_MISSING_FIELD');
      expect(result.error?.details?.field).toBe('commitment');
    });

    it('should reject missing evidence and duplicate_of', () => {
      const op: Operation = {
        id: 'op_close001',
        op: 'close',
        ts: '2024-01-01T00:00:03Z',
        actor: 'test',
        workspace: 'test',
        payload: { commitment: 'cmt_12345678' } as any,
      };
      const result = validateOperation(op, [baseMemory, baseCommit, evidence], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_MISSING_FIELD');
      expect(result.error?.details?.field).toBe('evidence');
    });

    it('should reject both evidence and duplicate_of', () => {
      const op: Operation = {
        id: 'op_close001',
        op: 'close',
        ts: '2024-01-01T00:00:03Z',
        actor: 'test',
        workspace: 'test',
        payload: { commitment: 'cmt_12345678', evidence: 'mem_evidence1', duplicate_of: 'cmt_duplicat' },
      };
      const result = validateOperation(op, [baseMemory, baseCommit, evidence, duplicate], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_INVALID_OP');
    });

    it('should reject nonexistent commitment', () => {
      const op: Operation = {
        id: 'op_close001',
        op: 'close',
        ts: '2024-01-01T00:00:03Z',
        actor: 'test',
        workspace: 'test',
        payload: { commitment: 'cmt_nonexist', evidence: 'mem_evidence1' },
      };
      const result = validateOperation(op, [baseMemory, baseCommit, evidence], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_REF_NOT_FOUND');
      expect(result.error?.details?.field).toBe('commitment');
    });

    it('should reject nonexistent evidence', () => {
      const op: Operation = {
        id: 'op_close001',
        op: 'close',
        ts: '2024-01-01T00:00:03Z',
        actor: 'test',
        workspace: 'test',
        payload: { commitment: 'cmt_12345678', evidence: 'mem_nonexist' },
      };
      const result = validateOperation(op, [baseMemory, baseCommit], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_REF_NOT_FOUND');
      expect(result.error?.details?.field).toBe('evidence');
    });

    it('should reject nonexistent duplicate_of', () => {
      const op: Operation = {
        id: 'op_close001',
        op: 'close',
        ts: '2024-01-01T00:00:03Z',
        actor: 'test',
        workspace: 'test',
        payload: { commitment: 'cmt_12345678', duplicate_of: 'cmt_nonexist' },
      };
      const result = validateOperation(op, [baseMemory, baseCommit], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_REF_NOT_FOUND');
      expect(result.error?.details?.field).toBe('duplicate_of');
    });

    it('should reject closing already closed commitment', () => {
      const close1: Operation = {
        id: 'op_close001',
        op: 'close',
        ts: '2024-01-01T00:00:03Z',
        actor: 'test',
        workspace: 'test',
        payload: { commitment: 'cmt_12345678', evidence: 'mem_evidence1' },
      };
      const close2: Operation = {
        id: 'op_close002',
        op: 'close',
        ts: '2024-01-01T00:00:04Z',
        actor: 'test',
        workspace: 'test',
        payload: { commitment: 'cmt_12345678', evidence: 'mem_evidence1' },
      };
      const result = validateOperation(close2, [baseMemory, baseCommit, evidence, close1], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_ALREADY_CLOSED');
    });

    it('should accept valid close with evidence', () => {
      const op: Operation = {
        id: 'op_close001',
        op: 'close',
        ts: '2024-01-01T00:00:03Z',
        actor: 'test',
        workspace: 'test',
        payload: { commitment: 'cmt_12345678', evidence: 'mem_evidence1' },
      };
      const result = validateOperation(op, [baseMemory, baseCommit, evidence], null);
      expect(result.valid).toBe(true);
    });

    it('should accept valid close with duplicate_of', () => {
      const op: Operation = {
        id: 'op_close001',
        op: 'close',
        ts: '2024-01-01T00:00:03Z',
        actor: 'test',
        workspace: 'test',
        payload: { commitment: 'cmt_12345678', duplicate_of: 'cmt_duplicat' },
      };
      const result = validateOperation(op, [baseMemory, baseCommit, duplicate], null);
      expect(result.valid).toBe(true);
    });

    it('should reject duplicate close by non-owner of claimed commitment', () => {
      const claim: Operation = {
        id: 'op_claim001',
        op: 'claim',
        ts: '2024-01-01T00:00:02Z',
        actor: 'alice',
        workspace: 'test',
        payload: { commitment: 'cmt_12345678' },
      };
      const op: Operation = {
        id: 'op_close001',
        op: 'close',
        ts: '2024-01-01T00:00:03Z',
        actor: 'bob',
        workspace: 'test',
        payload: { commitment: 'cmt_12345678', duplicate_of: 'cmt_duplicat' },
      };
      const result = validateOperation(op, [baseMemory, baseCommit, duplicate, claim], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_NOT_OWNER');
    });
  });

  describe('Annotate Validation', () => {
    const baseMemory: Operation = {
      id: 'mem_target01',
      op: 'capture',
      ts: '2024-01-01T00:00:00Z',
      actor: 'test',
      workspace: 'test',
      payload: { body: 'Target record' },
    };

    it('should reject missing target', () => {
      const op: Operation = {
        id: 'op_annotate1',
        op: 'annotate',
        ts: '2024-01-01T00:00:01Z',
        actor: 'test',
        workspace: 'test',
        payload: { body: 'Note' } as any,
      };
      const result = validateOperation(op, [baseMemory], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_MISSING_FIELD');
      expect(result.error?.details?.field).toBe('target');
    });

    it('should reject empty body', () => {
      const op: Operation = {
        id: 'op_annotate1',
        op: 'annotate',
        ts: '2024-01-01T00:00:01Z',
        actor: 'test',
        workspace: 'test',
        payload: { target: 'mem_target01', body: '' },
      };
      const result = validateOperation(op, [baseMemory], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_EMPTY_BODY');
    });

    it('should reject whitespace-only body', () => {
      const op: Operation = {
        id: 'op_annotate1',
        op: 'annotate',
        ts: '2024-01-01T00:00:01Z',
        actor: 'test',
        workspace: 'test',
        payload: { target: 'mem_target01', body: '   ' },
      };
      const result = validateOperation(op, [baseMemory], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_EMPTY_BODY');
    });

    it('should reject nonexistent target', () => {
      const op: Operation = {
        id: 'op_annotate1',
        op: 'annotate',
        ts: '2024-01-01T00:00:01Z',
        actor: 'test',
        workspace: 'test',
        payload: { target: 'mem_nonexist', body: 'Note' },
      };
      const result = validateOperation(op, [baseMemory], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_REF_NOT_FOUND');
      expect(result.error?.details?.field).toBe('target');
    });

    it('should accept valid annotate', () => {
      const op: Operation = {
        id: 'op_annotate1',
        op: 'annotate',
        ts: '2024-01-01T00:00:01Z',
        actor: 'test',
        workspace: 'test',
        payload: { target: 'mem_target01', body: 'Important note' },
      };
      const result = validateOperation(op, [baseMemory], null);
      expect(result.valid).toBe(true);
    });

    it('should accept annotate with kind', () => {
      const op: Operation = {
        id: 'op_annotate1',
        op: 'annotate',
        ts: '2024-01-01T00:00:01Z',
        actor: 'test',
        workspace: 'test',
        payload: { target: 'mem_target01', body: 'Note', kind: 'comment' },
      };
      const result = validateOperation(op, [baseMemory], null);
      expect(result.valid).toBe(true);
    });

    it('should accept annotate with refs', () => {
      const op: Operation = {
        id: 'op_annotate1',
        op: 'annotate',
        ts: '2024-01-01T00:00:01Z',
        actor: 'test',
        workspace: 'test',
        payload: { target: 'mem_target01', body: 'Note', refs: ['mem_aaaaaaaa'] },
      };
      const result = validateOperation(op, [baseMemory], null);
      expect(result.valid).toBe(true);
    });
  });

  describe('Link Validation', () => {
    const baseMemory: Operation = {
      id: 'mem_source01',
      op: 'capture',
      ts: '2024-01-01T00:00:00Z',
      actor: 'test',
      workspace: 'test',
      payload: { body: 'Source memory' },
    };

    const baseCommit1: Operation = {
      id: 'cmt_12345678',
      op: 'commit',
      ts: '2024-01-01T00:00:01Z',
      actor: 'test',
      workspace: 'test',
      payload: { body: 'Fix bug', source: 'mem_source01' },
    };

    const baseCommit2: Operation = {
      id: 'cmt_target01',
      op: 'commit',
      ts: '2024-01-01T00:00:02Z',
      actor: 'test',
      workspace: 'test',
      payload: { body: 'Another fix', source: 'mem_source01' },
    };

    it('should reject missing source', () => {
      const op: Operation = {
        id: 'op_link0001',
        op: 'link',
        ts: '2024-01-01T00:00:03Z',
        actor: 'test',
        workspace: 'test',
        payload: { target: 'cmt_target01' } as any,
      };
      const result = validateOperation(op, [baseMemory, baseCommit1, baseCommit2], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_MISSING_FIELD');
      expect(result.error?.details?.field).toBe('source');
    });

    it('should reject missing target', () => {
      const op: Operation = {
        id: 'op_link0001',
        op: 'link',
        ts: '2024-01-01T00:00:03Z',
        actor: 'test',
        workspace: 'test',
        payload: { source: 'mem_source01' } as any,
      };
      const result = validateOperation(op, [baseMemory, baseCommit1, baseCommit2], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_MISSING_FIELD');
      expect(result.error?.details?.field).toBe('target');
    });

    it('should reject nonexistent source', () => {
      const op: Operation = {
        id: 'op_link0001',
        op: 'link',
        ts: '2024-01-01T00:00:03Z',
        actor: 'test',
        workspace: 'test',
        payload: { source: 'mem_nonexist', target: 'cmt_target01' },
      };
      const result = validateOperation(op, [baseMemory, baseCommit1, baseCommit2], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_REF_NOT_FOUND');
      expect(result.error?.details?.field).toBe('source');
    });

    it('should reject nonexistent target', () => {
      const op: Operation = {
        id: 'op_link0001',
        op: 'link',
        ts: '2024-01-01T00:00:03Z',
        actor: 'test',
        workspace: 'test',
        payload: { source: 'mem_source01', target: 'cmt_nonexist' },
      };
      const result = validateOperation(op, [baseMemory, baseCommit1, baseCommit2], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_REF_NOT_FOUND');
      expect(result.error?.details?.field).toBe('target');
    });

    it('should reject target that is not a commitment', () => {
      const op: Operation = {
        id: 'op_link0001',
        op: 'link',
        ts: '2024-01-01T00:00:03Z',
        actor: 'test',
        workspace: 'test',
        payload: { source: 'cmt_12345678', target: 'mem_source01' },
      };
      const result = validateOperation(op, [baseMemory, baseCommit1, baseCommit2], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_REF_NOT_FOUND');
      expect(result.error?.details?.field).toBe('target');
    });

    it('should reject self-link', () => {
      const op: Operation = {
        id: 'op_link0001',
        op: 'link',
        ts: '2024-01-01T00:00:03Z',
        actor: 'test',
        workspace: 'test',
        payload: { source: 'cmt_12345678', target: 'cmt_12345678' },
      };
      const result = validateOperation(op, [baseMemory, baseCommit1, baseCommit2], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_INVALID_OP');
    });

    it('should reject invalid link kind', () => {
      const op: Operation = {
        id: 'op_link0001',
        op: 'link',
        ts: '2024-01-01T00:00:03Z',
        actor: 'test',
        workspace: 'test',
        payload: { source: 'mem_source01', target: 'cmt_target01', kind: 'invalid' } as any,
      };
      const result = validateOperation(op, [baseMemory, baseCommit1, baseCommit2], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_INVALID_OP');
    });

    it('should accept valid link from memory to commitment', () => {
      const op: Operation = {
        id: 'op_link0001',
        op: 'link',
        ts: '2024-01-01T00:00:03Z',
        actor: 'test',
        workspace: 'test',
        payload: { source: 'mem_source01', target: 'cmt_target01' },
      };
      const result = validateOperation(op, [baseMemory, baseCommit1, baseCommit2], null);
      expect(result.valid).toBe(true);
    });

    it('should accept valid link from commitment to commitment', () => {
      const op: Operation = {
        id: 'op_link0001',
        op: 'link',
        ts: '2024-01-01T00:00:03Z',
        actor: 'test',
        workspace: 'test',
        payload: { source: 'cmt_12345678', target: 'cmt_target01' },
      };
      const result = validateOperation(op, [baseMemory, baseCommit1, baseCommit2], null);
      expect(result.valid).toBe(true);
    });

    it('should accept valid link with kind=related', () => {
      const op: Operation = {
        id: 'op_link0001',
        op: 'link',
        ts: '2024-01-01T00:00:03Z',
        actor: 'test',
        workspace: 'test',
        payload: { source: 'mem_source01', target: 'cmt_target01', kind: 'related' },
      };
      const result = validateOperation(op, [baseMemory, baseCommit1, baseCommit2], null);
      expect(result.valid).toBe(true);
    });

    it('should accept valid link with kind=duplicate', () => {
      const op: Operation = {
        id: 'op_link0001',
        op: 'link',
        ts: '2024-01-01T00:00:03Z',
        actor: 'test',
        workspace: 'test',
        payload: { source: 'cmt_12345678', target: 'cmt_target01', kind: 'duplicate' },
      };
      const result = validateOperation(op, [baseMemory, baseCommit1, baseCommit2], null);
      expect(result.valid).toBe(true);
    });

    it('should accept valid link with kind=caused_by', () => {
      const op: Operation = {
        id: 'op_link0001',
        op: 'link',
        ts: '2024-01-01T00:00:03Z',
        actor: 'test',
        workspace: 'test',
        payload: { source: 'mem_source01', target: 'cmt_target01', kind: 'caused_by' },
      };
      const result = validateOperation(op, [baseMemory, baseCommit1, baseCommit2], null);
      expect(result.valid).toBe(true);
    });

    it('should accept valid link with kind=blocks', () => {
      const op: Operation = {
        id: 'op_link0001',
        op: 'link',
        ts: '2024-01-01T00:00:03Z',
        actor: 'test',
        workspace: 'test',
        payload: { source: 'cmt_12345678', target: 'cmt_target01', kind: 'blocks' },
      };
      const result = validateOperation(op, [baseMemory, baseCommit1, baseCommit2], null);
      expect(result.valid).toBe(true);
    });

    it('should accept valid link with kind=evidence', () => {
      const op: Operation = {
        id: 'op_link0001',
        op: 'link',
        ts: '2024-01-01T00:00:03Z',
        actor: 'test',
        workspace: 'test',
        payload: { source: 'mem_source01', target: 'cmt_target01', kind: 'evidence' },
      };
      const result = validateOperation(op, [baseMemory, baseCommit1, baseCommit2], null);
      expect(result.valid).toBe(true);
    });

    it('should accept link with reason', () => {
      const op: Operation = {
        id: 'op_link0001',
        op: 'link',
        ts: '2024-01-01T00:00:03Z',
        actor: 'test',
        workspace: 'test',
        payload: { source: 'mem_source01', target: 'cmt_target01', reason: 'Provides context' },
      };
      const result = validateOperation(op, [baseMemory, baseCommit1, baseCommit2], null);
      expect(result.valid).toBe(true);
    });
  });

  describe('Dismiss Validation', () => {
    const baseMemory: Operation = {
      id: 'mem_dismiss1',
      op: 'capture',
      ts: '2024-01-01T00:00:00Z',
      actor: 'test',
      workspace: 'test',
      payload: { body: 'Memory to dismiss' },
    };

    const sourceMemory: Operation = {
      id: 'mem_source01',
      op: 'capture',
      ts: '2024-01-01T00:00:00Z',
      actor: 'test',
      workspace: 'test',
      payload: { body: 'Source of commitment' },
    };

    const commit: Operation = {
      id: 'cmt_12345678',
      op: 'commit',
      ts: '2024-01-01T00:00:01Z',
      actor: 'test',
      workspace: 'test',
      payload: { body: 'Fix bug', source: 'mem_source01' },
    };

    it('should reject missing memory', () => {
      const op: Operation = {
        id: 'op_dismiss1',
        op: 'dismiss',
        ts: '2024-01-01T00:00:01Z',
        actor: 'test',
        workspace: 'test',
        payload: { reason: 'Not needed' } as any,
      };
      const result = validateOperation(op, [baseMemory], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_MISSING_FIELD');
      expect(result.error?.details?.field).toBe('memory');
    });

    it('should reject missing reason', () => {
      const op: Operation = {
        id: 'op_dismiss1',
        op: 'dismiss',
        ts: '2024-01-01T00:00:01Z',
        actor: 'test',
        workspace: 'test',
        payload: { memory: 'mem_dismiss1' } as any,
      };
      const result = validateOperation(op, [baseMemory], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_MISSING_FIELD');
      expect(result.error?.details?.field).toBe('reason');
    });

    it('should reject empty reason', () => {
      const op: Operation = {
        id: 'op_dismiss1',
        op: 'dismiss',
        ts: '2024-01-01T00:00:01Z',
        actor: 'test',
        workspace: 'test',
        payload: { memory: 'mem_dismiss1', reason: '' },
      };
      const result = validateOperation(op, [baseMemory], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_MISSING_FIELD');
      expect(result.error?.details?.field).toBe('reason');
    });

    it('should reject whitespace-only reason', () => {
      const op: Operation = {
        id: 'op_dismiss1',
        op: 'dismiss',
        ts: '2024-01-01T00:00:01Z',
        actor: 'test',
        workspace: 'test',
        payload: { memory: 'mem_dismiss1', reason: '   ' },
      };
      const result = validateOperation(op, [baseMemory], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_MISSING_FIELD');
    });

    it('should reject nonexistent memory', () => {
      const op: Operation = {
        id: 'op_dismiss1',
        op: 'dismiss',
        ts: '2024-01-01T00:00:01Z',
        actor: 'test',
        workspace: 'test',
        payload: { memory: 'mem_nonexist', reason: 'Not needed' },
      };
      const result = validateOperation(op, [baseMemory], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_REF_NOT_FOUND');
      expect(result.error?.details?.field).toBe('memory');
    });

    it('should reject dismissing memory that is source of commitment', () => {
      const op: Operation = {
        id: 'op_dismiss1',
        op: 'dismiss',
        ts: '2024-01-01T00:00:02Z',
        actor: 'test',
        workspace: 'test',
        payload: { memory: 'mem_source01', reason: 'Not needed' },
      };
      const result = validateOperation(op, [sourceMemory, commit], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_CONSTRAINT_VIOLATED');
      expect(result.error?.details?.memory).toBe('mem_source01');
    });

    it('should accept valid dismiss', () => {
      const op: Operation = {
        id: 'op_dismiss1',
        op: 'dismiss',
        ts: '2024-01-01T00:00:01Z',
        actor: 'test',
        workspace: 'test',
        payload: { memory: 'mem_dismiss1', reason: 'Not actionable' },
      };
      const result = validateOperation(op, [baseMemory], null);
      expect(result.valid).toBe(true);
    });

    it('should accept dismiss with tags', () => {
      const op: Operation = {
        id: 'op_dismiss1',
        op: 'dismiss',
        ts: '2024-01-01T00:00:01Z',
        actor: 'test',
        workspace: 'test',
        payload: { memory: 'mem_dismiss1', reason: 'Not actionable', tags: ['spam', 'duplicate'] },
      };
      const result = validateOperation(op, [baseMemory], null);
      expect(result.valid).toBe(true);
    });
  });

  describe('Triage Validation', () => {
    const mem1: Operation = {
      id: 'mem_triage01',
      op: 'capture',
      ts: '2024-01-01T00:00:00Z',
      actor: 'test',
      workspace: 'test',
      payload: { body: 'Memory 1' },
    };

    const mem2: Operation = {
      id: 'mem_triage02',
      op: 'capture',
      ts: '2024-01-01T00:00:01Z',
      actor: 'test',
      workspace: 'test',
      payload: { body: 'Memory 2' },
    };

    const commit: Operation = {
      id: 'cmt_12345678',
      op: 'commit',
      ts: '2024-01-01T00:00:02Z',
      actor: 'test',
      workspace: 'test',
      payload: { body: 'Fix bug', source: 'mem_triage01' },
    };

    it('should reject missing reviewed', () => {
      const op: Operation = {
        id: 'op_triage01',
        op: 'triage',
        ts: '2024-01-01T00:00:03Z',
        actor: 'test',
        workspace: 'test',
        payload: { summary: 'Triaged batch', decisions: [] } as any,
      };
      const result = validateOperation(op, [mem1, mem2], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_MISSING_FIELD');
      expect(result.error?.details?.field).toBe('reviewed');
    });

    it('should reject empty reviewed array', () => {
      const op: Operation = {
        id: 'op_triage01',
        op: 'triage',
        ts: '2024-01-01T00:00:03Z',
        actor: 'test',
        workspace: 'test',
        payload: { reviewed: [], summary: 'Triaged batch', decisions: [] },
      };
      const result = validateOperation(op, [mem1, mem2], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_MISSING_FIELD');
      expect(result.error?.details?.field).toBe('reviewed');
    });

    it('should reject missing summary', () => {
      const op: Operation = {
        id: 'op_triage01',
        op: 'triage',
        ts: '2024-01-01T00:00:03Z',
        actor: 'test',
        workspace: 'test',
        payload: { reviewed: ['mem_triage01'], decisions: [] } as any,
      };
      const result = validateOperation(op, [mem1, mem2], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_MISSING_FIELD');
      expect(result.error?.details?.field).toBe('summary');
    });

    it('should reject empty summary', () => {
      const op: Operation = {
        id: 'op_triage01',
        op: 'triage',
        ts: '2024-01-01T00:00:03Z',
        actor: 'test',
        workspace: 'test',
        payload: { reviewed: ['mem_triage01'], summary: '', decisions: [] },
      };
      const result = validateOperation(op, [mem1, mem2], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_MISSING_FIELD');
    });

    it('should reject whitespace-only summary', () => {
      const op: Operation = {
        id: 'op_triage01',
        op: 'triage',
        ts: '2024-01-01T00:00:03Z',
        actor: 'test',
        workspace: 'test',
        payload: { reviewed: ['mem_triage01'], summary: '   ', decisions: [] },
      };
      const result = validateOperation(op, [mem1, mem2], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_MISSING_FIELD');
    });

    it('should reject nonexistent reviewed memory', () => {
      const op: Operation = {
        id: 'op_triage01',
        op: 'triage',
        ts: '2024-01-01T00:00:03Z',
        actor: 'test',
        workspace: 'test',
        payload: { reviewed: ['mem_nonexist'], summary: 'Triaged', decisions: [] },
      };
      const result = validateOperation(op, [mem1, mem2], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_REF_NOT_FOUND');
      expect(result.error?.details?.field).toBe('reviewed');
      expect(result.error?.details?.value).toBe('mem_nonexist');
    });

    it('should accept valid triage', () => {
      const op: Operation = {
        id: 'op_triage01',
        op: 'triage',
        ts: '2024-01-01T00:00:03Z',
        actor: 'test',
        workspace: 'test',
        payload: {
          reviewed: ['mem_triage01', 'mem_triage02'],
          summary: 'Triaged 2 memories',
          decisions: [
            { memory: 'mem_triage01', action: 'create', target: 'cmt_12345678' },
            { memory: 'mem_triage02', action: 'dismiss', reason: 'Not needed' },
          ],
        },
      };
      const result = validateOperation(op, [mem1, mem2, commit], null);
      expect(result.valid).toBe(true);
    });

    it('should accept triage with single memory', () => {
      const op: Operation = {
        id: 'op_triage01',
        op: 'triage',
        ts: '2024-01-01T00:00:03Z',
        actor: 'test',
        workspace: 'test',
        payload: {
          reviewed: ['mem_triage01'],
          summary: 'Triaged 1 memory',
          decisions: [{ memory: 'mem_triage01', action: 'defer' }],
        },
      };
      const result = validateOperation(op, [mem1], null);
      expect(result.valid).toBe(true);
    });

    it('should accept triage with empty decisions', () => {
      const op: Operation = {
        id: 'op_triage01',
        op: 'triage',
        ts: '2024-01-01T00:00:03Z',
        actor: 'test',
        workspace: 'test',
        payload: {
          reviewed: ['mem_triage01'],
          summary: 'Reviewed but no actions',
          decisions: [],
        },
      };
      const result = validateOperation(op, [mem1], null);
      expect(result.valid).toBe(true);
    });
  });

  describe('Idempotency - Source Key', () => {
    const baseMemory: Operation = {
      id: 'mem_12345678',
      op: 'capture',
      ts: '2024-01-01T00:00:00Z',
      actor: 'test',
      workspace: 'test',
      payload: { body: 'Test' },
      source_key: 'external:123',
    };

    it('should reject operation with duplicate source_key', () => {
      const newOp: Operation = {
        id: 'mem_87654321',
        op: 'capture',
        ts: '2024-01-01T00:00:01Z',
        actor: 'test',
        workspace: 'test',
        payload: { body: 'Another test' },
        source_key: 'external:123',
      };
      const result = validateOperation(newOp, [baseMemory], null);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('E_DUPLICATE_SOURCE_KEY');
      expect(result.error?.details?.source_key).toBe('external:123');
    });

    it('should accept operation with unique source_key', () => {
      const newOp: Operation = {
        id: 'mem_87654321',
        op: 'capture',
        ts: '2024-01-01T00:00:01Z',
        actor: 'test',
        workspace: 'test',
        payload: { body: 'Another test' },
        source_key: 'external:456',
      };
      const result = validateOperation(newOp, [baseMemory], null);
      expect(result.valid).toBe(true);
    });

    it('should accept operation without source_key when ledger has source_key', () => {
      const newOp: Operation = {
        id: 'mem_87654321',
        op: 'capture',
        ts: '2024-01-01T00:00:01Z',
        actor: 'test',
        workspace: 'test',
        payload: { body: 'Another test' },
      };
      const result = validateOperation(newOp, [baseMemory], null);
      expect(result.valid).toBe(true);
    });
  });
});
