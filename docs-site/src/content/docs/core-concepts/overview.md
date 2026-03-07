---
title: Core Concepts Overview
description: Understanding the Mentu commitment ledger protocol
order: 1
---

## What is Mentu?

Mentu is a commitment ledger - an append-only record that links observations to commitments, and commitments to evidence. It provides accountability that's reconstructable.

## The Two Objects

### Memory

A **Memory** is something observed. Created with `mentu capture`.

```bash
mentu capture "Found bug in auth flow - tokens not refreshing"
# Returns: mem_abc12345
```

Memories are observations, ideas, bugs, notes - anything worth recording.

### Commitment

A **Commitment** is something owed. Created with `mentu commit`, referencing a source memory.

```bash
mentu commit "Fix token refresh bug" --source mem_abc12345
# Returns: cmt_def67890
```

Commitments are promises. They must be claimed, worked, and closed with evidence.

## The Lifecycle

```
Memory (observe) → Commitment (promise) → Evidence (prove) → Closure
```

1. **Observe**: Capture what you notice
2. **Promise**: Commit to action
3. **Prove**: Produce evidence
4. **Close**: Link evidence to commitment

## Next

- [The Three Rules](/knowledge-base/core-concepts/three-rules/)
- [Memories & Commitments](/knowledge-base/core-concepts/memories-commitments/)
