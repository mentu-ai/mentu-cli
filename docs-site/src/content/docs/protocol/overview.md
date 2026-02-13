---
title: "Protocol Overview"
description: "Formal specification of the Mentu protocol: twelve operations, two objects, three rules"
---

The Mentu protocol is the formal specification that governs how commitments and memories are created, tracked, and closed. Everything in Mentu — the CLI, the dashboard, the MCP server — is an implementation of this protocol.

## Core Primitives

The protocol is built on a deliberately minimal set of primitives:

- **Twelve operations** — the only ways to mutate state
- **Two objects** — commitments and memories
- **Three rules** — the invariants that must always hold

## The Ledger

The ledger is the source of truth. It lives at `.mentu/ledger.jsonl` — an append-only JSON Lines file where each line is a single operation.

```
{"id":"op_a1b2c3d4","op":"commit","ts":"2026-01-15T10:00:00Z","actor":"human:rashid","workspace":"vendora","payload":{...}}
{"id":"op_e5f6g7h8","op":"claim","ts":"2026-01-15T10:01:00Z","actor":"agent:claude","workspace":"vendora","payload":{...}}
{"id":"op_i9j0k1l2","op":"submit","ts":"2026-01-15T11:30:00Z","actor":"agent:claude","workspace":"vendora","payload":{...}}
```

### Append-Only

Operations are never modified or deleted. Once written, a line in the ledger is permanent. This property makes the ledger trivially auditable — you can always reconstruct the complete history of any object.

### State Is Computed, Never Stored

There is no "commitments table" or "memories table" with a `status` column. The current state of any object is computed by replaying all operations that reference it, in timestamp order.

To determine a commitment's state:

1. Find the `commit` operation that created it
2. Replay all subsequent operations (`claim`, `submit`, `close`, etc.) in order
3. The final state after replay is the current state

This is the protocol's most important design decision. It means:

- There is no stale cache to invalidate
- There is no state inconsistency between replicas
- Any agent or tool can independently compute the same state from the same ledger

## The Sacred Invariant

> **Read ledger, write ops.**

This is the one rule that every Mentu implementation must follow:

- To **read** state: replay the ledger
- To **change** state: append an operation to the ledger

No implementation may store derived state as the source of truth. Caches and materialized views are allowed for performance, but the ledger is always authoritative.

## The Three Rules

### Rule 1: Append-Only

Operations are only ever appended. No operation is ever modified or deleted.

### Rule 2: Deterministic Replay

Given the same sequence of operations, every implementation must compute the same state. There is no ambiguity in how operations are interpreted.

### Rule 3: Operation Validity

An operation is valid only if it represents a legal state transition. For example, you cannot `close` a commitment that is in the `open` state — it must first be `claimed` and then `submitted` (or use `close_direct` with appropriate permissions).

## The Twelve Operations

| Operation | Object | Description |
|-----------|--------|-------------|
| `commit` | Commitment | Create a new commitment |
| `claim` | Commitment | Assign a commitment to an actor |
| `unclaim` | Commitment | Release a claimed commitment |
| `evidence` | Commitment | Attach evidence to a claimed commitment |
| `submit` | Commitment | Submit a commitment for review |
| `close` | Commitment | Close a commitment (with verdict) |
| `reopen` | Commitment | Reopen a closed or dismissed commitment |
| `dismiss` | Commitment | Discard a commitment |
| `capture` | Memory | Create a new memory |
| `annotate` | Memory | Add annotation to a memory |
| `triage` | Memory | Classify and prioritize a memory |
| `link` | Both | Link a memory to a commitment |

## Two Objects

### Commitment

A unit of work with a defined lifecycle. Commitments move through states: `open` -> `claimed` -> `in_review` -> `closed`. They carry evidence and are bound to accountability rules.

### Memory

A unit of context. Memories capture information — bug reports, decisions, notes — that inform commitment work. Memories are referenced by commitments but have their own lifecycle.

## Version History

| Version | Milestone | Operations Added |
|---------|-----------|-----------------|
| **v0.1** | Core operations | `commit`, `claim`, `close`, `capture`, `annotate`, `link` |
| **v0.8** | Triage operations | `triage`, `unclaim`, `dismiss`, `evidence` |
| **v1.0** | Review operations | `submit`, `reopen` |

The protocol has evolved to support increasingly sophisticated workflows while maintaining backward compatibility. A v0.1 ledger is still valid under v1.0 — new operations are additive, never breaking.
