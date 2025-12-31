import type {
  Operation,
  CaptureOperation,
  CommitOperation,
  AnnotateOperation,
  Memory,
  Commitment,
  CommitmentState,
  MemoryState,
  Annotation,
} from '../types.js';

/**
 * Compute commitment state by replaying the ledger.
 * v0.8: Added duplicate state support.
 * v1.0: Added in_review and reopened states.
 */
export function computeCommitmentState(
  ops: Operation[],
  cmtId: string
): {
  state: CommitmentState | 'duplicate';
  owner: string | null;
  evidence: string | null;
  closed_by: string | null;
  duplicate_of: string | null;
  submittedAt?: string;
  approvedAt?: string;
  reopenedAt?: string;
  reopenReason?: string;
} {
  let state: CommitmentState | 'duplicate' = 'open';
  let owner: string | null = null;
  let evidence: string | null = null;
  let closed_by: string | null = null;
  let duplicate_of: string | null = null;
  let submittedAt: string | undefined;
  let approvedAt: string | undefined;
  let reopenedAt: string | undefined;
  let reopenReason: string | undefined;

  for (const op of ops) {
    if (op.op === 'claim' && op.payload.commitment === cmtId) {
      state = 'claimed';
      owner = op.actor;
    } else if (op.op === 'release' && op.payload.commitment === cmtId) {
      state = 'open';
      owner = null;
    } else if (op.op === 'submit' && op.payload.commitment === cmtId) {
      state = 'in_review';
      evidence = op.payload.evidence?.[0] ?? null;
      submittedAt = op.ts;
      // owner preserved for potential rework
    } else if (op.op === 'approve' && op.payload.commitment === cmtId) {
      state = 'closed';
      closed_by = op.actor;
      approvedAt = op.ts;
      owner = null;
    } else if (op.op === 'reopen' && op.payload.commitment === cmtId) {
      state = 'reopened';
      reopenedAt = op.ts;
      reopenReason = op.payload.reason;
      // owner preserved from before
    } else if (op.op === 'close' && op.payload.commitment === cmtId) {
      // Legacy direct close
      if (op.payload.duplicate_of) {
        state = 'duplicate';
        duplicate_of = op.payload.duplicate_of;
      } else {
        state = 'closed';
        evidence = op.payload.evidence ?? null;
      }
      owner = null;
      closed_by = op.actor;
    }
  }

  return { state, owner, evidence, closed_by, duplicate_of, submittedAt, approvedAt, reopenedAt, reopenReason };
}

/**
 * Get annotations for a target ID.
 */
export function getAnnotations(ops: Operation[], targetId: string): Annotation[] {
  const annotations: Annotation[] = [];

  for (const op of ops) {
    if (op.op === 'annotate' && op.payload.target === targetId) {
      annotations.push({
        id: op.id,
        body: op.payload.body,
        kind: op.payload.kind,
        actor: op.actor,
        ts: op.ts,
      });
    }
  }

  return annotations;
}

/**
 * Compute all memories from ledger.
 */
export function computeMemories(ops: Operation[]): Memory[] {
  const memories: Memory[] = [];

  for (const op of ops) {
    if (op.op === 'capture') {
      const captureOp = op as CaptureOperation;
      memories.push({
        id: captureOp.id,
        body: captureOp.payload.body,
        kind: captureOp.payload.kind ?? null,
        actor: captureOp.actor,
        ts: captureOp.ts,
        refs: captureOp.payload.refs,
        meta: captureOp.payload.meta,
        annotations: getAnnotations(ops, captureOp.id),
      });
    }
  }

  return memories;
}

/**
 * Compute all commitments from ledger.
 */
export function computeCommitments(ops: Operation[]): Commitment[] {
  const commitments: Commitment[] = [];

  for (const op of ops) {
    if (op.op === 'commit') {
      const commitOp = op as CommitOperation;
      const { state, owner, evidence, closed_by } = computeCommitmentState(ops, commitOp.id);

      // For backward compat, duplicate shows as closed in the Commitment interface
      const commitmentState: CommitmentState = state === 'duplicate' ? 'closed' : state;

      commitments.push({
        id: commitOp.id,
        body: commitOp.payload.body,
        source: commitOp.payload.source,
        state: commitmentState,
        owner,
        evidence,
        closed_by,
        actor: commitOp.actor,
        ts: commitOp.ts,
        tags: commitOp.payload.tags,
        meta: commitOp.payload.meta,
        annotations: getAnnotations(ops, commitOp.id),
      });
    }
  }

  return commitments;
}

