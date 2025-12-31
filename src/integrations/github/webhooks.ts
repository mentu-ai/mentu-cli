import type { Commitment } from '../../types.js';

export interface GitHubWebhookPayload {
  action: string;
  issue?: {
    number: number;
    title: string;
    body: string;
    state: string;
    html_url: string;
    user: { login: string };
  };
  pull_request?: {
    number: number;
    title: string;
    body: string;
    html_url: string;
    merged: boolean;
    merged_at: string | null;
    merge_commit_sha: string | null;
    head: { ref: string };
    user: { login: string };
    merged_by?: { login: string };
  };
  comment?: {
    body: string;
    user: { login: string };
    html_url: string;
  };
  repository: {
    full_name: string;
    owner: { login: string };
    name: string;
  };
  sender: { login: string };
}

export interface WebhookHandlerResult {
  action: 'captured' | 'annotated' | 'warned' | 'ignored';
  message: string;
  memoryId?: string;
  operationId?: string;
}

/**
 * Extract commitment ID from text (PR body, commit message, etc.).
 * Looks for "Mentu: cmt_xxx" or just "cmt_xxx".
 */
export function extractCommitmentId(text: string): string | null {
  const patterns = [
    /Mentu:\s*(cmt_[a-zA-Z0-9]+)/i,
    /\b(cmt_[a-zA-Z0-9]+)\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Format evidence from merged PR.
 */
export function formatPREvidence(pr: GitHubWebhookPayload['pull_request']): {
  body: string;
  meta: Record<string, unknown>;
} {
  if (!pr) {
    return { body: 'PR merged', meta: {} };
  }

  return {
    body: `PR #${pr.number} merged: ${pr.title}`,
    meta: {
      type: 'pr_merged',
      pr_number: pr.number,
      pr_url: pr.html_url,
      merge_sha: pr.merge_commit_sha,
      branch: pr.head.ref,
      merged_by: pr.merged_by?.login,
      merged_at: pr.merged_at,
    },
  };
}

/**
 * Format warning comment for unauthorized issue close.
 */
export function formatCloseWarning(commitmentId: string): string {
  return `## Warning: Unauthorized Close

This issue is linked to Mentu commitment \`${commitmentId}\`.

**Closing in GitHub does not close the commitment.** Evidence is required.

To properly close, use:
\`\`\`bash
mentu close ${commitmentId} --evidence <memory_id>
\`\`\`

Reopening this issue to maintain sync.

---
*Managed by [Mentu](https://mentu.ai) - The Commitment Ledger*`;
}

/**
 * Determine the appropriate action for a GitHub webhook event.
 */
export function determineAction(
  payload: GitHubWebhookPayload,
  linkedCommitment: Commitment | null
): 'capture_evidence' | 'annotate' | 'warn_and_reopen' | 'ignore' {
  const { action, issue, pull_request, comment } = payload;

  // PR merged - potential evidence
  if (pull_request && action === 'closed' && pull_request.merged) {
    const commitmentId =
      extractCommitmentId(pull_request.body ?? '') ??
      extractCommitmentId(pull_request.title);
    if (commitmentId) {
      return 'capture_evidence';
    }
    return 'ignore';
  }

  // Issue closed without going through Mentu
  if (issue && action === 'closed' && linkedCommitment) {
    // If commitment is still open/claimed in Mentu, warn and reopen
    if (linkedCommitment.state !== 'closed') {
      return 'warn_and_reopen';
    }
    return 'ignore';
  }

  // Issue commented
  if (issue && action === 'created' && comment && linkedCommitment) {
    return 'annotate';
  }

  return 'ignore';
}
