import { describe, it, expect } from 'vitest';
import { computeInstanceState, mapCommitmentStateToStepState } from '../../src/workflows/cache.js';

describe('Workflow Cache Pure Functions', () => {
  describe('mapCommitmentStateToStepState', () => {
    it('maps open to pending', () => {
      expect(mapCommitmentStateToStepState('open')).toBe('pending');
    });

    it('maps claimed to running', () => {
      expect(mapCommitmentStateToStepState('claimed')).toBe('running');
    });

    it('maps in_review to running', () => {
      expect(mapCommitmentStateToStepState('in_review')).toBe('running');
    });

    it('maps closed to completed', () => {
      expect(mapCommitmentStateToStepState('closed')).toBe('completed');
    });

    it('maps reopened to running', () => {
      expect(mapCommitmentStateToStepState('reopened')).toBe('running');
    });

    it('maps unknown states to pending', () => {
      expect(mapCommitmentStateToStepState('unknown')).toBe('pending');
      expect(mapCommitmentStateToStepState('')).toBe('pending');
    });
  });

  describe('computeInstanceState', () => {
    it('returns pending for empty commitments', () => {
      expect(computeInstanceState([])).toBe('pending');
    });

    it('returns pending when no commitments have workflow_step_id', () => {
      const commitments = [
        { id: 'cmt_1', state: 'claimed', workflow_step_id: null, step_outcome: null, owner: null, created_at: '2026-01-01', closed_at: null },
      ];
      expect(computeInstanceState(commitments)).toBe('pending');
    });

    it('returns completed when all step commitments are closed', () => {
      const commitments = [
        { id: 'cmt_1', state: 'closed', workflow_step_id: 'detection', step_outcome: null, owner: null, created_at: '2026-01-01', closed_at: '2026-01-02' },
        { id: 'cmt_2', state: 'closed', workflow_step_id: 'investigation', step_outcome: null, owner: null, created_at: '2026-01-01', closed_at: '2026-01-02' },
        { id: 'cmt_3', state: 'closed', workflow_step_id: 'fix', step_outcome: null, owner: null, created_at: '2026-01-01', closed_at: '2026-01-02' },
      ];
      expect(computeInstanceState(commitments)).toBe('completed');
    });

    it('returns running when any step commitment is claimed', () => {
      const commitments = [
        { id: 'cmt_1', state: 'closed', workflow_step_id: 'detection', step_outcome: null, owner: null, created_at: '2026-01-01', closed_at: '2026-01-02' },
        { id: 'cmt_2', state: 'claimed', workflow_step_id: 'investigation', step_outcome: null, owner: null, created_at: '2026-01-01', closed_at: null },
      ];
      expect(computeInstanceState(commitments)).toBe('running');
    });

    it('returns running when any step commitment is in_review', () => {
      const commitments = [
        { id: 'cmt_1', state: 'closed', workflow_step_id: 'detection', step_outcome: null, owner: null, created_at: '2026-01-01', closed_at: '2026-01-02' },
        { id: 'cmt_2', state: 'in_review', workflow_step_id: 'investigation', step_outcome: null, owner: null, created_at: '2026-01-01', closed_at: null },
      ];
      expect(computeInstanceState(commitments)).toBe('running');
    });

    it('returns running when any step commitment is reopened', () => {
      const commitments = [
        { id: 'cmt_1', state: 'closed', workflow_step_id: 'detection', step_outcome: null, owner: null, created_at: '2026-01-01', closed_at: '2026-01-02' },
        { id: 'cmt_2', state: 'reopened', workflow_step_id: 'investigation', step_outcome: null, owner: null, created_at: '2026-01-01', closed_at: null },
      ];
      expect(computeInstanceState(commitments)).toBe('running');
    });

    it('returns pending when all step commitments are open', () => {
      const commitments = [
        { id: 'cmt_1', state: 'open', workflow_step_id: 'detection', step_outcome: null, owner: null, created_at: '2026-01-01', closed_at: null },
        { id: 'cmt_2', state: 'open', workflow_step_id: 'investigation', step_outcome: null, owner: null, created_at: '2026-01-01', closed_at: null },
      ];
      expect(computeInstanceState(commitments)).toBe('pending');
    });

    it('ignores commitments without workflow_step_id', () => {
      const commitments = [
        { id: 'cmt_1', state: 'claimed', workflow_step_id: null, step_outcome: null, owner: null, created_at: '2026-01-01', closed_at: null },
        { id: 'cmt_2', state: 'closed', workflow_step_id: 'detection', step_outcome: null, owner: null, created_at: '2026-01-01', closed_at: '2026-01-02' },
        { id: 'cmt_3', state: 'closed', workflow_step_id: 'fix', step_outcome: null, owner: null, created_at: '2026-01-01', closed_at: '2026-01-02' },
      ];
      expect(computeInstanceState(commitments)).toBe('completed');
    });

    it('mixed states with some closed and some open returns pending', () => {
      const commitments = [
        { id: 'cmt_1', state: 'closed', workflow_step_id: 'detection', step_outcome: null, owner: null, created_at: '2026-01-01', closed_at: '2026-01-02' },
        { id: 'cmt_2', state: 'open', workflow_step_id: 'investigation', step_outcome: null, owner: null, created_at: '2026-01-01', closed_at: null },
      ];
      expect(computeInstanceState(commitments)).toBe('pending');
    });
  });
});
