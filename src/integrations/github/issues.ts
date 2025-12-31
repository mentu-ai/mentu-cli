import type { Commitment, Memory } from '../../types.js';

/**
 * Format issue body for a commitment.
 */
export function formatIssueBody(commitment: Commitment, memory: Memory): string {
  return `## Commitment: ${commitment.body}

**Source Memory:** ${memory.body}
**Commitment ID:** \`${commitment.id}\`
**Created:** ${commitment.ts}
**Actor:** ${commitment.actor}

---

\u26A0\uFE0F **Do not close this issue directly.**

This issue is managed by Mentu. To close properly:
\`\`\`bash
mentu capture "Description of work" --kind evidence
mentu close ${commitment.id} --evidence <mem_id>
\`\`\`

---
*Managed by [Mentu](https://github.com/anthropics/mentu) - The Commitment Ledger*
`;
}

/**
 * Format evidence comment for closing an issue.
 */
export function formatEvidenceComment(commitment: Commitment, evidence: Memory): string {
  return `## \u2705 Commitment Closed

**Evidence:** ${evidence.body}
**Evidence ID:** \`${evidence.id}\`
**Closed by:** ${commitment.closed_by}
**Closed at:** ${new Date().toISOString()}

---
*Closed via Mentu CLI with evidence*
`;
}

/**
 * Map Mentu tags to GitHub labels.
 */
export function mapTagsToLabels(tags?: string[]): string[] {
  if (!tags || tags.length === 0) {
    return ['mentu'];
  }

  const labelMap: Record<string, string> = {
    bug: 'bug',
    feature: 'enhancement',
    urgent: 'priority: critical',
    blocked: 'blocked',
  };

  const labels = ['mentu'];

  for (const tag of tags) {
    if (tag in labelMap) {
      labels.push(labelMap[tag]);
    } else {
      labels.push(`mentu:${tag}`);
    }
  }

  return labels;
}

/**
 * Format issue title from commitment body.
 * Truncates to 256 chars (GitHub limit).
 */
export function formatIssueTitle(body: string): string {
  const title = body.trim();
  if (title.length <= 256) {
    return title;
  }
  return title.slice(0, 253) + '...';
}
