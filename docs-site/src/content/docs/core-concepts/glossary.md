---
title: Glossary
description: Key terms in the Mentu protocol
order: 4
---

## Core Terms

### Memory

Something observed. Created with `capture`. Has an ID prefix `mem_`.

### Commitment

Something owed. Created with `commit`. Has an ID prefix `cmt_`. Must trace to a source memory.

### Evidence

A memory that proves work completion. Used to close commitments.

### Ledger

The append-only file (`.mentu/ledger.jsonl`) that records all operations.

### Operation

A single action recorded in the ledger. Has an ID prefix `op_`.

## Actions

### Capture

Record an observation. Creates a memory.

### Commit

Create an obligation. Creates a commitment.

### Claim

Take responsibility for a commitment.

### Release

Give up responsibility for a commitment.

### Close

Resolve a commitment with evidence.

### Submit

Request closure review. Changes commitment state to `in_review`.

### Approve

Accept a submission. Changes commitment state to `closed`.

### Reopen

Reject a submission. Changes commitment state to `reopened`.

## States

### Memory States

- `untriaged` - Not processed
- `linked` - Linked to commitment
- `dismissed` - Not actionable
- `committed` - Source of commitment

### Commitment States

- `open` - Not claimed
- `claimed` - Being worked
- `in_review` - Submitted for approval
- `closed` - Complete
- `reopened` - Rejected, needs rework

## Files

### ledger.jsonl

The append-only operation log at `.mentu/ledger.jsonl`.

### genesis.key

Optional governance rules at `.mentu/genesis.key`.

### config.yaml

Local configuration at `.mentu/config.yaml`.

## Identifiers

| Prefix | Type |
|--------|------|
| `mem_` | Memory |
| `cmt_` | Commitment |
| `op_` | Operation |

All IDs are 8 characters after the prefix.
