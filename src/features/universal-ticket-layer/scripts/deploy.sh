#!/bin/bash
# Universal Ticket Layer - Deploy Edge Functions
#
# Usage:
#   ./scripts/deploy.sh              # Deploy all functions
#   ./scripts/deploy.sh tickets-api  # Deploy specific function
#
# Environment Variables:
#   SUPABASE_ACCESS_TOKEN - Supabase access token
#   SUPABASE_PROJECT_REF  - Supabase project reference (from dashboard URL)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions to deploy
FUNCTIONS=(
  "tickets-api"
  "ingest-ticket"
  "create-github-issue"
  "github-webhook"
)

echo -e "${GREEN}Universal Ticket Layer - Edge Function Deployment${NC}"
echo "=================================================="

# Check for supabase CLI
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}Error: supabase CLI not found. Install from https://supabase.com/docs/guides/cli${NC}"
    exit 1
fi

# Check environment variables
if [ -z "$SUPABASE_PROJECT_REF" ]; then
    echo -e "${YELLOW}Warning: SUPABASE_PROJECT_REF not set. Using local deployment.${NC}"
    LOCAL_MODE=true
else
    LOCAL_MODE=false
fi

# Determine which functions to deploy
if [ -n "$1" ]; then
    # Single function specified
    FUNCTIONS=("$1")
fi

echo ""
echo "Functions to deploy: ${FUNCTIONS[*]}"
echo ""

# Deploy each function
for func in "${FUNCTIONS[@]}"; do
    echo -e "${YELLOW}Deploying: $func${NC}"

    if [ "$LOCAL_MODE" = true ]; then
        # Local mode - just validate
        if [ -d "supabase/functions/$func" ]; then
            echo -e "  ${GREEN}✓ Function exists: supabase/functions/$func${NC}"
        else
            echo -e "  ${RED}✗ Function not found: supabase/functions/$func${NC}"
            exit 1
        fi
    else
        # Production mode - deploy
        supabase functions deploy "$func" --project-ref "$SUPABASE_PROJECT_REF"
    fi

    echo ""
done

echo -e "${GREEN}Deployment complete!${NC}"
echo ""

if [ "$LOCAL_MODE" = true ]; then
    echo "To deploy to production, set these environment variables:"
    echo "  export SUPABASE_ACCESS_TOKEN=<your-token>"
    echo "  export SUPABASE_PROJECT_REF=<your-project-ref>"
    echo ""
    echo "Then run: ./scripts/deploy.sh"
fi
