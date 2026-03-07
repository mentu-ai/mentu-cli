---
title: Ledger Format
description: The append-only operation log format
order: 2
---

## File Location

```
.mentu/ledger.jsonl
```

## Format

JSON Lines (JSONL) - one JSON object per line.

```json
{"op_id":"op_12345678","op":"capture","body":"Found bug","kind":"observation","actor":"user:rashid","at":"2026-01-03T12:00:00Z"}
{"op_id":"op_23456789","op":"commit","body":"Fix bug","source":"mem_abcdef12","actor":"user:rashid","at":"2026-01-03T12:01:00Z"}
```

## Operation Schema

### Common Fields

| Field | Type | Description |
|-------|------|-------------|
| `op_id` | string | Unique operation ID (`op_` prefix) |
| `op` | string | Operation type |
| `actor` | string | Who performed the operation |
| `at` | string | ISO 8601 timestamp |

### capture

```json
{
  "op_id": "op_xxx",
  "op": "capture",
  "body": "Observation text",
  "kind": "observation",
  "refs": [],
  "actor": "user:xxx",
  "at": "..."
}
```

Creates: `mem_xxx`

### commit

```json
{
  "op_id": "op_xxx",
  "op": "commit",
  "body": "Commitment text",
  "source": "mem_xxx",
  "actor": "user:xxx",
  "at": "..."
}
```

Creates: `cmt_xxx`

### claim

```json
{
  "op_id": "op_xxx",
  "op": "claim",
  "target": "cmt_xxx",
  "actor": "user:xxx",
  "at": "..."
}
```

### release

```json
{
  "op_id": "op_xxx",
  "op": "release",
  "target": "cmt_xxx",
  "actor": "user:xxx",
  "at": "..."
}
```

### close

```json
{
  "op_id": "op_xxx",
  "op": "close",
  "target": "cmt_xxx",
  "evidence": "mem_xxx",
  "actor": "user:xxx",
  "at": "..."
}
```

### submit

```json
{
  "op_id": "op_xxx",
  "op": "submit",
  "target": "cmt_xxx",
  "summary": "Work complete",
  "tier": "tier_2",
  "actor": "user:xxx",
  "at": "..."
}
```

### approve

```json
{
  "op_id": "op_xxx",
  "op": "approve",
  "target": "cmt_xxx",
  "comment": "Approved",
  "actor": "user:xxx",
  "at": "..."
}
```

### reopen

```json
{
  "op_id": "op_xxx",
  "op": "reopen",
  "target": "cmt_xxx",
  "reason": "Tests failing",
  "actor": "user:xxx",
  "at": "..."
}
```

## ID Generation

IDs are generated as:

```
{prefix}_{8_random_hex_chars}
```

| Prefix | Type |
|--------|------|
| `op_` | Operation |
| `mem_` | Memory |
| `cmt_` | Commitment |

## Append-Only

The ledger is append-only:
- No edits
- No deletions
- New lines only

Corrections are made via new operations, not modifications.
