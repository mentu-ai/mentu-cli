#!/bin/bash
# Universal Ticket Layer - Run Migrations
#
# Usage:
#   ./scripts/migrate.sh          # Apply all migrations
#   ./scripts/migrate.sh reset    # Reset database (WARNING: destructive)
#   ./scripts/migrate.sh status   # Show migration status
#
# Environment Variables:
#   SUPABASE_ACCESS_TOKEN - Supabase access token
#   SUPABASE_PROJECT_REF  - Supabase project reference

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Universal Ticket Layer - Database Migrations${NC}"
echo "=============================================="

# Check for supabase CLI
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}Error: supabase CLI not found. Install from https://supabase.com/docs/guides/cli${NC}"
    exit 1
fi

# Check environment variables
if [ -z "$SUPABASE_PROJECT_REF" ]; then
    echo -e "${YELLOW}Warning: SUPABASE_PROJECT_REF not set. Using local database.${NC}"
    LOCAL_MODE=true
else
    LOCAL_MODE=false
fi

ACTION=${1:-push}

case $ACTION in
    "push"|"")
        echo ""
        echo "Applying migrations..."
        echo ""

        if [ "$LOCAL_MODE" = true ]; then
            supabase db push
        else
            supabase db push --project-ref "$SUPABASE_PROJECT_REF"
        fi

        echo ""
        echo -e "${GREEN}Migrations applied successfully!${NC}"
        ;;

    "reset")
        echo ""
        echo -e "${RED}WARNING: This will reset the database and delete all data!${NC}"
        read -p "Are you sure? (type 'yes' to confirm): " confirm

        if [ "$confirm" != "yes" ]; then
            echo "Aborted."
            exit 0
        fi

        echo ""
        echo "Resetting database..."
        echo ""

        if [ "$LOCAL_MODE" = true ]; then
            supabase db reset
        else
            supabase db reset --project-ref "$SUPABASE_PROJECT_REF"
        fi

        echo ""
        echo -e "${GREEN}Database reset complete!${NC}"
        ;;

    "status")
        echo ""
        echo "Migration status:"
        echo ""

        # List migration files
        echo "Local migrations:"
        ls -la supabase/migrations/

        echo ""

        # Show applied migrations (if remote)
        if [ "$LOCAL_MODE" = false ]; then
            echo "Remote migrations:"
            supabase migration list --project-ref "$SUPABASE_PROJECT_REF"
        fi
        ;;

    *)
        echo -e "${RED}Unknown action: $ACTION${NC}"
        echo ""
        echo "Usage:"
        echo "  ./scripts/migrate.sh          # Apply migrations"
        echo "  ./scripts/migrate.sh reset    # Reset database"
        echo "  ./scripts/migrate.sh status   # Show status"
        exit 1
        ;;
esac
