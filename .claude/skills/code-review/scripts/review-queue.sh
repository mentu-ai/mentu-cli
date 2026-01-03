#!/bin/bash
# Display Mentu review queue with details

echo "=== Mentu Review Queue ==="
echo ""

# Check if mentu is available
if ! command -v mentu &> /dev/null; then
  echo "Error: mentu command not found"
  exit 1
fi

# Get queue
QUEUE=$(mentu review-queue --json 2>/dev/null)

if [ -z "$QUEUE" ] || [ "$QUEUE" = "[]" ]; then
  echo "No commitments pending review."
  exit 0
fi

# Count items
COUNT=$(echo "$QUEUE" | jq 'length')
echo "Found $COUNT commitment(s) in review:"
echo ""

# Display each
echo "$QUEUE" | jq -r '.[] | "─────────────────────────────────────────\nID: \(.id)\nBody: \(.body)\nActor: \(.actor)\nEvidence: \(.evidence // "none")\nSubmitted: \(.submitted_at // "unknown")"'

echo ""
echo "─────────────────────────────────────────"
echo ""
echo "Commands:"
echo "  mentu show <id> --json     # View full details"
echo "  mentu approve <id>         # Approve submission"
echo "  mentu reopen <id> --reason # Reject with feedback"
echo ""
