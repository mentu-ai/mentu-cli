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
# type: Document classification. Fixed as "prd" for this template.
# intent: Fixed as "reference" - PRDs define requirements for agents to reference.
id: PRD-{Name}-v{X.Y}
path: docs/PRD-{Name}-v{X.Y}.md
type: prd
intent: reference

# VERSIONING
# version: Semantic version. Start at "1.0", increment on changes.
# created: ISO 8601 date when document was created. Never modify.
# last_updated: ISO 8601 date of last edit. Update on every change.
version: "1.0"
created: YYYY-MM-DD
last_updated: YYYY-MM-DD

# TIER
# tier: Task complexity. T1=simple, T2=feature, T3=multi-part, T4=orchestrated.
tier: T2

# RELATIONSHIPS
# children: IDs of HANDOFF documents that implement this PRD.
# dependencies: IDs of documents that must be read to understand this PRD.
children:
  - HANDOFF-{Name}-v{X.Y}
dependencies:
  - {Prerequisite-Document-ID}

# MENTU INTEGRATION
# Required for T2+ PRDs. Tracks commitment lifecycle.
# commitment: Set to "pending" initially, then update to cmt_XXXXXXXX after mentu commit.
# status: Current state. pending -> claimed -> in_review -> closed/reopened.
mentu:
  commitment: pending
  status: pending
---

# PRD: {Name} v{X.Y}

## Mission

{One paragraph stating what this PRD delivers and why it matters. Focus on outcome, not implementation.}

---

## Problem Statement

### Current State

```
{Diagram or description of how things work now}
```

{Description of what's broken, missing, or suboptimal.}

### Desired State

```
{Diagram or description of how things should work}
```

{Description of the improved state after implementation.}

---

## Completion Contract

**First action**: Create the feature list at the commitment-scoped path:

```bash
mkdir -p .mentu/feature_lists
# Create: .mentu/feature_lists/cmt_XXXXXXXX.json
```

**Path**: `.mentu/feature_lists/cmt_XXXXXXXX.json`

> **Legacy fallback**: If `MENTU_COMMITMENT` is not set, the hook reads from `feature_list.json` at the repository root.

```json
{
  "$schema": "feature-list-v1",
  "instruction_id": "HANDOFF-{Name}-v{X.Y}",
  "created": "{ISO-timestamp}",
  "status": "in_progress",
  "tier": "{T1|T2|T3|T4}",
  "mentu": {
    "commitment": "cmt_XXXXXXXX",
    "source": "mem_XXXXXXXX"
  },
  "features": [
    {
      "id": "F001",
      "description": "{First acceptance criterion}",
      "passes": false,
      "evidence": null
    },
    {
      "id": "F002",
      "description": "{Second acceptance criterion}",
      "passes": false,
      "evidence": null
    }
  ],
  "checks": {
    "tsc": true,
    "build": true,
    "test": "{true|false}"
  }
}
```

The stop hook (`feature_enforcer.py`) will block until all features pass.

---

## Core Concepts

### {Concept 1}

{Definition and explanation of key abstraction or terminology.}

### {Concept 2}

{Definition and explanation of key abstraction or terminology.}

### {Concept 3}

{Definition and explanation of key abstraction or terminology.}

---

## Specification

### Types

```typescript
// Type definitions for this feature
interface {TypeName} {
  {field}: {type};
  {field}: {type};
}
```

### Operations

| Operation | Input | Output | Description |
|-----------|-------|--------|-------------|
| `{operation1}` | `{input}` | `{output}` | {What it does} |
| `{operation2}` | `{input}` | `{output}` | {What it does} |

### State Machine

```
{State diagram showing transitions}
```

| State | Meaning | Valid Transitions |
|-------|---------|-------------------|
| `{state1}` | {Description} | -> `{state2}`, `{state3}` |
| `{state2}` | {Description} | -> `{state3}` |

### Validation Rules

- {Rule 1: What MUST be true}
- {Rule 2: What MUST be true}
- {Rule 3: What MUST NOT happen}

---

## Implementation

### Deliverables

| File | Purpose |
|------|---------|
| `{path/to/file1.ts}` | {What this file does} |
| `{path/to/file2.ts}` | {What this file does} |
| `{path/to/file3.ts}` | {What this file does} |

### Build Order

1. **{Phase 1 Name}**: {Brief description}
2. **{Phase 2 Name}**: {Brief description}
3. **{Phase 3 Name}**: {Brief description}

### Integration Points

| System | Integration | Notes |
|--------|-------------|-------|
| `{system1}` | {How it integrates} | {Considerations} |
| `{system2}` | {How it integrates} | {Considerations} |

---

## Constraints

- {Constraint 1: What MUST NOT change}
- {Constraint 2: Backwards compatibility requirement}
- {Constraint 3: Performance requirement}
- {Constraint 4: Security requirement}

---

## Success Criteria

### Functional

- [ ] {Functional requirement 1}
- [ ] {Functional requirement 2}
- [ ] {Functional requirement 3}

### Quality

- [ ] {Quality requirement 1: e.g., "All files compile without errors"}
- [ ] {Quality requirement 2: e.g., "Test coverage > 80%"}
- [ ] {Quality requirement 3}

### Integration

- [ ] {Integration requirement 1: e.g., "Works with existing hooks"}
- [ ] {Integration requirement 2}
- [ ] {Integration requirement 3}

---

## Verification Commands

```bash
# Verify build
npm run build

# Verify tests
npm test

# Verify functionality
{specific verification command}

# Verify Mentu state
mentu list commitments --state open
```

---

## References

- `{Document-ID-1}`: {Brief description of relevance}
- `{Document-ID-2}`: {Brief description of relevance}
- `{Document-ID-3}`: {Brief description of relevance}

---

*{Closing statement capturing the essence of what this PRD delivers}*
