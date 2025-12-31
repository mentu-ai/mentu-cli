#!/bin/bash
AIRTABLE_TOKEN="<AIRTABLE_PAT>.c1ae34300ff572e29e2276d9aa24b1153202c208cc024e95bb5ba9b58efaac83"
BASE_ID="apppH8Loitcb1dwpJ"

curl -s "https://api.airtable.com/v0/bases/${BASE_ID}/webhooks" \
  -H "Authorization: Bearer ${AIRTABLE_TOKEN}" | jq '.'
