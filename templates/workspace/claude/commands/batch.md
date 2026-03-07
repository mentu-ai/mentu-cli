Batch triage + fix: filter all Mentu bugs, investigate survivors, then either create HANDOFFs + Ralph PROMPT (default) or auto-fix inline (when `--auto` is passed or running inside a ralph loop).

**Usage:** `/batch [--auto] [--max N]`

---

## Configuration

```
MENTU_PROXY_URL:    https://mentu-proxy.affihub.workers.dev
MENTU_WORKSPACE_ID: {{WORKSPACE_ID}}
PROJECT_DOMAINS:    {{PROJECT_DOMAINS}}
```

Read credentials from `.env`:
```bash
MENTU_TOKEN=$(grep '^{{TOKEN_ENV_VAR}}=' .env | cut -d'"' -f2)
MENTU_WS=$(grep '^{{WS_ENV_VAR}}=' .env | cut -d'"' -f2)
```

---

## Arguments

**$ARGUMENTS**

Parse:
- `--auto` -- auto-execution mode: fix bugs inline instead of creating HANDOFFs
- `--max N` -- max tickets to process (default: 5)

**Auto-detection:** If `.claude/ralph-loop.local.md` exists, auto-execution mode is enabled automatically (we're inside a ralph loop).

---

## Instructions

### Phase 1: Triage (same as /triage)

1. Fetch all memories and commitments from Mentu (parallel API calls):

```bash
curl -s "https://mentu-proxy.affihub.workers.dev/memories" \
  -H "X-Proxy-Token: $MENTU_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WS"
```

```bash
curl -s "https://mentu-proxy.affihub.workers.dev/commitments" \
  -H "X-Proxy-Token: $MENTU_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WS"
```

2. Apply the **5-gate garbage filter** to each memory:

   - **Gate 1 -- Body Coherence**: Reject < 20 chars real content, gibberish
   - **Gate 2 -- Test Detection**: Reject "test", "E2E", "verificacion del flujo", "prueba", "token test", "hello there", localhost test submissions
   - **Gate 3 -- Project Match**: Reject URLs from unrelated domains. Empty page_url is OK.
   - **Gate 4 -- Duplicate Collapse**: Same/near-identical title + same day -> keep newest only
   - **Gate 5 -- Actionability**: Must have description beyond just a title

3. **Exclude tickets that already have commitments** -- don't re-plan work that's already committed.

4. **Cross-reference against git log** -- skip tickets whose description matches recent commit messages.

5. Score and sort survivors by: `priority_weight x age_factor x description_quality`

6. Present the triage summary:

```markdown
## Triage Results

**Actionable:** {N} tickets
**Filtered:** {N} (junk/test/dupes/wrong-project)
**Already committed:** {N} (skipped)

| # | ID | Priority | Title | Page |
|---|-----|----------|-------|------|
| 1 | mem_xxx | high | Title | /page |
| 2 | mem_yyy | medium | Title | /page |
```

### Mode Fork

**If auto-execution mode (`--auto` or inside ralph loop):** Skip confirmation, proceed directly to Phase 2A (Auto-Fix).

**If normal mode:** Stop and ask user for confirmation:
> "These {N} tickets will get HANDOFFs and a batch Ralph PROMPT. Proceed? (You can also exclude specific tickets by number.)"

Then proceed to Phase 2B (HANDOFF mode).

---

### Phase 2A: Auto-Fix Mode (inline execution)

For EACH surviving ticket (in priority order):

1. **Investigate**: Parse bug, find route in source directory, read components, determine root cause
2. **Create branch**: `git checkout -b fix/ticket-{short_id}`
3. **Create Mentu commitment + claim**:
   ```bash
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
4. **Implement fix** -- make changes, run `{{BUILD_CMD}}`, fix all errors
   If build fails after reasonable attempts, close the commitment as failed:
   ```bash
   curl -s -X POST "https://mentu-proxy.affihub.workers.dev/ops" \
     -H "X-Proxy-Token: $MENTU_TOKEN" \
     -H "X-Workspace-Id: $MENTU_WS" \
     -H "Content-Type: application/json" \
     -d '{"op":"close","commitment":"{cmt_id}","verdict":"fail","evidence":[],"summary":"Build failed: {error}"}'
   ```
   Then abandon: `git checkout main && git branch -D fix/ticket-{short_id}` -- skip to next ticket.
5. **Commit**: `[Ticket-{short_id}] {description}`
6. **Merge to main**:
   ```bash
   git checkout main
   git merge fix/ticket-{short_id}
   git branch -d fix/ticket-{short_id}
   ```
7. **Capture evidence**:
   ```bash
   curl -s -X POST "https://mentu-proxy.affihub.workers.dev/ops" \
     -H "X-Proxy-Token: $MENTU_TOKEN" \
     -H "X-Workspace-Id: $MENTU_WS" \
     -H "Content-Type: application/json" \
     -d '{"op":"capture","body":"Fixed {mem_id}: {title}","kind":"execution-progress"}'
   ```

After ALL tickets:
```bash
git push origin main
```

For each fixed ticket, submit and close the commitment:

**Submit:**
```bash
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

Output summary table and: <promise>{{COMPLETION_PROMISE}}</promise>

---

### Phase 2B: HANDOFF Mode (normal)

For EACH surviving ticket (in priority order):

1. **Investigate** (same as auto-fix: parse bug, find route, read components, determine root cause)

2. **Create branch:**
   ```bash
   git branch fix/ticket-{short_id}
   ```
   (Don't checkout -- just create them all from current HEAD. Ralph will checkout each one as it works.)

3. **Create lightweight PRD** at `docs/PRD-Ticket-{short_id}.md`

4. **Create HANDOFF** at `docs/HANDOFF-Ticket-{short_id}.md` with 2-5 concrete steps

5. **Capture evidence** for each HANDOFF:
   ```bash
   curl -s -X POST "https://mentu-proxy.affihub.workers.dev/ops" \
     -H "X-Proxy-Token: $MENTU_TOKEN" \
     -H "X-Workspace-Id: $MENTU_WS" \
     -H "Content-Type: application/json" \
     -d '{"op":"capture","body":"Created HANDOFF-Ticket-{short_id}: {title}","kind":"document","meta":{"author_type":"auditor"}}'
   ```

6. **Create commitment + claim** for each ticket:
   ```bash
   curl -s -X POST "https://mentu-proxy.affihub.workers.dev/ops" \
     -H "X-Proxy-Token: $MENTU_TOKEN" \
     -H "X-Workspace-Id: $MENTU_WS" \
     -H "Content-Type: application/json" \
     -d '{
       "op": "commit",
       "body": "Fix: {title}",
       "source": "{mem_id}",
       "actor": "{{ACTOR}}",
       "meta": {"priority": "{priority}", "estimated_effort": "{effort}", "branch": "fix/ticket-{short_id}"}
     }'
   ```
   Save the returned `cmt_*` ID. Then immediately claim it:
   ```bash
   curl -s -X POST "https://mentu-proxy.affihub.workers.dev/ops" \
     -H "X-Proxy-Token: $MENTU_TOKEN" \
     -H "X-Workspace-Id: $MENTU_WS" \
     -H "Content-Type: application/json" \
     -d '{"op":"claim","commitment":"{cmt_id}"}'
   ```

7. **Update PRD and HANDOFF** with the returned `cmt_*` ID.

### Phase 3: Generate Master Ralph PROMPT (HANDOFF mode only)

Create `.ralph/PROMPT.md` -- a **sequential batch prompt** that works through all tickets in order.

````markdown
You have {N} bug tickets to fix, one at a time, in sequence. Each ticket has its own branch and HANDOFF.

## Ticket Queue

| # | ID | Branch | HANDOFF | Commitment | Steps |
|---|-----|--------|---------|------------|-------|
| 1 | mem_xxx | fix/ticket-{id1} | docs/HANDOFF-Ticket-{id1}.md | cmt_aaa | 2 |
| 2 | mem_yyy | fix/ticket-{id2} | docs/HANDOFF-Ticket-{id2}.md | cmt_bbb | 3 |

## How to work

### Determine current position

1. Run `git branch --show-current` and `git log --oneline -10` to figure out where you are.
2. If you're on `main`, start with Ticket #1.
3. If you're on a `fix/ticket-*` branch, check if all steps for that ticket are committed. If yes, move to the next ticket. If no, continue from where you left off.

### Per-ticket workflow

For each ticket in order:

1. **Checkout the branch:**
   ```bash
   git checkout fix/ticket-{short_id}
   ```

2. **Read the HANDOFF:** `docs/HANDOFF-Ticket-{short_id}.md`

3. **Claim the commitment (first time only):**
   ```bash
   MENTU_TOKEN=$(grep '^{{TOKEN_ENV_VAR}}=' .env | cut -d'"' -f2)
   MENTU_WS=$(grep '^{{WS_ENV_VAR}}=' .env | cut -d'"' -f2)
   curl -s -X POST "https://mentu-proxy.affihub.workers.dev/ops" \
     -H "X-Proxy-Token: $MENTU_TOKEN" \
     -H "X-Workspace-Id: $MENTU_WS" \
     -H "Content-Type: application/json" \
     -d '{"op":"claim","commitment":"{cmt_id}"}'
   ```

4. **Work each step** from the HANDOFF:
   - Build the fix exactly as described
   - Run `{{BUILD_CMD}}` -- fix ALL errors
   - Commit: `[Ticket-{short_id} Step X] description`
   - Capture progress via curl

5. **After all steps for this ticket are done:**
   - Create `docs/RESULT-Ticket-{short_id}.md`
   - Capture RESULT as evidence
   - **Submit the commitment:**
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
   - **Close the commitment (pass):**
     ```bash
     curl -s -X POST "https://mentu-proxy.affihub.workers.dev/ops" \
       -H "X-Proxy-Token: $MENTU_TOKEN" \
       -H "X-Workspace-Id: $MENTU_WS" \
       -H "Content-Type: application/json" \
       -d '{"op":"close","commitment":"{cmt_id}","verdict":"pass","evidence":["{commit_sha}"],"summary":"Fixed: {title} -- merged to main, pushed"}'
     ```

6. **Move to next ticket.** Checkout the next branch and repeat.

### After ALL tickets are done

Output a summary table, then: <promise>{{COMPLETION_PROMISE}}</promise>

## Critical rules

- Run `{{BUILD_CMD}}` after EVERY step -- fix all errors before committing
- One commit per step: `[Ticket-{short_id} Step X] description`
- One branch per ticket -- don't mix fixes across branches
- Complete one ticket fully before moving to the next
- All Mentu ops via curl -- NEVER use mentu CLI

## Completion signal

When ALL tickets are fixed, all RESULTs created, all commitments submitted:
<promise>{{COMPLETION_PROMISE}}</promise>
````

---

### Phase 4: Output Launch Instructions (HANDOFF mode only)

```markdown
## Batch Ready: {N} Tickets

| # | Ticket | Branch | HANDOFF | Commitment | Tier | Steps |
|---|--------|--------|---------|------------|------|-------|
| 1 | mem_xxx | fix/ticket-{id1} | docs/HANDOFF-Ticket-{id1}.md | cmt_aaa | T1 | 2 |

**Total steps:** {sum}

### Launch Ralph
```
/ralph-loop Read and execute .ralph/PROMPT.md --completion-promise '{{COMPLETION_PROMISE}}' --max-iterations {recommended}
```

### After Completion
```bash
git push origin main
```
```

---

## Rules

1. **Always triage first.** Don't create HANDOFFs for garbage tickets.
2. **In normal mode, ask for confirmation** after showing triage results.
3. **In auto mode, skip confirmation** and fix inline.
4. **One branch per ticket.** Never mix fixes.
5. **Be specific in HANDOFFs.** Vague steps waste Ralph iterations.
6. **If only 1 ticket survives triage**, suggest using `/fix mem_xxx` instead.
7. **Cap at 5 tickets per batch** (or `--max N`). If more survive, pick top N by score.
8. **All Mentu ops via curl to proxy API.** Never use the `mentu` CLI.
