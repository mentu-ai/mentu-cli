#!/bin/bash
# Pre-flight validation for {{PROJECT_TITLE}} Ralph Loop
set -euo pipefail

PASS=0; FAIL=0; WARN=0
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

check() {
    local num="$1" desc="$2" result="$3"
    if [ "$result" = "PASS" ]; then
        echo "  [PASS] Check $num: $desc"; PASS=$((PASS + 1))
    elif [ "$result" = "WARN" ]; then
        echo "  [WARN] Check $num: $desc"; WARN=$((WARN + 1))
    else
        echo "  [FAIL] Check $num: $desc"; FAIL=$((FAIL + 1))
    fi
}

echo "=== {{PROJECT_TITLE}} Pre-Flight Validation ==="
echo ""

# Check 1: ralph.yml exists
[ -f "$ROOT/ralph.yml" ] \
    && check 1 "ralph.yml exists" "PASS" \
    || check 1 "ralph.yml not found" "FAIL"

# Check 2: PROMPT.md exists (WARN if missing — created per-task via /craft-ralph)
[ -f "$ROOT/.ralph/PROMPT.md" ] \
    && check 2 ".ralph/PROMPT.md exists" "PASS" \
    || check 2 ".ralph/PROMPT.md not found (create with /craft-ralph)" "WARN"

# Check 3: Project builds
if cd "$ROOT" && {{BUILD_CMD}} > /dev/null 2>&1; then
    check 3 "Project builds successfully" "PASS"
else
    check 3 "Project build failed" "FAIL"
fi

# Check 4: Permissions configured
SETTINGS="$ROOT/.claude/settings.local.json"
if [ -f "$SETTINGS" ]; then
    PERM_COUNT=$(python3 -c "import json; f=open('$SETTINGS'); d=json.load(f); print(len(d.get('permissions',{}).get('allow',[])))" 2>/dev/null || echo "0")
    [ "$PERM_COUNT" -ge 20 ] \
        && check 4 "Permissions count = $PERM_COUNT" "PASS" \
        || check 4 "Permissions count = $PERM_COUNT (need >= 20)" "WARN"
else
    check 4 "settings.local.json not found" "WARN"
fi

# Check 5: Git working tree clean
cd "$ROOT"
DIRTY=$(git diff --name-only 2>/dev/null | wc -l | tr -d ' ')
[ "$DIRTY" -eq 0 ] \
    && check 5 "Git working tree clean" "PASS" \
    || check 5 "$DIRTY modified tracked files" "WARN"

# Check 6: .mentu/ directory exists
[ -d "$ROOT/.mentu" ] \
    && check 6 ".mentu/ directory exists" "PASS" \
    || check 6 ".mentu/ directory not found" "FAIL"

# Check 7: Mentu manifest exists
[ -f "$ROOT/.mentu/manifest.yaml" ] \
    && check 7 ".mentu/manifest.yaml exists" "PASS" \
    || check 7 ".mentu/manifest.yaml not found" "FAIL"

# Check 8: No stale ralph-loop.local.md
[ ! -f "$ROOT/.claude/ralph-loop.local.md" ] \
    && check 8 "No stale ralph-loop.local.md" "PASS" \
    || check 8 "Stale .claude/ralph-loop.local.md exists" "WARN"

# Check 9: ralph-work.sh exists and is executable
[ -x "$ROOT/scripts/ralph-work.sh" ] \
    && check 9 "scripts/ralph-work.sh exists and is executable" "PASS" \
    || check 9 "scripts/ralph-work.sh missing or not executable" "WARN"

# Check 10: CLAUDE_CODE_OAUTH_TOKEN in .env
if [ -f "$ROOT/.env" ] && grep -q '^CLAUDE_CODE_OAUTH_TOKEN=.' "$ROOT/.env" 2>/dev/null; then
    check 10 "CLAUDE_CODE_OAUTH_TOKEN set in .env" "PASS"
else
    check 10 "CLAUDE_CODE_OAUTH_TOKEN not set in .env (ralph-work.sh will fail)" "WARN"
fi

# Check 11: .mcp.json has no unfilled placeholders
if [ -f "$ROOT/.mcp.json" ] && grep -q '__MENTU_TOKEN__\|__WORKSPACE_ID__' "$ROOT/.mcp.json" 2>/dev/null; then
    check 11 ".mcp.json has unfilled placeholders" "FAIL"
elif [ -f "$ROOT/.mcp.json" ]; then
    check 11 ".mcp.json has literal credentials" "PASS"
else
    check 11 ".mcp.json not found" "FAIL"
fi

echo ""
echo "=== Results: $PASS passed, $FAIL failed, $WARN warnings ==="

[ "$FAIL" -gt 0 ] && { echo "PREFLIGHT FAILED"; exit 1; } || { echo "PREFLIGHT PASSED"; exit 0; }
