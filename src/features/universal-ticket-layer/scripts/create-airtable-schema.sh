#!/bin/bash

# Airtable API Configuration
AIRTABLE_TOKEN="<AIRTABLE_PAT>.c1ae34300ff572e29e2276d9aa24b1153202c208cc024e95bb5ba9b58efaac83"
BASE_ID="apppH8Loitcb1dwpJ"
TABLE_ID="tblQcExUHhBTbOJX7"

# Function to create a field
create_field() {
  local name="$1"
  local type="$2"
  local options="$3"

  echo "Creating field: $name ($type)"

  if [ -z "$options" ]; then
    curl -s -X POST "https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables/${TABLE_ID}/fields" \
      -H "Authorization: Bearer ${AIRTABLE_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "{\"name\": \"$name\", \"type\": \"$type\"}" | jq -r '.id // .error.message'
  else
    curl -s -X POST "https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables/${TABLE_ID}/fields" \
      -H "Authorization: Bearer ${AIRTABLE_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "{\"name\": \"$name\", \"type\": \"$type\", \"options\": $options}" | jq -r '.id // .error.message'
  fi

  sleep 0.5
}

# Function to update table name
update_table() {
  echo "Renaming table to: Tickets"
  curl -s -X PATCH "https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables/${TABLE_ID}" \
    -H "Authorization: Bearer ${AIRTABLE_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"name": "Tickets", "description": "Universal Ticket Layer - Synced with Supabase"}' | jq -r '.id // .error.message'
}

echo "=== Creating Universal Ticket Layer Schema ==="
echo ""

# 1. Rename table
update_table
echo ""

# 2. Create Title field (will use existing Name field - skip)
echo "Using existing 'Name' field as Title"

# 3. Create Description field (long text)
create_field "Description" "multilineText"

# 4. Create Type field (single select)
create_field "Type" "singleSelect" '{
  "choices": [
    {"name": "bug", "color": "redLight2"},
    {"name": "feature", "color": "greenLight2"},
    {"name": "support", "color": "blueLight2"},
    {"name": "task", "color": "yellowLight2"},
    {"name": "question", "color": "purpleLight2"}
  ]
}'

# 5. Create Priority field (single select)
create_field "Priority" "singleSelect" '{
  "choices": [
    {"name": "critical", "color": "redDark1"},
    {"name": "high", "color": "orangeDark1"},
    {"name": "medium", "color": "yellowDark1"},
    {"name": "low", "color": "grayLight2"}
  ]
}'

# 6. Update existing Status field with proper choices
echo "Updating Status field choices..."
# First get the Status field ID
STATUS_FIELD_ID=$(curl -s "https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables/${TABLE_ID}/fields" \
  -H "Authorization: Bearer ${AIRTABLE_TOKEN}" | jq -r '.fields[] | select(.name=="Status") | .id')

if [ -n "$STATUS_FIELD_ID" ]; then
  curl -s -X PATCH "https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables/${TABLE_ID}/fields/${STATUS_FIELD_ID}" \
    -H "Authorization: Bearer ${AIRTABLE_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Status",
      "options": {
        "choices": [
          {"name": "submitted", "color": "grayLight2"},
          {"name": "triaged", "color": "blueLight2"},
          {"name": "in_progress", "color": "yellowLight2"},
          {"name": "resolved", "color": "greenLight2"},
          {"name": "closed", "color": "grayDark1"},
          {"name": "wont_fix", "color": "redLight2"}
        ]
      }
    }' | jq -r '.id // .error.message'
else
  # Create Status field if it doesn't exist
  create_field "Status" "singleSelect" '{
    "choices": [
      {"name": "submitted", "color": "grayLight2"},
      {"name": "triaged", "color": "blueLight2"},
      {"name": "in_progress", "color": "yellowLight2"},
      {"name": "resolved", "color": "greenLight2"},
      {"name": "closed", "color": "grayDark1"},
      {"name": "wont_fix", "color": "redLight2"}
    ]
  }'
fi

# 7. Create Source field (single select)
create_field "Source" "singleSelect" '{
  "choices": [
    {"name": "bug_reporter", "color": "purpleLight2"},
    {"name": "email", "color": "blueLight2"},
    {"name": "slack", "color": "pinkLight2"},
    {"name": "api", "color": "cyanLight2"},
    {"name": "airtable", "color": "orangeLight2"},
    {"name": "github", "color": "grayDark1"}
  ]
}'

# 8. Create Supabase ID field (single line text - for sync)
create_field "Supabase ID" "singleLineText"

# 9. Create GitHub Issue field (URL)
create_field "GitHub Issue" "url"

# 10. Create Page URL field (URL)
create_field "Page URL" "url"

# 11. Create Environment field (long text for JSON)
create_field "Environment" "multilineText"

# 12. Create Reporter Email field
create_field "Reporter Email" "email"

# 13. Create Created At field (for display - actual created time is automatic)
create_field "Synced At" "dateTime" '{"dateFormat": {"name": "iso"}, "timeFormat": {"name": "24hour"}, "timeZone": "utc"}'

# 14. Create Last Sync field
create_field "Last Sync" "dateTime" '{"dateFormat": {"name": "iso"}, "timeFormat": {"name": "24hour"}, "timeZone": "utc"}'

echo ""
echo "=== Schema Creation Complete ==="
echo ""

# Show final schema
echo "=== Final Schema ==="
curl -s "https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables/${TABLE_ID}" \
  -H "Authorization: Bearer ${AIRTABLE_TOKEN}" | jq '{name, description, fields: [.fields[] | {name, type}]}'
