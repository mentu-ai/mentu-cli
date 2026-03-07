---
name: fix
description: Investigate a Mentu bug ticket, explore the codebase, then create a HANDOFF + Ralph PROMPT to fix it.
---

Investigate a Mentu bug ticket, explore the codebase, then create a HANDOFF + Ralph PROMPT to fix it.

**Usage:** `/fix <mem_id>` -- e.g., `/fix mem_6534dx1x`

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

---

## Arguments

The ticket ID: **$ARGUMENTS**

If no argument is provided, ask the user for the `mem_*` ID (suggest running `/triage` first).

---

## Instructions

### Phase 1: Fetch & Parse Ticket

1. Fetch the ticket from Mentu:
```bash
curl -s "https://mentu-proxy.affihub.workers.dev/memories" \
  -H "X-Proxy-Token: $MENTU_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WS"
```

2. Find the memory matching the provided ID from the response.

3. Parse the bug body to extract:
   - **Title**: from the memory title/body header
   - **Affected page**: from `page_url` metadata or body content
   - **Priority**: from metadata or body
   - **Description**: the core bug description
   - **Expected vs Actual**: if present in the body
   - **Error messages**: any errors, console logs, stack traces
   - **Screenshots**: any screenshot URLs referenced
   - **Browser/device info**: if present

4. Present a brief summary:
```
Ticket: mem_xxx
Title: {title}
Priority: {priority}
Page: {page_url}
Description: {1-2 sentence summary}
```

### Phase 2: Investigate Codebase

Based on the affected page and description:

1. **Find the route**: Search for the route that matches the page URL (check route config files, App.tsx, router config, etc.)
2. **Find the page component**: Read the page component file
3. **Find related components**: Use Grep/Glob to find components referenced by the page
4. **Find related hooks**: Check for data hooks used by the affected components
5. **Read the relevant files**: Read each file to understand the current implementation

Present investigation findings:
```
## Investigation

**Route:** /path -> src/pages/Page.tsx
**Components involved:**
  - src/components/X.tsx (likely culprit)
  - src/components/Y.tsx (related)
**Hooks:** useHookA, useHookB
**Root cause hypothesis:** {your analysis}
```

### Phase 3: Estimate Tier

Based on investigation:
- **T1 (1-3 files, < 50 lines changed):** Simple UI fix, typo, style adjustment, single component bug
- **T2 (3-8 files, 50-200 lines):** Multi-component fix, logic bug, data flow issue
- **T3 (8+ files, 200+ lines):** Architectural issue, cross-cutting concern, major refactor

State the tier and reasoning.

### Phase 4: Create Branch

```bash
git checkout -b fix/ticket-{short_id}
```

Where `{short_id}` is the last 8 chars of the mem_id (e.g., `mem_6534dx1x` -> `6534dx1x`).

### Phase 5: Create Lightweight Bug PRD

Create `docs/PRD-Ticket-{short_id}.md` -- a **lightweight** bug PRD:

```markdown
---
mentu:
  commitment: pending
  status: pending
  source: {mem_id}
type: bug-fix
tier: {T1|T2|T3}
---

# Bug Fix: {title}

## Source Ticket
- **ID:** {mem_id}
- **Priority:** {priority}
- **Page:** {page_url}

## Problem
{Description of what is broken, from the ticket + investigation}

## Root Cause
{Your analysis from the investigation phase}

## Affected Files
{List of files that need changes, from investigation}

## Fix Approach
{Brief description of the fix strategy}

## Acceptance Criteria
- [ ] {The bug described in the ticket is fixed}
- [ ] Build passes
- [ ] No regressions in related functionality
```

Capture evidence via curl to proxy API.

### Phase 6: Create HANDOFF

Create `docs/HANDOFF-Ticket-{short_id}.md` with 2-5 concrete fix steps:

```markdown
---
mentu:
  commitment: pending
  status: pending
execution: ralph-loop
author_type: executor
tier: {T1|T2|T3}
---

# HANDOFF: Fix {title}

## Context
{1-2 sentences: what is broken and why}

## Build Order

### Step 1: {Fix description}

{What this step does}

**Files to modify:**
- `{path}` -- {what changes}

**Implementation:**
{Specific code changes needed -- be precise about what to change}

**Verification:**
```bash
{BUILD_CMD}
```

**Commit:** `[Ticket-{short_id} Step 1] {description}`

### Step 2: {If needed}
...

## Final Checklist
- [ ] Build passes
- [ ] Bug from ticket is resolved
- [ ] All steps committed with `[Ticket-{short_id} Step N]` format
- [ ] RESULT document created
- [ ] Mentu commitment submitted
```

Key rules for the HANDOFF:
- **Be specific.** Do not say "fix the button" -- say "In `src/components/X.tsx`, change the onClick handler to call `handleSubmit()` instead of `handleClick()`".
- **Include file paths.** Every step must list exact files to modify.
- **Keep it short.** Bug fixes are 2-5 steps, not 15.
- **Each step must build.** No intermediate broken states.

