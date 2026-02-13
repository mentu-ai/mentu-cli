# Mentu Prompting Architecture

## Overview

The Mentu system is a **document-driven AI coordination architecture** that transforms strategic intent into executable code through a chain of structured documents. Each document type serves a specific purpose and is authored by a specific role, creating an auditable trail from idea to implementation.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DOCUMENT CHAIN FLOW                                  │
│                                                                             │
│   INTENT ──→ AUDIT ──→ PRD ──→ HANDOFF ──→ PROMPT ──→ RESULT               │
│     │          │        │         │          │          │                   │
│  Architect  Auditor  Architect  Architect  Architect  Executor              │
│     ▼          ▼        ▼         ▼          ▼          ▼                   │
│   "What"   "Should   "Full     "Build    "Launch    "Evidence"              │
│   "Why"    we do     Spec"     Order"    Command"                           │
│            this?"                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### 1. Actor Model

The system defines three actor types with different trust levels:

| Actor Type | Trust Level | Permissions | Responsibilities |
|------------|-------------|-------------|------------------|
| **Architect** | Strategic | Design, intent, decomposition | Creates INTENT, PRD, HANDOFF, PROMPT |
| **Auditor** | Trusted | Approve, modify, reject | Validates feasibility, risk, alignment |
| **Executor** | Authorized | Build, capture evidence | Implements code, creates RESULT |

### 2. Trust Gradient

```
UNTRUSTED ────────→ TRUSTED ────────→ AUTHORIZED
    │                   │                  │
 capture            + commit            + submit
 annotate           + claim             + close
                    + release
```

### 3. Commitment Tracking

