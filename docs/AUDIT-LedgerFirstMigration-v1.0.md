---
# ============================================================
# CANONICAL YAML FRONT MATTER
# ============================================================
id: AUDIT-LedgerFirstMigration-v1.0
path: docs/AUDIT-LedgerFirstMigration-v1.0.md
type: audit
intent: reference

version: "1.0"
created: 2026-01-12
last_updated: 2026-01-12

intent_ref: INTENT-LedgerFirstMigration-v1.0
craft_ref: pending

auditor: agent:claude-code
checkpoint:
  git_sha: b6ee9218592ef485df7c3aeb7c70e6ab23544e7c
  timestamp: 2026-01-12T00:00:00Z

verdict: APPROVE_WITH_CONDITIONS
verdict_timestamp: 2026-01-12T00:00:00Z

mentu:
  evidence: mem_c1aca24b
  status: approved_with_conditions
---

# Audit: LedgerFirstMigration

> **Leading Agent Audit Report**
>
> This document records the audit of an Architect's strategic intent.
> The verdict determines whether the intent proceeds to implementation.

---

## Intent Summary

**Source**: `docs/INTENT-LedgerFirstMigration-v1.0.md`

The Architect requests migration from `bridge_commands` table to ledger-first orchestration. The Mentu ledger becomes the single source of truth for work routing. A new `dispatch` operation type is introduced as the 13th operation. Bridge daemons subscribe to the operations table instead of a separate bridge_commands table. Genesis key governs machine affinity, concurrency limits, and tier-based execution rules.

### What the Architect Wants
Unify work routing into the ledger with `dispatch` operation, making bridge_commands obsolete.

### Why It Matters
Eliminates fragmented state across two tables, provides audit trail for routing decisions, enables genesis governance over dispatch, and simplifies queries.

### Stated Constraints
- Must NOT change the execution pattern (Auditor→Executor is stable)
- Must NOT break in-flight work during migration
- Must support gradual migration (dual-mode before full cutover)
- Must NOT require breaking Supabase schema changes
- Must work on both Mac and VPS simultaneously
- Must maintain atomic claiming semantics
- Must respect existing commitment states

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
- CLAUDE.md states "The Mentu Ledger is the source of truth. Everything else reacts to it."
- Architecture invariant: "All components follow one rule: Read ledger, write ops."
- This intent directly implements the core principle

### Governance Compliance

**Source**: `.mentu/genesis.key`

| Question | Answer |
|----------|--------|
| Does this respect the governance model? | yes |
| Are there permission boundaries being crossed? | no |
| Does this require elevated authorization? | no |

**Assessment**: compliant

**Note**: This intent strengthens genesis governance by adding execution configuration.

---

## Technical Feasibility

### Architecture Support

| Question | Answer |
|----------|--------|
| Can the existing architecture support this? | with modifications |
| Does this require new infrastructure? | no |
| Are there existing patterns to follow? | yes |

**Assessment**: feasible with caveats

### Affected Components

| Component | Path(s) | Impact Level |
|-----------|---------|--------------|
| Operation Types | `mentu-ai/src/types.ts` | high |
| Genesis Schema | `mentu-ai/docs/Genesis-Key-Canonical-Schema.md` | medium |
| Genesis Parser | `mentu-ai/src/core/genesis.ts` | medium |
| Bug Executor | `mentu-bridge/src/bug-executor.ts` | high |
| Realtime Subscriber | `mentu-bridge/src/realtime-subscriber.ts` | high |
| Dispatch CLI | `mentu-ai/src/commands/dispatch.ts` (new) | medium |
| Bridge Command Handler | `mentu-proxy/src/handlers/` | medium |

### Existing Patterns

```
Pattern: Operation Type Definition
Location: mentu-ai/src/types.ts (lines 54-276)
Relevance: Add dispatch following same pattern as 12 existing operations
```

```
Pattern: Atomic Claiming
Location: mentu-bridge/src/bug-executor.ts (lines 326-344)
Relevance: UPDATE...WHERE pattern proven for race condition handling
```

```
Pattern: Realtime Subscription
Location: mentu-bridge/src/realtime-subscriber.ts (lines 95-146)
Relevance: Extend to subscribe to dispatch operations
```

### Dependencies

| Dependency | Type | Concern |
|------------|------|---------|
| INTENT-WorkflowOrchestratorInvocation | internal | BLOCKING - must complete first |
| Supabase operations table | infrastructure | Already exists |
| genesis.key schema | internal | Additive extension |
| Multi-repo coordination | process | Requires careful staging |

---

## Risk Assessment

| Risk Category | Level | Rationale | Mitigation |
|---------------|-------|-----------|------------|
| **Scope Creep** | medium | 7 stages across 3 repos | Split into 4 HANDOFFs |
| **Breaking Changes** | medium | Routing change affects all execution | Dual-mode (Stage 5) |
| **Security** | low | No new attack surface | Permissions via genesis |
| **Technical Debt** | low | Reduces debt (single source of truth) | N/A |
| **Reversibility** | medium | Migration requires coordination | Each stage reversible |

### Overall Risk Profile

**Risk Score**: medium

The largest concern is multi-repo coordination and ensuring in-flight work isn't lost during migration. The staged approach with dual-mode mitigates this effectively.

---

## Effort Estimate

### Tier Assessment

| Tier | Description | This Intent |
|------|-------------|-------------|
| T1 | Simple change, single file | no |
| T2 | Feature, multiple files | no |
| T3 | Multi-part, cross-cutting | **yes** |
| T4 | Orchestrated, multi-agent | no |

**Assigned Tier**: T3

**Rationale**: 7 stages across 3 repositories (mentu-ai, mentu-bridge, mentu-proxy), schema evolution, and migration coordination.

