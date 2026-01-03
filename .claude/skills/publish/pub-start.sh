#!/bin/bash
# Start the Mentu Publication Server
# Run from: /home/mentu/Workspaces/mentu-ai/.claude/skills/publish/

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load environment
if [ -f "$SCRIPT_DIR/.env" ]; then
    set -a
    source "$SCRIPT_DIR/.env"
    set +a
fi

# Run server
exec node "$SCRIPT_DIR/scripts/pub-server.cjs"
