import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tick } from '../../src/core/dependency-resolver.js';
import { appendOperation } from '../../src/core/ledger.js';
import { createTestWorkspace } from '../helpers.js';
import { generateId } from '../../src/utils/id.js';
import type { CaptureOperation, CommitOperation, CloseOperation } from '../../src/types.js';

describe('dependency-resolver', () => {
  let workspacePath: string;
  let cleanup: () => void;

  beforeEach(() => {
    const workspace = createTestWorkspace();
    workspacePath = workspace.path;
    cleanup = workspace.cleanup;
  });

  afterEach(() => {
    cleanup();
  });

  describe('tick', () => {
    it('should skip commitments without wait_for', async () => {
      // Create a commitment without dependencies
      const memId = generateId('mem');
      const captureOp: CaptureOperation = {
        id: memId,
        op: 'capture',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: { body: 'Test task', kind: 'task' },
      };
      appendOperation(workspacePath, captureOp);

      const cmtId = generateId('cmt');
      const commitOp: CommitOperation = {
        id: cmtId,
        op: 'commit',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: {
          body: 'Test commitment',
          source: memId,
          meta: { affinity: 'bridge' },
        },
      };
      appendOperation(workspacePath, commitOp);

      const result = await tick(workspacePath, { dry_run: true });

      expect(result.checked).toBe(0);
      expect(result.spawned).toHaveLength(0);
    });

    it('should detect blocked dependencies', async () => {
      // Create two commitments with dependency
      const mem1 = generateId('mem');
      const capture1: CaptureOperation = {
        id: mem1,
        op: 'capture',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: { body: 'Task 1', kind: 'task' },
      };
      appendOperation(workspacePath, capture1);

      const cmt1 = generateId('cmt');
      const commit1: CommitOperation = {
        id: cmt1,
        op: 'commit',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: {
          body: 'Build step',
          source: mem1,
          meta: { affinity: 'bridge' },
        },
      };
      appendOperation(workspacePath, commit1);

      const mem2 = generateId('mem');
      const capture2: CaptureOperation = {
        id: mem2,
        op: 'capture',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: { body: 'Task 2', kind: 'task' },
      };
      appendOperation(workspacePath, capture2);

      const cmt2 = generateId('cmt');
      const commit2: CommitOperation = {
        id: cmt2,
        op: 'commit',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: {
          body: 'Test step',
          source: mem2,
          meta: { wait_for: cmt1, affinity: 'bridge' },
        },
      };
      appendOperation(workspacePath, commit2);

      const result = await tick(workspacePath, { dry_run: true });

      expect(result.checked).toBe(1);
      expect(result.blocked).toHaveLength(1);
      expect(result.blocked[0].id).toBe(cmt2);
      expect(result.blocked[0].waiting_on).toContain(cmt1);
    });

    it('should spawn when dependency is closed', async () => {
      // Create dependency commitment
      const mem1 = generateId('mem');
      const capture1: CaptureOperation = {
        id: mem1,
        op: 'capture',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: { body: 'Task 1', kind: 'task' },
      };
      appendOperation(workspacePath, capture1);

      const cmt1 = generateId('cmt');
      const commit1: CommitOperation = {
        id: cmt1,
        op: 'commit',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: { body: 'Build', source: mem1 },
      };
      appendOperation(workspacePath, commit1);

      // Close the dependency
      const evidence = generateId('mem');
      const evidenceCapture: CaptureOperation = {
        id: evidence,
        op: 'capture',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: { body: 'Evidence', kind: 'evidence' },
      };
      appendOperation(workspacePath, evidenceCapture);

      const closeOp: CloseOperation = {
        id: generateId('op'),
        op: 'close',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: { commitment: cmt1, evidence },
      };
      appendOperation(workspacePath, closeOp);

      // Create dependent commitment
      const mem2 = generateId('mem');
      const capture2: CaptureOperation = {
        id: mem2,
        op: 'capture',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: { body: 'Task 2', kind: 'task' },
      };
      appendOperation(workspacePath, capture2);

      const cmt2 = generateId('cmt');
      const commit2: CommitOperation = {
        id: cmt2,
        op: 'commit',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: {
          body: 'Test',
          source: mem2,
          meta: { wait_for: cmt1, affinity: 'bridge' },
        },
      };
      appendOperation(workspacePath, commit2);

      const result = await tick(workspacePath, { dry_run: true });

      expect(result.spawned).toContain(cmt2);
    });

    it('should skip non-bridge affinity', async () => {
      const mem1 = generateId('mem');
      const capture1: CaptureOperation = {
        id: mem1,
        op: 'capture',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: { body: 'Task', kind: 'task' },
      };
      appendOperation(workspacePath, capture1);

      const cmt1 = generateId('cmt');
      const commit1: CommitOperation = {
        id: cmt1,
        op: 'commit',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: {
          body: 'Human task',
          source: mem1,
          meta: { wait_for: 'cmt_fake', affinity: 'human' },
        },
      };
      appendOperation(workspacePath, commit1);

      const result = await tick(workspacePath, { dry_run: true });

      expect(result.checked).toBe(0);
    });

    it('should handle wait_for_all correctly', async () => {
      // Create two dependency commitments
      const mem1 = generateId('mem');
      const capture1: CaptureOperation = {
        id: mem1,
        op: 'capture',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: { body: 'Task 1', kind: 'task' },
      };
      appendOperation(workspacePath, capture1);

      const cmt1 = generateId('cmt');
      const commit1: CommitOperation = {
        id: cmt1,
        op: 'commit',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: { body: 'Dep 1', source: mem1 },
      };
      appendOperation(workspacePath, commit1);

      const mem2 = generateId('mem');
      const capture2: CaptureOperation = {
        id: mem2,
        op: 'capture',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: { body: 'Task 2', kind: 'task' },
      };
      appendOperation(workspacePath, capture2);

      const cmt2 = generateId('cmt');
      const commit2: CommitOperation = {
        id: cmt2,
        op: 'commit',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: { body: 'Dep 2', source: mem2 },
      };
      appendOperation(workspacePath, commit2);

      // Close only first dependency
      const evidence1 = generateId('mem');
      const evidenceCapture1: CaptureOperation = {
        id: evidence1,
        op: 'capture',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: { body: 'Evidence 1', kind: 'evidence' },
      };
      appendOperation(workspacePath, evidenceCapture1);

      const closeOp1: CloseOperation = {
        id: generateId('op'),
        op: 'close',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: { commitment: cmt1, evidence: evidence1 },
      };
      appendOperation(workspacePath, closeOp1);

      // Create commitment waiting on both
      const mem3 = generateId('mem');
      const capture3: CaptureOperation = {
        id: mem3,
        op: 'capture',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: { body: 'Task 3', kind: 'task' },
      };
      appendOperation(workspacePath, capture3);

      const cmt3 = generateId('cmt');
      const commit3: CommitOperation = {
        id: cmt3,
        op: 'commit',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: {
          body: 'Final',
          source: mem3,
          meta: { wait_for_all: [cmt1, cmt2], affinity: 'bridge' },
        },
      };
      appendOperation(workspacePath, commit3);

      const result = await tick(workspacePath, { dry_run: true });

      // Should be blocked because cmt2 is still open
      expect(result.blocked).toHaveLength(1);
      expect(result.blocked[0].id).toBe(cmt3);
      expect(result.blocked[0].waiting_on).toContain(cmt2);
    });

    it('should handle wait_for_any correctly', async () => {
      // Create two dependency commitments
      const mem1 = generateId('mem');
      const capture1: CaptureOperation = {
        id: mem1,
        op: 'capture',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: { body: 'Task 1', kind: 'task' },
      };
      appendOperation(workspacePath, capture1);

      const cmt1 = generateId('cmt');
      const commit1: CommitOperation = {
        id: cmt1,
        op: 'commit',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: { body: 'Dep 1', source: mem1 },
      };
      appendOperation(workspacePath, commit1);

      const mem2 = generateId('mem');
      const capture2: CaptureOperation = {
        id: mem2,
        op: 'capture',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: { body: 'Task 2', kind: 'task' },
      };
      appendOperation(workspacePath, capture2);

      const cmt2 = generateId('cmt');
      const commit2: CommitOperation = {
        id: cmt2,
        op: 'commit',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: { body: 'Dep 2', source: mem2 },
      };
      appendOperation(workspacePath, commit2);

      // Close only first dependency
      const evidence1 = generateId('mem');
      const evidenceCapture1: CaptureOperation = {
        id: evidence1,
        op: 'capture',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: { body: 'Evidence 1', kind: 'evidence' },
      };
      appendOperation(workspacePath, evidenceCapture1);

      const closeOp1: CloseOperation = {
        id: generateId('op'),
        op: 'close',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: { commitment: cmt1, evidence: evidence1 },
      };
      appendOperation(workspacePath, closeOp1);

      // Create commitment waiting on ANY
      const mem3 = generateId('mem');
      const capture3: CaptureOperation = {
        id: mem3,
        op: 'capture',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: { body: 'Task 3', kind: 'task' },
      };
      appendOperation(workspacePath, capture3);

      const cmt3 = generateId('cmt');
      const commit3: CommitOperation = {
        id: cmt3,
        op: 'commit',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: {
          body: 'Final',
          source: mem3,
          meta: { wait_for_any: [cmt1, cmt2], affinity: 'bridge' },
        },
      };
      appendOperation(workspacePath, commit3);

      const result = await tick(workspacePath, { dry_run: true });

      // Should be spawned because cmt1 is closed
      expect(result.spawned).toContain(cmt3);
    });

    it('should detect circular dependencies', async () => {
      // Create two commitments that depend on each other
      const mem1 = generateId('mem');
      const capture1: CaptureOperation = {
        id: mem1,
        op: 'capture',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: { body: 'Task 1', kind: 'task' },
      };
      appendOperation(workspacePath, capture1);

      const cmt1 = generateId('cmt');
      const cmt2 = generateId('cmt');

      // cmt1 waits for cmt2
      const commit1: CommitOperation = {
        id: cmt1,
        op: 'commit',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: {
          body: 'Step 1',
          source: mem1,
          meta: { wait_for: cmt2, affinity: 'bridge' },
        },
      };
      appendOperation(workspacePath, commit1);

      const mem2 = generateId('mem');
      const capture2: CaptureOperation = {
        id: mem2,
        op: 'capture',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: { body: 'Task 2', kind: 'task' },
      };
      appendOperation(workspacePath, capture2);

      // cmt2 waits for cmt1 - circular!
      const commit2: CommitOperation = {
        id: cmt2,
        op: 'commit',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: {
          body: 'Step 2',
          source: mem2,
          meta: { wait_for: cmt1, affinity: 'bridge' },
        },
      };
      appendOperation(workspacePath, commit2);

      const result = await tick(workspacePath, { dry_run: true });

      // Should have errors for circular dependency
      expect(result.errors.some(e => e.code === 'E_CIRCULAR_DEP')).toBe(true);
    });

    it('should skip already claimed commitments', async () => {
      // Create a commitment and claim it
      const mem1 = generateId('mem');
      const capture1: CaptureOperation = {
        id: mem1,
        op: 'capture',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: { body: 'Task', kind: 'task' },
      };
      appendOperation(workspacePath, capture1);

      const cmt1 = generateId('cmt');
      const commit1: CommitOperation = {
        id: cmt1,
        op: 'commit',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: { body: 'Dep', source: mem1 },
      };
      appendOperation(workspacePath, commit1);

      // Close the dependency
      const evidence = generateId('mem');
      const evidenceCapture: CaptureOperation = {
        id: evidence,
        op: 'capture',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: { body: 'Evidence', kind: 'evidence' },
      };
      appendOperation(workspacePath, evidenceCapture);

      const closeOp: CloseOperation = {
        id: generateId('op'),
        op: 'close',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: { commitment: cmt1, evidence },
      };
      appendOperation(workspacePath, closeOp);

      // Create dependent commitment and claim it
      const mem2 = generateId('mem');
      const capture2: CaptureOperation = {
        id: mem2,
        op: 'capture',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: { body: 'Task 2', kind: 'task' },
      };
      appendOperation(workspacePath, capture2);

      const cmt2 = generateId('cmt');
      const commit2: CommitOperation = {
        id: cmt2,
        op: 'commit',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: {
          body: 'Claimed task',
          source: mem2,
          meta: { wait_for: cmt1, affinity: 'bridge' },
        },
      };
      appendOperation(workspacePath, commit2);

      // Claim the commitment
      appendOperation(workspacePath, {
        id: generateId('op'),
        op: 'claim',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: { commitment: cmt2 },
      });

      const result = await tick(workspacePath, { dry_run: true });

      // Should not spawn because it's already claimed
      expect(result.spawned).not.toContain(cmt2);
      expect(result.checked).toBe(0); // Skipped because not 'open' state
    });

    it('should respect max_batch limit', async () => {
      // Create dependency commitment and close it
      const depMem = generateId('mem');
      const depCapture: CaptureOperation = {
        id: depMem,
        op: 'capture',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: { body: 'Dep', kind: 'task' },
      };
      appendOperation(workspacePath, depCapture);

      const depCmt = generateId('cmt');
      const depCommit: CommitOperation = {
        id: depCmt,
        op: 'commit',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: { body: 'Dependency', source: depMem },
      };
      appendOperation(workspacePath, depCommit);

      const evidence = generateId('mem');
      const evidenceCapture: CaptureOperation = {
        id: evidence,
        op: 'capture',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: { body: 'Evidence', kind: 'evidence' },
      };
      appendOperation(workspacePath, evidenceCapture);

      const closeOp: CloseOperation = {
        id: generateId('op'),
        op: 'close',
        ts: new Date().toISOString(),
        actor: 'test',
        workspace: workspacePath,
        payload: { commitment: depCmt, evidence },
      };
      appendOperation(workspacePath, closeOp);

      // Create 5 dependent commitments
      for (let i = 0; i < 5; i++) {
        const mem = generateId('mem');
        const capture: CaptureOperation = {
          id: mem,
          op: 'capture',
          ts: new Date().toISOString(),
          actor: 'test',
          workspace: workspacePath,
          payload: { body: `Task ${i}`, kind: 'task' },
        };
        appendOperation(workspacePath, capture);

        const cmt = generateId('cmt');
        const commit: CommitOperation = {
          id: cmt,
          op: 'commit',
          ts: new Date().toISOString(),
          actor: 'test',
          workspace: workspacePath,
          payload: {
            body: `Step ${i}`,
            source: mem,
            meta: { wait_for: depCmt, affinity: 'bridge' },
          },
        };
        appendOperation(workspacePath, commit);
      }

      const result = await tick(workspacePath, { dry_run: true, max_batch: 3 });

      // Should only process up to max_batch
      expect(result.checked).toBeLessThanOrEqual(3);
    });
  });
});
