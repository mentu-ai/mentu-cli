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
#     CONTEXT documents do NOT include version numbers (they evolve in place).
# path: Relative path from repository root.
# type: Document classification. Fixed as "context" for this template.
# intent: Fixed as "reference" - CONTEXT documents provide background for decisions.
id: CONTEXT-{Name}
path: docs/CONTEXT-{Name}.md
type: context
intent: reference

# VERSIONING
# version: Semantic version. Increment on significant updates.
# created: ISO 8601 date when document was created. Never modify.
# last_updated: ISO 8601 date of last edit. Update on every change.
version: "1.0"
created: YYYY-MM-DD
last_updated: YYYY-MM-DD

# DOMAIN
# domain: The area of concern this context addresses.
#         Examples: architecture, security, operations, integration, protocol
domain: {domain}

# RELATIONSHIPS
# dependencies: Documents that should be read before this one.
# related: Documents that provide additional context (not prerequisites).
dependencies:
  - {Prerequisite-Document-ID}
related:
  - {Related-Document-ID}
---

# CONTEXT: {Name}

## Purpose

{One paragraph explaining why this context document exists and what problem it addresses. What decision or design does this context inform?}

---

## Background

{Historical context, previous attempts, or evolution of thinking that led to the current state. Why are things the way they are?}

---

## The Problem

{Clear statement of the problem or question this context addresses. What was unclear, broken, or missing?}

### Symptoms

- {Observable symptom 1}
- {Observable symptom 2}
- {Observable symptom 3}

### Root Cause

{Analysis of why the problem exists. Go deeper than symptoms.}

---

## Design Considerations

### Option 1: {Option Name}

{Description of this approach.}

**Pros:**
- {Advantage 1}
- {Advantage 2}

**Cons:**
- {Disadvantage 1}
- {Disadvantage 2}

### Option 2: {Option Name}

{Description of this approach.}

**Pros:**
- {Advantage 1}
- {Advantage 2}

**Cons:**
- {Disadvantage 1}
- {Disadvantage 2}

### Option 3: {Option Name} (Selected)

{Description of the chosen approach.}

**Pros:**
- {Advantage 1}
- {Advantage 2}

**Cons:**
- {Disadvantage 1}
- {Disadvantage 2}

**Why Selected:** {Rationale for choosing this option over others.}

---

## Key Decisions

### Decision 1: {Decision Title}

**Context:** {What situation prompted this decision?}

**Decision:** {What was decided?}

**Rationale:** {Why was this the right choice?}

**Consequences:** {What follows from this decision?}

### Decision 2: {Decision Title}

**Context:** {What situation prompted this decision?}

**Decision:** {What was decided?}

**Rationale:** {Why was this the right choice?}

**Consequences:** {What follows from this decision?}

---

## Constraints

{External factors that limit options or impose requirements.}

- **{Constraint 1}**: {Description and impact}
- **{Constraint 2}**: {Description and impact}
- **{Constraint 3}**: {Description and impact}

---

## Principles

{Guiding principles that informed the design. These are reusable across similar decisions.}

1. **{Principle 1}**: {Statement and explanation}
2. **{Principle 2}**: {Statement and explanation}
3. **{Principle 3}**: {Statement and explanation}

---

## Implementation Implications

{How do these decisions affect implementation? What should an implementing agent know?}

### For PRD Authors

- {Implication 1}
- {Implication 2}

### For HANDOFF Authors

- {Implication 1}
- {Implication 2}

### For Implementing Agents

- {Implication 1}
- {Implication 2}

---

## Open Questions

{Questions that remain unresolved. These may be addressed in future iterations.}

1. {Open question 1}
2. {Open question 2}
3. {Open question 3}

---

## References

- `{Document-ID-1}`: {Brief description of relevance}
- `{Document-ID-2}`: {Brief description of relevance}
- {External reference with URL if applicable}

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| {YYYY-MM-DD} | Initial creation | {actor} |
| {YYYY-MM-DD} | {Description of change} | {actor} |

---

*{Closing statement capturing the key insight from this context}*
