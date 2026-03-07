// Stage 6: Evidence Webhook
// Triggered when agent investigation evidence is captured
// Updates commitment state based on investigation confidence

interface Memory {
  id: string;
  kind: string;
  body: string;
  payload?: Record<string, unknown>;
}

interface Investigation {
  is_real_bug?: boolean;
  root_cause?: string;
  confidence: number;
  affected_components?: string[];
  suggested_fix?: string;
  reasoning?: string;
}

/**
 * Handle evidence capture webhook
 * Called when evidence memory is created
 */
export async function onEvidenceCaptured(evidence: Memory): Promise<void> {
  // Check if this is bug investigation evidence
  if (evidence.kind !== 'evidence' && !evidence.body.includes('Investigation')) {
    return; // Not our concern
  }

  // Get commitment ID from payload
  const commitmentId = (evidence.payload?.commitment_id || evidence.payload?.refs) as string | undefined;
  if (!commitmentId) {
    return; // No commitment to update
  }

  // Parse investigation results
  const investigation: Investigation | null = evidence.payload?.investigation as Investigation | null;
  if (!investigation) {
    return; // No investigation data
  }

  // Update commitment with findings
  try {
    // High confidence: mark as ready for potential fix
    if (investigation.confidence > 0.8) {
      // Annotate with findings
      await annotateCommitment(
        commitmentId,
        `✅ Investigation complete. Bug confirmed. Confidence: ${(investigation.confidence * 100).toFixed(1)}%. Root cause: ${investigation.root_cause || 'TBD'}`
      );

      // If fix is suggested, could trigger next phase
      if (investigation.suggested_fix) {
        await annotateCommitment(
          commitmentId,
          `💡 Suggested fix: ${investigation.suggested_fix}`
        );
      }
    } else if (investigation.confidence > 0.5) {
      // Medium confidence: needs review
      await annotateCommitment(
        commitmentId,
        `🔍 Investigation needs review. Confidence: ${(investigation.confidence * 100).toFixed(1)}%. Reasoning: ${investigation.reasoning || 'insufficient data'}`
      );
    } else {
      // Low confidence: escalate for human review
      await annotateCommitment(
        commitmentId,
        `⚠️ Investigation inconclusive. Confidence: ${(investigation.confidence * 100).toFixed(1)}%. Escalating for human review.`
      );
    }
  } catch (error) {
    console.error(`Failed to update commitment ${commitmentId}:`, error);
  }
}

/**
 * Annotate commitment with findings
 */
async function annotateCommitment(
  commitmentId: string,
  annotation: string
): Promise<void> {
  // This would call mentu annotate in production
  // For now, log the annotation
  console.log(`[${commitmentId}] ${annotation}`);
}
