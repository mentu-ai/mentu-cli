/**
 * Auditor Memory Contract v1.0
 *
 * Output from the Auditor tier of the Dual Triad orchestration.
 * Represents feasibility assessment and scope validation of Architect's strategy.
 *
 * The Auditor role:
 * - Validates Architect's strategy against actual codebase
 * - Produces feasibility assessment and scope boundaries
 * - Generates detailed prompt for Executor tier
 * - Constraint: Cannot create vision, only judge
 */

export interface FeasibilityAssessment {
  /** Is the Architect's strategy technically feasible? */
  is_feasible: boolean;

  /** Key concerns or blockers discovered */
  concerns: string[];

  /** Whether the strategy is aligned with codebase reality */
  reality_aligned: boolean;

  /** Suggested modifications to make strategy viable */
  suggested_modifications: string[];

  /** Risk level for implementing this strategy */
  implementation_risk: 'low' | 'medium' | 'high';
}

export interface ScopeBoundaries {
  /** Specific files that are safe to modify */
  allowed_files: string[];

  /** Files that MUST NOT be modified (dependencies, critical paths) */
  forbidden_files: string[];

  /** Allowed operations (create, modify, delete, etc.) */
  allowed_operations: string[];

  /** Forbidden operations */
  forbidden_operations: string[];

  /** Maximum number of files that should be modified */
  max_file_changes: number;

  /** Any constraints discovered during analysis */
  constraints: string[];
}

export interface AuditorMemory {
  /** Memory identifier */
  id: string;

  /** Memory kind for ledger filtering */
  kind: 'auditor-assessment';

  /** Reference to the Architect's investigation memory */
  source_architect: string;

  /** Feasibility assessment */
  feasibility_assessment: FeasibilityAssessment;

  /** Scope boundaries for executor */
  scope_boundaries: ScopeBoundaries;

  /** Auditor's decision: can executor proceed? */
  decision: 'approved' | 'rejected';

  /** If rejected, detailed explanation */
  rejection_reason?: string;

  /** Detailed prompt prepared for Executor */
  prompt_for_executor: string;

  /** Confidence in this assessment (0.0 - 1.0) */
  confidence_score: number;

  /** Timestamp when this memory was created */
  created_at: string;

  /** Actor who created this (should be agent:claude-auditor) */
  actor: string;
}

/**
 * Builder for creating auditor memories from structured data
 */
export function createAuditorMemory(data: {
  id: string;
  source_architect: string;
  is_feasible: boolean;
  concerns: string[];
  reality_aligned: boolean;
  suggested_modifications: string[];
  implementation_risk: 'low' | 'medium' | 'high';
  allowed_files: string[];
  forbidden_files: string[];
  allowed_operations: string[];
  forbidden_operations: string[];
  max_file_changes: number;
  constraints: string[];
  decision: 'approved' | 'rejected';
  rejection_reason?: string;
  prompt_for_executor: string;
  confidence_score: number;
  actor?: string;
}): AuditorMemory {
  return {
    id: data.id,
    kind: 'auditor-assessment',
    source_architect: data.source_architect,
    feasibility_assessment: {
      is_feasible: data.is_feasible,
      concerns: data.concerns,
      reality_aligned: data.reality_aligned,
      suggested_modifications: data.suggested_modifications,
      implementation_risk: data.implementation_risk,
    },
    scope_boundaries: {
      allowed_files: data.allowed_files,
      forbidden_files: data.forbidden_files,
      allowed_operations: data.allowed_operations,
      forbidden_operations: data.forbidden_operations,
      max_file_changes: data.max_file_changes,
      constraints: data.constraints,
    },
    decision: data.decision,
    rejection_reason: data.rejection_reason,
    prompt_for_executor: data.prompt_for_executor,
    confidence_score: data.confidence_score,
    created_at: new Date().toISOString(),
    actor: data.actor || 'agent:claude-auditor',
  };
}
