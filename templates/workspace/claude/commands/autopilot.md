Autonomous bug-fix pipeline. Triages Mentu tickets, fixes them in waves via Ralph Wiggum loop.

**Usage:** `/autopilot [--max-waves N] [--batch-size N]`

Defaults: `--max-waves 5`, `--batch-size 5`

---

## Arguments

**$ARGUMENTS**

Parse `--max-waves` (default 5) and `--batch-size` (default 5) from the arguments.

---

## Instructions

### Step 1: Read Credentials

Read Mentu proxy credentials from `.env`:
```bash
MENTU_TOKEN=$(grep '^{{TOKEN_ENV_VAR}}=' .env | cut -d'"' -f2)
MENTU_WS=$(grep '^{{WS_ENV_VAR}}=' .env | cut -d'"' -f2)
```

Verify both are non-empty. If missing, stop and tell the user to add `{{TOKEN_ENV_VAR}}` and `{{WS_ENV_VAR}}` to `.env`.

### Step 2: Write Autopilot Config

Write `.claude/autopilot.local.md`:
```markdown
---
batch_size: {batch_size}
project: {{PROJECT_NAME}}
build_cmd: {{BUILD_CMD}}
started_at: "{ISO timestamp}"
---
```

### Step 3: Activate Ralph Loop

Write the Ralph loop state file directly to `.claude/ralph-loop.local.md` with the full pipeline prompt baked inline. Use the Write tool to create this file:

```markdown
---
active: true
iteration: 1
max_iterations: {max_waves}
completion_promise: "ALL_TICKETS_RESOLVED"
started_at: "{ISO timestamp}"
---

{PIPELINE PROMPT -- see below}
```

The PIPELINE PROMPT below is the EXACT text to place after the closing `---` in the state file:

---

### PIPELINE PROMPT (copy verbatim into state file)

You are an autonomous bug-fix agent. This is one wave of a multi-wave pipeline.

## Step 1: Read Credentials

```bash
MENTU_TOKEN=$(grep '^{{TOKEN_ENV_VAR}}=' .env | cut -d'"' -f2)
MENTU_WS=$(grep '^{{WS_ENV_VAR}}=' .env | cut -d'"' -f2)
```

## Step 2: Triage

Fetch memories and commitments via curl (run both in parallel):

**Memories (bugs):**
```bash
curl -s "https://mentu-proxy.affihub.workers.dev/memories" \
  -H "X-Proxy-Token: $MENTU_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WS"
```

**Commitments (already-planned work):**
```bash
curl -s "https://mentu-proxy.affihub.workers.dev/commitments" \
  -H "X-Proxy-Token: $MENTU_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WS"
```

Also check existing fix branches:
```bash
git branch --list 'fix/ticket-*'
```

### Apply 5-Gate Garbage Filter

For each memory, run through these gates in order. If a ticket fails any gate, filter it out.

**Gate 1 -- Body Coherence:** Reject if body (after stripping markdown) has < 20 chars of real content, or is gibberish.

**Gate 2 -- Test Detection:** Reject if title/body contains (case-insensitive): "test", "testing", "E2E", "verificacion del flujo", "prueba", "token test", "hello there". Also reject localhost submissions with generic/test-like titles.

**Gate 3 -- Project Match:** Reject if `page_url` points to a domain NOT in: {{PROJECT_DOMAINS}}. Empty page_url is OK. Reject tickets from other projects.

**Gate 4 -- Duplicate Collapse:** Same/near-identical title + same day -> keep newest only.

**Gate 5 -- Actionability:** Must have description beyond just a title.

### Exclude Already-Committed Tickets

Cross-reference memories against commitments. Skip any ticket that already has a commitment linked to it.

### Score Survivors

```
score = priority_weight x age_factor x description_quality
  priority_weight:  critical=10, high=7, medium=4, low=2, (missing)=3
  age_factor:       1.0 + (days_old x 0.1), capped at 2.0
  description_quality: 0.5 (title only) | 0.8 (brief desc) | 1.0 (detailed)
```

Sort by score descending. Pick top N (read batch_size from .claude/autopilot.local.md).

### Cross-Reference Git Log

```bash
git log --oneline -50
```

Skip any ticket whose title/description matches a recent commit message (already fixed).

### If 0 Actionable Tickets

Output:
```
All actionable tickets have been resolved or committed.
```
Then output: <promise>ALL_TICKETS_RESOLVED</promise>

## Step 3: Per-Ticket Fix (sequential)

For each surviving ticket, in score order:

### 3a. Investigate
- Parse the bug: affected page, description, errors
- Find the route in the source directory
- Find the page component and related components
- Read relevant files to understand current implementation
- Determine root cause hypothesis

### 3b. Create Branch
```bash
git checkout -b fix/ticket-{short_id}
```
Where `{short_id}` is the last 8 chars of the mem_id.

### 3c. Create Mentu Commitment + Claim
```bash
MENTU_TOKEN=$(grep '^{{TOKEN_ENV_VAR}}=' .env | cut -d'"' -f2)
MENTU_WS=$(grep '^{{WS_ENV_VAR}}=' .env | cut -d'"' -f2)
curl -s -X POST "https://mentu-proxy.affihub.workers.dev/ops" \
  -H "X-Proxy-Token: $MENTU_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WS" \
  -H "Content-Type: application/json" \
  -d '{"op":"commit","body":"Fix: {title}","source":"{mem_id}","actor":"{{ACTOR}}","meta":{"branch":"fix/ticket-{short_id}"}}'
```

