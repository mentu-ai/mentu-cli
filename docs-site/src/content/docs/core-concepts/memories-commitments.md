---
title: Memories & Commitments
description: The two fundamental objects in Mentu
order: 2
---

## Memories

Memories are the foundation of Mentu. They represent things observed.

### Creating Memories

```bash
mentu capture "Found bug in auth flow"
```

### Memory States

| State | Description |
|-------|-------------|
| `untriaged` | Not yet processed |
| `linked` | Linked to a commitment |
| `dismissed` | Marked as not actionable |
| `committed` | Is source of a commitment |

### Memory Kinds

Memories can be classified by kind:

- `observation` - General observation (default)
- `evidence` - Proof of work completion
- `task` - A task to be done
- `bug` - A bug report
- `idea` - A feature idea

```bash
mentu capture "All tests passing" --kind evidence
```

## Commitments

Commitments are promises that must be kept.

### Creating Commitments

Commitments must trace to a source memory:

```bash
mentu commit "Fix the auth bug" --source mem_abc123
```

### Commitment Lifecycle

```
open → claimed → in_review → closed
                    ↓           ↓
                reopened ←──────┘
```

### Commitment States

| State | Description |
|-------|-------------|
| `open` | Created, not claimed |
| `claimed` | Someone working on it |
| `in_review` | Submitted, awaiting approval |
| `closed` | Approved or auto-closed |
| `reopened` | Rejected, needs rework |

## The Link

Every commitment has a `source` field linking to its origin memory. This creates an unbroken chain from observation to obligation.

```bash
mentu show cmt_def456
# Shows: source: mem_abc123
```

## Next

- [The Three Rules](/knowledge-base/core-concepts/three-rules/)
- [Glossary](/knowledge-base/core-concepts/glossary/)
