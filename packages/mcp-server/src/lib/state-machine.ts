/**
 * Mentu State Machine
 *
 * Derives commitment and memory states from their history/properties.
 * Used for enriching API responses with computed state info.
 *
 * Commitment lifecycle:
 *   OPEN → CLAIMED → IN_REVIEW → CLOSED
 *                  ↗               ↓
 *              REOPENED ←──────────┘
 *
 * Memory lifecycle:
 *   UNTRIAGED → COMMITTED (has commitment)
 *             → LINKED (linked to commitment)
 *             → DISMISSED (filtered out)
 */

import type { CommitmentState, MemoryState, Commitment, Memory, HistoryEntry } from './types.js';

/**
 * Derive commitment state from its history entries.
 * Replays the ops chain to compute current state.
 */
export function deriveCommitmentState(history: HistoryEntry[]): CommitmentState {
  let state: CommitmentState = 'open';

  for (const entry of history) {
    switch (entry.op) {
      case 'claim':
        state = 'claimed';
        break;
      case 'release':
        state = 'open';
        break;
      case 'submit':
        state = 'in_review';
        break;
      case 'approve':
      case 'close':
        state = 'closed';
        break;
      case 'reopen':
        state = 'reopened';
        break;
    }
  }

  return state;
}

/**
 * Check if a commitment is in a terminal state.
 */
export function isTerminal(state: CommitmentState): boolean {
  return state === 'closed';
}

/**
 * Check if a commitment can be claimed.
 */
export function isClaimable(state: CommitmentState): boolean {
  return state === 'open' || state === 'reopened';
}

/**
 * Check if a commitment can be submitted.
 */
export function isSubmittable(state: CommitmentState): boolean {
  return state === 'claimed';
}

/**
 * Get a human-readable label for a commitment state.
 */
export function stateLabel(state: CommitmentState): string {
  const labels: Record<CommitmentState, string> = {
    open: 'Open',
    claimed: 'Claimed',
    in_review: 'In Review',
    closed: 'Closed',
    reopened: 'Reopened',
  };
  return labels[state] || state;
}

/**
 * Get a human-readable label for a memory triage state.
 */
export function memoryStateLabel(state: MemoryState): string {
  const labels: Record<MemoryState, string> = {
    untriaged: 'Untriaged',
    linked: 'Linked',
    dismissed: 'Dismissed',
    committed: 'Committed',
  };
  return labels[state] || state;
}

/**
 * Compute pipeline health metrics from commitments.
 */
export function computePipelineHealth(commitments: Commitment[]): {
  total: number;
  open: number;
  claimed: number;
  in_review: number;
  closed: number;
  reopened: number;
  throughput_rate: number;
} {
  const counts = {
    total: commitments.length,
    open: 0,
    claimed: 0,
    in_review: 0,
    closed: 0,
    reopened: 0,
  };

  for (const c of commitments) {
    const state = c.state;
    if (state in counts) {
      counts[state as keyof typeof counts]++;
    }
  }

  const throughput_rate = counts.total > 0
    ? Math.round((counts.closed / counts.total) * 100) / 100
    : 0;

  return { ...counts, throughput_rate };
}
