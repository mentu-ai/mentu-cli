#!/usr/bin/env bash
# Ralph — default account with cloud sync
# Runs `mentu sync --watch` in the background so evidence pushes to cloud.
#
# Usage: ./scripts/ralph.sh                    (basic run)
#        ./scripts/ralph.sh --verbose           (pass ralph flags)
#        ./scripts/ralph.sh --max-iterations 20 (override iterations)

set -euo pipefail
cd "$(dirname "$0")/.."

# Load .env (for MENTU_API_TOKEN, MENTU_WORKSPACE_ID, etc.)
if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

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

ralph run "$@"
