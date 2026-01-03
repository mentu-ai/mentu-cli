// Scheduler Engine
// Tick function that processes temporal metadata and creates operations

import type {
  Operation,
  SchedulerConfig,
  SchedulerTickResult,
  SchedulerAction,
  SchedulerError,
  CaptureOperation,
  CommitOperation,
  AnnotateOperation,
} from '../types.js';
import { readLedger, appendOperation } from './ledger.js';
import { computeMemories, computeCommitments } from './state.js';
import { generateId } from '../utils/id.js';
import {
  getDueMemories,
  getLateCommitments,
  getRecurringDue,
  getTemporalMeta,
  calculateNextOccurrence,
} from './temporal.js';

// Default scheduler configuration
export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  enabled: true,
  tick_interval: 60,
  timezone: 'UTC',
  max_batch: 50,
};

/**
 * Execute a scheduler tick
 *
 * This function:
 * 1. Reads the current ledger state
 * 2. Finds due memories and creates commitments
 * 3. Finds late commitments and annotates them
 * 4. Handles recurring memories
 *
 * All actions are ledger operations (append-only)
 */
export async function tick(
  workspacePath: string,
  config: Partial<SchedulerConfig> = {},
  dryRun: boolean = false
): Promise<SchedulerTickResult> {
  const cfg = { ...DEFAULT_SCHEDULER_CONFIG, ...config };
  const now = new Date();
  const actions: SchedulerAction[] = [];
  const errors: SchedulerError[] = [];

  // Read current state
  const operations = readLedger(workspacePath);
  const memories = computeMemories(operations);
  const commitments = computeCommitments(operations);

  let processed = 0;

  // 1. Process due memories (create commitments)
  const dueMemories = getDueMemories(memories, now);
  for (const memory of dueMemories.slice(0, cfg.max_batch)) {
    if (processed >= cfg.max_batch) break;

    try {
      // Check if commitment already exists for this memory
      const existingCommitment = commitments.find(c => c.source === memory.id);
      if (existingCommitment) continue;

      const temporal = getTemporalMeta(memory);

      if (!dryRun) {
        const commitOp: CommitOperation = {
          id: generateId('cmt'),
          op: 'commit',
          ts: now.toISOString(),
          actor: 'scheduler',
          workspace: workspacePath,
          payload: {
            body: memory.body,
            source: memory.id,
            meta: {
              scheduled: true,
              original_due_at: temporal?.due_at,
              deadline: temporal?.deadline,
            },
          },
        };

        appendOperation(workspacePath, commitOp);

        actions.push({
          type: 'create_commitment',
          target: memory.id,
          op_id: commitOp.id,
        });
      } else {
        actions.push({
          type: 'create_commitment',
          target: memory.id,
          op_id: '[dry-run]',
        });
      }

      processed++;
    } catch (error) {
      errors.push({
        target: memory.id,
        error: error instanceof Error ? error.message : String(error),
        code: 'E_INTERNAL',
      });
    }
  }

  // 2. Process late commitments (annotate)
  const lateCommitments = getLateCommitments(commitments, now);
  for (const commitment of lateCommitments.slice(0, cfg.max_batch - processed)) {
    if (processed >= cfg.max_batch) break;

    try {
      // Check if already annotated as late
      const hasLateAnnotation = commitment.annotations.some(
        a => a.kind === 'late'
      );
      if (hasLateAnnotation) continue;

      const temporal = getTemporalMeta(commitment);
      const latePolicy = temporal?.late_policy || 'warn';

      if (!dryRun) {
        if (latePolicy === 'warn' || latePolicy === 'escalate') {
          const annotateOp: AnnotateOperation = {
            id: generateId('op'),
            op: 'annotate',
            ts: now.toISOString(),
            actor: 'scheduler',
            workspace: workspacePath,
            payload: {
              target: commitment.id,
              body: `Commitment is past deadline (${temporal?.deadline})`,
              kind: 'late',
              meta: {
                deadline: temporal?.deadline,
                detected_at: now.toISOString(),
                policy: latePolicy,
              },
            },
          };

          appendOperation(workspacePath, annotateOp);

          actions.push({
            type: 'annotate_late',
            target: commitment.id,
            op_id: annotateOp.id,
          });
        }

        if (latePolicy === 'escalate') {
          const captureOp: CaptureOperation = {
            id: generateId('mem'),
            op: 'capture',
            ts: now.toISOString(),
            actor: 'scheduler',
            workspace: workspacePath,
            payload: {
              body: `ESCALATION: Commitment ${commitment.id} is late: "${commitment.body}"`,
              kind: 'escalation',
              refs: [commitment.id],
              meta: {
                deadline: temporal?.deadline,
                escalated_at: now.toISOString(),
              },
            },
          };

          appendOperation(workspacePath, captureOp);

          actions.push({
            type: 'escalate',
            target: commitment.id,
            op_id: captureOp.id,
          });
        }
      } else {
        actions.push({
          type: 'annotate_late',
          target: commitment.id,
          op_id: '[dry-run]',
        });
      }

      processed++;
    } catch (error) {
      errors.push({
        target: commitment.id,
        error: error instanceof Error ? error.message : String(error),
        code: 'E_INTERNAL',
      });
    }
  }

  // 3. Process recurring memories (create next occurrence)
  const recurringDue = getRecurringDue(memories, now);
  for (const memory of recurringDue.slice(0, cfg.max_batch - processed)) {
    if (processed >= cfg.max_batch) break;

    try {
      const temporal = getTemporalMeta(memory);
      if (!temporal?.recurrence) continue;

      const { pattern, timezone } = temporal.recurrence;
      const nextAt = calculateNextOccurrence(pattern, now, timezone || cfg.timezone);

      if (!dryRun) {
        // Create new memory for next occurrence
        const newMemoryOp: CaptureOperation = {
          id: generateId('mem'),
          op: 'capture',
          ts: now.toISOString(),
          actor: 'scheduler',
          workspace: workspacePath,
          payload: {
            body: memory.body,
            kind: memory.kind || 'scheduled',
            refs: [memory.id],
            meta: {
              ...memory.meta,
              due_at: nextAt.toISOString(),
              recurrence: {
                ...temporal.recurrence,
                last_at: now.toISOString(),
                next_at: calculateNextOccurrence(pattern, nextAt, timezone || cfg.timezone).toISOString(),
                count: temporal.recurrence.count !== undefined
                  ? temporal.recurrence.count - 1
                  : undefined,
              },
            },
          },
        };

        appendOperation(workspacePath, newMemoryOp);

        actions.push({
          type: 'recurrence_tick',
          target: memory.id,
          op_id: newMemoryOp.id,
        });
      } else {
        actions.push({
          type: 'recurrence_tick',
          target: memory.id,
          op_id: '[dry-run]',
        });
      }

      processed++;
    } catch (error) {
      errors.push({
        target: memory.id,
        error: error instanceof Error ? error.message : String(error),
        code: 'E_INTERNAL',
      });
    }
  }

  return {
    tick_at: now.toISOString(),
    processed,
    actions,
    errors,
  };
}

/**
 * Start scheduler loop (for daemon mode)
 */
export function startSchedulerLoop(
  workspacePath: string,
  config: Partial<SchedulerConfig> = {},
  onTick?: (result: SchedulerTickResult) => void
): () => void {
  const cfg = { ...DEFAULT_SCHEDULER_CONFIG, ...config };

  if (!cfg.enabled) {
    console.log('Scheduler is disabled');
    return () => {};
  }

  const intervalMs = cfg.tick_interval * 1000;

  const intervalId = setInterval(async () => {
    try {
      const result = await tick(workspacePath, cfg);
      if (onTick) {
        onTick(result);
      }
    } catch (error) {
      console.error('Scheduler tick error:', error);
    }
  }, intervalMs);

  // Return stop function
  return () => {
    clearInterval(intervalId);
  };
}

export default {
  DEFAULT_SCHEDULER_CONFIG,
  tick,
  startSchedulerLoop,
};
