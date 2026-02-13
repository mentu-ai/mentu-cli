---
# ============================================================
# CANONICAL YAML FRONT MATTER
# ============================================================
id: INTENT-LedgerFirstMigration-v1.0
path: docs/INTENT-LedgerFirstMigration-v1.0.md
type: intent
intent: reference

version: "1.0"
created: 2026-01-12
last_updated: 2026-01-12

architect:
  actor: agent:claude-mentu
  session: ledger-first-planning
  context: conversation

tier_hint: T3

lineage:
  parent_plan: /Users/rashid/.claude/plans/sprightly-growing-reddy.md
  phase: 3
  sequence: "Stage 0-1 complete → Stages 2-7 (this)"
  depends_on:
    - INTENT-WorkflowOrchestratorInvocation-v1.0

mentu:
  commitment: pending
  status: awaiting_audit
---

# Strategic Intent: LedgerFirstMigration

> **Mode**: Architect
>
> You lack local filesystem access. Produce strategic intent only.
> State what and why. Do not specify file paths, schemas, or code.
> A local Leading Agent will audit and implement.

---

## What

Migrate from `bridge_commands` table to ledger-first orchestration. The Mentu ledger becomes the single source of truth for work routing. Introduce `dispatch` as the 13th operation type. Bridge daemons subscribe to the operations table instead of a separate bridge_commands table.

Genesis key governs machine affinity, concurrency limits, and tier-based execution rules.

---

## Why

**Problem**: Work routing is fragmented across two systems:
- `bridge_commands` table (routing decisions, execution state)
- `operations` table (evidence, commitments, lifecycle)

This creates:
- No audit trail for routing decisions
- Inconsistent state between tables
- No genesis governance over dispatch
- Complex multi-table queries

**Solution**: Unify routing into the ledger with `dispatch` operation.

**Value**:
- Single source of truth for all work lifecycle
- Genesis key governs routing (permissions, affinity, tiers)
- Full audit trail: who dispatched what, where, when
- Simpler queries (one table)
- Machine affinity and parallel execution from genesis configuration

**Strategic Context**:
```
CURRENT (Technical Debt)              FUTURE (Ledger-First)
─────────────────────────             ────────────────────────

bridge_commands table                 operations table (dispatch op)
    ↓                                     ↓
Bridge polls separate table           Bridge subscribes to ledger
    ↓                                     ↓
executeBugCommand()                   executeBugCommand() (SAME!)
```

---

## Constraints

- Must NOT change the execution pattern (Auditor→Executor is stable)
- Must NOT break in-flight work during migration
- Must support gradual migration (dual-mode before full cutover)
- Must NOT require Supabase schema changes that break existing queries
- Must work on both Mac and VPS simultaneously
- Must maintain atomic claiming semantics
- Must respect existing commitment states (open, claimed, in_review, closed)

---

## Expected Outcome

**User Perspective**:
- Bugs and workflows execute as before
- `mentu dispatch` command available for manual routing
- `mentu status` shows dispatch information
- Genesis key controls which machine handles which work

**Technical Verification**:

| Check | Verification |
|-------|--------------|
| Genesis schema | `execution:` section parses without error |
| Dispatch operation | `mentu dispatch cmt_xxx --machine vps-01` creates operation |
| Bridge subscription | Daemon logs show "Subscribed to dispatch operations" |
| Auto-dispatch | Autonomous commits create dispatch automatically |
| T3 blocking | T3 commits require approval before dispatch |
| Atomic claim | Only one machine claims a dispatched commitment |
| Scope compliance | Logs show file count and pattern warnings |
| Parallel execution | VPS handles 2 concurrent bugs (per genesis config) |

**Migration Milestones**:

| Stage | Milestone | Verification |
|-------|-----------|--------------|
| 1 | Genesis execution schema | Config parses, no behavior change |
| 2 | Dispatch operation exists | CLI command works, operation in ledger |
| 3 | Auto-dispatch at commit | Autonomous bugs get dispatched automatically |
| 4 | Bridge reads from ledger | Daemon uses operations, not bridge_commands |
| 5 | Dual-mode works | Both tables read, only ledger written |
| 6 | Parallel execution | Multiple bugs execute concurrently |
| 7 | bridge_commands deprecated | Table no longer written |

---

## Open Questions

- Should dispatch be reversible? (Can you re-dispatch after release?)
- What happens to in-flight bridge_commands during migration?
- Should we support machine pools? (dispatch to "vps-*" instead of specific machine)
- How long is the dual-mode period before full deprecation?
- Should dispatch operations have their own lifecycle (pending→claimed→completed)?
- How do we handle daemon restarts with in-flight work?

