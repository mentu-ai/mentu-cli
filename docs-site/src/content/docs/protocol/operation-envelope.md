---
title: "Operation Envelope"
description: "The universal structure every Mentu operation follows — IDs, actors, timestamps, and payloads"
---

Every operation in the Mentu protocol follows the same envelope structure. Whether it is a `commit`, `capture`, `close`, or any other operation, the outer shape is identical. Only the `payload` varies by operation type.

## Envelope Structure

```json
{
  "id": "op_a1b2c3d4",
  "op": "capture",
  "ts": "2026-01-15T10:30:00Z",
  "actor": "human:rashid",
  "workspace": "my-project",
  "payload": { }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier for this operation |
| `op` | string | Operation type (one of the twelve operations) |
| `ts` | string | ISO 8601 UTC timestamp |
| `actor` | string | Identity of who performed the operation |
| `workspace` | string | Workspace this operation belongs to |
| `payload` | object | Operation-specific data (varies by `op`) |

## ID Format

All Mentu identifiers follow the pattern `{prefix}_{8chars}`, where the prefix indicates the object type and the 8 characters are alphanumeric.

| Prefix | Object | Example |
|--------|--------|---------|
| `op_` | Operation | `op_a1b2c3d4` |
| `mem_` | Memory | `mem_e5f6g7h8` |
| `cmt_` | Commitment | `cmt_i9j0k1l2` |

### Generation

IDs are generated at the point of creation using a random alphanumeric string. They must be unique within the workspace. Collision probability is negligible for typical workload sizes, but implementations should check for uniqueness before writing.

## Actor Format

Actors identify who performed an operation. The format is `{type}:{identity}`:

| Type | Description | Examples |
|------|-------------|---------|
| `human` | A person | `human:rashid`, `human:maria` |
| `agent` | An AI agent or automated system | `agent:claude`, `agent:ci` |
| `sdk` | A client SDK | `sdk:bug-reporter` |
| `ci` | A CI/CD system | `ci:github-actions` |
| `system` | The Mentu system itself | `system:scheduler` |

### Rules

- The `type` portion is a well-known category (one of the types listed above)
- The `identity` portion is a freeform string unique within the type
- Actor identities should be consistent across operations — the same person should always use the same actor string
- Actor mappings in the Genesis Key can translate external identities to Mentu actors

## Timestamp

All timestamps are ISO 8601 format in UTC:

```
2026-01-15T10:30:00Z
```

### Rules

- Always UTC (the `Z` suffix)
- Millisecond precision is allowed but not required: `2026-01-15T10:30:00.123Z`
- Timestamps must be monotonically increasing within a single actor's operation stream
- Operations from different actors may have overlapping timestamps

## Payload by Operation Type

The `payload` field contains operation-specific data. Below is the payload structure for each of the twelve operations.

### `commit` — Create Commitment

```json
{
  "commitment_id": "cmt_i9j0k1l2",
  "title": "Fix invoice NaN bug",
  "description": "Handle empty discount field in calculateTotal()",
  "tags": ["bugfix", "invoices"],
  "tier": "t2",
  "refs": ["mem_e5f6g7h8"]
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `commitment_id` | Yes | ID for the new commitment |
| `title` | Yes | Short description of the work |
| `description` | No | Longer description with context |
| `tags` | No | Classification tags (used for tier assignment) |
| `tier` | No | Explicit tier override (t1/t2/t3) |
| `refs` | No | Memory IDs this commitment relates to |

### `claim` — Claim Commitment

```json
{
  "commitment_id": "cmt_i9j0k1l2"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `commitment_id` | Yes | ID of the commitment to claim |

### `unclaim` — Release Commitment

```json
{
  "commitment_id": "cmt_i9j0k1l2",
  "reason": "Blocked by dependency"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `commitment_id` | Yes | ID of the commitment to release |
| `reason` | No | Why the commitment is being released |

### `evidence` — Attach Evidence

```json
{
  "commitment_id": "cmt_i9j0k1l2",
  "evidence": [
    { "kind": "build", "status": "pass", "log": "..." },
    { "kind": "test", "status": "pass", "summary": "24 passed" }
  ]
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `commitment_id` | Yes | ID of the commitment |
| `evidence` | Yes | Array of evidence items |
| `evidence[].kind` | Yes | Evidence type: `build`, `test`, `pr`, `review`, `screenshot`, `custom` |
| `evidence[].status` | No | `pass` or `fail` |
| `evidence[].url` | No | Link to the evidence (PR URL, build log, etc.) |
| `evidence[].log` | No | Inline log content |
| `evidence[].summary` | No | Human-readable summary |

### `submit` — Submit for Review

```json
{
  "commitment_id": "cmt_i9j0k1l2",
  "evidence": [
    { "kind": "pr", "url": "https://github.com/org/repo/pull/42" },
    { "kind": "build", "status": "pass" }
  ]
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `commitment_id` | Yes | ID of the commitment to submit |
| `evidence` | No | Final evidence to attach with the submission |

### `close` — Close Commitment

```json
{
  "commitment_id": "cmt_i9j0k1l2",
  "verdict": "pass",
  "evidence": [
    { "kind": "review", "note": "Fix verified, PR merged" }
  ]
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `commitment_id` | Yes | ID of the commitment to close |
| `verdict` | Yes | `pass` or `fail` |
| `evidence` | Yes | Evidence supporting the close (can be empty array for `fail`) |

### `reopen` — Reopen Commitment

```json
{
  "commitment_id": "cmt_i9j0k1l2",
  "reason": "Regression found in production"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `commitment_id` | Yes | ID of the commitment to reopen |
| `reason` | No | Why the commitment is being reopened |

### `dismiss` — Dismiss Commitment

```json
{
  "commitment_id": "cmt_i9j0k1l2",
  "reason": "Duplicate of cmt_m3n4o5p6"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `commitment_id` | Yes | ID of the commitment to dismiss |
| `reason` | No | Why the commitment is being dismissed |

### `capture` — Create Memory

```json
{
  "memory_id": "mem_e5f6g7h8",
  "kind": "bug",
  "title": "Invoice total shows NaN",
  "body": "Steps to reproduce...",
  "meta": {
    "url": "/invoices/new",
    "browser": "Chrome 125"
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `memory_id` | Yes | ID for the new memory |
| `kind` | Yes | Memory kind: `bug`, `context`, `decision`, `note` |
| `title` | Yes | Short title |
| `body` | No | Full content |
| `meta` | No | Arbitrary metadata |

### `annotate` — Annotate Memory

```json
{
  "memory_id": "mem_e5f6g7h8",
  "note": "Confirmed: this only happens with empty string, not null"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `memory_id` | Yes | ID of the memory to annotate |
| `note` | Yes | Annotation text |

### `triage` — Triage Memory

```json
{
  "memory_id": "mem_e5f6g7h8",
  "severity": "medium",
  "priority": 2,
  "tags": ["invoices", "calculation"]
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `memory_id` | Yes | ID of the memory to triage |
| `severity` | No | `low`, `medium`, `high`, `critical` |
| `priority` | No | Numeric priority (lower = higher priority) |
| `tags` | No | Classification tags |

### `link` — Link Memory to Commitment

```json
{
  "memory_id": "mem_e5f6g7h8",
  "commitment_id": "cmt_i9j0k1l2",
  "relation": "fixes"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `memory_id` | Yes | ID of the memory |
| `commitment_id` | Yes | ID of the commitment |
| `relation` | No | Relationship type: `fixes`, `relates_to`, `caused_by`, `blocks` |
