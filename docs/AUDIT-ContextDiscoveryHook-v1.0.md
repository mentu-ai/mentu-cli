---
id: AUDIT-ContextDiscoveryHook-v1.0
path: docs/AUDIT-ContextDiscoveryHook-v1.0.md
type: audit
intent: reference
version: "1.0"
created: 2026-01-03
last_updated: 2026-01-03
auditor: agent:claude-auditor
author_type: auditor
trust_level: trusted
checkpoint:
  git_sha: c435fac64d4c683b15ca67cdaa1bd57537909d29
  timestamp: 2026-01-03T04:47:17Z
verdict: APPROVE
mentu:
  evidence: mem_980333f8
  status: pending
---

# AUDIT: Context Discovery Hook v1.0

**Auditor**: agent:claude-auditor
**Date**: 2026-01-03
**Verdict**: APPROVE

---

## Intent Summary

**Source**: Inline conversation (Rashid → Claude)

| Section | Content |
|---------|---------|
| **What** | Build a Context Discovery Hook that scans YAML frontmatter from documents and injects conversational awareness at session start |
| **Why** | Enable AI to recall context without holding memory; documents become discoverable memory via their frontmatter signage |
| **Constraints** | No explicit commands (invisible to user); builds on existing session_start.py; uses existing frontmatter spec |
| **Expected Outcome** | Session starts with natural language context about recent work, open tasks, and related documents |

---

## Philosophy Alignment

| Principle | Alignment | Evidence |
|-----------|-----------|----------|
| `evidence-required` | Aligned | Documents with frontmatter are evidence of past work |
| `lineage-preserved` | **Direct** | Context discovery surfaces document relationships and origins |
| `append-only` | Aligned | Read-only scanning; no document modifications |

**Genesis Reference**: The genesis.key principle "Every commitment traces to its origin" is directly supported by surfacing document lineage at session start.

---

## Technical Assessment

### Existing Infrastructure

| Component | Location | Reusability |
|-----------|----------|-------------|
| Session hook architecture | `.claude/hooks/session_start.py` | Direct pattern |
| YAML frontmatter spec | `docs/Canonical-Front-Matter-Spec.md` | Schema definition |
| Document discovery | `.claude/hooks/doc_sync.py:41-56` | Glob pattern |
| YAML parsing | `src/core/craft-node.ts:131-132` | `YAML.parse()` |
| Context injection | `session_start.py:239-242` | `additionalContext` |

### Gaps Identified

1. No centralized Python frontmatter extractor (regex in doc_sync.py)
2. No document filtering by date/status/actor
3. No craft node scanning in session hook

### Implementation Path

```
SessionStart Hook
     ↓
Scan docs/*.md + .mentu/craft/*/node.yaml
     ↓
Extract YAML frontmatter (--- block ---)
     ↓
Filter by: last_updated (7 days), mentu.status, type
     ↓
Build natural language context
     ↓
Inject via additionalContext
```

---

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Scope Creep | Low | Bounded to session hook; read-only |
| Breaking Changes | Low | Additive to existing hook infrastructure |
| Performance | Low | Scan limited to docs/ and .mentu/craft/; file I/O is fast |
| Security | Low | No external access; local filesystem only |
| Reversibility | Low | Hook can be disabled in hooks.json |

---

## Effort Estimation

**Tier**: T2 (Feature)

**Rationale**: Single Python hook file following established patterns. Estimated 2-3 hours.

**Deliverables**:
1. `.claude/hooks/context_discovery.py` - Main hook
2. Update `hooks.json` to register hook
3. Optional: `src/core/document-scanner.ts` for reusable TypeScript discovery

---

## Verdict: APPROVE

The Context Discovery Hook:

1. **Aligns with genesis principles** - Surfaces lineage and document relationships
2. **Uses proven infrastructure** - Session hooks, YAML parsing, glob discovery
3. **Low risk, high value** - Conversational memory without holding state
4. **Bounded scope** - Read-only scanning of known paths

### Conditions

1. MUST scan only `docs/` and `.mentu/craft/` directories
2. MUST use existing frontmatter schema (no new fields)
3. MUST inject context as natural language, not commands
4. SHOULD filter by recency (last 7-14 days by default)
5. SHOULD include craft node status alongside document context

### Modifications

None required. Intent is clean and well-scoped.

---

## Provenance

- Checkpoint: `c435fac64d4c683b15ca67cdaa1bd57537909d29`
- Audit Evidence: `mem_980333f8`
- Intent Source: Inline conversation (2026-01-03)

---

*Approved for execution. Proceed to /craft.*
