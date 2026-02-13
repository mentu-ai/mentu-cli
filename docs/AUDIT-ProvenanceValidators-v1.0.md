---
# ============================================================
# CANONICAL YAML FRONT MATTER
# ============================================================
id: AUDIT-ProvenanceValidators-v1.0
path: docs/AUDIT-ProvenanceValidators-v1.0.md
type: audit
intent: reference

# VERSIONING
version: "1.0"
created: 2026-01-02
last_updated: 2026-01-02

# RELATIONSHIPS
intent_ref: INTENT-ProvenanceValidators-v1.0
craft_ref: ProvenanceValidators-v1.0
execution_commitment: cmt_af3f29ba

# AUDITOR IDENTITY
auditor: agent:claude-auditor
checkpoint:
  git_sha: c435fac64d4c683b15ca67cdaa1bd57537909d29
  timestamp: 2026-01-02T16:29:49Z

# VERDICT
verdict: MODIFY
verdict_timestamp: 2026-01-02T16:35:00Z

# MENTU INTEGRATION
mentu:
  checkpoint: mem_82e583c9
  verdict: mem_9b32a40c
  evidence: mem_de11995f
  status: awaiting-craft
---

# Audit: ProvenanceValidators

> **Leading Agent Audit Report**
>
> This document records the audit of an Architect's strategic intent.
> The verdict determines whether the intent proceeds to implementation.

---

## Intent Summary

**Source**: `docs/INTENT-ProvenanceValidators-v1.0.md`

The Architect proposes upgrading the existing Validation Triad to be **provenance-aware**, meaning validators should know which Cooperation Triad role (Architect/Auditor/Executor) they are verifying, and when validation fails, attribute the failure to the responsible author type.

### What the Architect Wants
Connect each validator to the Cooperation Triad role it verifies: Intent Validator ↔ Architect, Safety Validator ↔ Auditor, Technical Validator ↔ Executor.

### Why It Matters
Currently validators operate in isolation — they don't know the original intent or audit boundaries, so failures can't be attributed to the responsible role, breaking the trust chain.

