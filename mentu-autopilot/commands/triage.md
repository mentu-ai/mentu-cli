---
description: "Read-only triage dashboard — fetch Mentu bugs, 5-gate filter, score and present"
allowed-tools: ["mcp__mentu__mentu_list_memories", "mcp__mentu__mentu_list_commitments", "mcp__mentu__mentu_get_status", "mcp__mentu__mentu_dismiss", "mcp__mentu__mentu_triage", "Bash(git:*)", "Read", "Glob", "Grep"]
---

# Mentu Triage

Read-only triage dashboard. Fetches all Mentu bugs, filters garbage, scores survivors, and presents an actionable table. **No code modifications — just reporting and dismissals.**

## Instructions

### Step 1: Fetch Data

Use MCP tools in parallel:

1. **mentu_list_memories** — fetch all memories (set limit to 200)
2. **mentu_list_commitments** — fetch existing commitments
3. **git branch --list 'fix/ticket-*'** — check existing fix branches

### Step 2: Apply 5-Gate Garbage Filter

For each memory, run through these gates **in order**. Failure at any gate = filtered out. Track rejection reasons.

**Gate 1 — Body Coherence**
Reject if the body (after stripping markdown formatting) has < 20 characters of real content, or is unintelligible gibberish (random characters, single words with no context like "PAREJAA 4", "asdf", etc.).

**Gate 2 — Test Detection**
Reject if ANY of these match (case-insensitive):
- Title or body contains: "test", "testing", "E2E", "verificacion del flujo", "prueba", "token test", "hello there"
- The source metadata is `localhost` AND the title looks like a test (short, generic, or test keywords)
- Body is clearly a test submission ("This is a test bug report", "Testing the form")

**Gate 3 — Project Match**
Reject if `page_url` in metadata points to a domain that does NOT contain the project name, `localhost`, or a deployment URL. Empty/missing page_url is OK.

**Gate 4 — Duplicate Collapse**
If multiple tickets have the same title (or nearly identical titles after normalization) AND were created in the same session/day, keep only the newest one. Mark older ones as duplicates.

**Gate 5 — Actionability**
Reject if the ticket has only a title with no meaningful description — there must be enough information to understand what's broken and where.

### Step 3: Score Surviving Tickets

For each ticket that passes all 5 gates, compute a triage score:

```
score = priority_weight x age_factor x description_quality x scope_estimate

Where:
  priority_weight:  critical=10, high=7, medium=4, low=2, p1/major=8, (missing)=3
  age_factor:       1.0 + (days_old x 0.1), capped at 2.0
  description_quality: 0.5 (title only) | 0.8 (brief desc) | 1.0 (detailed with steps/context)
  scope_estimate:   1.0 (single component) | 0.8 (multi-file) | 0.6 (architectural)
```

Sort by score descending.

### Step 4: Cross-Reference Status

For each surviving ticket, check:
- Is there already a commitment linked to this memory? -> status: `committed`
- Is there a git branch `fix/ticket-{short_id}`? -> status: `in-progress`
- Otherwise -> status: `new`

### Step 5: Dismiss Junk

Use **mentu_dismiss** for clearly junk memories (test submissions, gibberish) with a reason.

### Step 6: Record Triage

Use **mentu_triage** to record the triage session with reviewed memory IDs, summary, and decisions.

### Step 7: Present Dashboard

```markdown
# Ticket Triage — {today's date}

## Actionable ({count})
| # | ID | Priority | Score | Title | Page | Status |
|---|-----|----------|-------|-------|------|--------|
| 1 | mem_xxx | medium | 5.2 | Short title | /page | new |
| 2 | mem_yyy | high   | 4.8 | Short title | /page | committed |

## Filtered Out ({count})
  - {N} junk/test tickets ({list abbreviated reasons})
  - {N} duplicate pairs collapsed
  - {N} wrong-project tickets
  - {N} low-actionability tickets

## Active Commitments ({count})
| ID | Title | Status | Source |
|----|-------|--------|--------|
| cmt_xxx | Description | state | mem_xxx |

## Suggested Next
  -> `/fix {top_ticket_id}`   ({reason})
```

## Rules

1. **Be aggressive with filtering.** When in doubt, filter it out.
2. **Show filtered reasons** so the user can verify nothing real was dropped.
3. **Read-only for code.** Don't create commitments, don't create branches.
4. **If ALL tickets are garbage**, say so: "No actionable tickets found. {N} total filtered."
5. **Keep it fast.** ~30 seconds, not minutes.
6. **All Mentu operations via MCP tools.** No curl. No .env scanning.
