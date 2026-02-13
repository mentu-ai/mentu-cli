---
description: "Investigate + fix a single Mentu bug ticket end-to-end"
allowed-tools: ["mcp__mentu__mentu_list_memories", "mcp__mentu__mentu_list_commitments", "mcp__mentu__mentu_commit", "mcp__mentu__mentu_claim", "mcp__mentu__mentu_capture", "mcp__mentu__mentu_submit", "mcp__mentu__mentu_annotate", "Bash(npm:*)", "Bash(git:*)", "Bash(gh:*)", "Read", "Write", "Edit", "Glob", "Grep"]
argument-hint: "<mem_id>"
---

# Mentu Fix

Investigate a single Mentu bug ticket, create branch + HANDOFF, fix the bug, verify build, push + PR, and submit the commitment. Full end-to-end for one ticket.

**Usage:** `/fix <mem_id>` — e.g., `/fix mem_6534dx1x`

## Instructions

### Phase 1: Fetch Ticket

The ticket ID is: **$ARGUMENTS**

If no argument is provided, ask the user for the `mem_*` ID (suggest running `/triage` first).

Use **mentu_list_memories** to fetch memories, then find the one matching the ID. Extract:
- **Title**: from the memory body header
- **Affected page**: from metadata `page_url`
- **Priority**: from metadata
- **Description**: the core bug description
- **Error messages**: any errors, console logs, stack traces

Present a brief summary:
```
Ticket: {mem_id}
Title: {title}
Priority: {priority}
Page: {page_url}
Description: {1-2 sentence summary}
```

### Phase 2: Investigate Codebase

Based on the affected page and description:

1. Check `package.json` for framework detection (Next.js, Vite+React, etc.)
2. Search for the route matching the page URL
3. Find the page component
4. Find related components and hooks
5. Check utilities and type definitions

Present:
```markdown
## Investigation

**Stack:** {detected stack}
**Route:** {path} -> {file}
**Components:** {files} ({roles})
**Root cause:** {hypothesis}
```

### Phase 3: Estimate Tier

- **T1 (1-3 files, < 50 lines):** Simple fix
- **T2 (3-8 files, 50-200 lines):** Multi-component fix
- **T3 (8+ files, 200+ lines):** Architectural

### Phase 4: Create Branch

```bash
git checkout -b fix/ticket-{short_id}
```

### Phase 5: Create HANDOFF

Create `docs/HANDOFF-Ticket-{short_id}.md` with 2-5 concrete fix steps.

### Phase 6: Create Mentu Commitment + Claim

Use **mentu_commit**: body="Fix: {title}", source={mem_id}

Update HANDOFF's `mentu.commitment` with returned `cmt_*` ID (one-time, frozen).

Use **mentu_claim**: commitment={cmt_id}

### Phase 7: Fix the Bug

For each HANDOFF step:
1. Make code changes
2. Build and verify (`npm run build` or project build command)
3. `git add {files} && git commit -m "[Ticket-{short_id} Step N] {description}"`
4. Use **mentu_capture**: body="[Ticket-{short_id} Step N] done", kind="execution-progress"

### Phase 8: Final Verification

Build verification:
Use **mentu_capture**: body="Build PASS for fix/ticket-{short_id}", kind="validation"

### Phase 9: Push + PR

```bash
git push origin fix/ticket-{short_id} -u
gh pr create --title "Fix: {title}" --body "..." --head fix/ticket-{short_id} --base main
```

Use **mentu_capture**: body="PR: {pr_url}", kind="document"

### Phase 10: Submit Commitment

Use **mentu_submit**: commitment={cmt_id}, evidence=[list of mem_ids from captures], summary="Fixed: {title}"

## Rules

1. **Investigate before fixing.** Read the source files first.
2. **Build after EVERY step.**
3. **One commit per step:** `[Ticket-{short_id} Step N] description`
4. **Full evidence chain.** Every state transition via MCP tools.
5. **Stack-aware.** Follow detected framework conventions.
6. **All Mentu via MCP tools.** No curl. No .env scanning.
