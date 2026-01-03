#!/bin/bash
# post-pr-comment.sh
# Posts code review findings to a GitHub PR

set -e

# Usage: post-pr-comment.sh <pr_number> <verdict> <findings_json>

PR_NUMBER="$1"
VERDICT="$2"
FINDINGS_FILE="$3"

if [ -z "$PR_NUMBER" ]; then
  echo "Error: PR number required"
  echo "Usage: post-pr-comment.sh <pr_number> <verdict> <findings_json_file>"
  exit 1
fi

# Check gh CLI
if ! command -v gh &> /dev/null; then
  echo "Error: gh CLI not found"
  exit 1
fi

# Check auth
if ! gh auth status &> /dev/null; then
  echo "Error: Not authenticated with GitHub"
  exit 1
fi

# Generate verdict emoji
if [ "$VERDICT" = "PASS" ]; then
  EMOJI="✅"
  VERDICT_COLOR="green"
else
  EMOJI="❌"
  VERDICT_COLOR="red"
fi

# Build summary comment
COMMENT_BODY=$(cat <<EOF
## $EMOJI Code Review

**Verdict**: $VERDICT

EOF
)

# Add findings if file provided
if [ -n "$FINDINGS_FILE" ] && [ -f "$FINDINGS_FILE" ]; then
  CRITICAL=$(jq '[.findings[] | select(.severity == "critical")] | length' "$FINDINGS_FILE")
  HIGH=$(jq '[.findings[] | select(.severity == "high")] | length' "$FINDINGS_FILE")
  MEDIUM=$(jq '[.findings[] | select(.severity == "medium")] | length' "$FINDINGS_FILE")
  LOW=$(jq '[.findings[] | select(.severity == "low")] | length' "$FINDINGS_FILE")
  FILTERED=$(jq '.stats.issues_filtered // 0' "$FINDINGS_FILE")

  COMMENT_BODY+="### Summary

| Severity | Count |
|----------|-------|
| Critical | $CRITICAL |
| High | $HIGH |
| Medium | $MEDIUM |
| Low | $LOW |
| Filtered | $FILTERED |

"

  # Add findings details
  if [ "$VERDICT" = "FAIL" ]; then
    COMMENT_BODY+="### Blocking Issues

"
    jq -r '.findings[] | select(.severity == "critical" or .severity == "high") | "- **[\(.severity | ascii_upcase):\(.confidence)]** `\(.file):\(.line // "")` - \(.message)"' "$FINDINGS_FILE" >> /tmp/findings.md
    COMMENT_BODY+=$(cat /tmp/findings.md)
    COMMENT_BODY+="

"
  fi

  # Add agent status
  COMMENT_BODY+="### Agent Status

"
  jq -r '.agents | to_entries[] | "- \(.key): \(if .value.verdict == "PASS" then "✓" else "✗" end) (\(.value.findings) findings, \(.value.filtered) filtered)"' "$FINDINGS_FILE" >> /tmp/agents.md
  COMMENT_BODY+=$(cat /tmp/agents.md)
fi

COMMENT_BODY+="

---
*Reviewed by 4 parallel agents with confidence-based scoring.*
"

# Post the comment
echo "Posting review comment to PR #$PR_NUMBER..."
gh pr comment "$PR_NUMBER" --body "$COMMENT_BODY"

# Post inline comments for findings
if [ -n "$FINDINGS_FILE" ] && [ -f "$FINDINGS_FILE" ]; then
  echo "Posting inline comments..."

  # Get repo info
  REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner')

  # Post inline comment for each finding with line number
  jq -c '.findings[] | select(.line != null)' "$FINDINGS_FILE" | while read -r FINDING; do
    FILE=$(echo "$FINDING" | jq -r '.file')
    LINE=$(echo "$FINDING" | jq -r '.line')
    MESSAGE=$(echo "$FINDING" | jq -r '"[\(.severity | ascii_upcase):\(.confidence)] \(.message)"')
    SUGGESTION=$(echo "$FINDING" | jq -r '.suggestion // .fix // ""')

    BODY="$MESSAGE"
    if [ -n "$SUGGESTION" ]; then
      BODY+="\n\n**Suggestion**: $SUGGESTION"
    fi

    # Post review comment at specific line
    gh api "repos/$REPO/pulls/$PR_NUMBER/comments" \
      -f body="$BODY" \
      -f path="$FILE" \
      -F line="$LINE" \
      -f side="RIGHT" \
      -f commit_id="$(gh pr view $PR_NUMBER --json headRefOid -q '.headRefOid')" 2>/dev/null || true
  done

  echo "Done."
fi

echo ""
echo "Review posted to: $(gh pr view $PR_NUMBER --json url -q '.url')"
