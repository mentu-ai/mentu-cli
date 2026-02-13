---
document_type: directive
title: "Publishing Layer for Mentu"
version: "1.0"
status: strategic-intent
origin: conversation
date: 2026-01-02

# This document is strategic context, not implementation spec.
# The local agent must audit current state and interpret accordingly.

lineage:
  source: "Claude conversation with Rashid"
  context: "Multi-hour architectural discussion on Mentu platform evolution"
  artifacts_referenced:
    - "CLAUDE.md (workspaces root context)"
    - "mentu-cli/README.md"
    - "mentu-proxy/README.md"
    - "mentu-bridge/README.md"
    - "mentu-plugin/README.md"
    - "mentu/README.md (protocol)"
    - "CONTEXT-ReactiveWebhookArchitecture.md"

protocol_impact:
  new_operations: [publish]
  modified_commands: [close]  # evidence can now be pub_xxx
  new_id_prefix: pub_
  spec_update_required: true

execution:
  pattern: "directive → audit → interpret → /craft → execute"
  next_action: "Local agent runs /craft PublishingLayer-v1.0 after interpreting this directive"
---

# DIRECTIVE: Publishing Layer v1.0

## Classification

**This is a DIRECTIVE, not a PRD.**

A directive captures strategic intent and architectural context from a layer that lacks local access. It does not prescribe implementation details. The receiving agent must:

1. **Audit** current repository state
2. **Interpret** this directive against ground truth
3. **Execute** `/craft PublishingLayer-v1.0` with local knowledge
4. **Reference** this directive as origin in their commitment

---

## Strategic Intent

### The Problem

The Mentu protocol captures *that work happened*. It does not capture *what was produced*.

Agents produce artifacts: documentation, reports, diagrams, evidence. Today these artifacts:
- Live in local filesystems (ephemeral)
- Get pasted into Slack/tickets (no lineage)
- Have no permanent address (unlinkable)
- Cannot be traced back to the work that produced them

### The Solution

A publishing layer where agent output becomes **permanent**, **addressable**, and **traceable**.

When an agent produces an artifact:
1. It publishes to the layer
2. The artifact gets a stable URL
3. Lineage is recorded (who, when, from what commitment)
4. The URL can be referenced anywhere (ClickUp, Slack, docs)
5. Anyone viewing sees the content with its provenance

### The Outcome

"Published to Mentu" means:
- Permanent URL
- Version history
- Lineage footer showing origin
- Auditable back to commitment

---

## Architectural Decisions

These decisions emerged from conversation. The local agent should validate they align with current codebase patterns.

### 1. URL Strategy: Path Prefix on mentu.ai

**Decision:** Use `mentu.ai/p/...` for published content, not a separate domain.

```
mentu.ai/p/{workspace}/{module}/{path}
```

**Rationale:** Brand alignment. The publishing layer is part of Mentu, not a separate product.

**Binary assets** may use a shorter prefix for embedding:
```
mentu.ai/a/{workspace}/{asset_id}
```

### 2. Modules, Not Namespaces

**Decision:** Each content category is a *module* with distinct behavior, not just a URL segment.

| Module | Purpose | Rules |
|--------|---------|-------|
| `docs` | Documentation | Versioned, navigable |
| `evidence` | Proof of work | Immutable once linked to commitment |
| `artifacts` | General outputs | Versioned, flexible |
| `ledger` | Rendered ledger views | System-generated, computed |
| `assets` | Binary files | CDN-served, no versioning |

Each module defines:
- What content it accepts
- Who can write/read
- How versioning works
- How content renders
- Lifecycle rules

**This is extensible.** Workspaces can define custom modules (e.g., `changelog`, `rfcs`, `runbooks`).

### 3. Lineage is First-Class

Every published artifact records:
```yaml
lineage:
  actor: agent:documenter
  source_type: commitment
  source_id: cmt_abc123
  produced_at: 2026-01-02T...
```

This renders as a footer on every page. Viewers always know provenance.

### 4. Protocol Extension

**Decision:** `publish` is the **13th Mentu operation**, extending the protocol.

| Group | Operations |
|-------|------------|
| Core | capture, commit, claim, release, close, annotate |
| Review | submit, approve, reopen |
| Triage | link, dismiss, triage |
| **Publish** | **publish** |

This requires:
- Update to `docs/Mentu-Spec-v0.md`
- New operation handler in mentu-cli
- API endpoint in mentu-proxy

Publishing records to the ledger:
```json
{
  "op": "publish",
  "actor": "agent:documenter",
  "publish": {
    "id": "pub_xyz789",
    "module": "docs",
    "path": "auth-system/overview",
    "url": "mentu.ai/p/mentu/docs/auth-system/overview"
  },
  "source": {
    "type": "commitment",
    "id": "cmt_abc123"
  }
}
```

### 5. Evidence Type Expansion

**Decision:** Evidence can now be either a memory (`mem_xxx`) OR a published artifact (`pub_xxx`).

**Current behavior:**
```bash
mentu close cmt_abc123 --evidence mem_xyz789
```

**Extended behavior:**
```bash
mentu close cmt_abc123 --evidence pub_xyz789
```