---

## Context

**The Dispatch Operation**:

```typescript
interface DispatchOperation {
  op: "dispatch";
  ts: string;
  actor: string;
  payload: {
    target: string;           // commitment ID
    machine: string;          // "vps-01", "mac-local"
    timeout_seconds?: number;
    working_directory: string;
    flags?: string[];
  };
}
```

**Dispatch vs Claim Semantics**:

| Operation | Purpose | Who Creates | When |
|-----------|---------|-------------|------|
| dispatch | Routing intent | System or Human | At commit (auto) or later (manual) |
| claim | Execution ownership | Bridge daemon | When starting execution |

Both needed: dispatch for routing, claim for ownership.

**Genesis Key Execution Schema**:

```yaml
execution:
  machines:
    vps-01:
      host: "208.167.255.71"
      path: "/home/mentu/Workspaces"
      affinity:
        tags: [visual-test, screenshot, browser, long-running]
        kinds: [visual-evidence, browser-automation]
      concurrency: 2

    mac-local:
      path: "/Users/rashid/Desktop/Workspaces"
      affinity:
        tags: [quick-fix, development]
        default: true
      concurrency: 1

  tiers:
    T1:
      auto_execute: true
      max_parallel: 3
    T2:
      auto_execute: true
      max_parallel: 1
    T3:
      auto_execute: false
      max_parallel: 0

  queue:
    strategy: "priority"
    poll_interval: 5
```

**T3 Approval Flow**:

```
T3 commit → state: "pending_approval"
         ↓
Human: mentu approve cmt_xxx
         ↓
System: Creates dispatch operation
         ↓
Bridge claims and executes
```

**Multi-Machine Tie-Breaking**:

Strategy: First to claim wins.

```sql
UPDATE commitments
SET state = 'claimed', claimed_by = 'vps-01'
WHERE id = 'cmt_xxx' AND state = 'open'
RETURNING *;
```

**Restart Handling**:

```typescript
// On daemon startup
const inFlight = await getClaimedCommitments(this.machineId);
for (const cmt of inFlight) {
  if (canResume(cmt)) {
    resumeExecution(cmt);
  } else {
    releaseCommitment(cmt.id, "daemon_restart");
  }
}
```

**Re-Dispatch Rules**:

Dispatch is immutable once claimed. To change target:
1. `mentu release cmt_xxx`
2. `mentu dispatch cmt_xxx --machine new-target`

---

## Routing Hints

```yaml
priority: normal

tags:
  - ledger-first
  - dispatch
  - genesis
  - orchestration
  - phase-3

target_repo: mentu-ai

# Multi-repo: affects mentu-bridge and mentu-proxy too
related_repos:
  - mentu-bridge
  - mentu-proxy

ci_integration:
  github_actions: false
  auto_pr: false
```

---

## Staging Breakdown

This intent covers 7 implementation stages:

| Stage | Work | Complexity |
|-------|------|------------|
| 1 | Genesis execution schema | Low - additive only |
| 2 | Dispatch operation + CLI | Medium - new operation type |
| 3 | Auto-dispatch at commit | Medium - commit handler logic |
| 4 | Bridge subscribes to ledger | Medium - replace polling |
| 5 | Dual-mode operation | Low - read both sources |
| 6 | Parallel execution | Medium - concurrency control |
| 7 | Deprecate bridge_commands | Low - stop writing |

**Recommended Approach**: Execute as 3-4 separate HANDOFFs:
1. HANDOFF-GenesisExecutionSchema (Stage 1)
2. HANDOFF-DispatchOperation (Stages 2-3)
3. HANDOFF-BridgeLedgerSubscription (Stages 4-5)
4. HANDOFF-ParallelExecution (Stages 6-7)

---

## For the Leading Agent

When you receive this INTENT document:

1. **Establish checkpoint** (git + Claude Code)
2. **Audit** using `/craft--architect` protocol
3. **Capture evidence** of your audit findings
4. **Decide**: APPROVE / REJECT / REQUEST_CLARIFICATION
5. **If approved**: Consider splitting into multiple HANDOFFs per staging recommendation

**Key Questions to Answer During Audit**:
- Is the genesis schema compatible with existing genesis.key files?
- What's the minimum viable dispatch implementation?
- How will we test dual-mode operation?
- What's the rollback plan if migration fails?

**Dependencies**:
- INTENT-WorkflowOrchestratorInvocation-v1.0 should be complete first
- Execution pattern must be stable before changing routing

**You are the gatekeeper. Validate before committing.**

---

*This intent was created by an Architect agent without local filesystem access. It represents strategic direction, not implementation specification.*
