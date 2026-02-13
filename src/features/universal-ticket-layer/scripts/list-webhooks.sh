#!/bin/bash
AIRTABLE_TOKEN="${AIRTABLE_TOKEN:?Set AIRTABLE_TOKEN env var}"
BASE_ID="apppH8Loitcb1dwpJ"

curl -s "https://api.airtable.com/v0/bases/${BASE_ID}/webhooks" \
  -H "Authorization: Bearer ${AIRTABLE_TOKEN}" | jq '.'