Save the returned `cmt_*` ID. Then immediately claim it:
```bash
curl -s -X POST "https://mentu-proxy.affihub.workers.dev/ops" \
  -H "X-Proxy-Token: $MENTU_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WS" \
  -H "Content-Type: application/json" \
  -d '{"op":"claim","commitment":"{cmt_id}"}'
```

Track active commitment for hook coordination:
```bash
echo "{cmt_id}" > .mentu/active_commitment
```

### 3d. Implement Fix
- Make the code changes
- Run `{{BUILD_CMD}}` -- fix ALL errors before proceeding
- Commit: `[Ticket-{short_id}] {description}`

If build fails after reasonable attempts, close the commitment as failed:
```bash
curl -s -X POST "https://mentu-proxy.affihub.workers.dev/ops" \
  -H "X-Proxy-Token: $MENTU_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WS" \
  -H "Content-Type: application/json" \
  -d '{"op":"close","commitment":"{cmt_id}","verdict":"fail","evidence":[],"summary":"Build failed: {error}"}'
```
Then abandon: `git checkout main && git branch -D fix/ticket-{short_id}` -- skip to next ticket.

### 3e. Merge to Main
```bash
git checkout main
git merge fix/ticket-{short_id}
git branch -d fix/ticket-{short_id}
```

### 3f. Capture Progress
```bash
MENTU_TOKEN=$(grep '^{{TOKEN_ENV_VAR}}=' .env | cut -d'"' -f2)
MENTU_WS=$(grep '^{{WS_ENV_VAR}}=' .env | cut -d'"' -f2)
curl -s -X POST "https://mentu-proxy.affihub.workers.dev/ops" \
  -H "X-Proxy-Token: $MENTU_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WS" \
  -H "Content-Type: application/json" \
  -d '{"op":"capture","body":"Fixed ticket {mem_id}: {title}","kind":"execution-progress"}'
```

Repeat for each ticket.

## Step 4: Push + Submit + Close

After all tickets in this wave are fixed:
```bash
git push origin main
```

For each fixed ticket, submit and close the commitment:

**Submit:**
```bash
MENTU_TOKEN=$(grep '^{{TOKEN_ENV_VAR}}=' .env | cut -d'"' -f2)
MENTU_WS=$(grep '^{{WS_ENV_VAR}}=' .env | cut -d'"' -f2)
COMMIT_SHA=$(git rev-parse HEAD)
curl -s -X POST "https://mentu-proxy.affihub.workers.dev/ops" \
  -H "X-Proxy-Token: $MENTU_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WS" \
  -H "Content-Type: application/json" \
  -d '{"op":"submit","commitment":"{cmt_id}","evidence":["'"$COMMIT_SHA"'"],"summary":"Fixed: {title}","tier":"tier_1"}'
```

**Close (pass):**
```bash
curl -s -X POST "https://mentu-proxy.affihub.workers.dev/ops" \
  -H "X-Proxy-Token: $MENTU_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WS" \
  -H "Content-Type: application/json" \
  -d '{"op":"close","commitment":"{cmt_id}","verdict":"pass","evidence":["{commit_sha}"],"summary":"Fixed: {title} -- merged to main, pushed"}'
```

## Step 5: Wave Summary

Present a summary table:
```
## Wave Complete

| # | Ticket | Title | Status |
|---|--------|-------|--------|
| 1 | mem_xxx | Title | FIXED |
| 2 | mem_yyy | Title | FIXED |

Tickets fixed this wave: N
```

If more tickets may exist (batch was full, or not all were checked): end normally WITHOUT the completion promise. The stop hook will re-inject this prompt for the next wave.

If triage returned 0 actionable tickets: output <promise>ALL_TICKETS_RESOLVED</promise>

## Critical Rules

- `{{BUILD_CMD}}` after EVERY fix -- no broken merges
- All Mentu ops via curl to proxy API -- NEVER use mentu CLI
- One branch per ticket, merge to main immediately after fix
- Evidence chain: commit -> claim -> evidence(progress) -> submit -> close

---

### Step 4: Start Working

After writing the state file, output:

```
Autopilot activated!

Max waves: {max_waves}
Batch size: {batch_size}
Completion promise: ALL_TICKETS_RESOLVED

Starting Wave 1...
```

Then immediately begin executing the pipeline prompt (Wave 1). When you finish and try to exit, the Ralph Wiggum stop hook will re-inject the pipeline prompt for the next wave.

---

## Rules

1. **Write the state file FIRST.** The Ralph loop won't work without `.claude/ralph-loop.local.md`.
2. **The pipeline prompt must be self-contained.** No references to other skills or commands.
3. **Start working immediately** after setting up. Don't wait for user input.
4. **If creds are missing**, stop and tell the user. Don't proceed without Mentu access.
5. **Trust the stop hook.** When you finish a wave, the hook will detect whether you output the completion promise and either re-inject the prompt (more work) or let you exit (done).
