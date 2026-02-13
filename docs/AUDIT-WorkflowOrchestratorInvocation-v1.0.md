---
# ============================================================
# CANONICAL YAML FRONT MATTER
# ============================================================
id: AUDIT-WorkflowOrchestratorInvocation-v1.0
path: docs/AUDIT-WorkflowOrchestratorInvocation-v1.0.md
type: audit
intent: reference

version: "1.0"
created: 2026-01-12
last_updated: 2026-01-12

intent_ref: INTENT-WorkflowOrchestratorInvocation-v1.0
craft_ref: pending

auditor: agent:claude-code
checkpoint:
  git_sha: b6ee9218592ef485df7c3aeb7c70e6ab23544e7c
  timestamp: 2026-01-12T00:00:00Z

verdict: APPROVE
verdict_timestamp: 2026-01-12T00:00:00Z

mentu:
  evidence: mem_0d0c1b82
  status: approved
---

# Audit: WorkflowOrchestratorInvocation

> **Leading Agent Audit Report**
>
> This document records the audit of an Architect's strategic intent.
> The verdict determines whether the intent proceeds to implementation.

---

## Intent Summary

**Source**: `docs/INTENT-WorkflowOrchestratorInvocation-v1.0.md`

The Architect requests alignment of the workflow orchestrator's Claude invocation with the proven Auditor→Executor pattern. Currently, the workflow orchestrator invokes Claude directly with prescriptive prompts. It should use the same bounded-scope approach that was validated in ProgrammaticBugExecution (Stage 0).

### What the Architect Wants
Align workflow orchestrator Claude invocation with the Auditor→Executor pattern (boundaries, not steps).

### Why It Matters
Enables E2E workflow testing and ensures consistent execution semantics across all entry points.

