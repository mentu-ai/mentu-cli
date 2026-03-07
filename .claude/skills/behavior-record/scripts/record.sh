#!/bin/bash
# Behavior Recording Script
# Records browser behavior and captures as Mentu evidence

set -e

# Configuration
MENTU_AI_DIR="/Users/rashid/Desktop/Workspaces/mentu-ai"
DEFAULT_OUTPUT_DIR="$MENTU_AI_DIR/behaviors"
DEFAULT_AUTO_SAVE=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Parse arguments
TARGET_URL=""
NAME=""
COMMITMENT=""
OUTPUT_DIR="$DEFAULT_OUTPUT_DIR"
AUTO_SAVE=$DEFAULT_AUTO_SAVE
JSON_OUTPUT=false
NO_CAPTURE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --name)
            NAME="$2"
            shift 2
            ;;
        --commitment)
            COMMITMENT="$2"
            shift 2
            ;;
        --output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --auto)
            AUTO_SAVE="$2"
            shift 2
            ;;
        --json)
            JSON_OUTPUT=true
            shift
            ;;
        --no-capture)
            NO_CAPTURE=true
            shift
            ;;
        --help|-h)
            echo "Usage: record.sh <url> [options]"
            echo ""
            echo "Records browser behavior and captures as Mentu evidence."
            echo ""
            echo "Arguments:"
            echo "  url                     Target URL to record"
            echo ""
            echo "Options:"
            echo "  --name <name>          Recording name (default: auto-generated)"
            echo "  --commitment <id>      Link evidence to commitment"
            echo "  --output <dir>         Output directory (default: behaviors/)"
            echo "  --auto <seconds>       Auto-save timeout (default: wait for browser close)"
            echo "  --json                 Output as JSON"
            echo "  --no-capture           Skip Mentu evidence capture"
            echo ""
            echo "Examples:"
            echo "  record.sh https://mentu.ai"
            echo "  record.sh https://app.example.com --name login-flow --auto 60"
            echo "  record.sh https://dev.talismanapp.co --commitment cmt_abc123"
            exit 0
            ;;
        *)
            if [[ -z "$TARGET_URL" ]]; then
                TARGET_URL="$1"
            fi
            shift
            ;;
    esac
done

# Validate URL
if [[ -z "$TARGET_URL" ]]; then
    echo -e "${RED}Error: Target URL is required${NC}"
    echo "Usage: record.sh <url> [options]"
    exit 1
fi

