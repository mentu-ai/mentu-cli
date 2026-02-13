---
title: "Glossary"
description: "Comprehensive reference of every term, operation, state, and convention used in Mentu."
---

## Core Objects

### Memory

An observation recorded in the ledger. Memories are the raw inputs to the system — things noticed, discovered, measured, or reported. They carry no obligation on their own but serve as the traceable origin for commitments. Created by the `capture` operation. ID prefix: `mem_`.

### Commitment

An obligation recorded in the ledger. A promise that specific work will be done, always traced back to a source memory. Created by the `commit` operation. ID prefix: `cmt_`.

### Evidence

Structured proof attached to a commitment at closure. Evidence is what separates "marking done" from "proving done." It is an array of typed entries (link, text, metric, file) that permanently document what was delivered. Required by the `close` and `submit` operations.

### Ledger

The append-only record of all operations. The ledger is the single source of truth in Mentu. There are no mutable rows — state is computed by replaying operations in sequence. Nothing in the ledger is ever edited or deleted.

### Operation

A single recorded action in the ledger. Every state transition, annotation, and creation is stored as an operation. Each operation captures what happened, who did it, when, and to which object. Operations are immutable once recorded.

---

## Operations

Mentu has exactly 12 operations. Each triggers a specific state transition (or adds information without changing state).

### capture

Creates a new memory in the `untriaged` state. Records an observation in the ledger.

```
mentu_capture({ "title": "...", "body": "...", "tags": [...] })
```

### commit

Creates a new commitment in the `open` state. Requires a `source` field referencing an existing memory ID. Transitions the source memory to the `committed` state.

```
mentu_commit({ "title": "...", "source": "mem_xxx", "priority": "high" })
```

### claim

Transitions a commitment from `open` or `reopened` to `claimed`. Signals that an actor has taken ownership and is working on it.

```
mentu_claim({ "commitment": "cmt_xxx" })
```

### release

Transitions a commitment from `claimed` back to `open`. The claimant gives up ownership, making it available for someone else to pick up.

```
mentu_release({ "commitment": "cmt_xxx" })
```

### submit

Transitions a commitment from `claimed` to `in_review`. The claimant sends their work for review, entering the accountability airlock. Includes evidence.

```
mentu_submit({ "commitment": "cmt_xxx", "evidence": [...] })
```

### approve

Transitions a commitment from `in_review` to `closed`. A reviewer accepts the submitted work and evidence.

```
mentu_approve({ "commitment": "cmt_xxx" })
```

### reopen

Transitions a commitment from `in_review` or `closed` to `reopened`. Indicates the work is incomplete or incorrect and needs further attention.

```
mentu_reopen({ "commitment": "cmt_xxx", "reason": "..." })
```

### close

Transitions a commitment from `claimed` to `closed` directly, bypassing the review airlock (Tier 1). Requires an `evidence` array with at least one entry.

```
mentu_close({ "commitment": "cmt_xxx", "evidence": [...] })
```

### annotate

Adds a note to a memory or commitment without changing its state. Used for context, updates, or supplementary information.

```
mentu_annotate({ "target": "cmt_xxx", "note": "..." })
```

### link

Transitions a memory from `untriaged` to `linked`. Associates the memory with an existing commitment as additional context, without creating a new commitment.

```
mentu_link({ "memory": "mem_xxx", "commitment": "cmt_yyy" })
```

### dismiss

Transitions a memory from `untriaged` to `dismissed`. Records a conscious decision to not act on the observation. The memory remains in the ledger permanently.

```
mentu_dismiss({ "memory": "mem_xxx", "reason": "..." })
```

### triage

Bulk operation for processing untriaged memories. Allows reviewing and routing multiple memories at once (committing, linking, or dismissing each).

```
mentu_triage({ "actions": [{ "memory": "mem_xxx", "action": "dismiss", "reason": "..." }, ...] })
```

---

## Memory States

### untriaged

