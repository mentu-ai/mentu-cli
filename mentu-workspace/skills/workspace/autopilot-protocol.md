# Multi-HANDOFF Ralph Autopilot Protocol

Set up and run Ralph through sequential HANDOFF phases automatically.

## Overview

The autopilot mode configures a Ralph loop to execute multiple HANDOFF documents in sequence. Each iteration:
1. Reads `current-phase.txt` to determine the active phase
2. Reads the corresponding `HANDOFF-Phase-{NN}.md`
3. Executes all steps in the HANDOFF
4. Verifies the build passes
5. Commits with `[Phase N COMPLETE] description`
6. Increments `current-phase.txt`
7. Stops — Ralph loop restarts for next iteration

---

## Step 1: Discover HANDOFFs

```bash
ls {HANDOFF_DIR}/HANDOFF-Phase-*.md 2>/dev/null | sort -V
```

Where `{HANDOFF_DIR}` defaults to `docs/handoffs` if not specified.

Count the phases:
```bash
PHASE_COUNT=$(ls {HANDOFF_DIR}/HANDOFF-Phase-*.md 2>/dev/null | wc -l | tr -d ' ')
```

Validate each HANDOFF has content (not empty):
```bash
for f in {HANDOFF_DIR}/HANDOFF-Phase-*.md; do
    [ -s "$f" ] || echo "WARNING: Empty HANDOFF: $f"
done
```

---

## Step 2: Determine Starting Phase

Check if `current-phase.txt` exists:
```bash
CURRENT=$(cat {HANDOFF_DIR}/current-phase.txt 2>/dev/null | tr -d '[:space:]')
```

If it doesn't exist or is empty, create it with `1`:
```bash
echo 1 > {HANDOFF_DIR}/current-phase.txt
```

Cross-reference with git history to find the actual last completed phase:
```bash
git log --oneline | grep '\[Phase .* COMPLETE\]' | head -5
```

Trust git history over `current-phase.txt` if they disagree.

---

## Step 3: Generate `ralph.yml`

Create `ralph.yml` at the project root:

```yaml
# {PROJECT_NAME} — {PHASE_COUNT}-Phase Sequential Execution
# Runs one phase per iteration via .ralph/PROMPT.md

event_loop:
  prompt_file: ".ralph/PROMPT.md"
  completion_promise: "{PROJECT_NAME}_FULL_COMPLETE"
  max_iterations: {MAX_ITERATIONS}
  max_runtime_seconds: 86400    # 24 hours max
  checkpoint_interval: 1

cli:
  backend: "claude"
  prompt_mode: "arg"

core:
  guardrails:
    - "One phase per iteration — complete, commit, increment, stop"
    - "{BUILD_CMD} must pass after every phase"
    - "Follow all CLAUDE.md conventions for this project"
    - "Handle errors properly — no ignored errors, no force operations"
    - "Trust git log over current-phase.txt if they disagree"

hats:
  builder:
    name: "Phase Builder"
    description: "Executes one HANDOFF phase per iteration"
    triggers: ["build.start"]
    publishes: ["phase.complete"]
    default_publishes: "phase.complete"
    instructions: |
      Read {HANDOFF_DIR}/current-phase.txt to get the current phase number.
      Read the corresponding HANDOFF-Phase-{NN}.md file.
      Execute ALL steps in order.
      Run {BUILD_CMD} — must pass.
      Commit with: [Phase N COMPLETE] description
      Increment current-phase.txt to N+1.
      If phase {PHASE_COUNT} is done and current-phase.txt is {PHASE_COUNT+1}, emit the completion promise.
```

Where `{MAX_ITERATIONS}` = `{PHASE_COUNT}` * 2 + 10 (buffer for retries, recovery, and final validation).

---

## Step 4: Generate `.ralph/PROMPT.md`

Create the multi-phase execution prompt:

