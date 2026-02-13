---
title: "Autopilot Deep Dive"
description: "How the mentu-autopilot wave pipeline works: the Ralph-Wiggum pattern, circuit breakers, state persistence, garbage filter gates, and tier estimation."
---

This page covers the internals of the `/run` autopilot mode — how waves are structured, how continuity works between agent sessions, how the system decides when to stop, and how evidence is tracked end to end.

## The Ralph-Wiggum Pattern

Claude Code sessions are stateless between invocations. The autopilot needs to run multiple waves, but each wave can exhaust the context window or hit session limits. The solution is the **Ralph-Wiggum pattern**: the plugin uses the Claude Code **Stop hook** to trigger continuation.

Here is how it works:

1. The `/run` command starts Wave 1 and processes a batch of tickets.
2. At the end of the wave, the agent writes state to `.ralph/autopilot-state.json` and exits.
3. The Stop hook fires, reads the state file, checks for circuit breakers, and — if more waves remain — automatically starts a new Claude Code session with the `/run` command and a `--resume` flag.
4. The new session reads the state file, picks up where the previous wave left off, and begins the next wave.
5. This repeats until a circuit breaker trips or `max-waves` is reached.

The name "Ralph-Wiggum" is a lighthearted internal reference — the agent keeps getting back up and continuing, wave after wave, with cheerful persistence.

## Wave Structure

Each wave follows a fixed sequence:

```
┌─────────────┐
│   Triage     │  Fetch bugs, run garbage filter, score survivors
└──────┬──────┘
       ▼
┌─────────────┐
│  Fix Top N   │  Run /fix on the N highest-scored tickets
└──────┬──────┘
       ▼
┌─────────────┐
│  Push All    │  Ensure all branches pushed, all PRs opened
└──────┬──────┘
       ▼
┌─────────────┐
│ Wave Summary │  Log results: passed, failed, skipped
└──────┬──────┘
       ▼
┌─────────────┐
│  Continue?   │  Check circuit breakers → next wave or stop
└─────────────┘
```

### Triage Phase

At the start of each wave, the full backlog is re-triaged. This ensures that:

- Tickets fixed in previous waves are no longer in the backlog.
- New tickets submitted between waves are picked up.
- Priority scores reflect the current state of the codebase.

### Fix Phase

Tickets are fixed sequentially, not in parallel. This is intentional:

- Each fix can change the codebase, which affects subsequent investigations.
- Sequential execution avoids merge conflicts between simultaneous branches.
- Evidence chains are cleaner when commits are ordered.

### Push Phase

After all fixes in the wave are complete, the agent ensures every branch has been pushed and every PR has been opened. This is a safety net — individual `/fix` runs push their own branches, but the wave-level push catches any that were deferred.

### Summary Phase

The wave summary is logged both locally and as a Mentu evidence entry on a wave-level commitment. It includes:

- Number of tickets attempted.
- Number passed (PR opened).
- Number failed (build failure, investigation dead-end).
- Number skipped (already claimed by another agent).
- Wall-clock time for the wave.

## Circuit Breakers

The autopilot will stop early under two conditions:

### Empty Wave Breaker

If **2 consecutive waves** produce **zero successful fixes**, the autopilot stops. This indicates one of:

- The backlog is empty (all bugs triaged out).
- All remaining bugs are unfixable by the current agent (T3+ complexity, missing context, etc.).
- An environmental issue is preventing fixes (build broken, API down).

The threshold is 2 (not 1) to tolerate a single bad wave caused by transient issues.

### Max Waves Breaker

When `--max-waves N` is reached, the autopilot stops regardless of remaining backlog. The default is 5 waves. This prevents runaway automation and keeps resource usage predictable.

## State Persistence

### Local State: `.ralph/autopilot-state.json`

The local state file is a **resume cache**, not the source of truth. It contains:

```json
{
  "version": 1,
  "currentWave": 3,
  "maxWaves": 5,
  "batchSize": 5,
  "completedWaves": [
    {
      "wave": 1,
      "passed": ["mem_a8f...", "mem_b4d..."],
      "failed": ["mem_c1a..."],
      "skipped": [],
      "durationMs": 124000
    },
    {
      "wave": 2,
      "passed": ["mem_d7e...", "mem_e9c...", "mem_f0b..."],
      "failed": [],
      "skipped": [],
      "durationMs": 187000
    }
  ],
  "consecutiveEmptyWaves": 0,
  "startedAt": "2025-01-15T10:30:00Z",
  "lastUpdatedAt": "2025-01-15T10:35:24Z"
}
```

If this file is deleted, the autopilot can reconstruct state from Mentu by querying recent commitments. The file exists purely for fast resume without API calls.

### Source of Truth: Mentu Ledger

The Mentu commitment ledger is the authoritative record. Every action taken by the autopilot is recorded as a commitment operation:

- `commit` — ticket planned.
- `claim` — ticket being worked on.
- `evidence(progress)` — intermediate steps captured.
- `evidence(build)` — build result captured.
- `evidence(pr)` — PR URL captured.
- `submit(pass)` — fix shipped successfully.
- `submit(fail)` — fix attempted but failed, with reason.

Any agent or human can query Mentu and fully reconstruct what happened, in what order, and why — without access to the local `.ralph/` directory.

## Evidence Chain Per Fix

Every fix produces a complete evidence chain on its Mentu commitment:

```
1. commit
   └─ payload: { memoryId, title, tier, branch }

2. claim
   └─ payload: { agentId, startedAt }

3. evidence (progress: investigation)
   └─ payload: { rootCause, affectedFiles, strategy }

4. evidence (progress: fix-applied)
   └─ payload: { filesChanged, linesAdded, linesRemoved }

5. evidence (build)
   └─ payload: { command: "npm run build", exitCode: 0, durationMs: 3200 }

6. evidence (review)
   └─ payload: { type: "UI", passes: 3, verdict: "approve" }

7. evidence (pr)
   └─ payload: { url: "https://github.com/org/repo/pull/142", number: 142 }

8. submit (pass)
   └─ payload: { evidence: [refs to items 3-7], closedAt, totalDurationMs }
```

If a fix fails at any stage, the commitment is submitted with `fail` status and the evidence chain shows exactly where it broke:

```
1. commit → 2. claim → 3. evidence (investigation) → 4. evidence (fix-applied)
→ 5. evidence (build: FAILED, exitCode: 1, stderr: "...")
→ 6. submit (fail, reason: "build failure after fix")
```

## The 5-Gate Garbage Filter

Not every bug report is worth fixing. The garbage filter runs five sequential gates, eliminating low-quality or irrelevant reports before any code investigation begins.

### Gate 1: Body Coherence

**Question:** Does the report contain a meaningful description?

Eliminates reports with:
- Empty or near-empty bodies (fewer than 20 characters).
- Bodies that are just a title repeated.
- Random strings, keyboard smashes, or test submissions ("asdf", "test", "xxx").
- Bodies in languages the agent cannot process (if applicable).

### Gate 2: Test Detection

**Question:** Is there a reproduction path or observable symptom?

Eliminates reports that describe only a vague feeling ("something feels slow", "it looks wrong") without:
- Steps to reproduce.
- A specific page or action where the bug occurs.
- An error message, screenshot, or console output.
- A before/after description of expected vs. actual behavior.

This gate does not require a formal test case — a clear description of "I clicked X and saw Y instead of Z" is sufficient.

### Gate 3: Project Match

**Question:** Does the bug belong to this project's domain?

Eliminates reports that:
- Reference pages, features, or URLs that do not exist in the current project.
- Describe issues in third-party services (e.g., "Stripe is down").
- Are clearly intended for a different project in the same workspace.

The gate uses the project's route structure, component names, and domain terminology to assess relevance.

### Gate 4: Duplicate Collapse

**Question:** Is this a duplicate of an already-triaged or already-fixed bug?

Eliminates reports that:
- Describe the same symptom as an open commitment (already being worked on).
- Match a recently closed commitment (already fixed, pending deploy).
- Share the same root cause as another surviving report (keep the higher-scored one).

Similarity is assessed on symptoms, affected page/component, and error signatures — not just title matching.

### Gate 5: Actionability

**Question:** Can this be fixed with the available codebase and tools?

Eliminates reports where:
- The fix requires backend/database changes but the agent only has frontend access.
- The fix requires credentials, API keys, or third-party dashboard access.
- The bug is environment-specific (works on the reporter's machine but not reproducible).
- The fix would require a design decision that a human should make.

## Tier Estimation

After a ticket survives the garbage filter, the agent estimates its complexity tier:

### T1 — Simple

**Estimated effort:** Under 2 minutes.

Typical fixes:
- CSS property changes (color, spacing, layout).
- Text or label corrections.
- Config value adjustments.
- Single-line logic fixes (off-by-one, wrong operator, missing null check).
- Import path corrections.

### T2 — Moderate

**Estimated effort:** 2 to 10 minutes.

Typical fixes:
- Multi-line logic changes within a single component or function.
- Component-level refactors (restructuring JSX, adjusting props).
- State management fixes (incorrect React Query key, missing invalidation).
- Adding a missing validation rule or error handler.
- Adjusting a hook's dependencies or return value.

### T3 — Complex

**Estimated effort:** 10+ minutes.

Typical fixes:
- Changes spanning 3 or more files across different domains.
- Database schema changes or migration requirements.
- Permission/RLS policy modifications.
- Cross-cutting concerns (adding a new field that flows through form, API, database, and display).
- Performance optimizations requiring query restructuring or caching strategy.

The tier affects how the autopilot schedules work:
- T1 and T2 tickets are preferred in batch runs to maximize throughput.
- T3 tickets are attempted only when T1/T2 options are exhausted, or when the backlog is small enough to afford the time investment.
