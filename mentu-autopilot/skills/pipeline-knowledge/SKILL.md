# Mentu Autopilot Pipeline Knowledge

This skill provides background knowledge for the Mentu Autopilot bug-fix pipeline. Auto-loaded when any autopilot command or agent runs.

---

## Mentu Is a Commitment Ledger, Not a Task Tracker

Mentu is append-only, evidence-bound, and coordination-first. Treat it accordingly:

- **Never mutate** — only append new evidence. No updates, no deletes.
- **Every state transition gets evidence** — wave start, build pass/fail, PR created, circuit breaker, wave complete. If it happened, capture it.
- **Commitments have a lifecycle**: created -> claimed -> steps progressed -> submitted. Each transition is a separate append.
- **Coordination surface** — any agent or human can query Mentu and reconstruct the full pipeline state without local files.
- **Local state is cache, Mentu is truth** — `.claude/autopilot.local.md` is a wave-management hint for the Stop hook; the real state lives in the Mentu ledger.

---

## MCP Tools (via @mentu/mcp)

**All operations go through MCP tools.** No curl. No .env scanning. Configuration via env vars or `.mentu.json`.

### Read Operations

| MCP Tool | Purpose |
|----------|---------|
| `mentu_get_status` | Pipeline health summary |
| `mentu_list_memories` | List bug tickets (with limit, offset, kind, since filters) |
| `mentu_list_commitments` | List commitments (with state, owner, tags filters) |

### Write Operations

| MCP Tool | Purpose |
|----------|---------|
| `mentu_commit` | Create commitment (body, source, tags) |
| `mentu_claim` | Claim for execution (commitment) |
| `mentu_capture` | Attach evidence (body, kind, refs) |
| `mentu_submit` | Submit with evidence (commitment, evidence[], summary) |
| `mentu_approve` | Approve submission (commitment, comment) |
| `mentu_close` | Direct close (commitment, evidence/duplicate_of) |
| `mentu_annotate` | Add note to memory/commitment (target, body) |
| `mentu_dismiss` | Dismiss junk memory (memory, reason) |
| `mentu_triage` | Record triage session (reviewed, summary, decisions) |

### Capture Kinds

| Kind | When |
|------|------|
| `document` | Creating a HANDOFF, PRD, or capturing PR link |
| `execution-progress` | Claiming a commitment, completing a step |
| `validation` | Build pass/fail, review results |
| `result-document` | Creating a RESULT document |
| `bug-report` | Bug report from reporter widget |

---

## Evidence Chain (Required for Every Fix)

Every fix — whether by the wave pipeline or single `/fix` command — must produce this evidence chain:

1. **Commitment created** — `mentu_commit(body="Fix: {title}", source={mem_id})`
2. **Commitment claimed** — `mentu_claim(commitment={cmt_id})`
3. **Per-step progress** — `mentu_capture(body="[Ticket-{id} Step N] done", kind="execution-progress")`
4. **Build verification** — `mentu_capture(body="Build PASS", kind="validation")`
5. **PR link** — `mentu_capture(body="PR: {url}", kind="document")`
6. **Commitment submitted** — `mentu_submit(commitment={cmt_id}, evidence=[...], summary="...")`

Missing any step means the fix is not properly recorded.

---

## Commitment Lifecycle

```
OPEN → CLAIMED → IN_REVIEW → CLOSED
                ↗               ↓
            REOPENED ←──────────┘
```

State transitions:
- `commit` → creates OPEN commitment
- `claim` → OPEN/REOPENED → CLAIMED
- `submit` → CLAIMED → IN_REVIEW
- `approve` → IN_REVIEW → CLOSED
- `reopen` → IN_REVIEW/CLOSED → REOPENED
- `close` (direct) → any → CLOSED
- `release` → CLAIMED → OPEN

---

## HANDOFF Format

```yaml
---
mentu:
  commitment: cmt_xxx    # Write-once, then frozen
  source: mem_xxx         # Source ticket ID
tier: T1                  # T1 | T2 | T3
project: project-name     # From package.json
stack: vite-react          # nextjs-app | nextjs-pages | vite-react | other
---
```

### Commit Convention

`[Ticket-{short_id} Step N] {brief description}`

Example: `[Ticket-6534dx1x Step 1] Fix null check in notification handler`

---

## Wave Loop (Ralph-Wiggum Pattern)

### How Waves Work

1. `/run` starts the wave pipeline
2. Claude executes: triage -> fix -> build -> push -> PR
3. Claude outputs `<promise>COMPLETE</promise>` when done
4. Stop hook increments wave, checks circuit breakers
5. Each new wave gets fresh context — re-reads Mentu

### Circuit Breaker

- 2 consecutive empty waves → halt
- Max waves reached → halt
- Capture halt reason to Mentu

---

## 5-Gate Garbage Filter

### Gate 1 — Body Coherence
< 20 chars of real content or gibberish = reject

### Gate 2 — Test Detection
"test", "testing", "E2E", "prueba", test submissions = reject

### Gate 3 — Project Match
page_url must contain project name, localhost, or deployment domain. Empty OK.

### Gate 4 — Duplicate Collapse
Same/near-identical title + same day = keep newest only

### Gate 5 — Actionability
Title-only with no description = reject

---

## Tier Estimation Guide

| Tier | Files | Lines Changed | Examples |
|------|-------|---------------|----------|
| T1 | 1-3 | < 50 | Missing null check, wrong CSS class, broken link |
| T2 | 3-8 | 50-200 | Form validation broken, query filter wrong, state sync |
| T3 | 8+ | 200+ | Auth flow broken, data model change, routing overhaul |

---

## Stack-Specific Conventions

### Vite + React Projects
- **Routing**: `src/App.tsx` with React Router
- **Pages**: `src/pages/`
- **Components**: `src/components/{domain}/`
- **Hooks**: `src/hooks/` (React Query wrappers)
- **Path alias**: `@/` -> `src/`
- **Brand system**: Never hardcode brand values — use `brand.*` from `@/brands`
- **State**: React Query for server, React Context for auth/theme
- **DB**: Supabase (RLS, auto-generated types)

### Next.js App Router
- **Routing**: `app/` directory (file-system routing)
- **Server vs Client**: Default Server Component; `"use client"` for interactivity
- **API Routes**: `app/api/`
- **Middleware**: `middleware.ts` at root
- **ORM**: Usually Prisma
- **Server Actions**: `"use server"` for mutations
- **Revalidation**: `revalidatePath()` / `revalidateTag()` after mutations

### Next.js Pages Router
- **Routing**: `pages/` directory
- **API Routes**: `pages/api/`
- **Data**: `getServerSideProps` / `getStaticProps`

---

## Pipeline Principles

### Backpressure over Prescription
Create quality gates that reject bad work:
- Build must pass after each step
- Commitment must be claimed before fixing
- Build failures captured as evidence

### Fresh Context per Wave
Each wave re-reads Mentu. Don't rely on context window memory.

### Evidence is Non-Negotiable
If it happened, capture it. The full chain is what makes the pipeline auditable and resumable.