```markdown
# Ralph PROMPT: {PROJECT_NAME} — Full Reconstruction

## Phase Tracking

Read the current phase from `{HANDOFF_DIR}/current-phase.txt`. Execute the corresponding HANDOFF file at `{HANDOFF_DIR}/HANDOFF-Phase-{NN}.md` where `{NN}` is the zero-padded phase number.

## Execution Protocol

1. Read `{HANDOFF_DIR}/current-phase.txt` to get the current phase number (1-{PHASE_COUNT})
2. Read the corresponding `{HANDOFF_DIR}/HANDOFF-Phase-{NN}.md`
3. Execute ALL steps in the HANDOFF document
4. Verify ALL success criteria are met
5. Run `{BUILD_CMD}` — must pass with zero errors
6. Commit with the message pattern: `[Phase {N} COMPLETE] {description}`
7. Increment the phase: `echo {N+1} > {HANDOFF_DIR}/current-phase.txt`
8. If phase < {PHASE_COUNT}, stop — let the loop restart for the next iteration
9. If phase == {PHASE_COUNT}, emit the completion promise

## Recovery Protocol

If `{BUILD_CMD}` fails mid-phase:
1. Read the compiler errors carefully
2. Fix ONLY the reported errors — do not restart the entire phase
3. Run `{BUILD_CMD}` again after each fix
4. Repeat until the build passes
5. Continue with the remaining steps in the current phase

If `current-phase.txt` seems wrong or out of sync:
1. Run `git log --oneline | grep '\[Phase .* COMPLETE\]'` to see which phases are actually done
2. Trust git history over `current-phase.txt`
3. Set `current-phase.txt` to the next uncompleted phase number
4. Continue from there

If you encounter a merge conflict or dirty working tree:
1. Run `git status` to understand the state
2. Stage and commit any in-progress work with `[Phase N WIP]` message
3. Then continue the phase

## Iteration Awareness

The Ralph loop runs multiple iterations. On each iteration:
- **Iteration 1**: Start from whatever `current-phase.txt` says
- **Subsequent iterations**: Read `current-phase.txt` to determine which phase to execute
- **Never redo completed work** — if git log shows `[Phase N COMPLETE]`, skip to phase N+1
- **One phase per iteration** is the target pace — complete the phase, commit, increment, and stop

If `current-phase.txt` already shows `{PHASE_COUNT+1}`, all phases are complete. Verify with `{BUILD_CMD}` and emit the completion promise.

## Pacing Guidance

- **Target**: Complete exactly ONE phase per iteration
- After completing a phase:
  1. Run `{BUILD_CMD}` — must pass
  2. Commit: `git add -A && git commit -m "[Phase N COMPLETE] description"`
  3. Increment: `echo N+1 > {HANDOFF_DIR}/current-phase.txt`
  4. Stage and commit the phase increment: `git add {HANDOFF_DIR}/current-phase.txt && git commit -m "Advance to phase N+1"`
  5. Stop — let the loop restart for the next iteration
- Do NOT try to squeeze multiple phases into one iteration
- If a phase is genuinely too large, split it across two iterations (commit WIP, continue next iteration)

## Strict Rules

1. **Follow CLAUDE.md conventions** — read the project's CLAUDE.md and follow all documented code style rules
2. **`{BUILD_CMD}` must pass** after every step
3. **Commit after each phase** — `[Phase N COMPLETE] description`
4. **Increment `current-phase.txt`** after each successful phase completion
5. **No skipping phases** — each depends on the previous
6. **Handle errors properly** — no force unwraps/casts (Swift), no uncaught exceptions (TS/JS), no bare except (Python), no unwrap() (Rust)
7. **No debug output** — remove print/console.log/println! before committing

## Completion Promise

Only emit after ALL {PHASE_COUNT} phases are complete and `{BUILD_CMD}` passes:

When `current-phase.txt` contains `{PHASE_COUNT+1}`:
1. Verify `{BUILD_CMD}` passes with zero errors
2. Verify `git log --oneline | grep '\[Phase .* COMPLETE\]' | wc -l` equals {PHASE_COUNT}
3. If both checks pass, emit:

<promise>{PROJECT_NAME}_FULL_COMPLETE</promise>
```

---

## Step 5: Generate `scripts/preflight.sh`

Create a pre-flight validation script:

