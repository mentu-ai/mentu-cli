#!/bin/bash
# Start the Mentu Knowledge Base Server
# Run from: /home/mentu/Workspaces/mentu-ai/docs-site/

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load environment
if [ -f "$SCRIPT_DIR/.env" ]; then
    set -a
    source "$SCRIPT_DIR/.env"
    set +a
fi

# Start the server
exec node "$SCRIPT_DIR/kb-server.cjs"
