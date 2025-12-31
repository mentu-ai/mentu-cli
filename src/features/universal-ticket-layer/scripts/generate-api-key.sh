#!/bin/bash
# Universal Ticket Layer - Generate API Key
#
# Usage:
#   ./scripts/generate-api-key.sh "My Client Name"
#   ./scripts/generate-api-key.sh "My Client Name" "client-id"
#
# This script generates a secure API key for a client application.
# The key is displayed once and should be stored securely by the client.
#
# Environment Variables:
#   SUPABASE_URL           - Supabase project URL
#   SUPABASE_SERVICE_ROLE_KEY - Supabase service role key

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Universal Ticket Layer - API Key Generator${NC}"
echo "============================================"

# Check arguments
if [ -z "$1" ]; then
    echo -e "${RED}Error: Client name required${NC}"
    echo ""
    echo "Usage:"
    echo "  ./scripts/generate-api-key.sh \"Client Name\""
    echo "  ./scripts/generate-api-key.sh \"Client Name\" \"client-id\""
    exit 1
fi

CLIENT_NAME="$1"
CLIENT_ID="${2:-}"

# Check environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${YELLOW}Note: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY not set.${NC}"
    echo "Generating key locally (for development only)..."
    echo ""

    # Generate a local key for development
    LOCAL_KEY="utl_$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)"

    echo "Generated API Key:"
    echo ""
    echo -e "${GREEN}$LOCAL_KEY${NC}"
    echo ""
    echo "Store this key securely - it won't be shown again!"
    echo ""
    echo "To use in production, set these environment variables and re-run:"
    echo "  export SUPABASE_URL=<your-project-url>"
    echo "  export SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>"
    exit 0
fi

# Call Supabase function to generate key in database
echo ""
echo "Generating API key for: $CLIENT_NAME"
if [ -n "$CLIENT_ID" ]; then
    echo "Client ID: $CLIENT_ID"
fi
echo ""

# Call the RPC function to create the key
RESPONSE=$(curl -s -X POST \
    "$SUPABASE_URL/rest/v1/rpc/create_api_key" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "{
        \"p_name\": \"$CLIENT_NAME\",
        \"p_client_id\": $([ -n "$CLIENT_ID" ] && echo "\"$CLIENT_ID\"" || echo "null"),
        \"p_scopes\": [\"read\", \"write\"],
        \"p_rate_limit\": 1000
    }")

# Parse response
if echo "$RESPONSE" | grep -q "api_key"; then
    API_KEY=$(echo "$RESPONSE" | grep -o '"api_key":"[^"]*"' | cut -d'"' -f4)
    KEY_ID=$(echo "$RESPONSE" | grep -o '"key_id":"[^"]*"' | cut -d'"' -f4)
    PREFIX=$(echo "$RESPONSE" | grep -o '"prefix":"[^"]*"' | cut -d'"' -f4)

    echo -e "${GREEN}API Key Generated Successfully!${NC}"
    echo ""
    echo "Key ID: $KEY_ID"
    echo "Prefix: $PREFIX"
    echo ""
    echo "API Key:"
    echo ""
    echo -e "${GREEN}$API_KEY${NC}"
    echo ""
    echo -e "${RED}IMPORTANT: Store this key securely - it won't be shown again!${NC}"
    echo ""
    echo "To use this key:"
    echo "  curl -H 'x-api-key: $API_KEY' ..."
else
    echo -e "${RED}Error generating API key:${NC}"
    echo "$RESPONSE"
    exit 1
fi