```bash
#!/bin/bash
# Pre-flight validation for {PROJECT_NAME} {PHASE_COUNT}-Phase Ralph Loop
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

echo "=== {PROJECT_NAME} Pre-Flight Validation ==="
echo ""

# Check 1: All HANDOFFs exist and have content
COUNT=$(ls "$ROOT/{HANDOFF_DIR}/HANDOFF-Phase-"*.md 2>/dev/null | wc -l | tr -d ' ')
EMPTY=0
for f in "$ROOT/{HANDOFF_DIR}/HANDOFF-Phase-"*.md; do
    [ -s "$f" ] || EMPTY=$((EMPTY + 1))
done
[ "$COUNT" -eq {PHASE_COUNT} ] && [ "$EMPTY" -eq 0 ] \
    && check 1 "All {PHASE_COUNT} HANDOFFs exist ($COUNT files)" "PASS" \
    || check 1 "HANDOFFs check ($COUNT files, $EMPTY empty)" "FAIL"

# Check 2: current-phase.txt exists and is valid
PHASE=$(cat "$ROOT/{HANDOFF_DIR}/current-phase.txt" 2>/dev/null | tr -d '[:space:]')
[ -n "$PHASE" ] && [ "$PHASE" -ge 1 ] 2>/dev/null \
    && check 2 "current-phase.txt = $PHASE" "PASS" \
    || check 2 "current-phase.txt invalid or missing" "FAIL"

# Check 3: Project builds
if cd "$ROOT" && {BUILD_CMD} > /dev/null 2>&1; then
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
        || check 4 "Permissions count = $PERM_COUNT (need >= 20)" "FAIL"
else
    check 4 "settings.local.json not found" "FAIL"
fi

# Check 5: Git working tree clean
cd "$ROOT"
DIRTY=$(git diff --name-only 2>/dev/null | wc -l | tr -d ' ')
[ "$DIRTY" -eq 0 ] \
    && check 5 "Git working tree clean" "PASS" \
    || check 5 "$DIRTY modified tracked files" "FAIL"

# Check 6: No stale ralph-loop.local.md
[ ! -f "$ROOT/.claude/ralph-loop.local.md" ] \
    && check 6 "No stale ralph-loop.local.md" "PASS" \
    || check 6 "Stale .claude/ralph-loop.local.md exists" "FAIL"

# Check 7: PROMPT.md contains completion promise
grep -q "{PROJECT_NAME}_FULL_COMPLETE" "$ROOT/.ralph/PROMPT.md" 2>/dev/null \
    && check 7 "PROMPT.md contains completion promise" "PASS" \
    || check 7 "PROMPT.md missing completion promise" "FAIL"

# Check 8: ralph.yml exists
[ -f "$ROOT/ralph.yml" ] \
    && check 8 "ralph.yml exists" "PASS" \
    || check 8 "ralph.yml not found" "FAIL"

echo ""
echo "=== Results: $PASS passed, $FAIL failed, $WARN warnings ==="

[ "$FAIL" -gt 0 ] && { echo "PREFLIGHT FAILED"; exit 1; } || { echo "PREFLIGHT PASSED"; exit 0; }
```

Make executable: `chmod +x scripts/preflight.sh`

---

## Step 6: Report

After generating all autopilot files, output:

```markdown
## Autopilot Configured: {PROJECT_NAME}

**Phases**: {PHASE_COUNT}
**Current phase**: {CURRENT_PHASE}
**Completion promise**: `{PROJECT_NAME}_FULL_COMPLETE`
**Max iterations**: {MAX_ITERATIONS}

### Generated Files
| File | Purpose |
|------|---------|
| `ralph.yml` | Ralph loop configuration |
| `.ralph/PROMPT.md` | Multi-phase execution prompt |
| `scripts/preflight.sh` | Pre-flight validation (8 checks) |
| `{HANDOFF_DIR}/current-phase.txt` | Phase counter (currently: {CURRENT_PHASE}) |

### Launch

```bash
# 1. Validate
bash scripts/preflight.sh

# 2. Launch Ralph loop
ralph --config ralph.yml

# Or with ralph-wiggum skill:
# /ralph-loop
```

### Monitor

```bash
# Watch progress
tail -f .ralph/logs/ralph_*.log

# Check current phase
cat {HANDOFF_DIR}/current-phase.txt

# Check completed phases
git log --oneline | grep '\[Phase .* COMPLETE\]'
```

### Resume After Interruption

Ralph is resumable. If interrupted:
1. `current-phase.txt` tracks the last completed phase
2. Git log proves which phases actually committed
3. Re-run `ralph --config ralph.yml` to continue from where it left off
```
