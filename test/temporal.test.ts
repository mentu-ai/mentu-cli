import { describe, it, expect } from 'vitest';
import {
  parseTimestamp,
  isPast,
  isFuture,
  addMinutes,
  isLate,
  normalizePattern,
  isValidCron,
  calculateNextOccurrence,
  computeTemporalState,
  getTemporalMeta,
  isDependencySatisfied,
  areAllDependenciesSatisfied,
  isAnyDependencySatisfied,
  getScheduledMemories,
  getDueMemories,
  getLateCommitments,
  getWaitingCommitments,
  getRecurringDue,
} from '../src/core/temporal.js';
import type { Memory, Commitment } from '../src/types.js';

describe('Temporal Primitives', () => {
  describe('Date Utilities', () => {
    it('parseTimestamp should parse valid ISO 8601', () => {
      const date = parseTimestamp('2026-01-01T12:00:00Z');
      expect(date.getUTCHours()).toBe(12);
    });

    it('parseTimestamp should throw on invalid timestamp', () => {
      expect(() => parseTimestamp('invalid')).toThrow('Invalid timestamp');
    });

    it('isPast should return true for past dates', () => {
      expect(isPast('2020-01-01T00:00:00Z')).toBe(true);
    });

    it('isPast should return false for future dates', () => {
      expect(isPast('2030-01-01T00:00:00Z')).toBe(false);
    });

    it('isFuture should return true for future dates', () => {
      expect(isFuture('2030-01-01T00:00:00Z')).toBe(true);
    });

    it('isFuture should return false for past dates', () => {
      expect(isFuture('2020-01-01T00:00:00Z')).toBe(false);
    });

    it('addMinutes should add minutes correctly', () => {
      const date = new Date('2026-01-01T12:00:00Z');
      const result = addMinutes(date, 30);
      expect(result.getUTCMinutes()).toBe(30);
    });

    it('addMinutes should handle hour rollover', () => {
      const date = new Date('2026-01-01T12:45:00Z');
      const result = addMinutes(date, 30);
      expect(result.getUTCHours()).toBe(13);
      expect(result.getUTCMinutes()).toBe(15);
    });

    it('isLate should return true when past deadline', () => {
      const now = new Date('2026-01-01T12:30:00Z');
      const deadline = '2026-01-01T12:00:00Z';
      expect(isLate(deadline, 0, now)).toBe(true);
    });

    it('isLate should respect grace period', () => {
      const now = new Date('2026-01-01T12:30:00Z');
      const deadline = '2026-01-01T12:00:00Z';
      expect(isLate(deadline, 60, now)).toBe(false);
    });

    it('isLate should return true when past grace period', () => {
      const now = new Date('2026-01-01T13:30:00Z');
      const deadline = '2026-01-01T12:00:00Z';
      expect(isLate(deadline, 60, now)).toBe(true);
    });
  });

  describe('Recurrence', () => {
    it('normalizePattern should handle daily alias', () => {
      expect(normalizePattern('daily')).toBe('0 0 * * *');
    });

    it('normalizePattern should handle weekly alias', () => {
      expect(normalizePattern('weekly')).toBe('0 0 * * 0');
    });

    it('normalizePattern should handle monthly alias', () => {
      expect(normalizePattern('monthly')).toBe('0 0 1 * *');
    });

    it('normalizePattern should handle hourly alias', () => {
      expect(normalizePattern('hourly')).toBe('0 * * * *');
    });

    it('normalizePattern should pass through cron expressions', () => {
      expect(normalizePattern('0 2 * * *')).toBe('0 2 * * *');
    });

    it('isValidCron should validate cron expressions', () => {
      expect(isValidCron('0 2 * * *')).toBe(true);
      expect(isValidCron('daily')).toBe(true);
    });

    it('isValidCron should reject invalid cron', () => {
      expect(isValidCron('invalid')).toBe(false);
      expect(isValidCron('0 2 *')).toBe(false);
    });

    it('calculateNextOccurrence should compute daily', () => {
      const after = new Date('2026-01-01T12:00:00Z');
      const next = calculateNextOccurrence('daily', after);
      expect(next.getDate()).toBe(after.getDate() + 1);
      expect(next.getHours()).toBe(0);
    });

    it('calculateNextOccurrence should compute weekly', () => {
      const after = new Date('2026-01-01T12:00:00Z'); // Thursday
      const next = calculateNextOccurrence('weekly', after);
      expect(next.getUTCDay()).toBe(0); // Sunday
    });

    it('calculateNextOccurrence should compute monthly', () => {
      const after = new Date('2026-01-15T12:00:00Z');
      const next = calculateNextOccurrence('monthly', after);
      expect(next.getUTCMonth()).toBe(1); // February
      expect(next.getUTCDate()).toBe(1);
    });

    it('calculateNextOccurrence should compute hourly', () => {
      const after = new Date('2026-01-01T12:30:00Z');
      const next = calculateNextOccurrence('hourly', after);
      expect(next.getUTCHours()).toBe(13);
      expect(next.getUTCMinutes()).toBe(0);
    });

    it('calculateNextOccurrence should throw for complex cron', () => {
      expect(() => calculateNextOccurrence('0 2 * * 1-5')).toThrow('Complex cron patterns require cron-parser');
    });
  });

  describe('Temporal Metadata Extraction', () => {
    it('should extract due_at from meta', () => {
      const memory: Memory = {
        id: 'mem_test',
        body: 'Test',
        kind: null,
        actor: 'test',
        ts: new Date().toISOString(),
        annotations: [],
        meta: { due_at: '2026-01-01T12:00:00Z' },
      };
      const temporal = getTemporalMeta(memory);
      expect(temporal?.due_at).toBe('2026-01-01T12:00:00Z');
    });

    it('should extract scheduled_for as due_at', () => {
      const memory: Memory = {
        id: 'mem_test',
        body: 'Test',
        kind: null,
        actor: 'test',
        ts: new Date().toISOString(),
        annotations: [],
        meta: { scheduled_for: '2026-01-01T12:00:00Z' },
      };
      const temporal = getTemporalMeta(memory);
      expect(temporal?.due_at).toBe('2026-01-01T12:00:00Z');
    });

    it('should prefer due_at over scheduled_for', () => {
      const memory: Memory = {
        id: 'mem_test',
        body: 'Test',
        kind: null,
        actor: 'test',
        ts: new Date().toISOString(),
        annotations: [],
        meta: {
          due_at: '2026-01-01T10:00:00Z',
          scheduled_for: '2026-01-01T12:00:00Z',
        },
      };
      const temporal = getTemporalMeta(memory);
      expect(temporal?.due_at).toBe('2026-01-01T10:00:00Z');
    });

    it('should extract deadline', () => {
      const memory: Memory = {
        id: 'mem_test',
        body: 'Test',
        kind: null,
        actor: 'test',
        ts: new Date().toISOString(),
        annotations: [],
        meta: { deadline: '2026-01-01T18:00:00Z' },
      };
      const temporal = getTemporalMeta(memory);
      expect(temporal?.deadline).toBe('2026-01-01T18:00:00Z');
    });

    it('should extract wait_for', () => {
      const memory: Memory = {
        id: 'mem_test',
        body: 'Test',
        kind: null,
        actor: 'test',
        ts: new Date().toISOString(),
        annotations: [],
        meta: { wait_for: 'cmt_abc12345' },
      };
      const temporal = getTemporalMeta(memory);
      expect(temporal?.wait_for).toBe('cmt_abc12345');
    });

    it('should extract wait_for_all', () => {
      const memory: Memory = {
        id: 'mem_test',
        body: 'Test',
        kind: null,
        actor: 'test',
        ts: new Date().toISOString(),
        annotations: [],
        meta: { wait_for_all: ['cmt_aaa11111', 'cmt_bbb22222'] },
      };
      const temporal = getTemporalMeta(memory);
      expect(temporal?.wait_for_all).toEqual(['cmt_aaa11111', 'cmt_bbb22222']);
    });

    it('should extract wait_for_any', () => {
      const memory: Memory = {
        id: 'mem_test',
        body: 'Test',
        kind: null,
        actor: 'test',
        ts: new Date().toISOString(),
        annotations: [],
        meta: { wait_for_any: ['cmt_aaa11111', 'cmt_bbb22222'] },
      };
      const temporal = getTemporalMeta(memory);
      expect(temporal?.wait_for_any).toEqual(['cmt_aaa11111', 'cmt_bbb22222']);
    });

    it('should return null for empty meta', () => {
      const memory: Memory = {
        id: 'mem_test',
        body: 'Test',
        kind: null,
        actor: 'test',
        ts: new Date().toISOString(),
        annotations: [],
      };
      const temporal = getTemporalMeta(memory);
      expect(temporal).toBeNull();
    });

    it('should return null for meta without temporal fields', () => {
      const memory: Memory = {
        id: 'mem_test',
        body: 'Test',
        kind: null,
        actor: 'test',
        ts: new Date().toISOString(),
        annotations: [],
        meta: { other_field: 'value' },
      };
      const temporal = getTemporalMeta(memory);
      expect(temporal).toBeNull();
    });
  });

  describe('Dependency Checking', () => {
    const createCommitment = (id: string, state: 'open' | 'closed'): Commitment => ({
      id,
      body: 'Test',
      source: 'mem_test',
      state,
      owner: null,
      evidence: null,
      closed_by: null,
      actor: 'test',
      ts: new Date().toISOString(),
      annotations: [],
    });

    it('isDependencySatisfied should return true for closed commitment', () => {
      const commitments = new Map([
        ['cmt_dep12345', createCommitment('cmt_dep12345', 'closed')],
      ]);
      expect(isDependencySatisfied('cmt_dep12345', commitments)).toBe(true);
    });

    it('isDependencySatisfied should return false for open commitment', () => {
      const commitments = new Map([
        ['cmt_dep12345', createCommitment('cmt_dep12345', 'open')],
      ]);
      expect(isDependencySatisfied('cmt_dep12345', commitments)).toBe(false);
    });

    it('isDependencySatisfied should return false for missing commitment', () => {
      const commitments = new Map<string, Commitment>();
      expect(isDependencySatisfied('cmt_missing1', commitments)).toBe(false);
    });

    it('areAllDependenciesSatisfied should return true when all closed', () => {
      const commitments = new Map([
        ['cmt_aaa11111', createCommitment('cmt_aaa11111', 'closed')],
        ['cmt_bbb22222', createCommitment('cmt_bbb22222', 'closed')],
      ]);
      expect(areAllDependenciesSatisfied(['cmt_aaa11111', 'cmt_bbb22222'], commitments)).toBe(true);
    });

    it('areAllDependenciesSatisfied should return false when one open', () => {
      const commitments = new Map([
        ['cmt_aaa11111', createCommitment('cmt_aaa11111', 'closed')],
        ['cmt_bbb22222', createCommitment('cmt_bbb22222', 'open')],
      ]);
      expect(areAllDependenciesSatisfied(['cmt_aaa11111', 'cmt_bbb22222'], commitments)).toBe(false);
    });

    it('isAnyDependencySatisfied should return true when any closed', () => {
      const commitments = new Map([
        ['cmt_aaa11111', createCommitment('cmt_aaa11111', 'open')],
        ['cmt_bbb22222', createCommitment('cmt_bbb22222', 'closed')],
      ]);
      expect(isAnyDependencySatisfied(['cmt_aaa11111', 'cmt_bbb22222'], commitments)).toBe(true);
    });

    it('isAnyDependencySatisfied should return false when all open', () => {
      const commitments = new Map([
        ['cmt_aaa11111', createCommitment('cmt_aaa11111', 'open')],
        ['cmt_bbb22222', createCommitment('cmt_bbb22222', 'open')],
      ]);
      expect(isAnyDependencySatisfied(['cmt_aaa11111', 'cmt_bbb22222'], commitments)).toBe(false);
    });
  });

  describe('Temporal State Computation', () => {
    it('should return active for records without temporal meta', () => {
      const memory: Memory = {
        id: 'mem_test',
        body: 'Test',
        kind: null,
        actor: 'test',
        ts: new Date().toISOString(),
        annotations: [],
      };
      expect(computeTemporalState(memory)).toBe('active');
    });

    it('should return scheduled for future due_at', () => {
      const memory: Memory = {
        id: 'mem_test',
        body: 'Test',
        kind: null,
        actor: 'test',
        ts: new Date().toISOString(),
        annotations: [],
        meta: { due_at: '2030-01-01T00:00:00Z' },
      };
      expect(computeTemporalState(memory)).toBe('scheduled');
    });

    it('should return due for past due_at', () => {
      const memory: Memory = {
        id: 'mem_test',
        body: 'Test',
        kind: null,
        actor: 'test',
        ts: new Date().toISOString(),
        annotations: [],
        meta: { due_at: '2020-01-01T00:00:00Z' },
      };
      expect(computeTemporalState(memory)).toBe('due');
    });

    it('should return waiting for future wait_until', () => {
      const memory: Memory = {
        id: 'mem_test',
        body: 'Test',
        kind: null,
        actor: 'test',
        ts: new Date().toISOString(),
        annotations: [],
        meta: { wait_until: '2030-01-01T00:00:00Z' },
      };
      expect(computeTemporalState(memory)).toBe('waiting');
    });

    it('should return waiting for unsatisfied wait_for', () => {
      const commitment: Commitment = {
        id: 'cmt_test',
        body: 'Test',
        source: 'mem_test',
        state: 'open',
        owner: null,
        evidence: null,
        closed_by: null,
        actor: 'test',
        ts: new Date().toISOString(),
        annotations: [],
        meta: { wait_for: 'cmt_dep12345' },
      };
      const commitments = new Map<string, Commitment>([
        ['cmt_dep12345', {
          id: 'cmt_dep12345',
          body: 'Dep',
          source: 'mem_dep1234',
          state: 'open',
          owner: null,
          evidence: null,
          closed_by: null,
          actor: 'test',
          ts: new Date().toISOString(),
          annotations: [],
        }],
      ]);
      expect(computeTemporalState(commitment, new Date(), commitments)).toBe('waiting');
    });

    it('should return active for satisfied wait_for', () => {
      const commitment: Commitment = {
        id: 'cmt_test',
        body: 'Test',
        source: 'mem_test',
        state: 'open',
        owner: null,
        evidence: null,
        closed_by: null,
        actor: 'test',
        ts: new Date().toISOString(),
        annotations: [],
        meta: { wait_for: 'cmt_dep12345' },
      };
      const commitments = new Map<string, Commitment>([
        ['cmt_dep12345', {
          id: 'cmt_dep12345',
          body: 'Dep',
          source: 'mem_dep1234',
          state: 'closed',
          owner: null,
          evidence: null,
          closed_by: 'someone',
          actor: 'test',
          ts: new Date().toISOString(),
          annotations: [],
        }],
      ]);
      expect(computeTemporalState(commitment, new Date(), commitments)).toBe('active');
    });

    it('should return late for past deadline', () => {
      const commitment: Commitment = {
        id: 'cmt_test',
        body: 'Test',
        source: 'mem_test',
        state: 'open',
        owner: null,
        evidence: null,
        closed_by: null,
        actor: 'test',
        ts: new Date().toISOString(),
        annotations: [],
        meta: { deadline: '2020-01-01T00:00:00Z' },
      };
      expect(computeTemporalState(commitment)).toBe('late');
    });

    it('should respect grace period for late', () => {
      const now = new Date('2026-01-01T12:30:00Z');
      const commitment: Commitment = {
        id: 'cmt_test',
        body: 'Test',
        source: 'mem_test',
        state: 'open',
        owner: null,
        evidence: null,
        closed_by: null,
        actor: 'test',
        ts: new Date().toISOString(),
        annotations: [],
        meta: { deadline: '2026-01-01T12:00:00Z', grace_period: 60 },
      };
      expect(computeTemporalState(commitment, now)).toBe('active');
    });
  });

  describe('Query Helpers', () => {
    const createMemory = (id: string, meta?: Record<string, unknown>): Memory => ({
      id,
      body: 'Test',
      kind: 'scheduled',
      actor: 'test',
      ts: new Date().toISOString(),
      annotations: [],
      meta,
    });

    const createCommitment = (id: string, state: 'open' | 'closed', meta?: Record<string, unknown>): Commitment => ({
      id,
      body: 'Test',
      source: 'mem_test',
      state,
      owner: null,
      evidence: null,
      closed_by: null,
      actor: 'test',
      ts: new Date().toISOString(),
      annotations: [],
      meta,
    });

    it('getScheduledMemories should return future due memories', () => {
      const memories = [
        createMemory('mem_1', { due_at: '2030-01-01T00:00:00Z' }),
        createMemory('mem_2', { due_at: '2020-01-01T00:00:00Z' }),
        createMemory('mem_3'),
      ];
      const scheduled = getScheduledMemories(memories);
      expect(scheduled).toHaveLength(1);
      expect(scheduled[0].id).toBe('mem_1');
    });

    it('getDueMemories should return past due memories', () => {
      const memories = [
        createMemory('mem_1', { due_at: '2030-01-01T00:00:00Z' }),
        createMemory('mem_2', { due_at: '2020-01-01T00:00:00Z' }),
        createMemory('mem_3'),
      ];
      const due = getDueMemories(memories);
      expect(due).toHaveLength(1);
      expect(due[0].id).toBe('mem_2');
    });

    it('getLateCommitments should return past deadline commitments', () => {
      const commitments = [
        createCommitment('cmt_1', 'open', { deadline: '2020-01-01T00:00:00Z' }),
        createCommitment('cmt_2', 'open', { deadline: '2030-01-01T00:00:00Z' }),
        createCommitment('cmt_3', 'closed', { deadline: '2020-01-01T00:00:00Z' }),
      ];
      const late = getLateCommitments(commitments);
      expect(late).toHaveLength(1);
      expect(late[0].id).toBe('cmt_1');
    });

    it('getWaitingCommitments should return waiting commitments', () => {
      const commitments = [
        createCommitment('cmt_1', 'open', { wait_until: '2030-01-01T00:00:00Z' }),
        createCommitment('cmt_2', 'open'),
        createCommitment('cmt_3', 'closed', { wait_until: '2030-01-01T00:00:00Z' }),
      ];
      const waiting = getWaitingCommitments(commitments);
      expect(waiting).toHaveLength(1);
      expect(waiting[0].id).toBe('cmt_1');
    });

    it('getRecurringDue should return recurring memories past next_at', () => {
      const memories = [
        createMemory('mem_1', {
          recurrence: { pattern: 'daily', next_at: '2020-01-01T00:00:00Z' },
        }),
        createMemory('mem_2', {
          recurrence: { pattern: 'daily', next_at: '2030-01-01T00:00:00Z' },
        }),
        createMemory('mem_3'),
      ];
      const recurring = getRecurringDue(memories);
      expect(recurring).toHaveLength(1);
      expect(recurring[0].id).toBe('mem_1');
    });

    it('getRecurringDue should exclude ended recurrence', () => {
      const memories = [
        createMemory('mem_1', {
          recurrence: { pattern: 'daily', next_at: '2020-01-01T00:00:00Z', ends_at: '2019-01-01T00:00:00Z' },
        }),
      ];
      const recurring = getRecurringDue(memories);
      expect(recurring).toHaveLength(0);
    });

    it('getRecurringDue should exclude zero count recurrence', () => {
      const memories = [
        createMemory('mem_1', {
          recurrence: { pattern: 'daily', next_at: '2020-01-01T00:00:00Z', count: 0 },
        }),
      ];
      const recurring = getRecurringDue(memories);
      expect(recurring).toHaveLength(0);
    });
  });
});
