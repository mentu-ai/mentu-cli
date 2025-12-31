#!/bin/bash

# Airtable API Configuration
AIRTABLE_TOKEN="<AIRTABLE_PAT>.c1ae34300ff572e29e2276d9aa24b1153202c208cc024e95bb5ba9b58efaac83"
BASE_ID="apppH8Loitcb1dwpJ"
TABLE_ID="tblQcExUHhBTbOJX7"

# Get current schema
echo "=== Current Tables in Base ==="
curl -s "https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables" \
  -H "Authorization: Bearer ${AIRTABLE_TOKEN}" | jq '.tables[] | {id, name, fields: [.fields[].name]}'