The initial state of a freshly captured memory. No decision has been made about whether to act on it, link it, or dismiss it.

### linked

The memory has been associated with an existing commitment as additional context. It can still be promoted to `committed` if a new commitment is later sourced from it.

### committed

The memory has been promoted into a new commitment via the `commit` operation. This is a terminal state — the memory served its purpose as the origin of an obligation.

### dismissed

A conscious decision was made to not act on the memory. The memory remains in the ledger for the record. A dismissed memory can still be promoted to `committed` if circumstances change.

---

## Commitment States

### open

The commitment has been created but not yet claimed by anyone. It is available for an actor to pick up.

### claimed

An actor has taken ownership of the commitment. Work is expected to be in progress.

### in_review

The claimant has submitted their work for review. The commitment is in the accountability airlock, waiting for a reviewer to approve or reopen.

### closed

The commitment has been completed with evidence. This is the primary terminal state. A closed commitment can be reopened if the work is later found to be incomplete.

### reopened

A previously closed or reviewed commitment has been sent back for more work. It needs to be claimed again before further progress can be made.

---

## Concepts

### Genesis Key

The first operation on any object. For a memory, the genesis key is the `capture` operation. For a commitment, the genesis key is the `commit` operation. The genesis key establishes the object's identity and initial state in the ledger.

### Accountability Airlock

The `in_review` state and the two-step closure process (`submit` then `approve`). The airlock ensures that the person certifying completion is not the same person who did the work. This separation of concerns is especially important in agent workflows, where an AI agent performs the work and a human or different agent validates the output.

### Operation Envelope

The immutable wrapper around every recorded action. An operation envelope contains:

| Field | Description |
|-------|-------------|
| `id` | Unique operation ID (prefix: `op_`) |
| `type` | The operation name (e.g., `capture`, `commit`, `claim`) |
| `target` | The ID of the object being acted on (`mem_` or `cmt_`) |
| `actor` | Who performed the operation (e.g., `human:jane`, `agent:claude`) |
| `timestamp` | ISO 8601 timestamp of when the operation was recorded |
| `payload` | Operation-specific data (evidence, notes, source, reason, etc.) |

### Tiered Review

Mentu's three levels of review rigor for commitment closure:

- **Tier 1 (Auto):** Direct `close` from `claimed`. Claimant is worker and approver. Evidence required.
- **Tier 2 (Async):** `submit` then `approve`. Reviewer acts asynchronously. Evidence required at submit.
- **Tier 3 (Sync Gate):** Same mechanics as Tier 2, but downstream work is blocked until approval. The `in_review` state acts as a hard gate.

---

## ID Prefixes

| Prefix | Object |
|--------|--------|
| `mem_` | Memory |
| `cmt_` | Commitment |
| `op_` | Operation |

All IDs are globally unique within a workspace. The prefix makes it immediately clear what type of object an ID refers to, without needing to query the API.

---

## Actor Format

Actors are identified by a type prefix and a name, separated by a colon.

| Format | Description | Example |
|--------|-------------|---------|
| `human:<identifier>` | A human user | `human:jane`, `human:rashid` |
| `agent:<identifier>` | An AI agent or automated system | `agent:claude-code`, `agent:ci-pipeline` |

The actor is recorded on every operation envelope. This allows the ledger to distinguish between human and agent actions, enabling audit queries like "show me all closures by agents" or "which human approved this commitment."

---

## Evidence Types

Evidence entries are typed objects within the evidence array.

| Type | Description | Example Value |
|------|-------------|---------------|
| `link` | URL to an external artifact | `https://github.com/acme/api/pull/247` |
| `text` | Free-form description | `"Tested 20 sends. All arrived within 5s."` |
| `metric` | Measured outcome | `"p95 latency: 380ms (down from 2.3s)"` |
| `file` | Reference to an artifact | `"screenshot-2026-02-13.png"` |

Each evidence entry can also include an optional `label` field for human-readable context (e.g., `"label": "PR #247 — rate limiter middleware"`).
