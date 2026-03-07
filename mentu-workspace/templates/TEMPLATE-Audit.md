---
# ============================================================
# CANONICAL YAML FRONT MATTER
# ============================================================
# All fields are machine-fetchable and deterministic.
# No narrative or prose is allowed in this block.
# Agents MUST upsert this metadata on execution or edit.
# ============================================================

# IDENTITY
# id: Unique identifier matching filename. Replace {Name} with PascalCase name.
# path: Relative path from repository root.
# type: Document classification. Fixed as "audit" for this template.
# intent: Fixed as "reference" - AUDITs document decisions, not executable instructions.
id: AUDIT-{Name}-v{X.Y}
path: docs/AUDIT-{Name}-v{X.Y}.md
type: audit
intent: reference

# VERSIONING
# version: Semantic version. Start at "1.0", increment on changes.
# created: ISO 8601 date when document was created. Never modify.
# last_updated: ISO 8601 date of last edit. Update on every change.
version: "1.0"
created: YYYY-MM-DD
last_updated: YYYY-MM-DD

# RELATIONSHIPS
# intent_ref: ID of the INTENT document being audited.
# craft_ref: ID of the resulting craft chain (if approved). Set after /craft execution.
intent_ref: INTENT-{Name}-v{X.Y}
craft_ref: pending

# AUDITOR IDENTITY
# auditor: The Leading Agent that performed this audit.
# checkpoint: Git SHA at audit start (for rollback reference).
auditor: agent:claude-lead
checkpoint:
  git_sha: {sha}
  timestamp: YYYY-MM-DDTHH:MM:SSZ

# VERDICT
# verdict: APPROVE | REJECT | REQUEST_CLARIFICATION
# verdict_timestamp: When the verdict was rendered.
verdict: pending
verdict_timestamp: pending

# MENTU INTEGRATION
# evidence: Memory ID of the audit capture.
# status: Current state.
mentu:
  evidence: pending
  status: pending
---

# Audit: {Name}

> **Leading Agent Audit Report**
>
> This document records the audit of an Architect's strategic intent.
> The verdict determines whether the intent proceeds to implementation.

---

## Intent Summary

**Source**: `docs/INTENT-{Name}-v{X.Y}.md`

{Brief restatement of the strategic intent in your own words.}
{Demonstrate understanding before evaluating.}

### What the Architect Wants
{One sentence summary of the "What"}

### Why It Matters
{One sentence summary of the "Why"}

### Stated Constraints
- {Constraint 1}
- {Constraint 2}
- {Constraint 3}

---

## Philosophy Alignment

Evaluated against project foundational documents.

### Project Purpose

**Source**: `CLAUDE.md`, `.mentu/manifest.yaml`

| Question | Answer |
|----------|--------|
| Does this intent serve the project's stated purpose? | {yes | partially | no} |
| Does it align with the project's direction? | {yes | partially | no} |
| Would maintainers likely support this? | {yes | uncertain | no} |

**Assessment**: {aligned | misaligned | neutral}

**Evidence**:
{Quote or reference specific sections from CLAUDE.md or manifest that support your assessment}

### Governance Compliance

**Source**: `.mentu/genesis.key` (if present)

| Question | Answer |
|----------|--------|
| Does this respect the governance model? | {yes | N/A | no} |
| Are there permission boundaries being crossed? | {yes | no | uncertain} |
| Does this require elevated authorization? | {yes | no} |

**Assessment**: {compliant | non-compliant | N/A}

---

## Technical Feasibility

### Architecture Support

| Question | Answer |
|----------|--------|
| Can the existing architecture support this? | {yes | with modifications | no} |
| Does this require new infrastructure? | {yes | no | uncertain} |
| Are there existing patterns to follow? | {yes | no} |

**Assessment**: {feasible | feasible with caveats | not feasible}

### Affected Components

List components that would be touched:

| Component | Path(s) | Impact Level |
|-----------|---------|--------------|
| {Component 1} | `{path/to/files}` | {high | medium | low} |
| {Component 2} | `{path/to/files}` | {high | medium | low} |
| {Component 3} | `{path/to/files}` | {high | medium | low} |

### Existing Patterns

{Describe relevant patterns found in the codebase that should be followed}

```
Pattern: {name}
Location: {path}
Relevance: {how it applies to this intent}
```

### Dependencies

| Dependency | Type | Concern |
|------------|------|---------|
| {Dependency 1} | {internal | external | infrastructure} | {any concerns} |
| {Dependency 2} | {internal | external | infrastructure} | {any concerns} |

---

## Risk Assessment

