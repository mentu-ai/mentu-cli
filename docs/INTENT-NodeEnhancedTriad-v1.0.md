---
id: INTENT-NodeEnhancedTriad-v1.0
type: intent
origin: architect
created: 2026-01-02
architect:
  actor: user:rashid
  session: workspaces-conversation
  context: Synthesizing Node architecture with Headless Triad Execution for mentu-bridge
mentu:
  commitment: cmt_552fac91
  status: pending
---

# Strategic Intent: Node-Enhanced Headless Triad

## What

Enhance the Headless Triad Execution pattern (Architect → Auditor → Executor) with the Node-as-Directory architecture, so that each triad execution becomes a returnable epistemic Node with identity, evolution tracking, relationships, and progressive YAML front matter. Teach this enhanced pattern to mentu-bridge so coding agents always implement it.

## Why

The current Headless Triad produces ephemeral artifacts (PRD, INSTRUCTION, RESULT) that exist as flat files. This misses the opportunity for:
- **Compound Returns**: Each execution could accumulate context and refinements
- **Network Effects**: Craft nodes could link to other craft nodes, commitments, and epistemic concepts
- **Recursive Intelligence**: Past executions inform future ones through evolution.log
- **Trust Boundaries**: Explicit trust levels per artifact, not implicit

The Node architecture (from mentu-physics documentation) provides the infrastructure to make each triad execution a first-class epistemic citizen.

## Constraints

- Must NOT break existing `/craft`, `/craft--auditor`, `/craft--executor` commands
- Must NOT require existing craft documents to be migrated immediately
- Must maintain backward compatibility with current `.claude/craft/` flat structure
- Must NOT introduce new dependencies or complex tooling
- The Node structure should be opt-in initially, becoming default over time
- Must respect the existing Mentu ledger as source of truth

## Expected Outcome

1. **New directory structure** under `.mentu/craft/` where each task is a Node folder
2. **Progressive YAML** in PRD, INSTRUCTION, RESULT documents that evolves through stages
3. **Evolution tracking** via `evolution.log` in each craft Node
4. **mentu-bridge integration** that triggers headless triad with Node structure
5. **Discovery/query** capability to find past craft executions by relationships

Success looks like: "A coding agent receives an intent via bridge, executes the Headless Triad, and produces a fully-formed Craft Node that can be returned to, linked, and evolved."

## Open Questions

1. Should the craft Node live under `.mentu/craft/` or `.mentu/nodes/craft/`?
2. How does the craft Node relate to Mentu commitments (cmt_xxx)?
3. Should we implement the full Progressive YAML (5 stages) or a simplified version?
4. What is the minimum viable Node structure for the first implementation?
