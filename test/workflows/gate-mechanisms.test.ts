import { describe, it, expect } from 'vitest';
import { GateEvaluator } from '../../src/workflows/gates.js';

describe('Gate Mechanisms', () => {
  describe('Approval Gate', () => {
    it('blocks until approved', () => {
      const gate = new GateEvaluator({
        type: 'gate',
        gate_type: 'approval',
        timeout_hours: 24,
      });

      const result = gate.evaluate({
        state: 'waiting',
        commitment_id: 'cmt_test0001',
        commitment_state: 'open',
        status: 'waiting',
      });

      expect(result.should_proceed).toBe(false);
      expect(result.reason).toBe('waiting_for_approval');
    });

    it('proceeds on approval', () => {
      const gate = new GateEvaluator({
        type: 'gate',
        gate_type: 'approval',
        next: { approved: ['fix'], rejected: ['end'] },
      });

      const result = gate.evaluate({
        state: 'approved',
        commitment_id: 'cmt_test0002',
        commitment_state: 'closed',
        status: 'approved',
        approved_by: 'user:rashid',
      });

      expect(result.should_proceed).toBe(true);
      expect(result.next_step).toBe('fix');
    });

    it('stops on rejection', () => {
      const gate = new GateEvaluator({
        type: 'gate',
        gate_type: 'approval',
        next: { approved: ['fix'], rejected: ['end'] },
      });

      const result = gate.evaluate({
        state: 'rejected',
        commitment_id: 'cmt_test0003',
        commitment_state: 'reopened',
        status: 'rejected',
        rejected_by: 'user:rashid',
      });

      expect(result.should_proceed).toBe(true);
      expect(result.next_step).toBe('end');
    });

    it('escalates on timeout', () => {
      const gate = new GateEvaluator({
        type: 'gate',
        gate_type: 'approval',
        timeout_hours: 24,
        next: { timeout: ['escalate'] },
      });

      const now = Date.now();
      const timeout_at = now - (25 * 60 * 60 * 1000); // 25 hours ago

      const result = gate.evaluate({
        state: 'waiting',
        commitment_id: 'cmt_test0004',
        commitment_state: 'open',
        status: 'waiting',
        started_at: timeout_at,
        current_time: now,
      });

      expect(result.should_proceed).toBe(true);
      expect(result.next_step).toBe('escalate');
      expect(result.reason).toBe('timeout');
    });

    it('does not timeout if within time limit', () => {
      const gate = new GateEvaluator({
        type: 'gate',
        gate_type: 'approval',
        timeout_hours: 24,
        next: { timeout: ['escalate'] },
      });

      const now = Date.now();
      const started_at = now - (23 * 60 * 60 * 1000); // 23 hours ago

      const result = gate.evaluate({
        state: 'waiting',
        commitment_id: 'cmt_test0005',
        commitment_state: 'open',
        status: 'waiting',
        started_at,
        current_time: now,
      });

      expect(result.should_proceed).toBe(false);
      expect(result.reason).toBe('waiting_for_approval');
    });

    it('handles missing timeout configuration', () => {
      const gate = new GateEvaluator({
        type: 'gate',
        gate_type: 'approval',
      });

      const result = gate.evaluate({
        state: 'waiting',
        commitment_id: 'cmt_test0006',
        commitment_state: 'open',
        status: 'waiting',
      });

      expect(result.should_proceed).toBe(false);
      expect(result.reason).toBe('waiting_for_approval');
    });
  });

  describe('Validation Gate', () => {
    it('proceeds on success', () => {
      const gate = new GateEvaluator({
        type: 'gate',
        gate_type: 'validation',
        next: { success: ['deployment'], failure: ['investigation'] },
      });

      const result = gate.evaluate({
        state: 'success',
        commitment_id: 'cmt_test0007',
        commitment_state: 'closed',
        status: 'completed',
        tests_passed: 45,
        tests_failed: 0,
      });

      expect(result.should_proceed).toBe(true);
      expect(result.next_step).toBe('deployment');
    });

    it('loops back on failure', () => {
      const gate = new GateEvaluator({
        type: 'gate',
        gate_type: 'validation',
        next: { success: ['deployment'], failure: ['investigation'] },
      });

      const result = gate.evaluate({
        state: 'failure',
        commitment_id: 'cmt_test0008',
        commitment_state: 'reopened',
        status: 'failed',
        tests_passed: 43,
        tests_failed: 2,
      });

      expect(result.should_proceed).toBe(true);
      expect(result.next_step).toBe('investigation');
      expect(result.reason).toBe('validation_failed');
    });

    it('handles failed status (alternative spelling)', () => {
      const gate = new GateEvaluator({
        type: 'gate',
        gate_type: 'validation',
        next: { success: ['deployment'], failure: ['investigation'] },
      });

      const result = gate.evaluate({
        state: 'failed',
        commitment_id: 'cmt_test0009',
        commitment_state: 'reopened',
        status: 'failed',
        tests_passed: 40,
        tests_failed: 5,
      });

      expect(result.should_proceed).toBe(true);
      expect(result.next_step).toBe('investigation');
      expect(result.reason).toBe('validation_failed');
    });

    it('waits if validation not complete', () => {
      const gate = new GateEvaluator({
        type: 'gate',
        gate_type: 'validation',
        next: { success: ['deployment'], failure: ['investigation'] },
      });

      const result = gate.evaluate({
        state: 'waiting',
        commitment_id: 'cmt_test0010',
        commitment_state: 'open',
        status: 'waiting',
      });

      expect(result.should_proceed).toBe(false);
      expect(result.reason).toBe('waiting_for_validation');
    });
  });

  describe('Unknown Gate Types', () => {
    it('returns error for unknown gate type', () => {
      const gate = new GateEvaluator({
        type: 'gate',
        gate_type: 'unknown' as any,
      });

      const result = gate.evaluate({
        state: 'waiting',
        commitment_id: 'cmt_test0011',
        commitment_state: 'open',
        status: 'waiting',
      });

      expect(result.should_proceed).toBe(false);
      expect(result.reason).toBe('unknown_gate_type');
    });
  });

  describe('Multiple Next Paths', () => {
    it('handles approval gate with multiple approval paths', () => {
      const gate = new GateEvaluator({
        type: 'gate',
        gate_type: 'approval',
        next: { approved: ['fix', 'validate'], rejected: ['end'] },
      });

      const result = gate.evaluate({
        state: 'approved',
        commitment_id: 'cmt_test0012',
        commitment_state: 'closed',
        status: 'approved',
        approved_by: 'user:rashid',
      });

      expect(result.should_proceed).toBe(true);
      // Should take first path
      expect(result.next_step).toBe('fix');
    });

    it('handles validation gate with multiple success paths', () => {
      const gate = new GateEvaluator({
        type: 'gate',
        gate_type: 'validation',
        next: { success: ['deploy', 'notify'], failure: ['fix'] },
      });

      const result = gate.evaluate({
        state: 'success',
        commitment_id: 'cmt_test0013',
        commitment_state: 'closed',
        status: 'completed',
      });

      expect(result.should_proceed).toBe(true);
      // Should take first path
      expect(result.next_step).toBe('deploy');
    });
  });
});
