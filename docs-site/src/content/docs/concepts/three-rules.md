---
title: "Three Rules"
description: "The three invariants that make Mentu trustworthy: traceability, evidence-required closure, and append-only immutability."
---

Mentu enforces three rules. They are not guidelines, not best practices, not suggestions. They are invariants — the API rejects operations that violate them. Together, they are what make the ledger trustworthy.

## Rule 1: Commitments Trace to Memories

Every commitment must have a source. The `source` field is required on the `commit` operation and must reference an existing memory ID.

### What works

```
// First, capture an observation
mentu_capture({
  "title": "Password reset emails take 45 seconds to arrive",
  "body": "Tested 10 times. Average delivery: 43s. Users expect <10s.",
  "tags": ["email", "auth", "ux"]
})
// → mem_abc123

// Then, commit with the memory as source
mentu_commit({
  "title": "Reduce password reset email delivery to under 10 seconds",
  "source": "mem_abc123",
  "priority": "high"
})
// → cmt_def456 (state: open)
// → mem_abc123 transitions to "committed"
```

### What fails

```
// Attempting to create a commitment without a source
mentu_commit({
  "title": "Reduce password reset email delivery to under 10 seconds",
  "priority": "high"
})
// ERROR: "source" is required. Every commitment must trace to a memory.
```

```
// Attempting to use a nonexistent memory as source
mentu_commit({
  "title": "Fix the thing",
  "source": "mem_doesnotexist"
})
// ERROR: Memory "mem_doesnotexist" not found.
```

### Why this matters

Traceability prevents orphan obligations. Six months from now, when someone asks "why did we build this?", the answer is always one hop away: follow the `source` link to the memory that motivated it. This is true whether the commitment was created by a human, an AI agent, or an automated pipeline.

Without this rule, ledgers accumulate commitments whose origins are lost to Slack threads, hallway conversations, or agent context windows that have long since closed.

## Rule 2: Closure Requires Evidence

You cannot close a commitment by simply marking it done. The `close` operation requires an `evidence` array, and the array must contain at least one entry.

### What works

```
mentu_close({
  "commitment": "cmt_def456",
  "evidence": [
    {
      "type": "link",
      "value": "https://github.com/acme/api/pull/187",
      "label": "PR #187 — switch to async email queue"
    },
    {
      "type": "metric",
      "value": "Average delivery time: 3.2s (down from 43s)"
    },
    {
      "type": "text",
      "value": "Tested 20 sends in production. All arrived within 5 seconds."
    }
  ]
})
// → cmt_def456 transitions to "closed"
// Evidence permanently attached to the ledger entry
```

### What fails

```
// Attempting to close without evidence
mentu_close({
  "commitment": "cmt_def456"
})
// ERROR: "evidence" is required. Closure requires proof.
```

```
// Attempting to close with an empty evidence array
mentu_close({
  "commitment": "cmt_def456",
  "evidence": []
})
// ERROR: "evidence" must contain at least one entry.
```

### Why this matters

Evidence is the difference between "I said it's done" and "here is proof it's done." In a traditional task tracker, completion is a checkbox — a single bit of state that anyone can flip with no accountability. In Mentu, completion is a structured proof that becomes part of the permanent record.

This is particularly important for agent workflows. When an AI agent closes a commitment, the evidence provides a verifiable artifact that a human (or another agent) can inspect. The alternative — trusting the agent's self-report — is exactly the gap that evidence-based closure fills.

Evidence types include:
- **link** — URL to a PR, deploy, dashboard, or document
- **text** — free-form description of what was done
- **metric** — measured outcome demonstrating the result
- **file** — reference to an artifact (screenshot, log, report)

### The minimum bar

One evidence entry is the minimum. In practice, meaningful closures typically include two or three: a link to the change (PR, commit, deploy), a description of what was done, and optionally a metric or test result showing the outcome.

## Rule 3: Append-Only

