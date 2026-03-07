// Workflow cache refresh - computes step_states and state from commitment states.
// workflow_instances is a materialized cache; the ledger is source of truth.

import { CloudClient } from '../cloud/client.js';

interface CommitmentRow {
  id: string;
  state: string;
  workflow_step_id: string | null;
  step_outcome: string | null;
  owner: string | null;
  created_at: string;
  closed_at: string | null;
}

interface CachedStepState {
  state: string;
  commitment_id: string;
  commitment_state: string;
  outcome?: string;
  activated_at?: string;
  completed_at?: string;
}

/**
 * Refresh the workflow_instances cache row from commitment states.
 * Called after any ledger operation on a workflow-linked commitment.
 */
export async function refreshWorkflowCache(
  client: CloudClient,
  instanceId: string
): Promise<void> {
  const supabase = client.getSupabaseClient();

  // 1. Fetch all commitments linked to this instance
  const { data: commitments, error: cmtError } = await supabase
    .from('commitments')
    .select('id, state, workflow_step_id, step_outcome, owner, created_at, closed_at')
    .eq('workflow_instance_id', instanceId);

  if (cmtError || !commitments) return;

  // 2. Compute step_states from commitment states
  const stepStates: Record<string, CachedStepState> = {};

  for (const cmt of commitments as CommitmentRow[]) {
    if (!cmt.workflow_step_id) continue;

    stepStates[cmt.workflow_step_id] = {
      state: mapCommitmentStateToStepState(cmt.state),
      commitment_id: cmt.id,
      commitment_state: cmt.state,
      outcome: cmt.step_outcome ?? undefined,
      activated_at: cmt.created_at,
      completed_at: cmt.closed_at ?? undefined,
    };
  }

  // 3. Compute overall instance state
  const state = computeInstanceState(commitments as CommitmentRow[]);

  // 4. Update the cache row
  await supabase
    .from('workflow_instances')
    .update({
      step_states: stepStates,
      state,
      completed_at: state === 'completed' || state === 'failed' || state === 'cancelled'
        ? new Date().toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', instanceId);
}

/**
 * Map commitment state to the step state expected by the dashboard.
 */
export function mapCommitmentStateToStepState(commitmentState: string): string {
  switch (commitmentState) {
    case 'open': return 'pending';
    case 'claimed': return 'running';
    case 'in_review': return 'running';
    case 'closed': return 'completed';
    case 'reopened': return 'running';
    default: return 'pending';
  }
}

/**
 * Compute the overall instance state from child commitment states.
 *
 * Rules:
 * - If any child is claimed/in_review/reopened -> running
 * - If all children are closed -> completed
 * - If no children are claimed and none closed -> pending
 * - Otherwise -> running
 */
export function computeInstanceState(commitments: CommitmentRow[]): string {
  if (commitments.length === 0) return 'pending';

  const states = commitments
    .filter(c => c.workflow_step_id) // only step commitments
    .map(c => c.state);

  if (states.length === 0) return 'pending';

  const allClosed = states.every(s => s === 'closed');
  if (allClosed) return 'completed';

  const anyActive = states.some(s => s === 'claimed' || s === 'in_review' || s === 'reopened');
  if (anyActive) return 'running';

  return 'pending';
}