# Validate URL format
if [[ ! "$TARGET_URL" =~ ^https?:// ]]; then
    echo -e "${RED}Error: Invalid URL format. Must start with http:// or https://${NC}"
    exit 1
fi

# Generate name from URL if not provided
if [[ -z "$NAME" ]]; then
    HOSTNAME=$(echo "$TARGET_URL" | sed 's|https\?://||' | sed 's|/.*||' | sed 's|\.|-|g')
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    NAME="${HOSTNAME}-${TIMESTAMP}"
fi

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}BEHAVIOR RECORDER${NC}"
echo -e "${CYAN}========================================${NC}"
echo -e "Target: ${YELLOW}$TARGET_URL${NC}"
echo -e "Name: ${YELLOW}$NAME${NC}"
echo -e "Output: ${YELLOW}$OUTPUT_DIR${NC}"
if [[ -n "$COMMITMENT" ]]; then
    echo -e "Commitment: ${GREEN}$COMMITMENT${NC}"
fi
if [[ "$AUTO_SAVE" -gt 0 ]]; then
    echo -e "Auto-save: ${YELLOW}${AUTO_SAVE}s${NC}"
else
    echo -e "Mode: ${YELLOW}Close browser when done${NC}"
fi
echo -e "${CYAN}========================================${NC}"
echo ""

# Build command
CMD="node $MENTU_AI_DIR/tools/behavior-recorder.js $TARGET_URL --name $NAME --output $OUTPUT_DIR"
if [[ "$AUTO_SAVE" -gt 0 ]]; then
    CMD="$CMD --auto $AUTO_SAVE"
fi

# Run the recorder
echo -e "${BLUE}Starting browser recorder...${NC}"
echo ""

cd "$MENTU_AI_DIR"
eval "$CMD"

# Check output files
JSON_FILE="$OUTPUT_DIR/$NAME.json"
YAML_FILE="$OUTPUT_DIR/$NAME.yaml"

if [[ ! -f "$JSON_FILE" ]]; then
    echo -e "${RED}Error: Recording failed - no output file${NC}"
    exit 1
fi

# Parse recording stats
STEP_COUNT=$(jq '.steps | length' "$JSON_FILE" 2>/dev/null || echo "0")
CLICK_COUNT=$(jq '[.steps[] | select(.action == "click")] | length' "$JSON_FILE" 2>/dev/null || echo "0")
NAV_COUNT=$(jq '[.steps[] | select(.action == "navigate")] | length' "$JSON_FILE" 2>/dev/null || echo "0")
TYPE_COUNT=$(jq '[.steps[] | select(.action == "type")] | length' "$JSON_FILE" 2>/dev/null || echo "0")
SCROLL_COUNT=$(jq '[.steps[] | select(.action == "scroll")] | length' "$JSON_FILE" 2>/dev/null || echo "0")
COOKIE_COUNT=$(jq '.cookies | length' "$JSON_FILE" 2>/dev/null || echo "0")

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}RECORDING COMPLETE${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "Steps: ${YELLOW}$STEP_COUNT${NC}"
echo -e "  - Clicks: $CLICK_COUNT"
echo -e "  - Navigations: $NAV_COUNT"
echo -e "  - Typing: $TYPE_COUNT"
echo -e "  - Scrolls: $SCROLL_COUNT"
echo -e "Cookies: ${YELLOW}$COOKIE_COUNT${NC}"
echo -e "${GREEN}========================================${NC}"

# Capture as Mentu evidence (unless disabled)
EVIDENCE_ID=""
if [[ "$NO_CAPTURE" != true ]]; then
    echo ""
    echo -e "${BLUE}Capturing as Mentu evidence...${NC}"

    # Create evidence body with recording summary
    EVIDENCE_BODY="Behavior Recording: $NAME
Target: $TARGET_URL
Steps: $STEP_COUNT (clicks: $CLICK_COUNT, navigations: $NAV_COUNT, typing: $TYPE_COUNT)
Cookies: $COOKIE_COUNT
Files: $JSON_FILE, $YAML_FILE"

    # Capture to Mentu
    CAPTURE_RESULT=$(cd "$MENTU_AI_DIR" && mentu capture "$EVIDENCE_BODY" --kind behavior-evidence --json 2>/dev/null || echo "{}")

    EVIDENCE_ID=$(echo "$CAPTURE_RESULT" | grep -o '"id":"mem_[^"]*"' | head -1 | cut -d'"' -f4 || echo "")

    if [[ -n "$EVIDENCE_ID" ]]; then
        echo -e "${GREEN}Evidence captured: $EVIDENCE_ID${NC}"

        # Update JSON file with evidence ID
        jq --arg eid "$EVIDENCE_ID" '.mentu = {evidence_id: $eid}' "$JSON_FILE" > "${JSON_FILE}.tmp" && mv "${JSON_FILE}.tmp" "$JSON_FILE"

        # Link to commitment if specified
        if [[ -n "$COMMITMENT" ]]; then
            echo -e "${BLUE}Linking to commitment $COMMITMENT...${NC}"
            cd "$MENTU_AI_DIR" && mentu annotate "$COMMITMENT" "Behavior recording evidence: $EVIDENCE_ID - $NAME ($STEP_COUNT steps)" 2>/dev/null || true
            echo -e "${GREEN}Linked to $COMMITMENT${NC}"
        fi
    else
        echo -e "${YELLOW}Warning: Could not capture evidence${NC}"
    fi
fi

# Output results
if [[ "$JSON_OUTPUT" == true ]]; then
    cat <<EOF
{
  "name": "$NAME",
  "target": "$TARGET_URL",
  "steps": $STEP_COUNT,
  "clicks": $CLICK_COUNT,
  "navigations": $NAV_COUNT,
  "typing": $TYPE_COUNT,
  "scrolls": $SCROLL_COUNT,
  "cookies": $COOKIE_COUNT,
  "json_file": "$JSON_FILE",
  "yaml_file": "$YAML_FILE",
  "evidence_id": "$EVIDENCE_ID",
  "commitment": "$COMMITMENT"
}
EOF
else
    echo ""
    echo -e "${CYAN}Output Files:${NC}"
    echo -e "  JSON: ${YELLOW}$JSON_FILE${NC}"
    echo -e "  YAML: ${YELLOW}$YAML_FILE${NC}"

    if [[ -n "$EVIDENCE_ID" ]]; then
        echo ""
        echo -e "${GREEN}Mentu Evidence: $EVIDENCE_ID${NC}"
    fi

    echo ""
    echo -e "${CYAN}Next Steps:${NC}"
    echo "  # Replay in headless mode:"
    echo "  node tools/behavior-replayer.js $YAML_FILE --headless"
    echo ""
    echo "  # Replay with commitment evidence:"
    echo "  node tools/behavior-replayer.js $YAML_FILE --commitment cmt_xxx"
fi
