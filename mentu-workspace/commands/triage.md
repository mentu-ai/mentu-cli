---
name: triage
description: Daily ticket triage dashboard. Fetches Mentu bugs, filters garbage, and presents actionable tickets.
---

Daily ticket triage dashboard. Fetches all Mentu bugs, filters garbage, and presents actionable tickets.

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
```

Read project domains from `.mentu/manifest.yaml` if present (field: `project_domains`), otherwise infer from the repository name and common patterns (localhost, vercel.app variants).

---

## Instructions

Run a daily triage of all Mentu bug tickets. Present a clean dashboard the user can act on.

### Step 1: Fetch Data

Make these two API calls in parallel:

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

Also check for existing fix branches:
```bash
git branch --list 'fix/ticket-*'
```

### Step 2: Apply 5-Gate Garbage Filter

For each memory, run it through these gates **in order**. If a ticket fails any gate, it is filtered out. Track the reason for each rejection.

**Gate 1 -- Body Coherence**
Reject if the body (after stripping markdown formatting) has < 20 characters of real content, or is unintelligible gibberish (random characters, single words with no context).

**Gate 2 -- Test Detection**
Reject if ANY of these match (case-insensitive):
- Title or body contains: "test", "testing", "E2E", "verificacion del flujo", "prueba", "token test", "hello there"
- The `source` metadata is `localhost` AND the title looks like a test (short, generic, or contains test-related keywords)
- Body is clearly a test submission (e.g., "This is a test bug report", "Testing the form")

**Gate 3 -- Project Match**
Reject if `page_url` in metadata points to a domain that is NOT one of the project domains. Empty/missing page_url is OK (form-submitted tickets may not have one). Reject tickets clearly from other projects.

**Gate 4 -- Duplicate Collapse (Regression-Aware)**
Compare tickets with the same or nearly identical titles:
- If NEITHER has a closed commitment -> collapse as duplicate (keep newest only, same day)
- If one has a `CLOSED:PASS` commitment -> keep BOTH (newer is a regression, not a duplicate)
- If one has a `CLOSED:FAIL` commitment -> keep newer, skip older (superseded)
- Default: same/near-identical title + same day + no closed commitments -> keep newest, mark older as duplicates.

**Gate 5 -- Actionability**
Reject if the ticket has only a title with no meaningful description -- there must be enough information to understand what is broken and where.

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

### Step 4: Cross-Reference Status (State-Aware)

For each surviving ticket, derive its lifecycle state from the commitment's latest op:

| Commitment State | Display Status | Actionable? |
|-----------------|---------------|-------------|
| No commitment | `OPEN` | Yes -- needs fixing |
| Committed (no claim yet) | `COMMITTED` | No -- already planned |
| Claimed / In-Progress | `IN PROGRESS` | No -- being worked on |
| Submitted (not yet closed) | `SUBMITTED` | No -- awaiting verification |
| Closed: pass | `RESOLVED` | No -- already fixed |
| Closed: fail | `FAILED` | Yes -- retry candidate |

Also check for git branches: `fix/ticket-{short_id}` -> if present, at least `IN PROGRESS`.

**Only `OPEN` and `FAILED` tickets are actionable.** Skip all others in the Actionable table -- show them in the In Progress / Resolved table instead.

### Step 5: Present Dashboard

Output the dashboard in this exact format:

```markdown
# Ticket Triage -- {today's date}

## Actionable ({count})
| # | ID | Priority | Score | Title | Page | Status |
|---|-----|----------|-------|-------|------|--------|
| 1 | mem_xxx | medium | 5.2 | Short title | /page | OPEN |
| 2 | mem_yyy | high   | 4.8 | Short title | /page | FAILED |

## Filtered Out ({count})
  - {N} junk/test tickets ({list abbreviated reasons})
  - {N} duplicate pairs collapsed
  - {N} wrong-project tickets
  - {N} low-actionability tickets

## In Progress / Resolved ({count})
| ID | Title | Status | Commitment | Source |
|----|-------|--------|------------|--------|
| mem_xxx | Short title | COMMITTED | cmt_aaa | mem_xxx |
| mem_yyy | Short title | IN PROGRESS | cmt_bbb | mem_yyy |
| mem_zzz | Short title | RESOLVED | cmt_ccc | mem_zzz |

## Suggested Next
  -> `/fix {top_ticket_id}`   ({reason -- e.g., "clearest ticket, UI fix, ~T1"})
  -> If FAILED tickets exist: `/fix {failed_ticket_id}` (retry -- previous attempt failed: {reason})
```

### Rules

1. **Be aggressive with filtering.** The whole point is to cut noise. When in doubt, filter it out.
2. **Show filtered reasons** so the user can verify nothing real was dropped.
3. **The dashboard is read-only.** Do not create commitments, do not modify tickets, do not create branches. Just report.
4. **If ALL tickets are garbage**, say so clearly: "No actionable tickets found. {N} total filtered."
5. **Keep it fast.** This should take ~30 seconds, not minutes. Do not over-analyze each ticket.
