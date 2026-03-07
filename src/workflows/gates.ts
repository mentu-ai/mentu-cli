// Gate evaluator - handles approval and validation gates.
// Reads commitment state instead of internal StepStatus.

import type { GateConfig, GateEvaluationResult, StepStatus } from './types.js';

export class GateEvaluator {
  constructor(private config: GateConfig) {}

  evaluate(state: StepStatus & { current_time?: number }): GateEvaluationResult {
    if (this.config.gate_type === 'approval') {
      return this.evaluateApprovalGate(state);
    } else if (this.config.gate_type === 'validation') {
      return this.evaluateValidationGate(state);
    }

    return {
      should_proceed: false,
      reason: 'unknown_gate_type',
    };
  }

  private evaluateApprovalGate(state: StepStatus & { current_time?: number }): GateEvaluationResult {
    // Check for timeout
    if (this.config.timeout_hours && state.started_at && state.current_time) {
      const timeoutMs = this.config.timeout_hours * 60 * 60 * 1000;
      const elapsed = state.current_time - state.started_at;

      if (elapsed > timeoutMs) {
        const next = this.config.next;
        return {
          should_proceed: true,
          next_step: next && typeof next === 'object' && next.timeout ? next.timeout[0] : undefined,
          reason: 'timeout',
        };
      }
    }

    // Use commitment_state for gate evaluation (Protocol-native)
    const effectiveState = state.commitment_state ?? state.status ?? state.state;

    if (effectiveState === 'in_review' || effectiveState === 'waiting' || effectiveState === 'open') {
      return {
        should_proceed: false,
        reason: 'waiting_for_approval',
      };
    }

    if (effectiveState === 'closed' || effectiveState === 'approved') {
      const next = this.config.next;
      return {
        should_proceed: true,
        next_step: next && typeof next === 'object' && next.approved ? next.approved[0] : undefined,
      };
    }

    if (effectiveState === 'reopened' || effectiveState === 'rejected') {
      const next = this.config.next;
      return {
        should_proceed: true,
        next_step: next && typeof next === 'object' && next.rejected ? next.rejected[0] : undefined,
      };
    }

    return {
      should_proceed: false,
      reason: 'unknown_state',
    };
  }

  private evaluateValidationGate(state: StepStatus): GateEvaluationResult {
    const effectiveState = state.commitment_state ?? state.status ?? state.state;

    if (effectiveState === 'closed' || effectiveState === 'completed' || effectiveState === 'success') {
      const next = this.config.next;
      return {
        should_proceed: true,
        next_step: next && typeof next === 'object' && next.success ? next.success[0] : undefined,
      };
    }

    if (effectiveState === 'reopened' || effectiveState === 'failed' || effectiveState === 'rejected' || effectiveState === 'failure') {
      const next = this.config.next;
      return {
        should_proceed: true,
        next_step: next && typeof next === 'object' && next.failure ? next.failure[0] : undefined,
        reason: 'validation_failed',
      };
    }

    return {
      should_proceed: false,
      reason: 'waiting_for_validation',
    };
  }
}