| Risk Category | Level | Rationale | Mitigation |
|---------------|-------|-----------|------------|
| **Scope Creep** | {low | medium | high} | {why this level} | {how to contain} |
| **Breaking Changes** | {low | medium | high} | {why this level} | {how to handle} |
| **Security** | {low | medium | high} | {why this level} | {review needed?} |
| **Technical Debt** | {low | medium | high} | {why this level} | {acceptable?} |
| **Reversibility** | {low | medium | high} | {why this level} | {rollback plan} |

### Overall Risk Profile

**Risk Score**: {low | medium | high | critical}

{Narrative summary of the risk profile. What's the biggest concern?}

---

## Effort Estimate

### Tier Assessment

| Tier | Description | This Intent |
|------|-------------|-------------|
| T1 | Simple change, single file | {yes | no} |
| T2 | Feature, multiple files | {yes | no} |
| T3 | Multi-part, cross-cutting | {yes | no} |
| T4 | Orchestrated, multi-agent | {yes | no} |

**Assigned Tier**: {T1 | T2 | T3 | T4}

**Rationale**: {Why this tier? Reference component count, complexity, etc.}

### Scope Breakdown

If T2+, break down into sub-tasks:

1. {Sub-task 1} - {effort estimate}
2. {Sub-task 2} - {effort estimate}
3. {Sub-task 3} - {effort estimate}

---

## Open Questions Resolution

Address any questions raised in the INTENT document:

### Question 1: {question}
**Answer**: {your answer based on local context}
**Evidence**: {how you determined this}

### Question 2: {question}
**Answer**: {your answer based on local context}
**Evidence**: {how you determined this}

---

## Verdict

```
+---------------------------------------------------------------+
|                                                               |
|   VERDICT: {APPROVE | REJECT | REQUEST_CLARIFICATION}        |
|                                                               |
+---------------------------------------------------------------+
```

### Rationale

{Detailed explanation of why this verdict was reached.}

{Reference specific findings from the audit sections above.}

{Be explicit about the deciding factors.}

---

## Conditions (if APPROVE)

> These conditions MUST be met during implementation.

1. {Condition 1 - non-negotiable requirement}
2. {Condition 2 - non-negotiable requirement}
3. {Condition 3 - non-negotiable requirement}

### Recommended Approach

{High-level guidance for the craft chain, based on your audit findings}

---

## Rejection Reasons (if REJECT)

> Specific reasons why this intent cannot proceed.

1. {Reason 1}
2. {Reason 2}
3. {Reason 3}

### Path to Approval

{What would need to change for this intent to be approved?}

---

## Clarification Questions (if REQUEST_CLARIFICATION)

> Questions that must be answered before a verdict can be rendered.

1. {Question 1}
   - **Why it matters**: {context}
   - **Options considered**: {what you're weighing}

2. {Question 2}
   - **Why it matters**: {context}
   - **Options considered**: {what you're weighing}

---

## Next Steps

### If APPROVE

```bash
# Capture approval evidence
mentu capture "Approved INTENT-{Name}: {summary}" \
  --kind approval \
  --path docs/AUDIT-{Name}-v{X.Y}.md \
  --actor agent:claude-lead

# Execute craft chain
/craft {Name}-v{X.Y}
```

### If REJECT

```bash
# Capture rejection evidence
mentu capture "Rejected INTENT-{Name}: {reason}" \
  --kind rejection \
  --path docs/AUDIT-{Name}-v{X.Y}.md \
  --actor agent:claude-lead

# Notify (if bridge command)
# The AUDIT document serves as the rejection record
```

### If REQUEST_CLARIFICATION

```bash
# Capture clarification request
mentu capture "Clarification needed for INTENT-{Name}" \
  --kind clarification-request \
  --path docs/AUDIT-{Name}-v{X.Y}.md \
  --actor agent:claude-lead

# Annotate if there's an existing commitment
mentu annotate cmt_XXXXXXXX "Awaiting clarification" --actor agent:claude-lead
```

---

## Audit Trail

| Timestamp | Action | Actor | Evidence |
|-----------|--------|-------|----------|
| {timestamp} | Audit started | agent:claude-lead | Checkpoint: {sha} |
| {timestamp} | Philosophy evaluated | agent:claude-lead | - |
| {timestamp} | Feasibility assessed | agent:claude-lead | - |
| {timestamp} | Risks assessed | agent:claude-lead | - |
| {timestamp} | Verdict rendered | agent:claude-lead | mem_XXXXXXXX |

---

*This audit was performed by a Leading Agent with full local filesystem access, MCP tooling, and codebase context.*