This is a **protocol change** to the `close` command. The local agent must:
- Update `src/commands/close.ts` to accept `pub_` prefix
- Update validation logic in `src/core/validate.ts`
- Document in `docs/Mentu-Spec-v0.md`

### 6. Versioning Strategy

- **Mutable URL:** `mentu.ai/p/mentu/docs/overview` (always latest)
- **Immutable URL:** `mentu.ai/p/mentu/docs/overview?v=3` (pinned)

Query params for immutability. Configure CDN cache keys accordingly.

### 7. Rich Content (Phased)

Extended markdown with custom blocks. **Phased rollout:**

**Phase 3a (v1.0):**
- `mermaid` — diagrams (low risk, high value)

**Phase 3b (v1.1):**
- `::code[github:repo/path]{lines}` — snapshotted code reference

**Phase 3c (v1.2):**
- `::chart[data]{type}` — interactive charts
- `::video[src]` — video player
- `::secret[name]{level}` — redacted value, reveal on auth

**Code references snapshot at publish time.** No render-time API calls.

---

## What This Directive Does NOT Specify

The local agent must determine these through audit:

1. **File structure** — Where do new files go? What's the current pattern?
2. **Schema details** — What's the actual database schema? Supabase conventions?
3. **API patterns** — How are other APIs structured in mentu-proxy?
4. **Component patterns** — What's the React component structure in mentu-web?
5. **Existing module system** — Is there already a pattern for extensibility?
6. **Integration points** — How does mentu-cli currently work? What hooks exist?
7. **Storage backend** — Where does content live? Supabase storage? Cloudflare R2? Git?

**Do not assume. Audit.**

---

## Execution Protocol

### For the Local Agent

1. **Capture this directive as evidence:**
   ```bash
   mentu capture "Received DIRECTIVE-PublishingLayer-v1.0 from strategic conversation" --kind directive
   ```

2. **Audit current state:**
   - What exists in mentu-web, mentu-proxy, mentu-cli?
   - What patterns are established?
   - What schemas exist?
   - What conflicts with this directive?

3. **Interpret and adapt:**
   - Resolve conflicts between directive intent and current reality
   - Note any deviations and why

4. **Run /craft:**
   ```bash
   /craft PublishingLayer-v1.0
   ```
   This creates: PRD → HANDOFF → PROMPT with local knowledge

5. **Reference this directive:**
   In the PRD front matter:
   ```yaml
   lineage:
     directive: DIRECTIVE-PublishingLayer-v1.0
     directive_evidence: mem_XXXXXXXX
   ```

6. **Execute the HANDOFF:**
   The PRD and HANDOFF are now grounded in both strategic intent (this directive) and ground truth (local audit).

---

## Success Criteria

The publishing layer is complete when:

1. **An agent can publish:**
   ```bash
   POST mentu.ai/api/publish
   → Returns permanent URL
   ```

2. **Published content is viewable:**
   ```
   mentu.ai/p/mentu/docs/auth-system/overview
   → Renders markdown with lineage footer
   ```

3. **Evidence links to published artifacts:**
   ```bash
   mentu close cmt_xxx --evidence pub_yyy
   ```

4. **The Documenter Agent workflow works end-to-end:**
   - Agent claims commitment
   - Produces documentation
   - Publishes to mentu.ai/p/...
   - Closes commitment with published URL as evidence
   - User pastes URL in ClickUp
   - Anyone clicking sees rendered docs with provenance

---

## Phasing Guidance

### Phase 1: Core Publishing
- URL routing (`/p/...`)
- `docs` module (markdown rendering)
- Lineage capture and display
- Basic versioning
- Storage backend decision

### Phase 2: Protocol Integration
- `publish` operation added to spec
- `evidence` module
- Commitment → publish linking
- `close --evidence pub_xxx` support

### Phase 3a: Diagrams
- Mermaid rendering

### Phase 3b: Code References
- Code snapshots with GitHub integration

### Phase 4: Module System
- Module abstraction formalized
- Custom module registration
- Workspace-specific modules

**The local agent should validate this phasing against current velocity and dependencies.**

---

## Open Questions for Local Agent

1. Where should the rendering logic live? mentu-web (Next.js) or mentu-proxy (Cloudflare Worker)?

2. What's the auth pattern for workspace-scoped content?

3. Does the current DB schema support the publish model, or is migration needed?

4. What's the relationship between this and the existing "web engine" references in docs?

5. Should Phase 1 be a vertical slice (one module end-to-end) or horizontal (all modules, basic features)?

6. What is the storage backend for published content? Supabase storage, Cloudflare R2, or git-backed?

7. How does the `pub_` ID get generated? Same pattern as `mem_`/`cmt_` (8-char hex)?

---

## Summary

This directive captures strategic intent for a publishing layer that transforms Mentu from a commitment ledger into "the platform where agent work becomes permanent."

The directive is not implementation. It is context.

The local agent audits, interprets, and executes `/craft` to produce buildable specifications grounded in both this intent and ground truth.

---

*Origin: Conversation between Claude and Rashid, 2026-01-02*
*Purpose: Strategic input to /craft process*
*Next: Local agent interprets and runs `/craft PublishingLayer-v1.0`*
