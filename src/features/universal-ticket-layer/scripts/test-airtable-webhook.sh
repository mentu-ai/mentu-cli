#!/bin/bash

echo "Testing airtable-webhook Edge Function..."

curl -s -X POST 'https://uhwiegwpaagzulolmruz.supabase.co/functions/v1/airtable-webhook' \
  -H 'Content-Type: application/json' \
  -d '{
    "base": {"id": "apppH8Loitcb1dwpJ"},
    "webhook": {"id": "ach9fdq0qzWUJFoik"},
    "timestamp": "2025-12-20T08:00:00.000Z"
  }' | jq '.'
