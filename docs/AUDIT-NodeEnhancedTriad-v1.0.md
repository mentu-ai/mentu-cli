---
id: AUDIT-NodeEnhancedTriad-v1.0
type: audit
intent_ref: INTENT-NodeEnhancedTriad-v1.0
created: 2026-01-02
auditor: agent:claude-lead
checkpoint:
  git_sha: c435fac64d4c683b15ca67cdaa1bd57537909d29
  timestamp: 2026-01-02T00:00:00Z
verdict: APPROVE
mentu:
  commitment: cmt_552fac91
  evidence: pending
  status: pending
---

# Audit: Node-Enhanced Headless Triad

> **Leading Agent Audit Report**
>
> This document records the audit of the strategic intent to enhance the Headless Triad with Node-as-Directory architecture.

---

## Intent Summary

**Source**: `docs/INTENT-NodeEnhancedTriad-v1.0.md`

The Architect proposes enhancing the Headless Triad Execution pattern (Architect → Auditor → Executor) with Node-as-Directory architecture, making each triad execution a returnable epistemic Node with identity, evolution tracking, relationships, and progressive YAML front matter.

### What the Architect Wants
Transform craft executions from ephemeral flat files into first-class epistemic Nodes that can be returned to, evolved, and linked.

### Why It Matters
Enable compound returns from repeated craft executions, network effects through linked Nodes, and recursive intelligence through evolution tracking.

### Stated Constraints
- Must NOT break existing `/craft`, `/craft--auditor`, `/craft--executor` commands
- Must maintain backward compatibility with current `.claude/craft/` flat structure
- Node structure should be opt-in initially, becoming default over time
- Must respect existing Mentu ledger as source of truth

---

## Philosophy Alignment

Evaluated against project foundational documents.

### Project Purpose

**Source**: `CLAUDE.md`, `.mentu/genesis.key`, `.mentu/manifest.yaml`

| Question | Answer |
|----------|--------|
| Does this intent serve the project's stated purpose? | **Yes** - Enhances commitment tracking with better evidence |
| Does it align with the project's direction? | **Yes** - Follows the trust gradient pattern already in genesis.key |
| Would maintainers likely support this? | **Yes** - Owner created the Node architecture documents |

**Assessment**: **ALIGNED**

**Evidence**:
- genesis.key principle `evidence-required`: "Commitments close with proof, not assertion" → Node architecture provides MORE evidence through evolution.log and structured RESULT documents
- genesis.key principle `lineage-preserved`: "Every commitment traces to its origin" → Node relationships and progressive YAML enhance lineage tracking
- genesis.key principle `append-only`: "Nothing edited, nothing deleted" → evolution.log is append-only by design

### Governance Compliance

**Source**: `.mentu/genesis.key`

| Question | Answer |
|----------|--------|
| Does this respect the governance model? | **Yes** - Uses existing trust gradient (architect/auditor/executor) |
| Are there permission boundaries being crossed? | **No** - All actors retain their current permissions |
| Does this require elevated authorization? | **No** - Additive changes only |

**Assessment**: **COMPLIANT**

---

## Technical Feasibility

### Architecture Support

| Question | Answer |
|----------|--------|
| Can the existing architecture support this? | **Yes** - .mentu/ directory is extensible |
| Does this require new infrastructure? | **No** - Uses existing Node.js patterns from mentu-bridge |
| Are there existing patterns to follow? | **Yes** - prompt-builder.ts, daemon.ts spawning patterns |

**Assessment**: **FEASIBLE**

### Affected Components

| Component | Path(s) | Impact Level |
|-----------|---------|--------------|
| .mentu directory structure | `.mentu/craft/` (NEW) | Low - additive only |
| manifest.yaml | `.mentu/manifest.yaml` | Low - new capabilities section |
| mentu-bridge daemon | `mentu-bridge/src/daemon.ts` | Low - new handler (~50 lines) |
| Skill documentation | `.claude/skills/headless-triad/SKILL.md` | Low - path updates |
| New Node.js scripts | `.mentu/craft/*.js` (NEW) | Medium - new files (~200 lines) |

### Existing Patterns

```
Pattern: Agent Spawning
Location: mentu-bridge/src/daemon.ts
Relevance: Same spawn() pattern for Claude headless execution

Pattern: Template Substitution
Location: mentu-bridge/src/prompt-builder.ts
Relevance: Can use for INSTRUCTION.md template generation

Pattern: Mentu Evidence Capture
Location: daemon.ts captureMemory()
Relevance: Same pattern for capturing audit/execution evidence
```

### Dependencies

| Dependency | Type | Concern |
|------------|------|---------|
| mentu-bridge daemon | Internal | Must be running for bridge integration |
| claude CLI | External | Required for headless execution |
| Node.js runtime | Infrastructure | Already required by mentu-ai |

---

## Risk Assessment

| Risk Category | Level | Rationale | Mitigation |
|---------------|-------|-----------|------------|
| **Scope Creep** | Low | Intent is well-bounded to craft enhancement only | Clear constraints in INTENT document |
| **Breaking Changes** | Low | All changes are additive to new .mentu/craft/ | Existing /craft command unchanged |
| **Security** | Low | No new attack surfaces; uses existing patterns | Same trust gradient enforced |
| **Technical Debt** | Low | Builds on proven mentu-bridge patterns | Clean separation in new directory |
| **Reversibility** | High | Can delete .mentu/craft/ to roll back | No modifications to existing files |

