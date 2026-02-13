#!/bin/bash

# Airtable API Configuration
AIRTABLE_TOKEN="${AIRTABLE_TOKEN:?Set AIRTABLE_TOKEN env var}"
BASE_ID="apppH8Loitcb1dwpJ"
TICKETS_TABLE_ID="tblQcExUHhBTbOJX7"

# UTL Webhook URL
WEBHOOK_URL="https://uhwiegwpaagzulolmruz.supabase.co/functions/v1/airtable-webhook"

echo "=== Creating Airtable Webhook ==="
echo ""

# Create webhook
RESPONSE=$(curl -s -X POST "https://api.airtable.com/v0/bases/${BASE_ID}/webhooks" \
  -H "Authorization: Bearer ${AIRTABLE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"notificationUrl\": \"${WEBHOOK_URL}\",
    \"specification\": {
      \"options\": {
        \"filters\": {
          \"dataTypes\": [\"tableData\"],
          \"recordChangeScope\": \"${TICKETS_TABLE_ID}\"
        }
      }
    }
  }")

echo "Response:"
echo "$RESPONSE" | jq '.'

# Extract webhook ID
WEBHOOK_ID=$(echo "$RESPONSE" | jq -r '.id // "ERROR"')
echo ""
echo "Webhook ID: $WEBHOOK_ID"

if [ "$WEBHOOK_ID" != "ERROR" ] && [ -n "$WEBHOOK_ID" ]; then
  echo ""
  echo "=== Webhook Created Successfully ==="
  echo "ID: $WEBHOOK_ID"
  echo "URL: $WEBHOOK_URL"
  echo ""
  echo "Note: Airtable webhooks expire after 7 days. You'll need to refresh them."
  echo "Use: supabase functions invoke airtable-webhook --body '{\"refresh\": true}'"
fi