Every unit of work is a **commitment** with:
- Unique ID (e.g., `cmt_4b9d8c93`)
- Owner (who's responsible)
- Status (open → in_progress → in_review → closed)
- Evidence (memories proving completion)

---

## Document Types

### 1. INTENT Document

**Purpose:** Capture strategic vision and "why"

**Author:** Architect

**Structure:**
```yaml
---
id: INTENT-{FeatureName}-v{X.Y}
type: intent
intent: reference
---

## What
[Clear statement of what will be built]

## Why  
[Business/user justification]

## Design Specification
[Visual mockups, data flow, component structure]

## Constraints
[Hard limits: no backend changes, read-only, etc.]

## Success Criteria
[How we know it's done]

## Handoff Notes
[Decomposition suggestions for auditor]
```

**Key Pattern:** INTENTs describe the destination, not the route.

---

### 2. AUDIT Document

**Purpose:** Validate feasibility, risk, and alignment before work begins

**Author:** Auditor (AI agent)

**Structure:**
```yaml
---
id: AUDIT-{FeatureName}-v{X.Y}
type: audit
verdict: APPROVE | MODIFY | REJECT
auditor: agent:claude-auditor
checkpoint:
  git_sha: {commit_hash}
---

## Intent Summary
[What the architect wants]

## Philosophy Alignment
[Does it serve project purpose?]

## Technical Feasibility
[Can existing architecture support this?]

## Risk Assessment
[Scope creep, breaking changes, security]

## Effort Estimate
[Tier: T1-T4, with rationale]

## Verdict
[APPROVE/MODIFY/REJECT with conditions]
```

**Verdict Types:**

| Verdict | Meaning | Next Action |
|---------|---------|-------------|
| APPROVE | Proceed as-is | Craft PRD |
| MODIFY | Valid but needs changes | Craft with conditions |
| REJECT | Do not proceed | Return to architect |

---

### 3. PRD (Product Requirements Document)

**Purpose:** Full technical specification for implementation

**Author:** Architect (post-audit)

**Structure:**
```yaml
---
id: PRD-{FeatureName}-{Workstream}-v{X.Y}
type: prd
tier: T1-T4
children:
  - HANDOFF-{FeatureName}-{Workstream}-v{X.Y}
---

## Mission
[One paragraph: what this delivers]

## Problem Statement
[Current state → Desired state]

## Completion Contract
[completion.json configuration]

## Core Concepts
[Definitions and types]

## Specification
[Types, routing, validation rules]

## Implementation
[Deliverables table, build order, integration points]

## Constraints
[Color palette, patterns to follow, etc.]

## Success Criteria
[Functional, quality, integration checklist]

## Verification Commands
[npm run build, tsc, route checks]
```

---

### 4. HANDOFF Document

**Purpose:** Step-by-step build instructions for executor

**Author:** Architect

**Structure:**
```yaml
---
id: HANDOFF-{FeatureName}-{Workstream}-v{X.Y}
type: handoff
author_type: executor
parent: PRD-{FeatureName}-{Workstream}-v{X.Y}
---

## For the Coding Agent
[Brief summary + pointer to PRD]

## Your Identity
[Actor resolution from manifest]

## Audit Context
[Reference to audit conditions]

## Completion Contract
[JSON for .claude/completion.json]

## Build Order
[Stage 1, Stage 2, ... Stage N with code samples]

## Visual Verification
[Screenshot capture points]

## Completion Phase
[RESULT document creation steps]

## Verification Checklist
[Files, checks, mentu operations, functionality]
```

**Key Pattern:** Each stage has:
1. Clear deliverable (file path)
2. Code sample (can be partial or complete)
3. Verification command

---

### 5. PROMPT Document

**Purpose:** Executable launch command for executor agent

**Author:** Architect

**Structure:**
```yaml
---
id: PROMPT-{FeatureName}-{Workstream}-v{X.Y}
type: prompt
parent: HANDOFF-{FeatureName}-{Workstream}-v{X.Y}
---

## Launch Commands
[Option A: Native Claude]
[Option B: With enforcer wrapper]

## Minimal Prompts
[Shortest viable commands]

## What This Prompt Delivers
[Deliverables table]

## Expected Duration
[Turns, complexity tier, commitment count]

## Verification After Completion
[Post-execution checks]
```

**Prompt Structure:**
```
# IDENTITY
[How to resolve actor from manifest]

# COGNITIVE STANCE
[Domain ownership: technical vs intent]

# MISSION
[What to build]

# CONTRACT
[Done when...]

# PROTOCOL
[Step-by-step execution order]

# CONSTRAINTS
[Hard limits]

# RECOVERY
[What to do if things fail]

# CONTEXT
[Documents to read]

# EVIDENCE
[What final message must include]
```

---

### 6. RESULT Document

**Purpose:** Evidence of completion

**Author:** Executor

**Structure:**
```yaml
---
id: RESULT-{FeatureName}-{Workstream}-v{X.Y}
type: result
parent: HANDOFF-{FeatureName}-{Workstream}-v{X.Y}
mentu:
  commitment: cmt_XXXXXXXX
  evidence: mem_YYYYYYYY
  status: in_review
---

## Summary
[What was delivered]

## Files Created/Modified
[List of all files]

## Verification Results
[Build output, type check output]

## Screenshots
[Visual evidence]

## Commitment Closed
[ID + summary]
```

---

## Workstream Decomposition

Large features are decomposed into **workstreams** (W1, W2, W3...) with explicit dependencies:

```
                    ┌────────────────┐
                    │  INTENT        │
                    │ (Full Feature) │
                    └───────┬────────┘
                            │
                            ▼
                    ┌────────────────┐
                    │  AUDIT         │
                    │ Verdict: MODIFY│
                    │ (Decompose)    │
                    └───────┬────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
            ▼               ▼               ▼
    ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
    │ W1: Shell     │ │ W2: Enhance   │ │ W3: Context   │
    │ (Critical     │ │ (Depends on   │ │ (Depends on   │
    │  Path)        │ │  W1)          │ │  W1)          │
    └───────┬───────┘ └───────┬───────┘ └───────────────┘
            │               │                   │
            │               │                   │
            │         ┌─────┴─────┐             │
            │         │ Can run   │             │
            │         │ parallel  │◄────────────┘
            │         │ after W1  │
            │         └───────────┘
            │
            ▼
    W1 must complete before W2-4 can start
```

**Naming Convention:**
- `INTENT-ThreePlanesNavigation-v1.0` (the full feature)
- `PRD-ThreePlanesNavigation-W1-v1.0` (workstream 1)
- `HANDOFF-ThreePlanesNavigation-W1-v1.0` (workstream 1)

---

## Tier System

Work complexity is classified into tiers:

| Tier | Description | Typical Scope | Max Iterations |
|------|-------------|---------------|----------------|
| T1 | Simple change | Single file, <50 lines | 15 |
| T2 | Feature | Multiple files, single concern | 30 |
| T3 | Multi-part | Cross-cutting, multiple components | 75 |
| T4 | Orchestrated | Multi-agent, multiple workstreams | 100+ |

The tier determines:
- `max_iterations` in completion.json
- Whether to decompose into workstreams
- Expected duration

---

## Completion Contract

### Preferred: feature_list.json

The `feature_list.json` file defines the Executor's contract with feature-based tracking:

```json
{
  "$schema": "feature-list-v1",
  "instruction_id": "HANDOFF-ThreePlanesNavigation-W1-v1.0",
  "created": "2026-01-11T10:00:00Z",
  "status": "in_progress",
  "tier": "T3",
  "mentu": {
    "commitment": "cmt_XXXXXXXX",
    "source": "mem_YYYYYYYY"
  },
  "features": [
    {
      "id": "F001",
      "description": "TopNav component",
      "passes": false,
      "evidence": null
    },
    {
      "id": "F002",
      "description": "WorkspaceSelector component",
      "passes": false,
      "evidence": null
    }
  ],
  "checks": {
    "tsc": true,
    "build": true,
    "test": false
  }
}
```

Each feature is marked `passes: true` when complete, with evidence linking to a Mentu memory.

### Legacy: completion.json

The `.claude/completion.json` file (v3.0 multi-agent schema) is still supported for backwards compatibility:

```json
{
  "version": "3.0",
  "schema": "multi-agent",
  "agents": {
    "agent:claude-executor": {
      "required_files": ["src/components/nav/TopNav.tsx"],
      "checks": {"tsc": true, "build": true},
      "mentu": {"enabled": true}
    }
  }
}
```

**Note**: When both files exist, `feature_list.json` takes priority.

---

## Protocol Operations

Executors interact with the Mentu system via CLI commands:

```bash
# Claim a commitment (start work)
mentu claim cmt_XXXXXXXX --author-type executor

# Capture evidence (progress)
mentu capture "Stage 3 complete: TopNav built" \
  --kind execution-progress \
  --author-type executor

# Submit commitment (end work)
mentu submit cmt_XXXXXXXX \
  --summary "W1 Navigation Shell complete" \
  --include-files
```

Evidence types (`--kind`):
- `execution-progress` - Work in progress
- `result-document` - Final RESULT document
- `audit-approval` - Audit completed
- `observation` - Raw data/event
- `evidence` - Proof of action

---

## File System Layout

```
workspace/
├── .mentu/
│   ├── manifest.yaml          # Actor identity source
│   ├── genesis.key            # Trust gradient and principles
│   └── knowledge/             # Reference documents
├── .claude/
│   ├── completion.json        # Exit criteria (legacy)
│   ├── settings.json          # MCP and plugin config
│   └── hooks/                 # Automation scripts
├── feature_list.json          # Executor contract (preferred)
├── docs/
│   ├── INTENT-*.md            # Strategic intents
│   ├── AUDIT-*.md             # Audit reports
│   ├── PRD-*.md               # Specifications
│   ├── HANDOFF-*.md           # Build instructions
│   ├── PROMPT-*.md            # Launch commands
│   ├── RESULT-*.md            # Completion evidence
│   └── templates/             # Document templates
└── src/                       # Application code
```

---

## Document Relationships

```yaml
# YAML front matter showing relationships

# In INTENT:
children:
  - AUDIT-ThreePlanesNavigation-v1.0

# In AUDIT:
intent_ref: INTENT-ThreePlanesNavigation-v1.0

# In PRD:
dependencies:
  - INTENT-ThreePlanesNavigation-v1.0
  - AUDIT-ThreePlanesNavigation-v1.0
children:
  - HANDOFF-ThreePlanesNavigation-W1-v1.0

# In HANDOFF:
parent: PRD-ThreePlanesNavigation-W1-v1.0
children:
  - PROMPT-ThreePlanesNavigation-W1-v1.0

# In PROMPT:
parent: HANDOFF-ThreePlanesNavigation-W1-v1.0

# In RESULT:
parent: HANDOFF-ThreePlanesNavigation-W1-v1.0
```

---

## Cognitive Stance Pattern

Each role owns a specific domain:

```
ARCHITECT                    AUDITOR                     EXECUTOR
────────────────────         ─────────────────           ─────────────────
Domain: Strategic            Domain: Validation          Domain: Technical

Owns:                        Owns:                       Owns:
- What to build              - Should we build it        - How to build it
- Why it matters             - Risk assessment           - Implementation
- Decomposition              - Feasibility               - Evidence capture

On failure in                On failure in               On failure in
own domain:                  own domain:                 own domain:
→ Re-think                   → Re-audit                  → Fix it

On failure in                On failure in               On failure in
other domain:                other domain:               other domain:
→ Coordinate                 → Flag to architect         → Re-read HANDOFF
```

This is expressed in prompts as:

```
# COGNITIVE STANCE
Your domain is TECHNICAL (executor role).
- Technical failures → Own it. Fix it. Don't explain.
- Intent/safety failures → You drifted. Re-read HANDOFF.
```

---

## Real Case: ThreePlanesNavigation

### Flow Summary

1. **INTENT** created: Three-plane navigation for mentu-web
   - Context, Capability, Execution planes
   - 12 new views total
   - Phase 1 read-only

2. **AUDIT** performed:
   - Verdict: **MODIFY**
   - Condition: Decompose into 4 workstreams
   - Risk: Low (scope creep medium)

3. **PRD-W1** crafted: Navigation Shell only
   - 12 required files
   - Build order: 11 stages
   - Tier: T3

4. **HANDOFF-W1** crafted:
   - Stage-by-stage instructions
   - Code samples for each component
   - Verification checkpoints

5. **PROMPT-W1** crafted:
   - Two launch options (native / enforcer)
   - Expected 50-75 turns
   - Clear exit criteria

6. **Executor launched** to build W1

### Why This Architecture Works

1. **Separation of Concerns**: Architect thinks strategically, executor builds tactically
2. **Audit Gate**: Prevents scope creep and ensures feasibility
3. **Incremental Delivery**: Workstreams can be built and validated independently
4. **Evidence Trail**: Every decision is documented and traceable
5. **Failure Isolation**: If W3 fails, W1 and W2 are preserved
6. **Parallel Execution**: W3 and W4 can run simultaneously after W1

---

## Principles

### 1. Evidence-Required
> Commitments close with proof, not assertion.

### 2. Lineage-Preserved
> Every commitment traces to its origin.

### 3. Append-Only
> Nothing edited, nothing deleted.

### 4. Domain Ownership
> Each role owns their failures in their domain.

### 5. Explicit Dependencies
> Workstreams declare what they need before starting.

---

## Summary

The Mentu architecture transforms:

```
Vague idea → Structured intent → Validated plan → Executable instructions → Verified code
```

By separating **what** (INTENT) from **should we** (AUDIT) from **how** (HANDOFF) from **execute** (PROMPT) from **proof** (RESULT), the system creates:

- Clear accountability
- Auditable decisions
- Recoverable checkpoints
- Parallelizable work
- Evidence-based completion

This is **prompt engineering as architecture**, not just prompt writing.