### Overall Risk Profile

**Risk Score**: **LOW**

The intent introduces no breaking changes, adds capability to an isolated new directory, and uses proven patterns from the existing ecosystem.

---

## Effort Estimate

### Tier Assessment

| Tier | Description | This Intent |
|------|-------------|-------------|
| T1 | Simple change, single file | No |
| T2 | Feature, multiple files | **Yes** |
| T3 | Multi-part, cross-cutting | No |
| T4 | Orchestrated, multi-agent | No |

**Assigned Tier**: **T2**

**Rationale**:
- ~5 new files (Node.js scripts + documentation)
- ~300 lines of code
- Changes span mentu-ai and mentu-bridge repositories
- Single coherent feature with clear boundaries

### Scope Breakdown

1. Create `.mentu/craft/` directory structure and Node.js scripts - 2-3 hours
2. Update manifest.yaml with craft capabilities - 30 minutes
3. Add craft handler to mentu-bridge daemon - 1-2 hours
4. Update headless-triad SKILL.md documentation - 1 hour
5. Create test execution with sample PRD - 1 hour

---

## Open Questions Resolution

### Question 1: Should craft Node live under `.mentu/craft/` or `.mentu/nodes/craft/`?

**Answer**: `.mentu/craft/`

**Evidence**:
- The Node architecture documents show `.mentu/nodes/` for epistemic concept Nodes
- Craft executions are operational artifacts, not epistemic concepts
- Separation maintains clean distinction between concepts and operations
- Simpler path, easier to understand

### Question 2: How does craft Node relate to Mentu commitments?

**Answer**: One-to-one relationship via YAML front matter

**Evidence**:
- Each craft execution creates a commitment (existing pattern)
- The `mentu.commitment` field in PRD/INSTRUCTION/RESULT already links to cmt_xxx
- evolution.log can track commitment state changes
- No new linking mechanism required

### Question 3: Should we implement full Progressive YAML (5 stages)?

**Answer**: Simplified 3-stage version initially

**Evidence**:
- Stage 1 (Identity) + Stage 3 (Relationships) + Stage 5 (Activation) cover core needs
- Full 5-stage adds complexity without proportional value for craft artifacts
- Can extend later if needed (backward compatible)

### Question 4: What is minimum viable Node structure?

**Answer**:
```
.mentu/craft/{task-name}/
├── node.yaml          # Identity + relationships
├── PRD.md             # Architect output
├── INSTRUCTION.md     # Auditor output
└── RESULT.md          # Executor output + evidence
```

**Evidence**:
- Simpler than full Node architecture (no precedents.md, bindings/, agents/)
- Covers the essential triad artifacts
- evolution.log can be added later
- Matches existing craft document pattern

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

1. **Philosophy Aligned**: All three genesis principles (evidence-required, lineage-preserved, append-only) are enhanced, not violated

2. **Technically Feasible**: Proven patterns exist in mentu-bridge, no new dependencies required

3. **Low Risk**: All changes are additive, confined to new `.mentu/craft/` directory, fully reversible

4. **Clear Scope**: T2 effort with well-defined boundaries, ~5-6 hours of work

5. **User Intent Clear**: Owner provided the Node architecture documents that inform this enhancement

---

## Conditions (APPROVE)

1. **Maintain Backward Compatibility**: Existing `/craft` command MUST continue to work with `docs/` directory

2. **Opt-in Initially**: The new `.mentu/craft/` structure should be invoked via new command (e.g., `/craft-node` or flag `--node`)

3. **Simplified Node Structure**: Start with minimal node.yaml + artifacts, skip precedents.md and evolution.log for v1

4. **Document Migration Path**: Create clear documentation for moving from `/craft` to `/craft-node` when ready

5. **Test with Real PRD**: Before merging, execute full triad with sample PRD to validate chain

---

## Recommended Approach

### Implementation Order

1. **Create Directory Structure** (`.mentu/craft/`)
2. **Create node.yaml Schema** (simplified from full Node spec)
3. **Create Node.js Launcher Script** (orchestrates auditor → executor)
4. **Update mentu-bridge Handler** (conditional craft execution)
5. **Update Skill Documentation** (headless-triad/SKILL.md)
6. **Test End-to-End** (sample PRD → RESULT)

### Simplifications for v1

| Full Node Spec | v1 Implementation |
|----------------|-------------------|
| node.yaml + schema.json | node.yaml only |
| context.yaml | Embedded in node.yaml |
| precedents.md | Skip (add later) |
| evolution.log | Skip (add later) |
| bindings/ | Skip (not needed for craft) |
| agents/ | Skip (agent is the executor) |

---

## Audit Trail

| Timestamp | Action | Actor | Evidence |
|-----------|--------|-------|----------|
| 2026-01-02 | Audit started | agent:claude-lead | Checkpoint: c435fac |
| 2026-01-02 | Philosophy evaluated | agent:claude-lead | genesis.key aligned |
| 2026-01-02 | Feasibility assessed | agent:claude-lead | Explore agent analysis |
| 2026-01-02 | Risks assessed | agent:claude-lead | Low risk profile |
| 2026-01-02 | Verdict rendered | agent:claude-lead | APPROVE |

---

*This audit was performed by a Leading Agent with full local filesystem access, MCP tooling, and codebase context.*
