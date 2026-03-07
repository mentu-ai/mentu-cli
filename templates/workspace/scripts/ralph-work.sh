#!/usr/bin/env bash
# Ralph — Work account with extended thinking
# Sources CLAUDE_CODE_OAUTH_TOKEN from .env, unsets ANTHROPIC_API_KEY,
# sets MAX_THINKING_TOKENS=63999, passes --dangerously-skip-permissions to claude.
# Runs `mentu sync --watch` in the background so evidence pushes to cloud.
#
# Usage: ./scripts/ralph-work.sh                    (basic run)
#        ./scripts/ralph-work.sh --verbose           (pass ralph flags)
#        ./scripts/ralph-work.sh --max-iterations 20 (override iterations)

set -euo pipefail
cd "$(dirname "$0")/.."

# Load .env
if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

# Validate
if [[ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]]; then
  echo "ERROR: CLAUDE_CODE_OAUTH_TOKEN not set in .env" >&2
  exit 1
fi

# Prevent API key billing
unset ANTHROPIC_API_KEY 2>/dev/null || true

# Extended thinking
export MAX_THINKING_TOKENS=63999

# Background cloud sync — watches ledger.jsonl, pushes on change
SYNC_PID=""
cleanup() {
  # Submit + close active commitment
  if [[ -f .mentu/active_commitment ]]; then
    CMT_ID=$(cat .mentu/active_commitment)
    if [[ -n "$CMT_ID" ]]; then
      EVIDENCE_ID=$(python3 -c "
import json
try:
    entries = json.load(open('.claude/mentu_evidence.json'))
    print(entries[-1]['id'] if entries else '')
except: print('')
" 2>/dev/null)

      mentu submit "$CMT_ID" --summary "Session complete" \
        ${EVIDENCE_ID:+--evidence "$EVIDENCE_ID"} 2>/dev/null || true

      mentu close "$CMT_ID" \
        ${EVIDENCE_ID:+--evidence "$EVIDENCE_ID"} 2>/dev/null || true

      rm -f .mentu/active_commitment
    fi
  fi

  # Kill sync watcher
  if [[ -n "$SYNC_PID" ]]; then
    kill "$SYNC_PID" 2>/dev/null
    wait "$SYNC_PID" 2>/dev/null
  fi
  # Final flush
  mentu sync --push 2>/dev/null || true
}
trap cleanup EXIT

mentu sync --watch --json &
SYNC_PID=$!

ralph run "$@" -- --dangerously-skip-permissions
