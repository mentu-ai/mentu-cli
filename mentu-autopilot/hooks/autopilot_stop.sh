#!/bin/bash

# Mentu Autopilot Stop Hook
# Wave continuation logic (Ralph-Wiggum pattern).
# Delegates ALL state management to `mentu autopilot complete-wave`.

set -euo pipefail

# Read hook input from stdin
HOOK_INPUT=$(cat)

STATE_FILE=".claude/autopilot.local.md"

# No active autopilot — allow exit
if [[ ! -f "$STATE_FILE" ]]; then
  exit 0
fi

# Check if mentu CLI is available
if ! command -v mentu &>/dev/null; then
  echo "⚠️  mentu CLI not found. Autopilot stop hook cannot run." >&2
  echo "   Install with: npm install -g mentu-cli" >&2
  rm -f "$STATE_FILE"
  exit 0
fi

# Get transcript path from hook input
TRANSCRIPT_PATH=$(echo "$HOOK_INPUT" | jq -r '.transcript_path // ""')

# Count commits in this wave (heuristic: recent Ticket commits)
WAVE_COMMITS=0
if [[ -n "$TRANSCRIPT_PATH" ]] && [[ -f "$TRANSCRIPT_PATH" ]]; then
  # Check if last assistant message contains <promise>COMPLETE</promise>
  LAST_ASSISTANT=$(grep '"role":"assistant"' "$TRANSCRIPT_PATH" 2>/dev/null | tail -1 || echo "")
  if [[ -n "$LAST_ASSISTANT" ]]; then
    LAST_TEXT=$(echo "$LAST_ASSISTANT" | jq -r '
      .message.content |
      map(select(.type == "text")) |
      map(.text) |
      join("\n")
    ' 2>/dev/null || echo "")

    if echo "$LAST_TEXT" | grep -qi '<promise>.*COMPLETE.*</promise>'; then
      # Wave completed — count commits made
      WAVE_COMMITS=$(git log --oneline -20 2>/dev/null | grep -c '\[Ticket-' || echo "0")
    fi
  fi
fi

# Ask the CLI to decide: continue or stop
RESULT=$(mentu autopilot complete-wave --wave-commits "$WAVE_COMMITS" --json 2>/dev/null || echo '{"decision":"stop","reason":"CLI error"}')

DECISION=$(echo "$RESULT" | jq -r '.decision // "stop"')

if [[ "$DECISION" == "stop" ]]; then
  REASON=$(echo "$RESULT" | jq -r '.reason // "Autopilot complete"')
  TOTAL=$(echo "$RESULT" | jq -r '.total_fixed // 0')
  WAVE=$(echo "$RESULT" | jq -r '.wave // 0')
  echo "✅ Autopilot: $REASON" >&2
  exit 0
fi

# Continue — block exit and re-inject prompt
PROMPT=$(echo "$RESULT" | jq -r '.prompt // ""')
SYSTEM_MSG=$(echo "$RESULT" | jq -r '.system_message // ""')

if [[ -z "$PROMPT" ]]; then
  echo "⚠️  Autopilot: No prompt returned from complete-wave. Stopping." >&2
  rm -f "$STATE_FILE"
  exit 0
fi

jq -n \
  --arg prompt "$PROMPT" \
  --arg msg "🔄 $SYSTEM_MSG" \
  '{
    "decision": "block",
    "reason": $prompt,
    "systemMessage": $msg
  }'

exit 0
