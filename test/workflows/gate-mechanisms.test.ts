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

      const result = gate.evaluate({ status: 'waiting' });

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
        status: 'approved',
        approved_by: 'user:rashid'
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
        status: 'rejected',
        rejected_by: 'user:rashid'
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

      const result = gate.evaluate({ status: 'waiting' });

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
        status: 'success',
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
        status: 'failure',
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

      const result = gate.evaluate({ status: 'waiting' });

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
        status: 'approved',
        approved_by: 'user:rashid'
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
        status: 'success',
      });

      expect(result.should_proceed).toBe(true);
      // Should take first path
      expect(result.next_step).toBe('deploy');
    });
  });
});
