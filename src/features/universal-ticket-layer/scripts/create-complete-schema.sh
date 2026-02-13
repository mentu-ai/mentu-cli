#!/bin/bash

# Airtable API Configuration
AIRTABLE_TOKEN="${AIRTABLE_TOKEN:?Set AIRTABLE_TOKEN env var}"
BASE_ID="apppH8Loitcb1dwpJ"

echo "=== Creating Complete UTL Schema in Airtable ==="
echo ""

# ============================================
# TABLE 2: Sync Logs
# ============================================
echo "Creating table: Sync Logs"
SYNC_LOGS_RESPONSE=$(curl -s -X POST "https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables" \
  -H "Authorization: Bearer ${AIRTABLE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sync Logs",
    "description": "Audit trail of all synchronization events between Supabase and Airtable",
    "fields": [
      {"name": "Timestamp", "type": "dateTime", "options": {"dateFormat": {"name": "iso"}, "timeFormat": {"name": "24hour"}, "timeZone": "utc"}},
      {"name": "Direction", "type": "singleSelect", "options": {"choices": [{"name": "supabase_to_airtable", "color": "blueLight2"}, {"name": "airtable_to_supabase", "color": "greenLight2"}, {"name": "github_to_supabase", "color": "purpleLight2"}]}},
      {"name": "Operation", "type": "singleSelect", "options": {"choices": [{"name": "create", "color": "greenLight2"}, {"name": "update", "color": "yellowLight2"}, {"name": "delete", "color": "redLight2"}]}},
      {"name": "Status", "type": "singleSelect", "options": {"choices": [{"name": "success", "color": "greenDark1"}, {"name": "failed", "color": "redDark1"}, {"name": "conflict", "color": "orangeDark1"}]}},
      {"name": "Ticket ID", "type": "singleLineText"},
      {"name": "Airtable Record ID", "type": "singleLineText"},
      {"name": "Supabase ID", "type": "singleLineText"},
      {"name": "Changes", "type": "multilineText"},
      {"name": "Error Message", "type": "multilineText"}
    ]
  }')

SYNC_LOGS_ID=$(echo "$SYNC_LOGS_RESPONSE" | jq -r '.id // "ERROR"')
echo "  Created: $SYNC_LOGS_ID"

sleep 1

# ============================================
# TABLE 3: API Keys
# ============================================
echo "Creating table: API Keys"
API_KEYS_RESPONSE=$(curl -s -X POST "https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables" \
  -H "Authorization: Bearer ${AIRTABLE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "API Keys",
    "description": "Client API keys for UTL access",
    "fields": [
      {"name": "Name", "type": "singleLineText"},
      {"name": "Client ID", "type": "singleLineText"},
      {"name": "Key Prefix", "type": "singleLineText"},
      {"name": "Status", "type": "singleSelect", "options": {"choices": [{"name": "active", "color": "greenLight2"}, {"name": "revoked", "color": "redLight2"}, {"name": "expired", "color": "grayLight2"}]}},
      {"name": "Permissions", "type": "multipleSelects", "options": {"choices": [{"name": "read", "color": "blueLight2"}, {"name": "write", "color": "greenLight2"}, {"name": "delete", "color": "redLight2"}, {"name": "admin", "color": "purpleLight2"}]}},
      {"name": "Created At", "type": "dateTime", "options": {"dateFormat": {"name": "iso"}, "timeFormat": {"name": "24hour"}, "timeZone": "utc"}},
      {"name": "Expires At", "type": "dateTime", "options": {"dateFormat": {"name": "iso"}, "timeFormat": {"name": "24hour"}, "timeZone": "utc"}},
      {"name": "Last Used", "type": "dateTime", "options": {"dateFormat": {"name": "iso"}, "timeFormat": {"name": "24hour"}, "timeZone": "utc"}},
      {"name": "Request Count", "type": "number", "options": {"precision": 0}}
    ]
  }')

API_KEYS_ID=$(echo "$API_KEYS_RESPONSE" | jq -r '.id // "ERROR"')
echo "  Created: $API_KEYS_ID"

sleep 1

