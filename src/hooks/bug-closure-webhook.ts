// Stage 7: Commitment Closure Webhook
// Automatically closes bug commitments when evidence is sufficient

interface Commitment {
  id: string;
  state: string;
  evidence_ids?: string[];
  payload?: Record<string, unknown>;
}

interface Evidence {
  id: string;
  kind: string;
  evidence_type?: string;
  payload?: Record<string, unknown>;
}

/**
 * Check if commitment has sufficient evidence for closure
 */
function hasInvestigationEvidence(evidenceIds: string[]): boolean {
  // In production, would fetch each evidence and check type
  // For now, assume investigation evidence is present if any evidence exists
  return evidenceIds && evidenceIds.length > 0;
}

/**
 * Auto-close bug commitment when evidence is ready
 */
export async function autoCloseBugCommitment(commitment: Commitment): Promise<void> {
  // Check if this is a bug-related commitment
  if (!commitment.payload || !commitment.payload.kind?.toString().includes('bug')) {
    return;
  }

  // Check if already closed
  if (commitment.state === 'closed' || commitment.state === 'in_review') {
    return;
  }

  // Get evidence IDs
  const evidenceIds = commitment.evidence_ids || [];
  if (evidenceIds.length === 0) {
    return; // No evidence yet
  }

  // Check evidence sufficiency
  const hasInvestigation = hasInvestigationEvidence(evidenceIds);

  if (!hasInvestigation) {
    return; // Waiting for investigation evidence
  }

  try {
    // Check investigation confidence from payload
    const confidence = (commitment.payload.confidence as number | undefined) || 0.7;

    // Decision logic based on confidence
    let decision = 'closed_with_evidence';
    let reason = 'Bug investigation completed and evidence captured.';

    if (confidence < 0.5) {
      decision = 'inconclusive';
      reason = 'Investigation inconclusive. Needs human review.';
    } else if (confidence >= 0.8) {
      decision = 'bug_confirmed';
      reason = 'Bug confirmed by investigation. Ready for fix or documentation.';
    } else {
      decision = 'needs_review';
      reason = 'Investigation complete but confidence low. Needs review.';
    }

    // In production, this would call mentu close
    // For now, log the closure decision
    console.log(`[${commitment.id}] Closure Decision: ${decision}. Reason: ${reason}`);

    // If confidence is high enough, could auto-close
    // Otherwise, transition to in_review for human approval
    if (confidence >= 0.8) {
      await closeCommitment(commitment.id, decision, reason, evidenceIds);
    } else {
      await transitionToReview(commitment.id, decision, reason);
    }
  } catch (error) {
    console.error(`Failed to process closure for ${commitment.id}:`, error);
  }
}

/**
 * Close a commitment with evidence
 */
async function closeCommitment(
  commitmentId: string,
  decision: string,
  reason: string,
  evidenceIds: string[]
): Promise<void> {
  // This would call mentu close in production
  console.log(`Closing ${commitmentId}: ${reason}`);
  console.log(`Evidence: ${evidenceIds.join(', ')}`);
}

/**
 * Transition commitment to review state
 */
async function transitionToReview(
  commitmentId: string,
  decision: string,
  reason: string
): Promise<void> {
  // This would call mentu annotate and mark for review
  console.log(`[${commitmentId}] Marking for review: ${reason}`);
}

/**
 * Handle commitment state changes
 */
export async function onCommitmentStateChanged(commitment: Commitment): Promise<void> {
  // Check if this is a bug commitment
  if (!commitment.payload || commitment.state !== 'in_review') {
    return;
  }

  // If transitioning to in_review after evidence, could auto-approve
  // This would depend on investigation confidence
  // For MVP, manual approval required

  console.log(`Bug commitment ${commitment.id} now in review state`);
}
