// Temporal Primitives Core
// State computation and date utilities for time-aware commitments

import { TemporalMeta, TemporalState, RecurrenceSpec, LatePolicy, Memory, Commitment } from '../types.js';

// ============================================================
// DATE UTILITIES
// ============================================================

/**
 * Parse ISO 8601 timestamp to Date
 */
export function parseTimestamp(ts: string): Date {
  const date = new Date(ts);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid timestamp: ${ts}`);
  }
  return date;
}

/**
 * Check if timestamp is in the past
 */
export function isPast(ts: string, now: Date = new Date()): boolean {
  return parseTimestamp(ts) <= now;
}

/**
 * Check if timestamp is in the future
 */
export function isFuture(ts: string, now: Date = new Date()): boolean {
  return parseTimestamp(ts) > now;
}

/**
 * Add minutes to a date
 */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

/**
 * Check if a date is within grace period of deadline
 */
export function isLate(deadline: string, gracePeriod: number = 0, now: Date = new Date()): boolean {
  const deadlineDate = parseTimestamp(deadline);
  const graceEnd = addMinutes(deadlineDate, gracePeriod);
  return now > graceEnd;
}

// ============================================================
// RECURRENCE
// ============================================================

const PATTERN_ALIASES: Record<string, string> = {
  'daily': '0 0 * * *',
  'weekly': '0 0 * * 0',
  'monthly': '0 0 1 * *',
  'hourly': '0 * * * *',
};

/**
 * Normalize recurrence pattern to cron expression
 */
export function normalizePattern(pattern: string): string {
  return PATTERN_ALIASES[pattern.toLowerCase()] || pattern;
}

/**
 * Validate cron expression (basic validation)
 */
export function isValidCron(pattern: string): boolean {
  const normalized = normalizePattern(pattern);
  const parts = normalized.split(' ');
  return parts.length === 5;
}

/**
 * Calculate next occurrence from cron pattern
 * Note: For full cron parsing, consider using a library like 'cron-parser'
 */
export function calculateNextOccurrence(
  pattern: string,
  after: Date = new Date(),
  _timezone: string = 'UTC'
): Date {
  // Handle simple aliases
  if (pattern === 'daily') {
    const next = new Date(after);
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
    return next;
  }
  if (pattern === 'weekly') {
    const next = new Date(after);
    next.setDate(next.getDate() + (7 - next.getDay()));
    next.setHours(0, 0, 0, 0);
    return next;
  }
  if (pattern === 'monthly') {
    const next = new Date(after);
    next.setMonth(next.getMonth() + 1);
    next.setDate(1);
    next.setHours(0, 0, 0, 0);
    return next;
  }
  if (pattern === 'hourly') {
    const next = new Date(after);
    next.setHours(next.getHours() + 1, 0, 0, 0);
    return next;
  }

  // For complex cron: placeholder - add cron-parser dependency
  const normalized = normalizePattern(pattern);
  throw new Error(`Complex cron patterns require cron-parser: ${normalized}`);
}

// ============================================================
// TEMPORAL STATE COMPUTATION
// ============================================================

/**
 * Extract temporal metadata from a record
 */
export function getTemporalMeta(record: Memory | Commitment): TemporalMeta | null {
  const meta = record.meta as Record<string, unknown> | undefined;
  if (!meta) return null;

  const temporal: TemporalMeta = {};

  if (meta.due_at && typeof meta.due_at === 'string') {
    temporal.due_at = meta.due_at;
  }
  if (meta.scheduled_for && typeof meta.scheduled_for === 'string') {
    temporal.due_at = temporal.due_at || meta.scheduled_for as string;
  }
  if (meta.deadline && typeof meta.deadline === 'string') {
    temporal.deadline = meta.deadline;
  }
  if (meta.wait_until && typeof meta.wait_until === 'string') {
    temporal.wait_until = meta.wait_until;
  }
  if (meta.wait_for && typeof meta.wait_for === 'string') {
    temporal.wait_for = meta.wait_for;
  }
  if (meta.wait_for_all && Array.isArray(meta.wait_for_all)) {
    temporal.wait_for_all = meta.wait_for_all as string[];
  }
  if (meta.wait_for_any && Array.isArray(meta.wait_for_any)) {
    temporal.wait_for_any = meta.wait_for_any as string[];
  }
  if (meta.recurrence && typeof meta.recurrence === 'object') {
    temporal.recurrence = meta.recurrence as RecurrenceSpec;
  }
  if (meta.late_policy && typeof meta.late_policy === 'string') {
    temporal.late_policy = meta.late_policy as LatePolicy;
  }
  if (meta.grace_period && typeof meta.grace_period === 'number') {
    temporal.grace_period = meta.grace_period;
  }

  return Object.keys(temporal).length > 0 ? temporal : null;
}

/**
 * Check if a wait_for dependency is satisfied
 */
export function isDependencySatisfied(
  waitFor: string,
  commitments: Map<string, Commitment>
): boolean {
  const dep = commitments.get(waitFor);
  if (!dep) return false;
  return dep.state === 'closed';
}

/**
 * Check if all wait_for_all dependencies are satisfied
 */
export function areAllDependenciesSatisfied(
  waitForAll: string[],
  commitments: Map<string, Commitment>
): boolean {
  return waitForAll.every(id => isDependencySatisfied(id, commitments));
}

/**
 * Check if any wait_for_any dependency is satisfied
 */
export function isAnyDependencySatisfied(
  waitForAny: string[],
  commitments: Map<string, Commitment>
): boolean {
  return waitForAny.some(id => isDependencySatisfied(id, commitments));
}

/**
 * Compute temporal state of a memory or commitment
 */
export function computeTemporalState(
  record: Memory | Commitment,
  now: Date = new Date(),
  commitments?: Map<string, Commitment>
): TemporalState {
  const temporal = getTemporalMeta(record);
  if (!temporal) return 'active';

  // Check if waiting for time
  if (temporal.wait_until && isFuture(temporal.wait_until, now)) {
    return 'waiting';
  }

  // Check if waiting for single dependency
  if (temporal.wait_for && commitments) {
    if (!isDependencySatisfied(temporal.wait_for, commitments)) {
      return 'waiting';
    }
  }

  // Check if waiting for all dependencies
  if (temporal.wait_for_all && commitments) {
    if (!areAllDependenciesSatisfied(temporal.wait_for_all, commitments)) {
      return 'waiting';
    }
  }

  // Check if waiting for any dependency
  if (temporal.wait_for_any && commitments) {
    if (!isAnyDependencySatisfied(temporal.wait_for_any, commitments)) {
      return 'waiting';
    }
  }

  // Check if late
  if (temporal.deadline) {
    const gracePeriod = temporal.grace_period || 0;
    if (isLate(temporal.deadline, gracePeriod, now)) {
      return 'late';
    }
  }

  // Check if scheduled but not yet due
  if (temporal.due_at && isFuture(temporal.due_at, now)) {
    return 'scheduled';
  }

  // Check if due (scheduled time has passed)
  if (temporal.due_at && isPast(temporal.due_at, now)) {
    return 'due';
  }

  return 'active';
}

// ============================================================
// QUERY HELPERS
// ============================================================

/**
 * Get all memories with scheduled tasks
 */
export function getScheduledMemories(
  memories: Memory[],
  now: Date = new Date()
): Memory[] {
  return memories.filter(m => {
    const temporal = getTemporalMeta(m);
    if (!temporal?.due_at) return false;
    return computeTemporalState(m, now) === 'scheduled';
  });
}

/**
 * Get all memories that are due (ready to execute)
 */
export function getDueMemories(
  memories: Memory[],
  now: Date = new Date()
): Memory[] {
  return memories.filter(m => {
    const temporal = getTemporalMeta(m);
    if (!temporal?.due_at) return false;
    return computeTemporalState(m, now) === 'due';
  });
}

/**
 * Get all commitments that are late
 */
export function getLateCommitments(
  commitments: Commitment[],
  now: Date = new Date()
): Commitment[] {
  return commitments.filter(c => {
    if (c.state === 'closed') return false;
    return computeTemporalState(c, now) === 'late';
  });
}

/**
 * Get all commitments that are waiting
 */
export function getWaitingCommitments(
  commitments: Commitment[],
  now: Date = new Date(),
  allCommitments?: Map<string, Commitment>
): Commitment[] {
  return commitments.filter(c => {
    if (c.state === 'closed') return false;
    return computeTemporalState(c, now, allCommitments) === 'waiting';
  });
}

/**
 * Get memories with recurrence that need new instance
 */
export function getRecurringDue(
  memories: Memory[],
  now: Date = new Date()
): Memory[] {
  return memories.filter(m => {
    const temporal = getTemporalMeta(m);
    if (!temporal?.recurrence) return false;

    const { next_at, ends_at, count } = temporal.recurrence;

    // Check if recurrence has ended
    if (ends_at && isPast(ends_at, now)) return false;
    if (count !== undefined && count <= 0) return false;

    // Check if next occurrence is due
    if (next_at) {
      return isPast(next_at, now);
    }

    // No next_at computed yet, check if first occurrence should happen
    return true;
  });
}

export default {
  parseTimestamp,
  isPast,
  isFuture,
  addMinutes,
  isLate,
  normalizePattern,
  isValidCron,
  calculateNextOccurrence,
  getTemporalMeta,
  isDependencySatisfied,
  areAllDependenciesSatisfied,
  isAnyDependencySatisfied,
  computeTemporalState,
  getScheduledMemories,
  getDueMemories,
  getLateCommitments,
  getWaitingCommitments,
  getRecurringDue,
};
