#!/bin/bash
# One-time VPS setup for Mentu Knowledge Base Server
# Run this once after SSH-ing to VPS: ssh mentu@your-vps-ip
# Then: cd /home/mentu/Workspaces/mentu-ai/docs-site && ./vps-setup.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_FILE="$SCRIPT_DIR/mentu-kb.service"
VPS_DIR="/home/mentu/mentu-vps"

echo "=== Mentu Knowledge Base Server Setup ==="

# Check if dist folder exists
if [ ! -d "$SCRIPT_DIR/dist" ]; then
    echo "ERROR: dist folder not found. Build the docs site first."
    echo "On Mac: cd docs-site && npm run build"
    exit 1
fi

# Check if service file exists
if [ ! -f "$SERVICE_FILE" ]; then
    echo "ERROR: Service file not found at $SERVICE_FILE"
    exit 1
fi

# Install systemd service
echo ""
echo "=== Installing systemd service ==="
sudo cp "$SERVICE_FILE" /etc/systemd/system/mentu-kb.service
sudo systemctl daemon-reload
sudo systemctl enable mentu-kb
sudo systemctl restart mentu-kb

# Show status
echo ""
echo "=== KB Server Status ==="
sudo systemctl status mentu-kb --no-pager

# Update Caddy config if VPS docker setup exists
if [ -d "$VPS_DIR" ]; then
    echo ""
    echo "=== Updating Caddy for /knowledge-base route ==="

    # Copy updated configs from synced claude-code
    CLAUDE_CODE="/home/mentu/Workspaces/claude-code"
    if [ -f "$CLAUDE_CODE/infra/vps/config/caddy/Caddyfile" ]; then
        cp "$CLAUDE_CODE/infra/vps/config/caddy/Caddyfile" "$VPS_DIR/config/caddy/Caddyfile"
        echo "Updated Caddyfile"
    fi
    if [ -f "$CLAUDE_CODE/infra/vps/docker-compose.yml" ]; then
        cp "$CLAUDE_CODE/infra/vps/docker-compose.yml" "$VPS_DIR/docker-compose.yml"
        echo "Updated docker-compose.yml"
    fi

    # Restart Caddy to pick up new config
    cd "$VPS_DIR"
    docker compose up -d caddy
    echo "Caddy restarted"
fi

echo ""
echo "=== Done ==="
echo "Knowledge Base: http://localhost:3457"
echo "External URL: https://mentu.rashidazarang.com/knowledge-base"
echo ""
echo "Logs: sudo journalctl -u mentu-kb -f"
