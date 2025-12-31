import { describe, it, expect } from 'vitest';
import type { Operation } from '../../src/types.js';
import {
  computeCommitmentState,
  getAnnotations,
  computeMemories,
  computeCommitments,
  getMemory,
  getCommitment,
  memoryExists,
  commitmentExists,
  recordExists,
  computeMemoryState,
  getLinkedMemories,
  getLinkedCommitments,
  getDuplicates,
  isMemoryDismissed,
  isMemorySourceOfCommitment,
} from '../../src/core/state.js';

describe('State', () => {
  describe('computeCommitmentState', () => {
    it('should return open state for new commitment', () => {
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

      const state = computeCommitmentState(ops, 'cmt_001');
      expect(state.state).toBe('open');
      expect(state.owner).toBeNull();
      expect(state.evidence).toBeNull();
      expect(state.closed_by).toBeNull();
      expect(state.duplicate_of).toBeNull();
    });

    it('should return claimed state after claim', () => {
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
          actor: 'bob',
          workspace: 'test',
          payload: { commitment: 'cmt_001' },
        },
      ];

      const state = computeCommitmentState(ops, 'cmt_001');
      expect(state.state).toBe('claimed');
      expect(state.owner).toBe('bob');
      expect(state.evidence).toBeNull();
      expect(state.closed_by).toBeNull();
    });

    it('should return open state after release', () => {
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
          actor: 'bob',
          workspace: 'test',
          payload: { commitment: 'cmt_001' },
        },
        {
          id: 'op_002',
          op: 'release',
          ts: '2025-01-01T00:03:00.000Z',
          actor: 'bob',
          workspace: 'test',
          payload: { commitment: 'cmt_001' },
        },
      ];

      const state = computeCommitmentState(ops, 'cmt_001');
      expect(state.state).toBe('open');
      expect(state.owner).toBeNull();
      expect(state.evidence).toBeNull();
      expect(state.closed_by).toBeNull();
    });

    it('should return closed state after close with evidence', () => {
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
          payload: { body: 'Evidence', kind: 'evidence' },
        },
        {
          id: 'op_001',
          op: 'close',
          ts: '2025-01-01T00:03:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { commitment: 'cmt_001', evidence: 'mem_002' },
        },
      ];

      const state = computeCommitmentState(ops, 'cmt_001');
      expect(state.state).toBe('closed');
      expect(state.owner).toBeNull();
      expect(state.evidence).toBe('mem_002');
      expect(state.closed_by).toBe('alice');
      expect(state.duplicate_of).toBeNull();
    });

    it('should return duplicate state after close as duplicate', () => {
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
          payload: { body: 'Duplicate commitment', source: 'mem_001' },
        },
        {
          id: 'op_001',
          op: 'close',
          ts: '2025-01-01T00:03:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { commitment: 'cmt_002', duplicate_of: 'cmt_001' },
        },
      ];

      const state = computeCommitmentState(ops, 'cmt_002');
      expect(state.state).toBe('duplicate');
      expect(state.owner).toBeNull();
      expect(state.evidence).toBeNull();
      expect(state.closed_by).toBe('alice');
      expect(state.duplicate_of).toBe('cmt_001');
    });

    it('should handle claim after release (ownership transfer)', () => {
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
          actor: 'bob',
          workspace: 'test',
          payload: { commitment: 'cmt_001' },
        },
        {
          id: 'op_002',
          op: 'release',
          ts: '2025-01-01T00:03:00.000Z',
          actor: 'bob',
          workspace: 'test',
          payload: { commitment: 'cmt_001' },
        },
        {
          id: 'op_003',
          op: 'claim',
          ts: '2025-01-01T00:04:00.000Z',
          actor: 'charlie',
          workspace: 'test',
          payload: { commitment: 'cmt_001' },
        },
      ];

      const state = computeCommitmentState(ops, 'cmt_001');
      expect(state.state).toBe('claimed');
      expect(state.owner).toBe('charlie');
    });

    it('should handle close from claimed state', () => {
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
          actor: 'bob',
          workspace: 'test',
          payload: { commitment: 'cmt_001' },
        },
        {
          id: 'mem_002',
          op: 'capture',
          ts: '2025-01-01T00:03:00.000Z',
          actor: 'bob',
          workspace: 'test',
          payload: { body: 'Evidence', kind: 'evidence' },
        },
        {
          id: 'op_002',
          op: 'close',
          ts: '2025-01-01T00:04:00.000Z',
          actor: 'bob',
          workspace: 'test',
          payload: { commitment: 'cmt_001', evidence: 'mem_002' },
        },
      ];

      const state = computeCommitmentState(ops, 'cmt_001');
      expect(state.state).toBe('closed');
      expect(state.owner).toBeNull();
      expect(state.evidence).toBe('mem_002');
      expect(state.closed_by).toBe('bob');
    });

    it('should handle nonexistent commitment', () => {
      const ops: Operation[] = [];
      const state = computeCommitmentState(ops, 'cmt_999');
      expect(state.state).toBe('open');
      expect(state.owner).toBeNull();
      expect(state.evidence).toBeNull();
      expect(state.closed_by).toBeNull();
    });
  });

  describe('getAnnotations', () => {
    it('should return empty array when no annotations exist', () => {
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

      const annotations = getAnnotations(ops, 'mem_001');
      expect(annotations).toEqual([]);
    });

    it('should return annotations for a memory', () => {
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
          op: 'annotate',
          ts: '2025-01-01T00:01:00.000Z',
          actor: 'bob',
          workspace: 'test',
          payload: { target: 'mem_001', body: 'Important note', kind: 'note' },
        },
      ];

      const annotations = getAnnotations(ops, 'mem_001');
      expect(annotations).toHaveLength(1);
      expect(annotations[0].id).toBe('op_001');
      expect(annotations[0].body).toBe('Important note');
      expect(annotations[0].kind).toBe('note');
      expect(annotations[0].actor).toBe('bob');
      expect(annotations[0].ts).toBe('2025-01-01T00:01:00.000Z');
    });

    it('should return annotations for a commitment', () => {
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
          op: 'annotate',
          ts: '2025-01-01T00:02:00.000Z',
          actor: 'bob',
          workspace: 'test',
          payload: { target: 'cmt_001', body: 'Blocked', kind: 'blocked' },
        },
      ];

      const annotations = getAnnotations(ops, 'cmt_001');
      expect(annotations).toHaveLength(1);
      expect(annotations[0].id).toBe('op_001');
      expect(annotations[0].body).toBe('Blocked');
      expect(annotations[0].kind).toBe('blocked');
    });

    it('should return multiple annotations in order', () => {
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
          op: 'annotate',
          ts: '2025-01-01T00:01:00.000Z',
          actor: 'bob',
          workspace: 'test',
          payload: { target: 'mem_001', body: 'First note' },
        },
        {
          id: 'op_002',
          op: 'annotate',
          ts: '2025-01-01T00:02:00.000Z',
          actor: 'charlie',
          workspace: 'test',
          payload: { target: 'mem_001', body: 'Second note' },
        },
      ];

      const annotations = getAnnotations(ops, 'mem_001');
      expect(annotations).toHaveLength(2);
      expect(annotations[0].body).toBe('First note');
      expect(annotations[1].body).toBe('Second note');
    });

    it('should only return annotations for specified target', () => {
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
        {
          id: 'op_001',
          op: 'annotate',
          ts: '2025-01-01T00:02:00.000Z',
          actor: 'bob',
          workspace: 'test',
          payload: { target: 'mem_001', body: 'Note for mem_001' },
        },
        {
          id: 'op_002',
          op: 'annotate',
          ts: '2025-01-01T00:03:00.000Z',
          actor: 'bob',
          workspace: 'test',
          payload: { target: 'mem_002', body: 'Note for mem_002' },
        },
      ];

      const annotations = getAnnotations(ops, 'mem_001');
      expect(annotations).toHaveLength(1);
      expect(annotations[0].body).toBe('Note for mem_001');
    });

    it('should handle annotation without kind', () => {
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
          op: 'annotate',
          ts: '2025-01-01T00:01:00.000Z',
          actor: 'bob',
          workspace: 'test',
          payload: { target: 'mem_001', body: 'Note without kind' },
        },
      ];

      const annotations = getAnnotations(ops, 'mem_001');
      expect(annotations).toHaveLength(1);
      expect(annotations[0].kind).toBeUndefined();
    });
  });

  describe('computeMemories', () => {
    it('should return empty array for empty ledger', () => {
      const memories = computeMemories([]);
      expect(memories).toEqual([]);
    });

    it('should compute memory from capture operation', () => {
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

      const memories = computeMemories(ops);
      expect(memories).toHaveLength(1);
      expect(memories[0].id).toBe('mem_001');
      expect(memories[0].body).toBe('Test memory');
      expect(memories[0].kind).toBeNull();
      expect(memories[0].actor).toBe('alice');
      expect(memories[0].ts).toBe('2025-01-01T00:00:00.000Z');
      expect(memories[0].annotations).toEqual([]);
    });

    it('should compute memory with kind', () => {
      const ops: Operation[] = [
        {
          id: 'mem_001',
          op: 'capture',
          ts: '2025-01-01T00:00:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test memory', kind: 'evidence' },
        },
      ];

      const memories = computeMemories(ops);
      expect(memories[0].kind).toBe('evidence');
    });

    it('should compute memory with refs', () => {
      const ops: Operation[] = [
        {
          id: 'mem_001',
          op: 'capture',
          ts: '2025-01-01T00:00:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test memory', refs: ['cmt_001'] },
        },
      ];

      const memories = computeMemories(ops);
      expect(memories[0].refs).toEqual(['cmt_001']);
    });

    it('should compute memory with meta', () => {
      const ops: Operation[] = [
        {
          id: 'mem_001',
          op: 'capture',
          ts: '2025-01-01T00:00:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test memory', meta: { key: 'value' } },
        },
      ];

      const memories = computeMemories(ops);
      expect(memories[0].meta).toEqual({ key: 'value' });
    });

    it('should include annotations', () => {
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
          op: 'annotate',
          ts: '2025-01-01T00:01:00.000Z',
          actor: 'bob',
          workspace: 'test',
          payload: { target: 'mem_001', body: 'Note' },
        },
      ];

      const memories = computeMemories(ops);
      expect(memories[0].annotations).toHaveLength(1);
      expect(memories[0].annotations[0].body).toBe('Note');
    });

    it('should compute multiple memories', () => {
      const ops: Operation[] = [
        {
          id: 'mem_001',
          op: 'capture',
          ts: '2025-01-01T00:00:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Memory 1' },
        },
        {
          id: 'mem_002',
          op: 'capture',
          ts: '2025-01-01T00:01:00.000Z',
          actor: 'bob',
          workspace: 'test',
          payload: { body: 'Memory 2' },
        },
      ];

      const memories = computeMemories(ops);
      expect(memories).toHaveLength(2);
      expect(memories[0].body).toBe('Memory 1');
      expect(memories[1].body).toBe('Memory 2');
    });

    it('should not include commitments', () => {
      const ops: Operation[] = [
        {
          id: 'mem_001',
          op: 'capture',
          ts: '2025-01-01T00:00:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Memory' },
        },
        {
          id: 'cmt_001',
          op: 'commit',
          ts: '2025-01-01T00:01:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Commitment', source: 'mem_001' },
        },
      ];

      const memories = computeMemories(ops);
      expect(memories).toHaveLength(1);
      expect(memories[0].id).toBe('mem_001');
    });
  });

  describe('computeCommitments', () => {
    it('should return empty array for empty ledger', () => {
      const commitments = computeCommitments([]);
      expect(commitments).toEqual([]);
    });

    it('should compute commitment from commit operation', () => {
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

      const commitments = computeCommitments(ops);
      expect(commitments).toHaveLength(1);
      expect(commitments[0].id).toBe('cmt_001');
      expect(commitments[0].body).toBe('Test commitment');
      expect(commitments[0].source).toBe('mem_001');
      expect(commitments[0].state).toBe('open');
      expect(commitments[0].owner).toBeNull();
      expect(commitments[0].evidence).toBeNull();
      expect(commitments[0].closed_by).toBeNull();
      expect(commitments[0].actor).toBe('alice');
      expect(commitments[0].ts).toBe('2025-01-01T00:01:00.000Z');
    });

    it('should compute commitment with tags', () => {
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
          payload: { body: 'Test commitment', source: 'mem_001', tags: ['urgent', 'bug'] },
        },
      ];

      const commitments = computeCommitments(ops);
      expect(commitments[0].tags).toEqual(['urgent', 'bug']);
    });

    it('should compute commitment with meta', () => {
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
          payload: { body: 'Test commitment', source: 'mem_001', meta: { priority: 1 } },
        },
      ];

      const commitments = computeCommitments(ops);
      expect(commitments[0].meta).toEqual({ priority: 1 });
    });

    it('should include annotations', () => {
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
          op: 'annotate',
          ts: '2025-01-01T00:02:00.000Z',
          actor: 'bob',
          workspace: 'test',
          payload: { target: 'cmt_001', body: 'Note' },
        },
      ];

      const commitments = computeCommitments(ops);
      expect(commitments[0].annotations).toHaveLength(1);
      expect(commitments[0].annotations[0].body).toBe('Note');
    });

    it('should compute claimed commitment', () => {
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
          actor: 'bob',
          workspace: 'test',
          payload: { commitment: 'cmt_001' },
        },
      ];

      const commitments = computeCommitments(ops);
      expect(commitments[0].state).toBe('claimed');
      expect(commitments[0].owner).toBe('bob');
    });

    it('should compute closed commitment', () => {
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
          payload: { body: 'Evidence', kind: 'evidence' },
        },
        {
          id: 'op_001',
          op: 'close',
          ts: '2025-01-01T00:03:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { commitment: 'cmt_001', evidence: 'mem_002' },
        },
      ];

      const commitments = computeCommitments(ops);
      expect(commitments[0].state).toBe('closed');
      expect(commitments[0].evidence).toBe('mem_002');
      expect(commitments[0].closed_by).toBe('alice');
    });

    it('should show duplicate as closed (backward compat)', () => {
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
          payload: { body: 'Duplicate', source: 'mem_001' },
        },
        {
          id: 'op_001',
          op: 'close',
          ts: '2025-01-01T00:03:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { commitment: 'cmt_002', duplicate_of: 'cmt_001' },
        },
      ];

      const commitments = computeCommitments(ops);
      const duplicate = commitments.find((c) => c.id === 'cmt_002');
      expect(duplicate?.state).toBe('closed');
    });

    it('should compute multiple commitments', () => {
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
          payload: { body: 'Commitment 1', source: 'mem_001' },
        },
        {
          id: 'cmt_002',
          op: 'commit',
          ts: '2025-01-01T00:02:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Commitment 2', source: 'mem_001' },
        },
      ];

      const commitments = computeCommitments(ops);
      expect(commitments).toHaveLength(2);
      expect(commitments[0].body).toBe('Commitment 1');
      expect(commitments[1].body).toBe('Commitment 2');
    });
  });

  describe('getMemory', () => {
    it('should return null for nonexistent memory', () => {
      const ops: Operation[] = [];
      const memory = getMemory(ops, 'mem_999');
      expect(memory).toBeNull();
    });

    it('should return memory by ID', () => {
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

      const memory = getMemory(ops, 'mem_001');
      expect(memory).not.toBeNull();
      expect(memory?.id).toBe('mem_001');
      expect(memory?.body).toBe('Test memory');
    });

    it('should include annotations', () => {
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
          op: 'annotate',
          ts: '2025-01-01T00:01:00.000Z',
          actor: 'bob',
          workspace: 'test',
          payload: { target: 'mem_001', body: 'Note' },
        },
      ];

      const memory = getMemory(ops, 'mem_001');
      expect(memory?.annotations).toHaveLength(1);
    });
  });

  describe('getCommitment', () => {
    it('should return null for nonexistent commitment', () => {
      const ops: Operation[] = [];
      const commitment = getCommitment(ops, 'cmt_999');
      expect(commitment).toBeNull();
    });

    it('should return commitment by ID', () => {
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

      const commitment = getCommitment(ops, 'cmt_001');
      expect(commitment).not.toBeNull();
      expect(commitment?.id).toBe('cmt_001');
      expect(commitment?.body).toBe('Test commitment');
    });

    it('should include state', () => {
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
          actor: 'bob',
          workspace: 'test',
          payload: { commitment: 'cmt_001' },
        },
      ];

      const commitment = getCommitment(ops, 'cmt_001');
      expect(commitment?.state).toBe('claimed');
      expect(commitment?.owner).toBe('bob');
    });
  });

  describe('memoryExists', () => {
    it('should return false for empty ledger', () => {
      expect(memoryExists([], 'mem_001')).toBe(false);
    });

    it('should return true when memory exists', () => {
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

      expect(memoryExists(ops, 'mem_001')).toBe(true);
    });

    it('should return false when memory does not exist', () => {
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

      expect(memoryExists(ops, 'mem_002')).toBe(false);
    });
  });

  describe('commitmentExists', () => {
    it('should return false for empty ledger', () => {
      expect(commitmentExists([], 'cmt_001')).toBe(false);
    });

    it('should return true when commitment exists', () => {
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

      expect(commitmentExists(ops, 'cmt_001')).toBe(true);
    });

    it('should return false when commitment does not exist', () => {
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

      expect(commitmentExists(ops, 'cmt_001')).toBe(false);
    });
  });

  describe('recordExists', () => {
    it('should return false for empty ledger', () => {
      expect(recordExists([], 'mem_001')).toBe(false);
    });

    it('should return true for memory', () => {
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

      expect(recordExists(ops, 'mem_001')).toBe(true);
    });

    it('should return true for commitment', () => {
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

      expect(recordExists(ops, 'cmt_001')).toBe(true);
    });

    it('should return false for operation ID', () => {
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
          op: 'annotate',
          ts: '2025-01-01T00:01:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { target: 'mem_001', body: 'Note' },
        },
      ];

      expect(recordExists(ops, 'op_001')).toBe(false);
    });
  });

  describe('computeMemoryState', () => {
    it('should return untriaged for new memory', () => {
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

      const state = computeMemoryState(ops, 'mem_001');
      expect(state).toBe('untriaged');
    });

    it('should return committed when memory is source of commitment', () => {
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

      const state = computeMemoryState(ops, 'mem_001');
      expect(state).toBe('committed');
    });

    it('should return linked when memory is linked to commitment', () => {
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
          payload: { body: 'Related memory' },
        },
        {
          id: 'cmt_001',
          op: 'commit',
          ts: '2025-01-01T00:02:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test commitment', source: 'mem_001' },
        },
        {
          id: 'op_001',
          op: 'link',
          ts: '2025-01-01T00:03:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { source: 'mem_002', target: 'cmt_001' },
        },
      ];

      const state = computeMemoryState(ops, 'mem_002');
      expect(state).toBe('linked');
    });

    it('should return dismissed when memory is dismissed', () => {
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
          op: 'dismiss',
          ts: '2025-01-01T00:01:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { memory: 'mem_001', reason: 'Not actionable' },
        },
      ];

      const state = computeMemoryState(ops, 'mem_001');
      expect(state).toBe('dismissed');
    });

    it('should prioritize committed over linked', () => {
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
          payload: { body: 'Another commitment', source: 'mem_001' },
        },
        {
          id: 'op_001',
          op: 'link',
          ts: '2025-01-01T00:03:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { source: 'mem_001', target: 'cmt_002' },
        },
      ];

      const state = computeMemoryState(ops, 'mem_001');
      expect(state).toBe('committed');
    });
  });

  describe('getLinkedMemories', () => {
    it('should return empty array when no memories linked', () => {
      const ops: Operation[] = [];
      const linked = getLinkedMemories(ops, 'cmt_001');
      expect(linked).toEqual([]);
    });

    it('should return linked memory IDs', () => {
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
          payload: { body: 'Related memory' },
        },
        {
          id: 'cmt_001',
          op: 'commit',
          ts: '2025-01-01T00:02:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test commitment', source: 'mem_001' },
        },
        {
          id: 'op_001',
          op: 'link',
          ts: '2025-01-01T00:03:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { source: 'mem_002', target: 'cmt_001' },
        },
      ];

      const linked = getLinkedMemories(ops, 'cmt_001');
      expect(linked).toEqual(['mem_002']);
    });

    it('should not include commitments', () => {
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
          payload: { body: 'Related commitment', source: 'mem_001' },
        },
        {
          id: 'op_001',
          op: 'link',
          ts: '2025-01-01T00:03:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { source: 'cmt_002', target: 'cmt_001' },
        },
      ];

      const linked = getLinkedMemories(ops, 'cmt_001');
      expect(linked).toEqual([]);
    });

    it('should return multiple linked memories', () => {
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
          payload: { body: 'Related memory 1' },
        },
        {
          id: 'mem_003',
          op: 'capture',
          ts: '2025-01-01T00:02:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Related memory 2' },
        },
        {
          id: 'cmt_001',
          op: 'commit',
          ts: '2025-01-01T00:03:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test commitment', source: 'mem_001' },
        },
        {
          id: 'op_001',
          op: 'link',
          ts: '2025-01-01T00:04:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { source: 'mem_002', target: 'cmt_001' },
        },
        {
          id: 'op_002',
          op: 'link',
          ts: '2025-01-01T00:05:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { source: 'mem_003', target: 'cmt_001' },
        },
      ];

      const linked = getLinkedMemories(ops, 'cmt_001');
      expect(linked).toEqual(['mem_002', 'mem_003']);
    });
  });

  describe('getLinkedCommitments', () => {
    it('should return empty array when no commitments linked', () => {
      const ops: Operation[] = [];
      const linked = getLinkedCommitments(ops, 'cmt_001');
      expect(linked).toEqual([]);
    });

    it('should return linked commitment IDs', () => {
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
          payload: { body: 'Related commitment', source: 'mem_001' },
        },
        {
          id: 'op_001',
          op: 'link',
          ts: '2025-01-01T00:03:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { source: 'cmt_002', target: 'cmt_001' },
        },
      ];

      const linked = getLinkedCommitments(ops, 'cmt_001');
      expect(linked).toEqual(['cmt_002']);
    });

    it('should not include memories', () => {
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
          payload: { body: 'Related memory' },
        },
        {
          id: 'cmt_001',
          op: 'commit',
          ts: '2025-01-01T00:02:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test commitment', source: 'mem_001' },
        },
        {
          id: 'op_001',
          op: 'link',
          ts: '2025-01-01T00:03:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { source: 'mem_002', target: 'cmt_001' },
        },
      ];

      const linked = getLinkedCommitments(ops, 'cmt_001');
      expect(linked).toEqual([]);
    });
  });

  describe('getDuplicates', () => {
    it('should return empty array when no duplicates exist', () => {
      const ops: Operation[] = [];
      const duplicates = getDuplicates(ops, 'cmt_001');
      expect(duplicates).toEqual([]);
    });

    it('should return duplicate commitment IDs', () => {
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
          payload: { body: 'Duplicate', source: 'mem_001' },
        },
        {
          id: 'op_001',
          op: 'close',
          ts: '2025-01-01T00:03:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { commitment: 'cmt_002', duplicate_of: 'cmt_001' },
        },
      ];

      const duplicates = getDuplicates(ops, 'cmt_001');
      expect(duplicates).toEqual(['cmt_002']);
    });

    it('should return multiple duplicates', () => {
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
          payload: { body: 'Duplicate 1', source: 'mem_001' },
        },
        {
          id: 'cmt_003',
          op: 'commit',
          ts: '2025-01-01T00:03:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Duplicate 2', source: 'mem_001' },
        },
        {
          id: 'op_001',
          op: 'close',
          ts: '2025-01-01T00:04:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { commitment: 'cmt_002', duplicate_of: 'cmt_001' },
        },
        {
          id: 'op_002',
          op: 'close',
          ts: '2025-01-01T00:05:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { commitment: 'cmt_003', duplicate_of: 'cmt_001' },
        },
      ];

      const duplicates = getDuplicates(ops, 'cmt_001');
      expect(duplicates).toEqual(['cmt_002', 'cmt_003']);
    });
  });

  describe('isMemoryDismissed', () => {
    it('should return false for undismissed memory', () => {
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

      expect(isMemoryDismissed(ops, 'mem_001')).toBe(false);
    });

    it('should return true for dismissed memory', () => {
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
          op: 'dismiss',
          ts: '2025-01-01T00:01:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { memory: 'mem_001', reason: 'Not actionable' },
        },
      ];

      expect(isMemoryDismissed(ops, 'mem_001')).toBe(true);
    });
  });

  describe('isMemorySourceOfCommitment', () => {
    it('should return false when memory is not source', () => {
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

      expect(isMemorySourceOfCommitment(ops, 'mem_001')).toBe(false);
    });

    it('should return true when memory is source of commitment', () => {
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

      expect(isMemorySourceOfCommitment(ops, 'mem_001')).toBe(true);
    });
  });
});
