#!/bin/bash
# Visual Pathway Capture Script
# Captures screenshots from recorded behavior pathways

set -e

# Configuration
MENTU_AI_DIR="/Users/rashid/Desktop/Workspaces/mentu-ai"
VPS_HOST="208.167.255.71"
VPS_USER="mentu"
VPS_PATH="/home/mentu/Workspaces/mentu-ai"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Parse arguments
RECORDING=""
NAME=""
VIEWPORTS="desktop"
COMMITMENT=""
BUCKET="visual-evidence"
FORMAT="webp"
QUALITY=85
WAIT=1000
RUN_LOCAL=false
JSON_OUTPUT=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --name)
            NAME="$2"
            shift 2
            ;;
        --viewports)
            VIEWPORTS="$2"
            shift 2
            ;;
        --commitment)
            COMMITMENT="$2"
            shift 2
            ;;
        --bucket)
            BUCKET="$2"
            shift 2
            ;;
        --format)
            FORMAT="$2"
            shift 2
            ;;
        --quality)
            QUALITY="$2"
            shift 2
            ;;
        --wait)
            WAIT="$2"
            shift 2
            ;;
        --local)
            RUN_LOCAL=true
            shift
            ;;
        --json)
            JSON_OUTPUT=true
            shift
            ;;
        --help|-h)
            echo "Usage: capture.sh <recording> [options]"
            echo ""
            echo "Captures screenshots from recorded behavior pathways."
            echo "Runs on VPS by default for headless execution."
            echo ""
            echo "Arguments:"
            echo "  recording             Path to behavior recording (JSON/YAML)"
            echo ""
            echo "Options:"
            echo "  --name <name>        Pathway name (default: auto-generated)"
            echo "  --viewports <list>   Comma-separated: desktop,laptop,tablet,mobile"
            echo "  --commitment <id>    Link evidence to commitment"
            echo "  --bucket <name>      Supabase bucket (default: visual-evidence)"
            echo "  --format <fmt>       Screenshot format: png, jpeg, webp"
            echo "  --quality <num>      Quality 1-100 (default: 85)"
            echo "  --wait <ms>          Wait between steps (default: 1000)"
            echo "  --local              Run locally instead of VPS"
            echo "  --json               Output as JSON"
            echo ""
            echo "Examples:"
            echo "  capture.sh behaviors/talisman-flow.json --name talisman-visual"
            echo "  capture.sh behaviors/app.yaml --viewports desktop,mobile --commitment cmt_xxx"
            exit 0
            ;;
        *)
            if [[ -z "$RECORDING" ]]; then
                RECORDING="$1"
            fi
            shift
            ;;
    esac
done

# Validate recording
if [[ -z "$RECORDING" ]]; then
    echo -e "${RED}Error: Recording path is required${NC}"
    echo "Usage: capture.sh <recording> [options]"
    exit 1
fi

# Resolve recording path
if [[ "$RECORDING" != /* ]]; then
    RECORDING="$MENTU_AI_DIR/$RECORDING"
fi

if [[ ! -f "$RECORDING" ]]; then
    echo -e "${RED}Error: Recording not found: $RECORDING${NC}"
    exit 1
fi

# Generate name if not provided
if [[ -z "$NAME" ]]; then
    BASENAME=$(basename "$RECORDING" | sed 's/\.[^.]*$//')
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    NAME="${BASENAME}-${TIMESTAMP}"
fi

if [[ "$JSON_OUTPUT" != true ]]; then
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}VISUAL PATHWAY CAPTURE${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo -e "Recording: ${YELLOW}$RECORDING${NC}"
    echo -e "Name: ${YELLOW}$NAME${NC}"
    echo -e "Viewports: ${YELLOW}$VIEWPORTS${NC}"
    echo -e "Format: ${YELLOW}$FORMAT${NC} (quality: $QUALITY)"
    if [[ -n "$COMMITMENT" ]]; then
        echo -e "Commitment: ${GREEN}$COMMITMENT${NC}"
    fi
    echo -e "Mode: ${YELLOW}$(if $RUN_LOCAL; then echo 'Local'; else echo 'VPS'; fi)${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
fi

# Build command
CMD="node tools/visual-pathway.js \"$RECORDING\" --name \"$NAME\" --viewports \"$VIEWPORTS\" --bucket \"$BUCKET\" --format \"$FORMAT\" --quality $QUALITY --wait $WAIT --headless"

if [[ -n "$COMMITMENT" ]]; then
    CMD="$CMD --commitment \"$COMMITMENT\""
fi

if [[ "$JSON_OUTPUT" == true ]]; then
    CMD="$CMD --json"
fi

if [[ "$RUN_LOCAL" == true ]]; then
    # Run locally
    cd "$MENTU_AI_DIR"
    eval "$CMD"
else
    # Run on VPS
    if [[ "$JSON_OUTPUT" != true ]]; then
        echo -e "${BLUE}Connecting to VPS...${NC}"
    fi

    # Copy recording to VPS if it's local
    REMOTE_RECORDING="$VPS_PATH/$(basename "$RECORDING")"
    scp -q "$RECORDING" "$VPS_USER@$VPS_HOST:$REMOTE_RECORDING"

    # Update command for remote path
    CMD="node tools/visual-pathway.js \"$REMOTE_RECORDING\" --name \"$NAME\" --viewports \"$VIEWPORTS\" --bucket \"$BUCKET\" --format \"$FORMAT\" --quality $QUALITY --wait $WAIT --headless"

    if [[ -n "$COMMITMENT" ]]; then
        CMD="$CMD --commitment \"$COMMITMENT\""
    fi

    if [[ "$JSON_OUTPUT" == true ]]; then
        CMD="$CMD --json"
    fi

    # Execute on VPS
    ssh "$VPS_USER@$VPS_HOST" "cd $VPS_PATH && $CMD"

    # Clean up remote recording
    ssh "$VPS_USER@$VPS_HOST" "rm -f \"$REMOTE_RECORDING\"" 2>/dev/null || true
fi