/**
 * Get a single memory by ID.
 */
export function getMemory(ops: Operation[], id: string): Memory | null {
  for (const op of ops) {
    if (op.op === 'capture' && op.id === id) {
      const captureOp = op as CaptureOperation;
      return {
        id: captureOp.id,
        body: captureOp.payload.body,
        kind: captureOp.payload.kind ?? null,
        actor: captureOp.actor,
        ts: captureOp.ts,
        refs: captureOp.payload.refs,
        meta: captureOp.payload.meta,
        annotations: getAnnotations(ops, captureOp.id),
      };
    }
  }

  return null;
}

/**
 * Get a single commitment by ID.
 */
export function getCommitment(ops: Operation[], id: string): Commitment | null {
  for (const op of ops) {
    if (op.op === 'commit' && op.id === id) {
      const commitOp = op as CommitOperation;
      const { state, owner, evidence, closed_by } = computeCommitmentState(ops, commitOp.id);

      // For backward compat, duplicate shows as closed in the Commitment interface
      const commitmentState: CommitmentState = state === 'duplicate' ? 'closed' : state;

      return {
        id: commitOp.id,
        body: commitOp.payload.body,
        source: commitOp.payload.source,
        state: commitmentState,
        owner,
        evidence,
        closed_by,
        actor: commitOp.actor,
        ts: commitOp.ts,
        tags: commitOp.payload.tags,
        meta: commitOp.payload.meta,
        annotations: getAnnotations(ops, commitOp.id),
      };
    }
  }

  return null;
}

/**
 * Check if a memory exists.
 */
export function memoryExists(ops: Operation[], id: string): boolean {
  return ops.some((op) => op.op === 'capture' && op.id === id);
}

/**
 * Check if a commitment exists.
 */
export function commitmentExists(ops: Operation[], id: string): boolean {
  return ops.some((op) => op.op === 'commit' && op.id === id);
}

/**
 * Check if a record (memory or commitment) exists.
 */
export function recordExists(ops: Operation[], id: string): boolean {
  return memoryExists(ops, id) || commitmentExists(ops, id);
}

/**
 * Compute memory triage state by replaying the ledger.
 * v0.8: Triage layer.
 */
export function computeMemoryState(ops: Operation[], memId: string): MemoryState {
  // Check if memory is source of any commitment
  const isSource = ops.some(op =>
    op.op === 'commit' && op.payload.source === memId
  );
  if (isSource) return 'committed';

  // Check if memory is linked to any commitment
  const isLinked = ops.some(op =>
    op.op === 'link' && op.payload.source === memId
  );
  if (isLinked) return 'linked';

  // Check if memory is dismissed
  const isDismissed = ops.some(op =>
    op.op === 'dismiss' && op.payload.memory === memId
  );
  if (isDismissed) return 'dismissed';

  return 'untriaged';
}

/**
 * Get all memories linked to a commitment.
 * v0.8: Triage layer.
 */
export function getLinkedMemories(ops: Operation[], cmtId: string): string[] {
  return ops
    .filter(op =>
      op.op === 'link' &&
      op.payload.target === cmtId &&
      op.payload.source.startsWith('mem_')
    )
    .map(op => (op as { payload: { source: string } }).payload.source);
}

/**
 * Get all commitments linked to a commitment (as source).
 * v0.8: Triage layer.
 */
export function getLinkedCommitments(ops: Operation[], cmtId: string): string[] {
  return ops
    .filter(op =>
      op.op === 'link' &&
      op.payload.target === cmtId &&
      op.payload.source.startsWith('cmt_')
    )
    .map(op => (op as { payload: { source: string } }).payload.source);
}

/**
 * Get all commitments that are duplicates of a commitment.
 * v0.8: Triage layer.
 */
export function getDuplicates(ops: Operation[], cmtId: string): string[] {
  return ops
    .filter(op =>
      op.op === 'close' &&
      op.payload.duplicate_of === cmtId
    )
    .map(op => (op as { payload: { commitment: string } }).payload.commitment);
}

/**
 * Check if a memory has been dismissed.
 * v0.8: Triage layer.
 */
export function isMemoryDismissed(ops: Operation[], memId: string): boolean {
  return ops.some(op => op.op === 'dismiss' && op.payload.memory === memId);
}

/**
 * Check if a memory is the source of any commitment.
 * v0.8: Triage layer.
 */
export function isMemorySourceOfCommitment(ops: Operation[], memId: string): boolean {
  return ops.some(op => op.op === 'commit' && op.payload.source === memId);
}
