---
title: Architecture Overview
description: Understanding Mentu's architecture
order: 1
---

## Design Philosophy

Mentu follows one architectural invariant:

> **All components follow one rule: "Read ledger, write ops."**

No component stores its own state. State is always computed by replaying the ledger.

## Core Components

```
┌─────────────────────────────────────────────┐
│                   Client                    │
│        (CLI, Dashboard, Integrations)       │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│                Proxy Layer                  │
│         (Cloudflare Workers)                │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│               State Computer                │
│          (Ledger Replay Engine)             │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│                  Ledger                     │
│       (Append-only JSONL / Supabase)        │
└─────────────────────────────────────────────┘
```

## The Ledger

The ledger is the single source of truth. It's an append-only log of operations.

### Local Mode

```
.mentu/ledger.jsonl
```

### Remote Mode

```
Supabase PostgreSQL (operations table)
```

## State Computation

State is never stored. It's computed by replaying operations:

```typescript
function computeState(operations: Operation[]): State {
  return operations.reduce(applyOperation, initialState);
}
```

This means:
- State is always reconstructable
- History is always available
- No state corruption is possible

## Write Path

1. Client sends operation request
2. Validator checks invariants
3. Operation appended to ledger
4. State recomputed

## Read Path

1. Client requests state
2. Ledger replayed (or cached)
3. State returned

## Next

- [Ledger Format](/knowledge-base/architecture/ledger-format/)
- [Genesis Keys](/knowledge-base/architecture/genesis-keys/)
