---
title: "How Mentu Works"
description: "The core model behind Mentu: memories, commitments, evidence chains, and the append-only ledger that ties them together."
---

Mentu is a commitment ledger. Not a task tracker, not a project management tool, not a to-do list. It is a system for recording obligations, linking them to their origins, and requiring proof before they can be closed. Every action is immutable — the ledger only grows, never shrinks.

This page covers the entire conceptual model in a single narrative.

## The Two Objects

Mentu has exactly two core objects. Everything else in the system exists to support their lifecycle.

### Memory

A **memory** is an observation. Something noticed, discovered, measured, or reported. It is the raw input to the system — the "why" behind future work.

```
mentu_capture({
  "title": "Checkout flow drops 12% of users at payment step",
  "body": "Analytics show 12.3% abandonment between cart review and payment confirmation. Spike started Feb 1.",
  "tags": ["analytics", "checkout", "regression"]
})
```

Memories are cheap to create. They carry no obligation. You can capture hundreds of observations without committing to act on any of them. Their role is to ensure nothing gets lost and everything has a traceable origin.

A memory has four possible states:
- **untriaged** — freshly captured, no decision made
- **linked** — associated with an existing commitment as additional context
- **committed** — promoted into a new commitment
- **dismissed** — explicitly decided to not act on

### Commitment

A **commitment** is an obligation. A promise that specific work will be done, traceable to the observation that motivated it.

```
mentu_commit({
  "title": "Fix payment step abandonment in checkout flow",
  "body": "Investigate and resolve the 12% drop-off. Target: reduce to <3%.",
  "source": "mem_abc123",
  "priority": "high"
})
```

The `source` field is required. Every commitment must trace back to a memory. This is not a suggestion — the API enforces it. You cannot create a free-floating obligation with no origin.

A commitment has five possible states: `open`, `claimed`, `in_review`, `closed`, and `reopened`. The full state machine is covered in [State Machine](/concepts/state-machine/).

## The Lifecycle: Observe, Promise, Prove, Close

The four phases of Mentu's lifecycle form its core loop.

### Phase 1: Observe

Capture what you see. A bug, a metric, a user complaint, an architectural concern, a test failure. The observation is recorded as a memory and enters the ledger in the `untriaged` state.

```
mentu_capture({
  "title": "API response times exceed 2s on /search endpoint",
  "body": "p95 latency hit 2.3s at 14:00 UTC. Normal baseline is 400ms.",
  "tags": ["performance", "api"]
})
// → mem_d4e5f6
```

### Phase 2: Promise

Decide to act. Create a commitment sourced from the memory. This transitions the memory to `committed` and creates a new commitment in the `open` state.

```
mentu_commit({
  "title": "Optimize /search endpoint to sub-500ms p95",
  "body": "Add query caching, index optimization, and connection pooling.",
  "source": "mem_d4e5f6",
  "priority": "high"
})
// → cmt_g7h8i9
```

### Phase 3: Prove

Do the work. When you are done, you do not mark the commitment as "done" — you prove it. Evidence is required for closure.

```
mentu_close({
  "commitment": "cmt_g7h8i9",
  "evidence": [
    { "type": "link", "value": "https://github.com/acme/api/pull/312", "label": "PR: query caching + index" },
    { "type": "metric", "value": "p95 latency: 380ms (down from 2.3s)" },
    { "type": "text", "value": "Load tested with 1000 concurrent users. No degradation." }
  ]
})
```

### Phase 4: Close

The commitment enters the `closed` state. The evidence is permanently recorded in the ledger. Anyone — human or agent — can later inspect the commitment and see exactly what was done and why.

## Evidence Chains

Evidence is what separates Mentu from every task tracker. In a task tracker, completion is a checkbox. In Mentu, completion is a proof.

An evidence chain links three things:

1. **The observation** (memory) — what was noticed
2. **The obligation** (commitment) — what was promised
3. **The proof** (evidence array) — what was delivered

```
mem_d4e5f6  →  "API response times exceed 2s"
    ↓
cmt_g7h8i9  →  "Optimize /search to sub-500ms"
    ↓
evidence[]  →  [PR #312, metric: 380ms p95, load test results]
```

This chain is fully traversable. Given any commitment, you can trace it back to why it exists (the memory) and forward to how it was resolved (the evidence). Given any memory, you can see whether it was acted on and what came of it.

Evidence types include:
- **link** — a URL (PR, deploy, dashboard, document)
- **text** — a free-form description of what was done
- **metric** — a measured value demonstrating the outcome
- **file** — a reference to an artifact (screenshot, log, report)

## The Ledger: Append-Only Operations

Under the hood, Mentu stores nothing but operations. There is no mutable "current state" row in a database. Instead, state is computed by replaying the sequence of operations from the beginning.

Every action — `capture`, `commit`, `claim`, `release`, `close`, `annotate`, `submit`, `approve`, `reopen`, `link`, `dismiss`, `triage` — is recorded as an **operation envelope**:

```json
{
  "id": "op_x1y2z3",
  "type": "claim",
  "target": "cmt_g7h8i9",
  "actor": "agent:claude-code",
  "timestamp": "2026-02-13T10:05:00Z",
  "payload": {}
}
```

The current state of any object is derived by replaying its operations in order:

```
op: commit  → state: open
op: claim   → state: claimed
op: close   → state: closed
```

This design has several important consequences:

- **Auditability.** The full history is always available. You never have to ask "who changed this?" or "when did this happen?" — every state transition is recorded with its actor and timestamp.
- **Reproducibility.** Any system can reconstruct the state by replaying operations. There is no hidden state, no side channels, no out-of-band mutations.
- **Conflict resolution.** When multiple agents or humans interact with the same commitment, the operation log provides a total ordering that resolves ambiguity.
- **Immutability.** Operations cannot be edited or deleted. If a mistake is made, a corrective operation is appended (e.g., `reopen` a prematurely closed commitment). The mistake and the correction are both visible in the history.

## Why This Matters

### Accountability

When a commitment is closed, the evidence is right there. Not "I finished it" but "here is the PR, here is the metric, here is the test result." This works for humans reviewing other humans, humans reviewing agents, and agents reviewing agents.

### Auditability

Every state transition is recorded with who did it and when. You can answer questions like "who claimed this?", "when was it closed?", "what evidence was provided?" at any point in the future.

### Agent compatibility

Agents do not need to understand project management philosophy. They need a small set of operations with clear preconditions and postconditions. Mentu provides exactly that: 12 operations, explicit state machine, required evidence. An agent can participate in the full lifecycle without ambiguity.

The combination of these three properties — accountability through evidence, auditability through the append-only log, and agent compatibility through the explicit protocol — is what makes Mentu a ledger rather than a tracker.

## The Full Picture

```
  OBSERVE              PROMISE              PROVE                CLOSE
  ───────              ───────              ─────                ─────
  capture(memory)  →   commit(cmt)      →   claim → work →      close(evidence[])
                       source: mem_id        do the work          prove it's done
  "I noticed X"        "I will fix X"       "I'm on it"          "Here's proof"

  ┌─────────────────────────────────────────────────────────────────────┐
  │                    APPEND-ONLY LEDGER                              │
  │  op: capture  →  op: commit  →  op: claim  →  op: close           │
  │  All immutable. State computed by replaying ops in order.          │
  └─────────────────────────────────────────────────────────────────────┘
```

Continue to [State Machine](/concepts/state-machine/) for the full transition diagram, or [Three Rules](/concepts/three-rules/) for the invariants that enforce this model.
