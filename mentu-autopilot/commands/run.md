---
description: "Full autopilot pipeline — triage, fix, push in waves via Mentu MCP"
allowed-tools: ["mcp__mentu__mentu_list_memories", "mcp__mentu__mentu_list_commitments", "mcp__mentu__mentu_get_status", "mcp__mentu__mentu_commit", "mcp__mentu__mentu_claim", "mcp__mentu__mentu_capture", "mcp__mentu__mentu_submit", "mcp__mentu__mentu_dismiss", "mcp__mentu__mentu_triage", "mcp__mentu__mentu_annotate", "Bash(npm:*)", "Bash(git:*)", "Bash(gh:*)", "Read", "Write", "Edit", "Glob", "Grep", "Task"]
argument-hint: "[--max-waves N] [--batch-size N] [--dry-run]"
---

# Mentu Autopilot Run

Full autopilot pipeline: triage -> investigate -> fix -> build -> push -> PR in waves.

**Usage:**
- `/run` — full pipeline (5 waves, 5 tickets/wave)
- `/run --dry-run` — wave 1 triage only (no fixes)
- `/run --max-waves 2` — limit to 2 waves
- `/run --batch-size 3` — 3 tickets per wave

## Instructions

### Step 1: Pre-flight Checks

1. **Connection check:** Use **mentu_get_status** to verify Mentu is connected
2. **Clean working tree:**
   ```bash
   git status --porcelain
   ```
   If uncommitted changes, warn the user.
3. **GitHub CLI check:**
   ```bash
   gh api user --jq '.login' 2>/dev/null
   ```
4. **Detect stack:** Read `package.json` to detect framework (Next.js, Vite+React, etc.)

Present:
```
Pre-flight: {project} ({stack})
  Git:    clean | {N} uncommitted changes
  GitHub: {username} (OK)
  Mentu:  connected ({workspace})
  Flags:  {parsed flags}
```

### Step 2: Parse Arguments

Parse `$ARGUMENTS` for flags:
- `--max-waves N` (default: 5)
- `--batch-size N` (default: 5)
- `--dry-run` (triage only)

### Step 3: Execute Wave Pipeline

#### 3a. Fetch Untriaged Bugs

Use **mentu_list_memories** (limit: 200) and **mentu_list_commitments** in parallel.

#### 3b. Apply 5-Gate Garbage Filter

**Gate 1 — Body Coherence:** < 20 chars or gibberish = reject.
**Gate 2 — Test Detection:** "test", "prueba", "E2E", test submissions = reject.
**Gate 3 — Project Match:** Wrong domain = reject. Empty page_url OK.
**Gate 4 — Duplicate Collapse:** Same title + same day = keep newest.
**Gate 5 — Actionability:** Title-only with no description = reject.

Skip tickets with existing commitments.

#### 3c. Score & Sort

```
score = priority_weight x age_factor x description_quality x scope_estimate
```

Take top `{batch_size}`. If none survive: `<promise>COMPLETE</promise>`

If `--dry-run`: show dashboard and `<promise>COMPLETE</promise>`.

#### 3d. Per-Ticket Fix Pipeline

For EACH surviving ticket:

1. **Investigate** — stack-aware codebase search
2. **Create branch:** `git checkout -b fix/ticket-{short_id}`
3. **Create HANDOFF** at `docs/HANDOFF-Ticket-{short_id}.md`
4. **Create commitment:** Use **mentu_commit** (body="Fix: {title}", source={mem_id})
5. **Claim:** Use **mentu_claim** (commitment={cmt_id})
6. **Fix the bug** — follow HANDOFF steps:
   - Make changes, build, commit (`[Ticket-{short_id} Step N] desc`)
   - **mentu_capture** (body="[Ticket-{id} Step N] done", kind="execution-progress")
7. **Build verify:** **mentu_capture** (body="Build PASS", kind="validation")

#### 3e. Wave Wrap-up

1. `git checkout main`
2. Push all branches: `git push origin fix/ticket-{id1} ... -u`
3. Create PRs via `gh pr create`
4. Capture PR evidence: **mentu_capture** (body="PR: {url}", kind="document")
5. Submit commitments: **mentu_submit** (commitment, evidence, summary)
6. Present wave summary table
7. Signal: `<promise>COMPLETE</promise>`

The Stop hook calls `mentu autopilot complete-wave` which:
- Increments wave counter
- Checks circuit breakers (empty waves, max waves)
- Re-injects prompt for next wave, or allows exit

## Rules

1. **All Mentu via MCP tools.** No curl. No .env scanning.
2. **Build after EVERY step.**
3. **One commit per step:** `[Ticket-{short_id} Step N] description`
4. **Full evidence chain:** commit -> claim -> steps -> build -> PR -> submit.
5. **Skip committed tickets.**
6. **Aggressive garbage filtering.**
7. **Stack-aware investigation.**
8. **Wave completion signal mandatory:** `<promise>COMPLETE</promise>`