# ============================================
# TABLE 4: Integrations
# ============================================
echo "Creating table: Integrations"
INTEGRATIONS_RESPONSE=$(curl -s -X POST "https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables" \
  -H "Authorization: Bearer ${AIRTABLE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Integrations",
    "description": "External system integrations (GitHub, Linear, Slack, etc.)",
    "fields": [
      {"name": "Name", "type": "singleLineText"},
      {"name": "System", "type": "singleSelect", "options": {"choices": [{"name": "github", "color": "grayDark1"}, {"name": "linear", "color": "purpleLight2"}, {"name": "jira", "color": "blueLight2"}, {"name": "slack", "color": "pinkLight2"}, {"name": "email", "color": "cyanLight2"}]}},
      {"name": "Status", "type": "singleSelect", "options": {"choices": [{"name": "active", "color": "greenLight2"}, {"name": "inactive", "color": "grayLight2"}, {"name": "error", "color": "redLight2"}]}},
      {"name": "Webhook URL", "type": "url"},
      {"name": "Last Sync", "type": "dateTime", "options": {"dateFormat": {"name": "iso"}, "timeFormat": {"name": "24hour"}, "timeZone": "utc"}},
      {"name": "Config", "type": "multilineText"},
      {"name": "Notes", "type": "multilineText"}
    ]
  }')

INTEGRATIONS_ID=$(echo "$INTEGRATIONS_RESPONSE" | jq -r '.id // "ERROR"')
echo "  Created: $INTEGRATIONS_ID"

sleep 1

# ============================================
# Get Tickets table ID for views
# ============================================
TICKETS_TABLE_ID="tblQcExUHhBTbOJX7"

# ============================================
# VIEW 1: Open Bugs (Tickets)
# ============================================
echo "Creating view: Open Bugs"
curl -s -X POST "https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables/${TICKETS_TABLE_ID}/views" \
  -H "Authorization: Bearer ${AIRTABLE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Open Bugs",
    "type": "grid"
  }' | jq -r '.id // .error.message'

sleep 0.5

# ============================================
# VIEW 2: High Priority
# ============================================
echo "Creating view: High Priority"
curl -s -X POST "https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables/${TICKETS_TABLE_ID}/views" \
  -H "Authorization: Bearer ${AIRTABLE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "High Priority",
    "type": "grid"
  }' | jq -r '.id // .error.message'

sleep 0.5

# ============================================
# VIEW 3: By Source
# ============================================
echo "Creating view: By Source"
curl -s -X POST "https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables/${TICKETS_TABLE_ID}/views" \
  -H "Authorization: Bearer ${AIRTABLE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "By Source",
    "type": "grid"
  }' | jq -r '.id // .error.message'

sleep 0.5

# ============================================
# VIEW 4: Kanban Board
# ============================================
echo "Creating view: Kanban Board"
curl -s -X POST "https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables/${TICKETS_TABLE_ID}/views" \
  -H "Authorization: Bearer ${AIRTABLE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Kanban Board",
    "type": "kanban"
  }' | jq -r '.id // .error.message'

sleep 0.5

# ============================================
# VIEW 5: Calendar (by Created)
# ============================================
echo "Creating view: Calendar"
curl -s -X POST "https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables/${TICKETS_TABLE_ID}/views" \
  -H "Authorization: Bearer ${AIRTABLE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Calendar",
    "type": "calendar"
  }' | jq -r '.id // .error.message'

sleep 0.5

# ============================================
# VIEW 6: Needs Sync (no Supabase ID)
# ============================================
echo "Creating view: Needs Sync"
curl -s -X POST "https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables/${TICKETS_TABLE_ID}/views" \
  -H "Authorization: Bearer ${AIRTABLE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Needs Sync",
    "type": "grid"
  }' | jq -r '.id // .error.message'

echo ""
echo "=== Schema Creation Complete ==="
echo ""

# Show final tables
echo "=== Final Tables ==="
curl -s "https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables" \
  -H "Authorization: Bearer ${AIRTABLE_TOKEN}" | jq '.tables[] | {id, name, fields: [.fields[].name]}'
