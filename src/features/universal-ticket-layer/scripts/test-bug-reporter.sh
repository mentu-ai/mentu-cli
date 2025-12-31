#!/bin/bash
# Test Bug Reporter → UTL → GitHub flow

UTL_API_URL="https://uhwiegwpaagzulolmruz.supabase.co/functions/v1"
UTL_API_KEY="utl_UGWmZRQstFNIa28OjubMwCsA9lImK0e8"

echo "Testing Bug Reporter → UTL → GitHub flow..."
echo ""
echo "API URL: $UTL_API_URL"
echo "API Key: ${UTL_API_KEY:0:12}..."
echo ""

# Submit a test bug report
RESULT=$(curl -s -X POST "$UTL_API_URL/tickets-api" \
  -H "x-api-key: $UTL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "bug_reporter",
    "type": "bug",
    "title": "Bug Reporter Integration Test",
    "description": "Testing the complete Bug Reporter → UTL → GitHub flow. This ticket was submitted programmatically to verify the integration is working correctly.",
    "priority": "low",
    "page_url": "https://app.warrantyos.com/test",
    "environment": {
      "browser": {"name": "Chrome", "version": "120"},
      "os": {"name": "macOS", "version": "14.0"},
      "viewport": {"width": 1920, "height": 1080},
      "url": "https://app.warrantyos.com/test"
    },
    "payload": {
      "console_logs": [
        {"timestamp": 1700000000000, "level": "log", "message": "Test log entry"},
        {"timestamp": 1700000001000, "level": "error", "message": "Test error for demo"}
      ],
      "user_id": "test-user",
      "session_id": "test-session-123"
    }
  }')

echo "Response:"
echo $RESULT | jq .

TICKET_ID=$(echo $RESULT | jq -r '.data.id // .id // empty')

if [ -n "$TICKET_ID" ]; then
  echo ""
  echo "✓ Ticket created: $TICKET_ID"
  echo ""
  echo "Waiting 3 seconds for GitHub issue to be created..."
  sleep 3

  # Check if GitHub issue was created
  echo ""
  echo "Checking ticket for GitHub link..."
  TICKET=$(curl -s "$UTL_API_URL/tickets-api/$TICKET_ID" \
    -H "x-api-key: $UTL_API_KEY")

  echo $TICKET | jq '.data.external_refs // .external_refs // empty'

  GITHUB_URL=$(echo $TICKET | jq -r '.data.external_refs[0].url // .external_refs[0].url // empty')

  if [ -n "$GITHUB_URL" ]; then
    echo ""
    echo "✓ GitHub issue created: $GITHUB_URL"
    echo ""
    echo "========================================="
    echo "INTEGRATION TEST PASSED!"
    echo "========================================="
    echo ""
    echo "Ticket: https://supabase.com/dashboard/project/uhwiegwpaagzulolmruz/editor/tickets?filter=id%3Deq.$TICKET_ID"
    echo "GitHub: $GITHUB_URL"
    echo "Project: https://github.com/users/rashidazarang/projects/2"
  else
    echo ""
    echo "⚠ GitHub issue not yet linked (may take a moment)"
    echo "Check manually: https://github.com/rashidazarang/tickets/issues"
  fi
else
  echo ""
  echo "✗ Failed to create ticket"
  echo $RESULT
fi