### Scope Breakdown

| Stage | Work | Sub-Tier |
|-------|------|----------|
| 1 | Genesis execution schema | T1 |
| 2 | Dispatch operation + CLI | T2 |
| 3 | Auto-dispatch at commit | T2 |
| 4 | Bridge ledger subscription | T2 |
| 5 | Dual-mode operation | T1 |
| 6 | Parallel execution | T2 |
| 7 | Deprecate bridge_commands | T1 |

**Recommended HANDOFFs**:
1. HANDOFF-GenesisExecutionSchema (Stage 1)
2. HANDOFF-DispatchOperation (Stages 2-3)
3. HANDOFF-BridgeLedgerSubscription (Stages 4-5)
4. HANDOFF-ParallelExecution (Stages 6-7)

---

## Open Questions Resolution

### Question 1: Should dispatch be reversible? (Can you re-dispatch after release?)
**Answer**: YES. Dispatch is immutable once claimed. To change target: release → re-dispatch.
**Evidence**: Follows same pattern as commitment state machine (claim/release cycle).

### Question 2: What happens to in-flight bridge_commands during migration?
**Answer**: Dual-mode (Stage 5) reads from both tables, writes only to ledger. In-flight commands complete normally.
**Evidence**: Explicit dual-mode stage in intent ensures graceful migration.

### Question 3: Should we support machine pools? (dispatch to "vps-*")
**Answer**: DEFERRED to v2.0. First prove single-machine dispatch.
**Evidence**: Keep scope manageable; can be added later without breaking changes.

### Question 4: How long is the dual-mode period before full deprecation?
**Answer**: Minimum 2 weeks, until all in-flight bridge_commands complete and stability confirmed.
**Evidence**: Production safety requires observation period.

### Question 5: Should dispatch operations have their own lifecycle?
**Answer**: NO. Dispatch inherits commitment states (open→claimed→closed).
**Evidence**: Simpler than new state machine; dispatch is routing intent, not separate entity.

### Question 6: How do we handle daemon restarts with in-flight work?
**Answer**: Query claimed commitments on startup. Resume if possible, release if not.
**Evidence**: Already specified in intent document, pattern proven viable.

---

## Verdict

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   VERDICT: APPROVE WITH CONDITIONS                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Rationale

This intent is strongly aligned with project philosophy (ledger as single source of truth) and technically feasible using existing patterns. The risk is medium due to multi-repo coordination, but this is mitigated by:

1. **Staged approach**: 7 stages with clear milestones
2. **Dual-mode**: Prevents data loss during migration
3. **Proven patterns**: Atomic claiming, realtime subscription already work
4. **Additive schema**: Genesis extension doesn't break existing configs

The critical dependency is INTENT-WorkflowOrchestratorInvocation. The execution pattern must be stable before we change routing. Both Phase 2 and Phase 3 must execute in order.

**Deciding factors**:
- Eliminates technical debt (fragmented state)
- Strengthens audit trail (all routing decisions in ledger)
- Enables genesis-governed execution (machine affinity, tiers)
- Risk is manageable with proper staging

---

## Conditions (if APPROVE)

> These conditions MUST be met during implementation.

1. **INTENT-WorkflowOrchestratorInvocation MUST complete first** - Execution pattern must be stable
2. **Split into 4 separate HANDOFFs** - No monolithic implementation
3. **Implement dual-mode (Stage 5) before deprecation (Stage 7)** - Migration safety
4. **Test atomic claiming with multiple machines** - Before parallel execution
5. **Define rollback plan for each stage** - Each stage must be reversible
6. **Update all 3 repos (mentu-ai, mentu-bridge, mentu-proxy)** - Coordinated releases

### Recommended Approach

**Phase 1 (Week 1)**: Complete INTENT-WorkflowOrchestratorInvocation

**Phase 2 (Week 2)**: Genesis + Dispatch
- Add `execution:` section to genesis schema (additive)
- Add `dispatch` as 13th operation type
- Implement `mentu dispatch` CLI command

**Phase 3 (Week 3)**: Bridge Migration
- Subscribe bridge to dispatch operations
- Implement dual-mode (read both sources)
- Auto-dispatch at commit for autonomous work

**Phase 4 (Week 4)**: Stabilization
- Enable parallel execution
- Monitor dual-mode for issues
- Deprecate bridge_commands writes (keep reads)

---

## Next Steps

### If APPROVE

```bash
# First, complete INTENT 1
# (WorkflowOrchestratorInvocation must be done before this)

# Then capture approval evidence
mentu capture "Approved INTENT-LedgerFirstMigration: Ledger-first routing with dispatch operation" \
  --kind approval \
  --path docs/AUDIT-LedgerFirstMigration-v1.0.md

# Execute craft chain (4 separate HANDOFFs)
/craft GenesisExecutionSchema-v1.0
/craft DispatchOperation-v1.0
/craft BridgeLedgerSubscription-v1.0
/craft ParallelExecution-v1.0
```

---

## Audit Trail

| Timestamp | Action | Actor | Evidence |
|-----------|--------|-------|----------|
| 2026-01-12T00:00:00Z | Audit started | agent:claude-code | Checkpoint: b6ee921 |
| 2026-01-12T00:00:00Z | Philosophy evaluated | agent:claude-code | Strongly aligned |
| 2026-01-12T00:00:00Z | Feasibility assessed | agent:claude-code | Feasible with caveats |
| 2026-01-12T00:00:00Z | Risks assessed | agent:claude-code | Medium (mitigated) |
| 2026-01-12T00:00:00Z | Verdict rendered | agent:claude-code | APPROVE_WITH_CONDITIONS |

---

*This audit was performed by a Leading Agent with full local filesystem access, MCP tooling, and codebase context.*
