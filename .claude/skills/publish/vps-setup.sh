#!/bin/bash
# One-time VPS setup for Mentu Publication Server
# Run this once after SSH-ing to VPS: ssh mentu@your-vps-ip
# Then: cd /home/mentu/Workspaces/mentu-ai/.claude/skills/publish && ./vps-setup.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_FILE="$SCRIPT_DIR/mentu-pub.service"
VPS_DIR="/home/mentu/mentu-vps"

echo "=== Mentu Publication Server Setup ==="

# Check files exist
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    echo "ERROR: .env not found. Wait for SyncThing to sync."
    exit 1
fi

if [ ! -f "$SERVICE_FILE" ]; then
    echo "ERROR: mentu-pub.service not found. Wait for SyncThing to sync."
    exit 1
fi

# Make startup script executable
chmod +x "$SCRIPT_DIR/pub-start.sh"

# Install systemd service
echo "Installing systemd service..."
sudo cp "$SERVICE_FILE" /etc/systemd/system/mentu-pub.service
sudo systemctl daemon-reload

# Enable and start
echo "Enabling service..."
sudo systemctl enable mentu-pub

echo "Starting service..."
sudo systemctl start mentu-pub

# Show status
echo ""
echo "=== Pub Server Status ==="
sudo systemctl status mentu-pub --no-pager

# Update Caddy config if VPS docker setup exists
if [ -d "$VPS_DIR" ]; then
    echo ""
    echo "=== Updating Caddy for /docs route ==="

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
echo "Publication server: http://localhost:3456"
echo "External URL: https://mentu.rashidazarang.com/docs"
echo ""
echo "Logs: sudo journalctl -u mentu-pub -f"