Nothing in the ledger is ever edited or deleted. Every operation is an immutable entry. If a mistake is made, it is corrected by appending a new operation — not by modifying the original.

### What works

```
// Commitment was closed prematurely
mentu_close({
  "commitment": "cmt_ghi789",
  "evidence": [{ "type": "text", "value": "Fixed the bug" }]
})

// Later, someone discovers the fix was incomplete
mentu_reopen({
  "commitment": "cmt_ghi789",
  "reason": "Fix only covered the happy path. Error case still broken."
})
// Both the close AND the reopen are in the ledger.
// The premature closure is visible. The correction is visible.
// Nothing was hidden or rewritten.
```

### What fails

```
// There is no "edit" operation
mentu_edit({
  "commitment": "cmt_ghi789",
  "title": "Updated title"
})
// ERROR: Unknown operation "edit". The ledger is append-only.

// There is no "delete" operation
mentu_delete({
  "commitment": "cmt_ghi789"
})
// ERROR: Unknown operation "delete". The ledger is append-only.
```

### Adding context without changing state

The `annotate` operation exists specifically for adding information to an existing memory or commitment without changing its state:

```
mentu_annotate({
  "target": "cmt_def456",
  "note": "Stakeholder confirmed 10s SLA is acceptable. Original target was 5s."
})
// Annotation appended. State unchanged. Original commitment unchanged.
```

### Why this matters

Append-only is the property that makes the ledger a ledger. In a mutable system, history can be rewritten — a closed task can be quietly reopened and re-closed, a missed deadline can be backdated, an incomplete review can be overwritten. In an append-only system, the full history is always there.

This is critical for:
- **Audit trails** — compliance and accountability require that no records are tampered with
- **Multi-agent coordination** — agents can trust the ledger because they know it has not been silently modified since they last read it
- **Dispute resolution** — when there is disagreement about what happened, the operation log is the single source of truth
- **Debugging** — when something goes wrong, you can replay operations to see the exact sequence of events

## Exceptions and Edge Cases

### Duplicate Closure

If a commitment is already `closed` and a `close` operation is attempted, the API rejects it as an invalid state transition. To "re-close" a commitment, you must first `reopen` it, then `claim` it, then `close` it again with new evidence. This ensures the reopen and the new closure are both recorded.

### Tier 1 Auto-Approval

When using direct `close` (Tier 1 review), the claimant is both the worker and the approver. This is a valid exception to the separation of concerns provided by the accountability airlock. The evidence requirement still applies — the system accepts the lighter review process but does not waive the proof requirement.

```
// Tier 1: direct close (valid — evidence still required)
mentu_close({
  "commitment": "cmt_abc",
  "evidence": [{ "type": "link", "value": "https://github.com/acme/app/commit/abc123" }]
})

// Tier 2: submit + approve (full airlock)
mentu_submit({ "commitment": "cmt_abc", "evidence": [...] })
mentu_approve({ "commitment": "cmt_abc" })
```

Both paths are valid. The choice depends on the risk level and review culture of the team. See [State Machine — Tiered Review](/concepts/state-machine/#tiered-review) for guidance on when to use each tier.

### Dismissed Memories

Dismissing a memory is not the same as deleting it. The memory remains in the ledger permanently. The `dismiss` operation records that a conscious decision was made to not act on the observation. If circumstances change, a dismissed memory can still be promoted to a commitment — the dismiss and the subsequent commit are both visible in the history.

## Summary

| Rule | Invariant | Enforced By |
|------|-----------|-------------|
| 1. Traceability | Every commitment has a `source` memory | `commit` API validates `source` field |
| 2. Evidence | Every closure has proof | `close` API validates `evidence` array |
| 3. Append-only | No edits, no deletes | No `edit` or `delete` operations exist |

These three rules are non-negotiable. They are what allow you to trust the ledger — whether you are a developer reviewing your own work, a manager auditing a team, or an AI agent participating in a multi-step workflow.
