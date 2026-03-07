/**
 * Executor Memory Contract v1.0
 *
 * Output from the Executor tier of the Dual Triad orchestration.
 * Represents implementation results and evidence of work completion.
 *
 * The Executor role:
 * - Implements fix according to Auditor's boundaries
 * - Produces implementation details and evidence
 * - Captures test results and validation
 * - Constraint: Cannot exceed auditor's scope
 */

export interface Implementation {
  /** List of files that were created/modified */
  files_changed: string[];

  /** Summary of changes made */
  changes_summary: string;

  /** List of test files created or modified */
  tests_added: string[];

  /** Type of changes: bugfix, feature, refactor, etc. */
  change_type: 'bugfix' | 'feature' | 'refactor' | 'perf' | 'security';

  /** Description of what was done */
  description: string;

  /** Any breaking changes introduced */
  breaking_changes: string[];
}

export interface TestResults {
  /** Did all tests pass? */
  tests_passed: boolean;

  /** Number of tests run */
  tests_count: number;

  /** Number of tests that passed */
  tests_passed_count: number;

  /** Number of tests that failed */
  tests_failed_count: number;

  /** Test output summary */
  output_summary: string;

  /** Any failures or issues */
  failures: string[];
}

export interface Evidence {
  /** Memory IDs of captured evidence */
  evidence_ids: string[];

  /** Build status: success, failed, timeout */
  build_status: 'success' | 'failed' | 'timeout';

  /** Link to commit if deployed */
  commit_hash?: string;

  /** Link to GitHub PR if created */
  github_pr_url?: string;

  /** Deployment status */
  deployment_status?: 'pending' | 'deployed' | 'failed';

  /** Any issues encountered during execution */
  issues: string[];
}

export interface ExecutorMemory {
  /** Memory identifier */
  id: string;

  /** Memory kind for ledger filtering */
  kind: 'executor-results';

  /** Reference to the Auditor's assessment memory */
  source_auditor: string;

  /** Reference to the commitment being fulfilled */
  commitment_id: string;

  /** Implementation details */
  implementation: Implementation;

  /** Test results */
  test_results: TestResults;

  /** Evidence of work completion */
  evidence: Evidence;

  /** Executor's confidence in this solution (0.0 - 1.0) */
  confidence_score: number;

  /** Whether executor stayed within scope boundaries */
  within_scope: boolean;

  /** Any violations of scope boundaries */
  scope_violations: string[];

  /** Timestamp when this memory was created */
  created_at: string;

  /** Actor who created this (should be agent:claude-executor) */
  actor: string;
}

/**
 * Builder for creating executor memories from structured data
 */
export function createExecutorMemory(data: {
  id: string;
  source_auditor: string;
  commitment_id: string;
  files_changed: string[];
  changes_summary: string;
  tests_added: string[];
  change_type: 'bugfix' | 'feature' | 'refactor' | 'perf' | 'security';
  description: string;
  breaking_changes: string[];
  tests_passed: boolean;
  tests_count: number;
  tests_passed_count: number;
  tests_failed_count: number;
  test_output_summary: string;
  test_failures: string[];
  evidence_ids: string[];
  build_status: 'success' | 'failed' | 'timeout';
  commit_hash?: string;
  github_pr_url?: string;
  deployment_status?: 'pending' | 'deployed' | 'failed';
  issues: string[];
  confidence_score: number;
  within_scope: boolean;
  scope_violations: string[];
  actor?: string;
}): ExecutorMemory {
  return {
    id: data.id,
    kind: 'executor-results',
    source_auditor: data.source_auditor,
    commitment_id: data.commitment_id,
    implementation: {
      files_changed: data.files_changed,
      changes_summary: data.changes_summary,
      tests_added: data.tests_added,
      change_type: data.change_type,
      description: data.description,
      breaking_changes: data.breaking_changes,
    },
    test_results: {
      tests_passed: data.tests_passed,
      tests_count: data.tests_count,
      tests_passed_count: data.tests_passed_count,
      tests_failed_count: data.tests_failed_count,
      output_summary: data.test_output_summary,
      failures: data.test_failures,
    },
    evidence: {
      evidence_ids: data.evidence_ids,
      build_status: data.build_status,
      commit_hash: data.commit_hash,
      github_pr_url: data.github_pr_url,
      deployment_status: data.deployment_status,
      issues: data.issues,
    },
    confidence_score: data.confidence_score,
    within_scope: data.within_scope,
    scope_violations: data.scope_violations,
    created_at: new Date().toISOString(),
    actor: data.actor || 'agent:claude-executor',
  };
}
