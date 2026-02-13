#!/bin/bash
# Test UTL ticket creation with GitHub integration

SERVICE_ROLE="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVod2llZ3dwYWFnenVsb2xtcnV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE4NDM4NSwiZXhwIjoyMDgxNzYwMzg1fQ.N3Vyv_MDYMbikBBjrq-JwqV9NXp4i5nFE_9Npzk31fI"

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
