---
title: The Three Rules
description: The foundational rules of the Mentu protocol
order: 3
---

## Rule 1: Commitments Trace to Memories

Every commitment must have a source memory. This is not optional.

```bash
# This works
mentu capture "Bug found in login"
mentu commit "Fix login bug" --source mem_xxx

# This does NOT work
mentu commit "Fix something"  # Error: --source required
```

**Why?** Obligations don't appear from nowhere. Every promise has an origin. The ledger records that origin.

## Rule 2: Closure Requires Evidence

Commitments cannot be marked done. They must be closed with proof.

```bash
# This works
mentu capture "Tests passing, code reviewed" --kind evidence
mentu close cmt_xxx --evidence mem_yyy

# This does NOT work
mentu close cmt_xxx  # Error: --evidence required
```

**Why?** "Done" is a claim. Claims require evidence. The ledger records that evidence.

## Rule 3: Append-Only

The ledger is append-only. Nothing is edited. Nothing is deleted.

- You cannot modify a past operation
- You cannot delete an entry
- Mistakes are corrected with new operations

**Why?** History is immutable. Reconstruction is possible. Trust is verifiable.

## The Exception: Auto-Close

Some scenarios allow closure without external evidence:

### Duplicate Closure

```bash
mentu close cmt_xxx --duplicate-of cmt_yyy
```

The duplicate reference serves as evidence.

### Tier 1 Auto-Approval

```bash
mentu submit cmt_xxx --tier tier_1
```

Tier 1 commitments auto-approve on submission.

## Summary

| Rule | Enforcement |
|------|-------------|
| Trace | `--source` required on commit |
| Evidence | `--evidence` required on close |
| Append-only | No edit/delete operations exist |

## Next

- [Glossary](/knowledge-base/core-concepts/glossary/)
- [CLI Reference](/knowledge-base/cli-reference/overview/)
