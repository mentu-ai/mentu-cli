/**
 * Architect Memory Contract v1.0
 *
 * Output from the Architect tier of the Dual Triad orchestration.
 * Represents strategic investigation intent based on bug report analysis.
 *
 * The Architect role:
 * - Analyzes bug report WITHOUT codebase access
 * - Produces investigation strategy from first principles
 * - Generates detailed prompt for Auditor tier
 * - Freedom: Unconstrained by "what is"
 */

export interface InvestigationStrategy {
  /** Brief hypothesis about the root cause */
  hypothesis: string;

  /** Steps to investigate the hypothesis */
  investigation_steps: string[];

  /** Expected potential root causes (ranked by likelihood) */
  expected_root_causes: string[];

  /** Risk level of this investigation */
  risk_assessment: 'low' | 'medium' | 'high';

  /** Open questions that need codebase investigation */
  open_questions: string[];

  /** Estimate of implementation complexity if root cause confirmed */
  complexity_estimate: 'simple' | 'moderate' | 'complex';
}

export interface ArchitectMemory {
  /** Memory identifier */
  id: string;

  /** Memory kind for ledger filtering */
  kind: 'architect-investigation';

  /** Reference to the original bug report memory */
  source_bug: string;

  /** Core investigation strategy */
  investigation_strategy: InvestigationStrategy;

  /** Detailed prompt prepared for Auditor */
  prompt_for_auditor: string;

  /** Confidence in this strategy (0.0 - 1.0) */
  confidence_score: number;

  /** Timestamp when this memory was created */
  created_at: string;

  /** Actor who created this (should be agent:claude-architect) */
  actor: string;
}

/**
 * Builder for creating architect memories from structured data
 */
export function createArchitectMemory(data: {
  id: string;
  source_bug: string;
  hypothesis: string;
  investigation_steps: string[];
  expected_root_causes: string[];
  risk_assessment: 'low' | 'medium' | 'high';
  open_questions: string[];
  complexity_estimate: 'simple' | 'moderate' | 'complex';
  prompt_for_auditor: string;
  confidence_score: number;
  actor?: string;
}): ArchitectMemory {
  return {
    id: data.id,
    kind: 'architect-investigation',
    source_bug: data.source_bug,
    investigation_strategy: {
      hypothesis: data.hypothesis,
      investigation_steps: data.investigation_steps,
      expected_root_causes: data.expected_root_causes,
      risk_assessment: data.risk_assessment,
      open_questions: data.open_questions,
      complexity_estimate: data.complexity_estimate,
    },
    prompt_for_auditor: data.prompt_for_auditor,
    confidence_score: data.confidence_score,
    created_at: new Date().toISOString(),
    actor: data.actor || 'agent:claude-architect',
  };
}
