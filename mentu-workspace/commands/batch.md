---
name: batch
description: Batch triage + fix. Filter all Mentu bugs, investigate survivors, create per-ticket HANDOFFs, then generate one master Ralph PROMPT.
---

Batch triage + fix: filter all Mentu bugs, investigate survivors, create per-ticket HANDOFFs, then generate one master Ralph PROMPT that fixes them sequentially.

---

## Configuration

Read runtime config from `.mentu/manifest.yaml`:
- `actor` — agent identity
- `workspace` — Mentu workspace ID
- `build_cmd` — build command
- `token_env_var` — env var name for API token
- `workspace_env_var` — env var name for workspace ID
- `dev_port` — dev server port

Read credentials from `.env` using the env var names from manifest:
```bash
TOKEN_VAR=$(grep '^token_env_var' .mentu/manifest.yaml | awk '{print $2}' | tr -d '"')
WS_VAR=$(grep '^workspace_env_var' .mentu/manifest.yaml | awk '{print $2}' | tr -d '"')
MENTU_TOKEN=$(grep "^${TOKEN_VAR}=" .env | cut -d'"' -f2)
MENTU_WS=$(grep "^${WS_VAR}=" .env | cut -d'"' -f2)
ACTOR=$(grep '^actor' .mentu/manifest.yaml | awk '{print $2}' | tr -d '"')
BUILD_CMD=$(grep '^build_cmd' .mentu/manifest.yaml | awk '{print $2}' | tr -d '"')
```

Read project domains from `.mentu/manifest.yaml` field `project_domains` if present.

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

3. **Exclude tickets that already have commitments** -- do not re-plan work already committed.

4. Score and sort survivors by: `priority_weight x age_factor x description_quality`

5. Present the triage summary:

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

**STOP HERE and ask the user for confirmation before proceeding.** Show the list and ask:
> "These {N} tickets will get HANDOFFs and a batch Ralph PROMPT. Proceed? (You can also exclude specific tickets by number.)"

---

### Phase 2: Investigate All Tickets

For EACH surviving ticket (in priority order):

1. Parse the bug body: affected page, description, errors, expected vs actual
2. Find the route in the codebase
3. Find the page component and related components (Grep/Glob)
4. Read the relevant files
5. Determine root cause hypothesis
6. Estimate tier (T1/T2/T3)

Present a brief investigation summary per ticket:

```markdown
### Ticket 1: mem_xxx -- {title}
**Route:** /path -> src/pages/Page.tsx
**Files:** src/components/X.tsx, src/components/Y.tsx
**Root cause:** {hypothesis}
**Tier:** T1 (2 steps)
```

---

### Phase 3: Create Branches + HANDOFFs

For EACH ticket:

1. **Create branch:**
   ```bash
   git branch fix/ticket-{short_id}
   ```
   (Do not checkout -- just create them all from current HEAD. Ralph will checkout each one as it works.)

2. **Create lightweight PRD** at `docs/PRD-Ticket-{short_id}.md` with mentu YAML, source ticket info, root cause, affected files, fix approach, and acceptance criteria.

3. **Create HANDOFF** at `docs/HANDOFF-Ticket-{short_id}.md` with 2-5 concrete fix steps per ticket. Each step must list exact files, specific changes, verification command, and commit message format.

4. **Capture evidence** for each HANDOFF via curl to proxy API.

5. **Create commitment** for each ticket via curl to proxy API. Save the returned `cmt_*` ID, then immediately **claim** it.

6. **Update PRD and HANDOFF** with the returned `cmt_*` ID (one-time, then frozen).

---

### Phase 4: Generate Master Ralph PROMPT

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
2. If on `main`, start with Ticket #1.
3. If on a `fix/ticket-*` branch, check if all steps are committed. If yes, move to next ticket.

### Per-ticket workflow

1. Checkout the branch
2. Read the HANDOFF
3. Claim the commitment (first time only) via curl
4. Work each step: build fix, verify, commit, capture progress
5. After all steps done: create RESULT, capture evidence, submit commitment, close (pass)
6. Move to next ticket

### After ALL tickets are done

Output summary table and: <promise>COMPLETE</promise>

## Critical rules

- Read CLAUDE.md and follow all project conventions
- `{BUILD_CMD}` after EVERY step
- One commit per step: `[Ticket-{short_id} Step X] description`
- One branch per ticket -- do not mix fixes
- Complete one ticket fully before moving to the next
- `mentu:` YAML fields are write-once, then frozen
````

---

### Phase 5: Output Launch Instructions

```markdown
## Batch Ready: {N} Tickets

| # | Ticket | Branch | HANDOFF | Commitment | Tier | Steps |
|---|--------|--------|---------|------------|------|-------|
| 1 | mem_xxx | fix/ticket-{id1} | docs/HANDOFF-Ticket-{id1}.md | cmt_aaa | T1 | 2 |
| 2 | mem_yyy | fix/ticket-{id2} | docs/HANDOFF-Ticket-{id2}.md | cmt_bbb | T2 | 3 |

**Total steps:** {sum}
**Estimated iterations:** {sum + (N x 3) + 5}

### Launch Ralph
```bash
ralph run
```

### After Completion
```bash
# Push all branches
git push origin fix/ticket-{id1} fix/ticket-{id2}

# Create PRs (one per ticket)
for branch in fix/ticket-{id1} fix/ticket-{id2}; do
  git checkout $branch
  gh pr create --title "Fix: $(git log --oneline -1 | cut -d']' -f1 | cut -d'[' -f2)"
done
```
```

---

## Rules

1. **Always triage first.** Do not create HANDOFFs for garbage tickets.
2. **Ask for confirmation** after showing the triage results, before creating HANDOFFs.
3. **One branch per ticket.** Never mix fixes. Ralph checks out each branch separately.
4. **Complete sequentially.** Ralph finishes ticket 1 completely before starting ticket 2.
5. **Be specific in HANDOFFs.** Vague steps waste Ralph iterations across ALL tickets -- compounds fast.
6. **If only 1 ticket survives triage**, suggest using `/fix mem_xxx` instead (simpler).
7. **Cap at 5 tickets per batch.** If more survive, pick the top 5 by score and suggest running `/batch` again later.
