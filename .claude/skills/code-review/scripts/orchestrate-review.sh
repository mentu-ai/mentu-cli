#!/bin/bash
# orchestrate-review.sh
# Helper script for code review orchestration
# Gathers context for the parallel review agents

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
COMMENT=false
QUEUE=false
JSON=false
FORCE=false
CMT_ID=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --comment) COMMENT=true; shift ;;
    --queue) QUEUE=true; shift ;;
    --json) JSON=true; shift ;;
    --force) FORCE=true; shift ;;
    cmt_*) CMT_ID="$1"; shift ;;
    *) shift ;;
  esac
done

echo "═══════════════════════════════════════════════════════════════"
echo "                    CODE REVIEW ORCHESTRATOR                    "
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Phase 1: Determine mode and gather files
echo -e "${BLUE}Phase 1: Gathering context...${NC}"

if [ -n "$CMT_ID" ]; then
  # Mentu commitment mode
  echo "Mode: Mentu Commitment ($CMT_ID)"

  if ! command -v mentu &> /dev/null; then
    echo -e "${RED}Error: mentu command not found${NC}"
    exit 1
  fi

  CMT_DATA=$(mentu show "$CMT_ID" --json 2>/dev/null)
  if [ -z "$CMT_DATA" ]; then
    echo -e "${RED}Error: Commitment not found${NC}"
    exit 1
  fi

  echo "Commitment: $(echo "$CMT_DATA" | jq -r '.body' | head -c 60)..."

  # Try to get files from evidence or git
  CHANGED_FILES=$(git diff --name-only HEAD~1 2>/dev/null || echo "")

elif [ "$QUEUE" = true ]; then
  # Mentu queue mode
  echo "Mode: Mentu Review Queue"

  QUEUE_DATA=$(mentu review-queue --json 2>/dev/null)
  QUEUE_COUNT=$(echo "$QUEUE_DATA" | jq 'length')

  echo "Found $QUEUE_COUNT commitment(s) in review"

  if [ "$QUEUE_COUNT" -eq 0 ]; then
    echo -e "${GREEN}No pending reviews.${NC}"
    exit 0
  fi

  # Will process each in agent
  CHANGED_FILES=""

else
  # PR or local mode
  PR_NUMBER=$(gh pr view --json number -q '.number' 2>/dev/null || echo "")

  if [ -n "$PR_NUMBER" ]; then
    echo "Mode: Pull Request #$PR_NUMBER"

    # Check PR state
    PR_STATE=$(gh pr view --json state -q '.state' 2>/dev/null)
    PR_DRAFT=$(gh pr view --json isDraft -q '.isDraft' 2>/dev/null)
    PR_TITLE=$(gh pr view --json title -q '.title' 2>/dev/null)

    echo "Title: $PR_TITLE"
    echo "State: $PR_STATE (Draft: $PR_DRAFT)"

    # Skip conditions
    if [ "$PR_STATE" = "CLOSED" ] && [ "$FORCE" != true ]; then
      echo -e "${YELLOW}Skipping: PR is closed (use --force to override)${NC}"
      exit 0
    fi

    if [ "$PR_DRAFT" = "true" ] && [ "$FORCE" != true ]; then
      echo -e "${YELLOW}Skipping: PR is draft (use --force to override)${NC}"
      exit 0
    fi

    # Get changed files
    CHANGED_FILES=$(gh pr view --json files -q '.files[].path' 2>/dev/null)

  else
    echo "Mode: Local (no PR)"

    # Get changed files from git
    CHANGED_FILES=$(git diff --name-only HEAD~1 2>/dev/null || git diff --name-only origin/main...HEAD 2>/dev/null || echo "")
  fi
fi

echo ""

# Count and validate files
if [ -n "$CHANGED_FILES" ]; then
  FILE_COUNT=$(echo "$CHANGED_FILES" | wc -l | tr -d ' ')
  echo "Changed files: $FILE_COUNT"

  # Check for trivial changes
  DOC_COUNT=$(echo "$CHANGED_FILES" | grep -E '\.(md|txt|json|yaml|yml)$' | wc -l | tr -d ' ')
  CODE_COUNT=$((FILE_COUNT - DOC_COUNT))

  if [ "$CODE_COUNT" -eq 0 ] && [ "$FORCE" != true ]; then
    echo -e "${YELLOW}Skipping: Only documentation changes (use --force to override)${NC}"
    exit 0
  fi

  echo "  Code files: $CODE_COUNT"
  echo "  Doc files: $DOC_COUNT"
else
  echo "No changed files detected"
fi

echo ""

# Phase 2: Collect guidelines
echo -e "${BLUE}Phase 2: Loading guidelines...${NC}"

GUIDELINES=""

# Root CLAUDE.md
if [ -f "CLAUDE.md" ]; then
  echo "  Found: CLAUDE.md (root)"
  GUIDELINES="$GUIDELINES\n--- CLAUDE.md (root) ---\n$(cat CLAUDE.md)"
fi

# Directory-specific CLAUDE.md files
if [ -n "$CHANGED_FILES" ]; then
  for FILE in $CHANGED_FILES; do
    DIR=$(dirname "$FILE")
    if [ -f "$DIR/CLAUDE.md" ]; then
      echo "  Found: $DIR/CLAUDE.md"
      GUIDELINES="$GUIDELINES\n--- $DIR/CLAUDE.md ---\n$(cat "$DIR/CLAUDE.md")"
    fi
  done
fi

# Manifest
if [ -f ".mentu/manifest.yaml" ]; then
  echo "  Found: .mentu/manifest.yaml"
fi

echo ""

# Phase 3: Git context
echo -e "${BLUE}Phase 3: Git context...${NC}"

if [ -n "$CHANGED_FILES" ]; then
  # Recent commits to changed files
  echo "  Recent history:"
  for FILE in $(echo "$CHANGED_FILES" | head -5); do
    COMMITS=$(git log --oneline -3 -- "$FILE" 2>/dev/null | head -1)
    if [ -n "$COMMITS" ]; then
      echo "    $FILE: $COMMITS"
    fi
  done

  # Hotspots
  echo ""
  echo "  Hotspots (most changed files):"
  git log --format=format: --name-only --since="90 days" 2>/dev/null | \
    sort | uniq -c | sort -rn | head -5 | \
    while read COUNT FILE; do
      if [ -n "$FILE" ]; then
        echo "    $COUNT changes: $FILE"
      fi
    done
fi

echo ""

# Output summary
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo -e "${GREEN}Context gathered. Ready for parallel agent review.${NC}"
echo ""
echo "Files to review:"
echo "$CHANGED_FILES" | head -10
if [ $(echo "$CHANGED_FILES" | wc -l) -gt 10 ]; then
  echo "  ... and $(($(echo "$CHANGED_FILES" | wc -l) - 10)) more"
fi
echo ""
echo "Options:"
echo "  --comment: $COMMENT"
echo "  --queue: $QUEUE"
echo "  --json: $JSON"
echo "  --force: $FORCE"
echo ""

# Export for agent use
export CODE_REVIEW_FILES="$CHANGED_FILES"
export CODE_REVIEW_GUIDELINES="$GUIDELINES"
export CODE_REVIEW_COMMENT="$COMMENT"
export CODE_REVIEW_PR="$PR_NUMBER"
export CODE_REVIEW_CMT="$CMT_ID"

echo "Environment variables set for agent consumption."
echo ""