Capture evidence via curl to proxy API.

### Phase 7: Commit to Mentu

1. Create commitment:
```bash
curl -s -X POST "https://mentu-proxy.affihub.workers.dev/ops" \
  -H "X-Proxy-Token: $MENTU_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WS" \
  -H "Content-Type: application/json" \
  -d '{
    "op": "commit",
    "body": "Fix: {title} -- {short description of fix approach}",
    "source": "{mem_id}",
    "actor": "'"$ACTOR"'",
    "meta": {
      "priority": "{priority}",
      "estimated_effort": "{T1=small, T2=medium, T3=large}",
      "branch": "fix/ticket-{short_id}"
    }
  }'
```

2. Save the returned `cmt_*` ID. Then immediately **claim** it:
```bash
curl -s -X POST "https://mentu-proxy.affihub.workers.dev/ops" \
  -H "X-Proxy-Token: $MENTU_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WS" \
  -H "Content-Type: application/json" \
  -d '{"op":"claim","commitment":"{cmt_id}"}'
```

3. Update PRD and HANDOFF `mentu.commitment` field with the returned `cmt_*` ID (ONE TIME, then frozen).

### Phase 8: Generate Ralph PROMPT

Create `.ralph/PROMPT.md` with the commitment baked in:

````markdown
Read the fix plan before writing any code:
- `docs/HANDOFF-Ticket-{short_id}.md` -- staged fix steps
- `docs/PRD-Ticket-{short_id}.md` -- bug context and root cause

## Your job

Fix the bug described in ticket {mem_id}: {title}. The fix involves {brief scope}. After all steps pass and build is clean, create a RESULT document and submit the commitment.

**Mentu commitment**: `{cmt_id}`

## How to work each iteration

1. **Check progress:** Run `git log --oneline -10` to see what is already done.
2. **First iteration only -- claim the commitment** (skip if already claimed):
   ```bash
   MENTU_TOKEN=$(grep '^{TOKEN_VAR}=' .env | cut -d'"' -f2)
   MENTU_WS=$(grep '^{WS_VAR}=' .env | cut -d'"' -f2)
   curl -s -X POST "https://mentu-proxy.affihub.workers.dev/ops" \
     -H "X-Proxy-Token: $MENTU_TOKEN" \
     -H "X-Workspace-Id: $MENTU_WS" \
     -H "Content-Type: application/json" \
     -d '{"op":"claim","commitment":"{cmt_id}"}'
   ```
3. **Pick the next uncompleted step.** Do NOT skip ahead or repeat work.
4. **Read the HANDOFF** for step details.
5. **Build the fix.** Follow the HANDOFF instructions exactly.
6. **Verify:** `{BUILD_CMD}` -- fix ALL errors before committing.
7. **Commit:** `[Ticket-{short_id} Step X] Brief description`
8. **Capture progress** via curl to proxy API.
9. **If build fails after 3+ tries**, close as failed and abandon branch.

---

{Steps copied verbatim from the HANDOFF}

---

## After ALL steps are complete

1. Create RESULT document at `docs/RESULT-Ticket-{short_id}.md`
2. Capture RESULT as evidence
3. Submit commitment
4. Close commitment (pass)
5. Final verification: `{BUILD_CMD}`

Output: <promise>COMPLETE</promise>

## Critical rules

- Read CLAUDE.md and follow all project conventions
- Run `{BUILD_CMD}` after EVERY step
- One commit per step: `[Ticket-{short_id} Step X] description`
- `mentu:` YAML fields are write-once, then frozen

## Completion signal

When ALL steps complete, RESULT created, and commitment submitted:
<promise>COMPLETE</promise>
````

### Phase 9: Output Launch Instructions

Present the final summary:

```markdown
## Ready to Fix: {title}

**Ticket:** {mem_id}
**Branch:** fix/ticket-{short_id}
**Commitment:** {cmt_id}
**Tier:** {tier} ({step_count} steps)

### Review the Plan
```bash
cat docs/HANDOFF-Ticket-{short_id}.md
```

### Launch Ralph
```bash
ralph run
```

### After Completion
```bash
/review TicketFix
git push origin fix/ticket-{short_id}
gh pr create --title "Fix: {title}"
```
```

---

## Rules

1. **Investigate before planning.** Do not write the HANDOFF until you have read the actual code.
2. **Be specific in the HANDOFF.** Vague steps waste Ralph iterations.
3. **Keep bug HANDOFFs short.** 2-5 steps. If it needs more, it is probably T3 and you should say so.
4. **Do not fix the bug yourself.** Your job is to investigate and plan. Ralph does the fix.
5. **If the ticket is garbage** (fails the 5-gate filter from `/triage`), say so and suggest running `/triage` instead.
6. **The branch is created but empty.** No code changes happen in this command.