### Stated Constraints
- Use existing validator structure (don't rewrite from scratch)
- Maintain backward compatibility (work without provenance vars)
- Return structured JSON verdicts matching existing schema
- Support tier-based execution (T1: technical, T2: +safety, T3: +intent)
- Validators must not modify files or require provenance

---

## Philosophy Alignment

Evaluated against project foundational documents.

### Project Purpose

**Source**: `CLAUDE.md`, `.mentu/manifest.yaml`

| Question | Answer |
|----------|--------|
| Does this intent serve the project's stated purpose? | **yes** |
| Does it align with the project's direction? | **yes** |
| Would maintainers likely support this? | **yes** |

**Assessment**: aligned

**Evidence**:
- CLAUDE.md states: "Mentu is 'The Commitment Ledger' - an append-only ledger that tracks commitments and proof." Provenance validators directly support traceability of proof.
- CLAUDE.md Section "SubAgent Validators (v1.1)" already describes the triad (technical, intent, safety) and their roles.
- CLAUDE.md Section "Headless Validators (v1.0)" documents existing validator infrastructure.

### Governance Compliance

**Source**: `.mentu/genesis.key`

| Question | Answer |
|----------|--------|
| Does this respect the governance model? | **yes** |
| Are there permission boundaries being crossed? | **no** |
| Does this require elevated authorization? | **no** |

**Assessment**: compliant

Genesis.key has `trust_gradient.enabled: true` and explicitly defines author_types (architect, auditor, executor) with their constraints. This intent operationalizes that existing governance model.

---

## Technical Feasibility

### Architecture Support

| Question | Answer |
|----------|--------|
| Can the existing architecture support this? | **yes** |
| Does this require new infrastructure? | **no** |
| Are there existing patterns to follow? | **yes** |

**Assessment**: feasible

### Affected Components

| Component | Path(s) | Impact Level |
|-----------|---------|--------------|
| Validator Orchestrator | `.claude/hooks/tier_validator.py` | high |
| Verdict Schema | `.claude/validators/schemas/verdict.json` | low |
| Intent Validator | `.claude/validators/intent.sh` | medium |
| Safety Validator | `.claude/validators/safety.sh` | medium |
| Technical Validator | `.claude/validators/technical.sh` | low |
| Documentation | `.claude/validators/README.md` | low |

### Existing Patterns

```
Pattern: Author Type System
Location: src/utils/author.ts
Relevance: Fully implemented with getAuthorType(), getTrustLevel(), getProvenance(),
           buildProvenanceChain(), and validateAuthorTypeConstraints() functions.
           This provides the foundation for provenance-aware validation.
```

```
Pattern: Tier-based Validator Execution
Location: .claude/hooks/tier_validator.py
Relevance: Already implements parallel execution with ThreadPoolExecutor,
           tier classification based on tags, and RESULT document generation.
           Just needs provenance variable passing.
```

```
Pattern: Environment Variable Interface
Location: .claude/validators/technical.sh
Relevance: Already accepts CMT_ID, CMT_BODY, SOURCE_ID via environment.
           Extending to INTENT_ID, AUDIT_ID follows same pattern.
```

### Dependencies

| Dependency | Type | Concern |
|------------|------|---------|
| mentu CLI | internal | Required for `mentu show $ID --json` lookups |
| author.ts | internal | Already implemented, no new dependency |
| Python threading | standard library | Already used in tier_validator.py |

---

## Risk Assessment

| Risk Category | Level | Rationale | Mitigation |
|---------------|-------|-----------|------------|
| **Scope Creep** | low | Intent clearly bounds to validator layer via MUST list | Explicit constraints prevent expansion |
| **Breaking Changes** | low | Backward compatible - provenance vars are optional | Graceful degradation required |
| **Security** | none | Validators are read-only, no network calls | Already constrained by validator architecture |
| **Technical Debt** | low | Extends existing modules, no duplication | Uses author.ts which is comprehensive |
| **Reversibility** | high | Changes are env vars and one schema field | Git checkpoint established |

### Overall Risk Profile

**Risk Score**: low

The intent is well-bounded by explicit constraints. The main risk is implementation complexity in resolving the open questions, but those are now answered by this audit.

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

**Rationale**: Affects 6-8 files but all within the validator subsystem. No new subsystems, just connecting existing pieces. Requires design decisions that are now resolved.

### Scope Breakdown

1. Enable intent validator in tier_validator.py (uncomment) - 15 minutes
2. Add attribution field to verdict.json schema - 30 minutes
3. Modify tier_validator.py to extract and pass INTENT_ID/AUDIT_ID - 2 hours
4. Update validators to read provenance env vars - 1 hour
5. Update RESULT document generation with attribution - 30 minutes
6. Update README.md with provenance interface - 30 minutes

---

## Open Questions Resolution

Address questions raised in the INTENT document:

### Question 1: Constraint extraction - How should safety.sh extract constraints from audit-approval?

**Answer**: tier_validator.py fetches the audit memory via `mentu show $AUDIT_ID --json` and passes the body via `AUDIT_BODY` environment variable.

**Evidence**: This follows the existing pattern for CMT_BODY. Centralizing lookup in the orchestrator keeps validators pure and doesn't add mentu dependency to bash scripts.

### Question 2: Memory lookup - Should validators call `mentu show $INTENT_ID --json` or assume body passed via env var?

**Answer**: tier_validator.py calls `mentu show $ID --json` and passes body via env var (`INTENT_BODY`, `AUDIT_BODY`).

**Evidence**: This is simpler than having validators call mentu. The orchestrator already has mentu access and can batch lookups.

### Question 3: Tier selection - Should tier be explicit (`TIER=2`) or inferred from presence of provenance vars?

**Answer**: Keep explicit `--tier` flag in submit command. Consider future auto-inference but don't implement now.

**Evidence**: Already working, changing it would introduce scope creep. Future enhancement.

### Question 4: Integration point - Should tier_validator.py be called from hook or mentu submit?

**Answer**: Keep tier_validator.py as stop hook. Submit sets tier, hook validates.

**Evidence**: This is the existing architecture and works well. The hook already handles parallel execution and RESULT document generation.

---

## Verdict

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   VERDICT: MODIFY                                               │
│                                                                 │
│   The intent is valid but requires clarifications to proceed.  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Rationale

The intent is **sound and aligned** with project purpose. The architecture exists (80% complete) and risk is low. However, the INTENT document left 4 open questions that must be resolved before execution can begin. This audit provides those resolutions.

The modifications are not to the core vision but to the implementation approach:
1. **Open questions are now answered** with specific architectural decisions
2. **Implementation order is defined** to minimize risk
3. **Intent validator must be re-enabled** (currently commented out in tier_validator.py)

With these clarifications, the intent can proceed to craft.

---

## Conditions (MODIFY → APPROVE with conditions)

> These conditions MUST be met during implementation.

1. **Backward Compatibility**: Validators MUST work without provenance vars (graceful degradation)
2. **Centralized Lookup**: tier_validator.py fetches memories and passes via env vars (validators don't call mentu)
3. **Enable Intent Validator**: Uncomment intent validator in tier_validator.py before other changes
4. **Attribution Field Required**: Verdict JSON MUST include `attribution` object with `author_type` and `responsible_for` fields
5. **No New Dependencies**: Validators remain self-contained bash/headless scripts

### Recommended Approach

**Implementation Order:**

```
Phase 1: Foundation (30 min)
├── Uncomment intent validator in tier_validator.py lines 47-48
└── Verify intent validator runs for Tier 3 commitments

Phase 2: Schema Update (30 min)
├── Add attribution field to verdict.json schema
└── Update validators to include attribution in output

Phase 3: Provenance Plumbing (2 hours)
├── tier_validator.py extracts INTENT_ID and AUDIT_ID from commitment
├── tier_validator.py calls mentu show for provenance memories
├── tier_validator.py passes INTENT_ID, INTENT_BODY, AUDIT_ID, AUDIT_BODY as env vars
└── Update validators to read and use provenance vars

Phase 4: Integration (1 hour)
├── Update RESULT document generation with attribution
├── Test full tier 3 flow with provenance
└── Update README.md with provenance interface documentation
```

---

## Audit Trail

| Timestamp | Action | Actor | Evidence |
|-----------|--------|-------|----------|
| 2026-01-02T16:29:49Z | Audit started | agent:claude-auditor | Checkpoint: c435fac |
| 2026-01-02T16:30:00Z | Intent document parsed | agent:claude-auditor | Structure validated |
| 2026-01-02T16:31:00Z | Philosophy evaluated | agent:claude-auditor | Aligned with CLAUDE.md |
| 2026-01-02T16:32:00Z | Feasibility assessed | agent:claude-auditor | 80% infrastructure exists |
| 2026-01-02T16:33:00Z | Codebase explored | agent:claude-auditor | Task agent findings |
| 2026-01-02T16:34:00Z | Risks assessed | agent:claude-auditor | Low risk profile |
| 2026-01-02T16:35:00Z | Verdict rendered | agent:claude-auditor | mem_9b32a40c |

---

*This audit was performed by agent:claude-auditor with full local filesystem access, MCP tooling, and codebase context.*
