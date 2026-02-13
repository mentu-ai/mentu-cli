---
# ============================================================
# CANONICAL YAML FRONT MATTER
# ============================================================
id: INTENT-WorkflowOrchestratorInvocation-v1.0
path: docs/INTENT-WorkflowOrchestratorInvocation-v1.0.md
type: intent
intent: reference

version: "1.0"
created: 2026-01-12
last_updated: 2026-01-12

architect:
  actor: agent:claude-mentu
  session: ledger-first-planning
  context: conversation

tier_hint: T2

lineage:
  parent_plan: /Users/rashid/.claude/plans/sprightly-growing-reddy.md
  phase: 2
  sequence: "Stage 0 complete → Stage 1 (this) → Stage 2-7"

mentu:
  commitment: pending
  status: awaiting_audit
---

# Strategic Intent: WorkflowOrchestratorInvocation

> **Mode**: Architect
>
> You lack local filesystem access. Produce strategic intent only.
> State what and why. Do not specify file paths, schemas, or code.
> A local Leading Agent will audit and implement.

---

## What

Fix the workflow orchestrator's Claude invocation to align with the Auditor→Executor pattern. Currently, the workflow orchestrator invokes Claude directly with prescriptive prompts. It should use the same bounded-scope approach: Auditor outputs boundaries (objective, constraints, success criteria), Executor decides how to use tools.

This unblocks E2E workflow testing by ensuring all execution paths use the same validated pattern.

---

## Why

**Problem**: The workflow orchestrator cannot be E2E tested because its Claude invocation pattern differs from the validated bug execution pattern.

**Root Cause**: We proved the Auditor→Executor pattern works in `ProgrammaticBugExecution` (Stage 0), but the workflow orchestrator still uses the old prescriptive approach.

**Value**:
- E2E workflow tests become possible
- Consistent execution semantics across all entry points
- Single pattern to maintain and debug
- Prerequisite for ledger-first migration (Phase 3)

**Strategic Context**:
```
Phase 1: ProgrammaticBugExecution ← COMPLETE (Stage 0)
Phase 2: WorkflowOrchestratorInvocation ← THIS INTENT
Phase 3: Ledger-First Migration (depends on Phase 2)
```

---

## Constraints

- Must NOT change the Auditor→Executor pattern (it's stable and working)
- Must NOT modify `craftAudit()` or `spawnExecutor()` core logic
- Must NOT break existing bug execution flows
- Must maintain backwards compatibility with current workflow definitions
- Must NOT require infrastructure changes (no new tables, no new services)
- Must work on both Mac and VPS execution environments

---

## Expected Outcome

**User Perspective**:
- Workflows execute successfully end-to-end
- Workflow steps produce the same quality results as bug fixes
- Workflow logs show Auditor hypothesis and Executor objectives (not prescriptive steps)

**Technical Verification**:
1. `npm run build` passes in mentu-bridge
2. Workflow orchestrator uses `AuditOutput` type
3. Workflow execution logs show "Crafting audit boundaries" (not "Crafting instructions")
4. E2E workflow test completes without manual intervention
5. No prescriptive `steps[]` in workflow execution logs

**Metrics**:
- Workflow success rate matches bug execution success rate
- Scope compliance warnings appear in workflow logs (Frame 2 observability)

---

## Open Questions

- Is there an existing workflow orchestrator, or is this the initial implementation?
- Where does the workflow orchestrator live? (mentu-bridge? mentu-ai? separate?)
- What triggers workflow execution? (CLI command? webhook? scheduled?)
- Are there existing workflow definitions that need migration?
- Should workflows support the same T1/T2/T3 tier classification as commitments?

---

## Context

**What Was Proven in Stage 0**:

The `ProgrammaticBugExecution` implementation proved:
1. `AuditOutput` interface works (boundaries, not steps)
2. `craftAudit()` produces useful hypotheses
3. `spawnExecutor()` with objective-focused prompt succeeds
4. `logScopeCompliance()` provides observability without blocking
5. `verification` and `blocked_reason` fields capture outcomes

**What's Stable**:
```
AuditOutput → craftAudit() → spawnExecutor() → ExecutionResult
     ↑                                              ↓
This pattern is routing-agnostic. It works for:
- bug_execution (proven)
- workflow steps (this intent)
- manual CLI (future)
- dispatch operations (Phase 3)
```

**Relationship to Phase 3**:

Phase 3 (Ledger-First Migration) will:
1. Replace `bridge_commands` with `dispatch` operation
2. Bridge subscribes to ledger instead of separate table
3. Genesis key governs machine affinity

BUT the execution pattern (Auditor→Executor) remains unchanged. Phase 2 ensures workflows use this pattern before we migrate routing.

---

## Routing Hints

```yaml
priority: normal

tags:
  - workflow
  - execution-pattern
  - e2e-testing
  - phase-2

target_repo: mentu-bridge

ci_integration:
  github_actions: false
  auto_pr: false
```

---

## For the Leading Agent

When you receive this INTENT document:

1. **Establish checkpoint** (git + Claude Code)
2. **Audit** using `/craft--architect` protocol
3. **Capture evidence** of your audit findings
4. **Decide**: APPROVE / REJECT / REQUEST_CLARIFICATION
5. **If approved**: Execute `/craft WorkflowOrchestratorInvocation-v1.0` to create full chain

**Key Questions to Answer During Audit**:
- Does the workflow orchestrator exist? Where?
- Can it share `craftAudit()` and `spawnExecutor()` from bug-executor.ts?
- Or should these be extracted to a shared module?

**You are the gatekeeper. Validate before committing.**

---

*This intent was created by an Architect agent without local filesystem access. It represents strategic direction, not implementation specification.*
