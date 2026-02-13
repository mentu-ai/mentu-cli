---
id: INTENT-AuthorTypesCLI-v1.0
type: intent
created: 2026-01-02
author: agent:claude-architect
author_type: architect
trust_level: untrusted
mentu:
  commitment: cmt_60da6fd1
  evidence: mem_971ee382
---

# INTENT: Author Type Flag for mentu capture

## What

Add a `--author-type` flag to the `mentu capture` command that enables explicit trust gradient classification at capture time. This connects CLI operations to the existing author type system defined in `src/utils/author.ts`.

```
┌─────────────────────────────────────────────────────────────┐
│                     TRUST GRADIENT                          │
│                                                             │
│   mentu capture "..." --author-type architect               │
│   mentu capture "..." --author-type auditor                 │
│   mentu capture "..." --author-type executor                │
│                                                             │
│   Each flag value maps to a trust level:                    │
│   architect → untrusted                                     │
│   auditor   → trusted                                       │
│   executor  → authorized                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Why

### The Gap

The trust gradient system exists in code (`src/utils/author.ts`) but has no CLI surface. Agents and users cannot declare their role when capturing observations. This breaks the accountability chain:

1. **No provenance at capture time** — Memories lack author attribution
2. **Post-hoc classification** — Trust must be inferred from context or kind
3. **Incomplete audit trail** — Reviewers cannot verify who-did-what-as-whom

### The Opportunity

The specification (`docs/specs/SPEC-AuthorTypes-v1.0.md`, lines 532-562) already defines the interface:

```bash
mentu capture "Strategic intent" --author-type architect --kind architect-intent
```

The utility functions already exist:
- `resolveAuthorType()` — Resolution from flag/env/config/kind
- `buildAuthorMeta()` — Constructs metadata structure
- `isValidAuthorType()` — Validates input values

The capture command just needs to wire them together.

### The Value

**For agents**: Explicit role declaration enables trust-appropriate workflows. An agent operating as `architect` knows it should not produce implementation details.

**For audit**: Every memory carries its origin role. When validation fails, attribution points to the responsible author type.

**For governance**: Genesis.key constraints on author types become enforceable at the CLI layer.

---

## Constraints

### MUST

- Accept `--author-type <type>` flag on `mentu capture`
- Validate author type is one of: `architect`, `auditor`, `executor`
- Store author type in `payload.meta.author_type`
- Compute and store trust level in `payload.meta.trust_level`
- Support `MENTU_AUTHOR_TYPE` environment variable as fallback
- Emit author type in JSON output when `--json` flag is present

### MUST NOT

- Change behavior for captures without the flag (backward compatible)
- Enforce genesis.key constraints (that's validation, not capture)
- Require provenance flags (those are separate concerns)
- Modify the ledger format (meta field already exists)

### SHOULD

- Follow the resolution priority: flag > env > actor default > kind inference
- Validate allowed operations when genesis.key is present
- Emit helpful error messages for invalid author types
- Update CLI help text with author type documentation

### MAY

- Add `--provenance-intent` and `--provenance-audit` flags in future iteration
- Add `--trust-level` flag for explicit override (lower priority)
- Auto-infer author type from `--kind` when not specified

---

## Expected Outcome

### Success Criteria

1. `mentu capture "..." --author-type architect` succeeds and stores `meta.author_type: "architect"`
2. `mentu capture "..." --author-type invalid` fails with `E_INVALID_OP` error
3. `MENTU_AUTHOR_TYPE=auditor mentu capture "..."` uses auditor as default
4. JSON output includes `author_type` and `trust_level` fields when applicable
5. Help text documents the new flag
6. All existing tests continue to pass

### Artifacts

| Artifact | Purpose |
|----------|---------|
| Updated `capture.ts` | Add `--author-type` option handling |
| Updated `CapturePayload` | Ensure meta field supports author metadata |
| Updated `CaptureOutput` | Include author type in JSON output |
| New unit tests | Validate flag parsing and meta storage |

---

## Non-Goals

This intent explicitly excludes:

1. **Constraint enforcement** — Genesis.key validation is a separate concern
2. **Provenance flags** — `--provenance-intent` and `--provenance-audit` are future work
3. **Other commands** — Only `capture` is in scope; `commit`, `annotate` etc. are future
4. **Trust elevation logic** — How trust flows through chains is not changed

---

## Open Questions

1. **Kind validation**: Should `--author-type architect` warn if `--kind` is not an architect kind?
   - *Recommendation*: Warn but allow (soft constraint, not hard enforcement)

2. **Actor binding**: If genesis.key binds an actor to a specific author type, should we reject mismatched flags?
   - *Recommendation*: Defer to Phase 2 enforcement, accept all in Phase 1

3. **Default inference**: When `--kind architect-intent` is used without `--author-type`, should we infer?
   - *Recommendation*: Yes, via existing `resolveAuthorType()` logic

---

## Provenance

This intent bridges the gap between the theoretical trust gradient specification and practical CLI usage. It is the minimal viable step toward full provenance tracking.

```
Author Type: architect
Trust Level: untrusted
Status: Awaiting audit
```

---

*Strategic Intent Document - Created by Architect for Auditor validation.*
