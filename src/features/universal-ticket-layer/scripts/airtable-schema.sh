#!/bin/bash

# Airtable API Configuration
AIRTABLE_TOKEN="${AIRTABLE_TOKEN:?Set AIRTABLE_TOKEN env var}"
BASE_ID="apppH8Loitcb1dwpJ"
TABLE_ID="tblQcExUHhBTbOJX7"

# Get current schema
echo "=== Current Tables in Base ==="
curl -s "https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables" \
  -H "Authorization: Bearer ${AIRTABLE_TOKEN}" | jq '.tables[] | {id, name, fields: [.fields[].name]}'
