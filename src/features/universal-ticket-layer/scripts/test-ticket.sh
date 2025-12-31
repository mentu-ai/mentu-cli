#!/bin/bash
# Test UTL ticket creation with GitHub integration

SERVICE_ROLE="<JWT_REDACTED>"

echo "Creating test ticket..."
echo ""

curl -s -X POST "https://uhwiegwpaagzulolmruz.supabase.co/functions/v1/tickets-api" \
  -H "Authorization: Bearer $SERVICE_ROLE" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "bug_reporter",
    "type": "bug",
    "title": "Test: UTL to GitHub Integration",
    "description": "Testing the complete flow from Universal Ticket Layer to GitHub Issues. This ticket should automatically create a GitHub issue.",
    "priority": "medium",
    "page_url": "https://warrantyos.com/test",
    "environment": {"browser": "Chrome 120", "os": "macOS"}
  }' | jq .

echo ""
echo "Check https://github.com/rashidazarang/tickets/issues for the new issue!"