### Stated Constraints
- Must NOT change the Auditor→Executor pattern (it's stable)
- Must NOT modify `craftAudit()` or `spawnExecutor()` core logic
- Must NOT break existing bug execution flows
- Must maintain backwards compatibility with current workflow definitions
- Must NOT require infrastructure changes
- Must work on both Mac and VPS

---

## Philosophy Alignment

Evaluated against project foundational documents.

### Project Purpose

**Source**: `CLAUDE.md`, `.mentu/manifest.yaml`

| Question | Answer |
|----------|--------|
| Does this intent serve the project's stated purpose? | yes |
| Does it align with the project's direction? | yes |
| Would maintainers likely support this? | yes |

**Assessment**: aligned

**Evidence**:
- CLAUDE.md states "Frame 2: Trust, but verify. Boundaries define the arena."
- The Auditor→Executor pattern is documented as the canonical execution approach
- Workflow orchestration is listed as a core capability in the manifest

### Governance Compliance

**Source**: `.mentu/genesis.key`

| Question | Answer |
|----------|--------|
| Does this respect the governance model? | yes |
| Are there permission boundaries being crossed? | no |
| Does this require elevated authorization? | no |

**Assessment**: compliant

---

## Technical Feasibility

### Architecture Support

| Question | Answer |
|----------|--------|
| Can the existing architecture support this? | yes |
| Does this require new infrastructure? | no |
| Are there existing patterns to follow? | yes |

**Assessment**: feasible

### Affected Components

| Component | Path(s) | Impact Level |
|-----------|---------|--------------|
| Workflow Orchestrator | `mentu-bridge/src/workflow-orchestrator.ts` | medium |
| Bug Executor | `mentu-bridge/src/bug-executor.ts` | low (extract only) |
| New: Execution Pattern | `mentu-bridge/src/core/execution-pattern.ts` | low (new file) |

### Existing Patterns

```
Pattern: Auditor→Executor
Location: mentu-bridge/src/bug-executor.ts (lines 631-836)
Relevance: Direct reuse - extract and share
```

Key methods proven in Stage 0:
- `craftAudit()` - Produces `AuditOutput` with boundaries
- `spawnExecutor()` - Invokes Claude with objective focus
- `logScopeCompliance()` - Frame 2 observability

### Dependencies

| Dependency | Type | Concern |
|------------|------|---------|
| AuditOutput interface | internal | Already exists, no change needed |
| ExecutionResult interface | internal | Already exists with verification/blocked_reason |
| Supabase realtime | infrastructure | Already configured |

---

## Risk Assessment

| Risk Category | Level | Rationale | Mitigation |
|---------------|-------|-----------|------------|
| **Scope Creep** | low | Well-defined extraction task | Clear boundaries |
| **Breaking Changes** | low | Additive, not modifying core | Dual-mode testing |
| **Security** | low | No new attack surface | N/A |
| **Technical Debt** | low | Reduces debt (code sharing) | N/A |
| **Reversibility** | low | Extract is non-destructive | Easy rollback |

### Overall Risk Profile

**Risk Score**: low

This is a clean extraction and reuse. The pattern is proven, the target exists, and the scope is well-defined.

---

## Effort Estimate

### Tier Assessment

| Tier | Description | This Intent |
|------|-------------|-------------|
| T1 | Simple change, single file | no |
| T2 | Feature, multiple files | **yes** |
| T3 | Multi-part, cross-cutting | no |
| T4 | Orchestrated, multi-agent | no |

**Assigned Tier**: T2

**Rationale**: Multiple files affected (extract from bug-executor, create shared module, update workflow-orchestrator), but straightforward refactoring.

### Scope Breakdown

1. Extract execution pattern to shared module
2. Update workflow-orchestrator.ts to use shared pattern
3. Add E2E test coverage
4. Verify build and existing tests pass

---

## Open Questions Resolution

### Question 1: Is there an existing workflow orchestrator, or is this the initial implementation?
**Answer**: EXISTS. `workflow-orchestrator.ts` v1.1 with memory resolution.
**Evidence**: File at `mentu-bridge/src/workflow-orchestrator.ts`, polls `workflow_instances` table.

### Question 2: Where does the workflow orchestrator live?
**Answer**: mentu-bridge/src/workflow-orchestrator.ts
**Evidence**: Direct file exploration confirmed location.

### Question 3: What triggers workflow execution?
**Answer**: Realtime subscription + polling of `workflow_instances` table.
**Evidence**: RealtimeSubscriber and `pollPendingCommands` patterns.

### Question 4: Are there existing workflow definitions that need migration?
**Answer**: Yes, stored in `workflow_instances` table.
**Evidence**: Database schema references in orchestrator code.

### Question 5: Should workflows support T1/T2/T3 tier classification?
**Answer**: DEFERRED. Can be added later, not blocking for this intent.
**Evidence**: Commitment tier system is separate from workflow execution.

---

## Verdict

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   VERDICT: APPROVE                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Rationale

This intent is fully aligned with project philosophy, technically feasible with existing patterns, and carries low risk. The Auditor→Executor pattern has been proven in Stage 0 (ProgrammaticBugExecution). All components exist:

1. **Pattern exists**: `craftAudit()`, `spawnExecutor()`, `logScopeCompliance()` in bug-executor.ts
2. **Target exists**: workflow-orchestrator.ts v1.1
3. **Extraction viable**: No coupling between implementations
4. **No blockers**: All infrastructure in place

The deciding factor is that this is pure refactoring and code sharing - no new concepts, no new infrastructure, no breaking changes.

---

## Conditions (if APPROVE)

> These conditions MUST be met during implementation.

1. Extract shared execution pattern to `mentu-bridge/src/core/execution-pattern.ts`
2. Maintain backwards compatibility with existing bug execution (do not break executeBugCommand)
3. Add E2E test coverage for workflow execution with Auditor→Executor pattern
4. Workflow logs must show "Crafting audit boundaries" (not "Crafting instructions")

### Recommended Approach

1. Create `execution-pattern.ts` with exported functions (not class)
2. Update `bug-executor.ts` to import from shared module
3. Update `workflow-orchestrator.ts` to use same shared module
4. Verify both execution paths work independently
5. Create RESULT document with test evidence

---

## Next Steps

### If APPROVE

```bash
# Capture approval evidence
mentu capture "Approved INTENT-WorkflowOrchestratorInvocation: E2E workflow alignment with Auditor→Executor" \
  --kind approval \
  --path docs/AUDIT-WorkflowOrchestratorInvocation-v1.0.md

# Execute craft chain
/craft WorkflowOrchestratorInvocation-v1.0
```

---

## Audit Trail

| Timestamp | Action | Actor | Evidence |
|-----------|--------|-------|----------|
| 2026-01-12T00:00:00Z | Audit started | agent:claude-code | Checkpoint: b6ee921 |
| 2026-01-12T00:00:00Z | Philosophy evaluated | agent:claude-code | Aligned |
| 2026-01-12T00:00:00Z | Feasibility assessed | agent:claude-code | Feasible |
| 2026-01-12T00:00:00Z | Risks assessed | agent:claude-code | Low |
| 2026-01-12T00:00:00Z | Verdict rendered | agent:claude-code | APPROVE |

---

*This audit was performed by a Leading Agent with full local filesystem access, MCP tooling, and codebase context.*
