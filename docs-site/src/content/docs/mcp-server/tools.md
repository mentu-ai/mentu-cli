---
title: "Tools Reference"
description: "Complete reference for all 12 tools exposed by the @mentu/mcp server, with parameters, examples, and usage notes."
---

The MCP server exposes 12 tools organized into three categories: commitment lifecycle, memory management, and triage/queries.

## Commitment lifecycle

These five tools drive commitments through the state machine: `committed` -> `claimed` -> `submitted` -> `approved`, with `closed` reachable from any state.

---

### mentu_commit

Create a new commitment in the ledger.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `body` | `string` | Yes | Description of what is being committed to |
| `source` | `string` | Yes | Origin of the commitment (e.g., `"agent:claude"`, `"human:rashid"`) |
| `tags` | `string[]` | No | Tags for categorization and filtering |
| `meta` | `object` | No | Arbitrary metadata (key-value pairs) |

**Example tool call:**

```json
{
  "name": "mentu_commit",
  "arguments": {
    "body": "Fix login redirect loop on mobile Safari",
    "source": "agent:claude",
    "tags": ["bug", "auth", "mobile"],
    "meta": {
      "priority": "high",
      "file": "src/hooks/useAuth.ts"
    }
  }
}
```

**Example response:**

```json
{
  "id": "c_9f3a2b1e",
  "state": "committed",
  "body": "Fix login redirect loop on mobile Safari",
  "source": "agent:claude",
  "tags": ["bug", "auth", "mobile"],
  "created_at": "2025-06-15T10:30:00Z"
}
```

**Notes:**
- The `source` field should identify who or what created the commitment. Use a `agent:` prefix for AI agents and `human:` for people.
- Tags are optional but strongly recommended -- they enable filtering in `mentu_list_commitments` and the triage prompt.

---

### mentu_claim

Claim an existing commitment, signaling that work has begun.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `commitment` | `string` | Yes | The commitment ID to claim |

**Example tool call:**

```json
{
  "name": "mentu_claim",
  "arguments": {
    "commitment": "c_9f3a2b1e"
  }
}
```

**Example response:**

```json
{
  "id": "c_9f3a2b1e",
  "state": "claimed",
  "claimed_at": "2025-06-15T10:32:00Z",
  "claimed_by": "agent:claude"
}
```

**Notes:**
- A commitment can only be claimed if it is in the `committed` state.
- Claiming is how you signal ownership -- other agents can see that this work is in progress.

---

### mentu_submit

Submit a claimed commitment for review, attaching evidence of the work done.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `commitment` | `string` | Yes | The commitment ID to submit |
| `evidence` | `array` | Yes | Array of evidence objects (e.g., `[{"type": "build", "pass": true}]`) |
| `summary` | `string` | No | Human-readable summary of what was done |
| `tier` | `string` | No | Confidence tier (e.g., `"auto"`, `"manual"`) |
| `validation` | `object` | No | Validation results (build status, test counts, etc.) |

**Example tool call:**

```json
{
  "name": "mentu_submit",
  "arguments": {
    "commitment": "c_9f3a2b1e",
    "evidence": [
      { "type": "build", "pass": true, "output": "Build succeeded in 4.2s" },
      { "type": "test", "pass": true, "output": "14 tests passed, 0 failed" },
      { "type": "pr", "url": "https://github.com/org/repo/pull/42" }
    ],
    "summary": "Fixed redirect loop by checking auth state before navigation",
    "tier": "auto",
    "validation": {
      "build": true,
      "tests_passed": 14,
      "tests_failed": 0
    }
  }
}
```

**Example response:**

```json
{
  "id": "c_9f3a2b1e",
  "state": "submitted",
  "submitted_at": "2025-06-15T11:00:00Z",
  "evidence_count": 3,
  "summary": "Fixed redirect loop by checking auth state before navigation"
}
```

**Notes:**
- The `evidence` array is required and must contain at least one item. The API rejects submissions without evidence.
- Evidence objects are freeform -- use `type` to categorize (e.g., `"build"`, `"test"`, `"pr"`, `"screenshot"`, `"diff"`).
- The `tier` field indicates whether the submission was auto-validated or needs manual review.

---

### mentu_close

Close a commitment directly from any state. Used for duplicates, won't-fix, or immediate resolution.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `commitment` | `string` | Yes | The commitment ID to close |
| `evidence` | `array` | No | Evidence array (even if empty, recommended for audit trail) |
| `duplicate_of` | `string` | No | ID of the commitment this duplicates |

**Example tool call:**

```json
{
  "name": "mentu_close",
  "arguments": {
    "commitment": "c_7d4e1a2f",
    "evidence": [
      { "type": "note", "body": "Duplicate of c_9f3a2b1e -- same root cause" }
    ],
    "duplicate_of": "c_9f3a2b1e"
  }
}
```

**Example response:**

```json
{
  "id": "c_7d4e1a2f",
  "state": "closed",
  "closed_at": "2025-06-15T11:05:00Z",
  "duplicate_of": "c_9f3a2b1e"
}
```

**Notes:**
- `close` is the only transition that can be called from any state (committed, claimed, submitted, or approved).
- When closing as a duplicate, set `duplicate_of` to the canonical commitment ID.
- While `evidence` is optional for close, providing it creates a better audit trail.

---

### mentu_approve

Approve a submitted commitment, completing the review.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `commitment` | `string` | Yes | The commitment ID to approve |
| `comment` | `string` | No | Review comment |
| `auto` | `boolean` | No | Whether this is an auto-approval (e.g., all checks passed) |

**Example tool call:**

```json
{
  "name": "mentu_approve",
  "arguments": {
    "commitment": "c_9f3a2b1e",
    "comment": "Build and tests pass, PR merged.",
    "auto": true
  }
}
```

**Example response:**

```json
{
  "id": "c_9f3a2b1e",
  "state": "approved",
  "approved_at": "2025-06-15T11:10:00Z",
  "comment": "Build and tests pass, PR merged."
}
```

**Notes:**
- Can only be called on commitments in the `submitted` state.
- Set `auto: true` when the approval is driven by passing CI checks rather than human review.

---

## Memory management

Memories are observations, bugs, ideas, or notes captured during development. Unlike commitments, they are not stateful -- they are append-only records that can be annotated or dismissed.

---

### mentu_capture

Capture a new memory in the ledger.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `body` | `string` | Yes | Content of the memory |
| `kind` | `string` | No | Category (e.g., `"bug"`, `"idea"`, `"observation"`, `"debt"`) |
| `refs` | `string[]` | No | References to related entities (file paths, URLs, commitment IDs) |
| `meta` | `object` | No | Arbitrary metadata |
| `source_key` | `string` | No | Deduplication key to prevent duplicate captures |

**Example tool call:**

```json
{
  "name": "mentu_capture",
  "arguments": {
    "body": "The useClients hook does not sanitize search input before passing to .ilike() -- SQL injection risk via special chars %_()",
    "kind": "bug",
    "refs": ["src/hooks/useClients.ts"],
    "meta": {
      "severity": "medium",
      "line": 47
    },
    "source_key": "useClients-ilike-sanitize"
  }
}
```

**Example response:**

```json
{
  "id": "m_a1b2c3d4",
  "body": "The useClients hook does not sanitize search input before passing to .ilike() -- SQL injection risk via special chars %_()",
  "kind": "bug",
  "created_at": "2025-06-15T10:00:00Z"
}
```

**Notes:**
- The `source_key` is used for deduplication. If a memory with the same `source_key` already exists, the capture is a no-op.
- Use `kind` to categorize memories for easier filtering in `mentu_list_memories` and triage.

---

### mentu_dismiss

Dismiss a memory, marking it as reviewed and not actionable.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `memory` | `string` | Yes | The memory ID to dismiss |
| `reason` | `string` | Yes | Why the memory is being dismissed |
| `tags` | `string[]` | No | Tags to attach to the dismissal |

**Example tool call:**

```json
{
  "name": "mentu_dismiss",
  "arguments": {
    "memory": "m_a1b2c3d4",
    "reason": "Already fixed in PR #38 -- input is now sanitized",
    "tags": ["resolved", "pr-38"]
  }
}
```

**Example response:**

```json
{
  "id": "m_a1b2c3d4",
  "dismissed": true,
  "dismissed_at": "2025-06-15T12:00:00Z",
  "reason": "Already fixed in PR #38 -- input is now sanitized"
}
```

**Notes:**
- Dismissal is permanent and append-only -- the memory is not deleted, it is marked as dismissed with a reason.
- Always provide a meaningful reason so future triage sessions understand why it was dismissed.

---

### mentu_annotate

Add an annotation to any entity (commitment or memory).

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `target` | `string` | Yes | The entity ID to annotate (commitment or memory) |
| `body` | `string` | Yes | Annotation content |
| `kind` | `string` | No | Annotation type (e.g., `"note"`, `"question"`, `"blocker"`) |

**Example tool call:**

```json
{
  "name": "mentu_annotate",
  "arguments": {
    "target": "c_9f3a2b1e",
    "body": "This also affects the forgot-password flow -- same redirect logic",
    "kind": "note"
  }
}
```

**Example response:**

```json
{
  "id": "ann_x1y2z3",
  "target": "c_9f3a2b1e",
  "body": "This also affects the forgot-password flow -- same redirect logic",
  "kind": "note",
  "created_at": "2025-06-15T11:30:00Z"
}
```

**Notes:**
- Annotations are append-only -- you can add them but not edit or remove them.
- Use annotations to add context, flag blockers, or link related work after the initial entity was created.

---

## Triage and queries

These tools let you review incoming memories, list ledger data, and check pipeline health.

---

### mentu_triage

Record a triage session where memories are reviewed and decisions are made.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `reviewed` | `string[]` | Yes | Array of memory IDs that were reviewed |
| `summary` | `string` | Yes | Summary of the triage session |
| `decisions` | `array` | Yes | Array of decision objects, one per reviewed memory |

Each decision object:

| Name | Type | Required | Description |
|---|---|---|---|
| `memory` | `string` | Yes | The memory ID |
| `action` | `string` | Yes | Decision: `"commit"`, `"dismiss"`, `"defer"`, `"merge"` |
| `reason` | `string` | No | Why this decision was made |
| `commitment` | `string` | No | Commitment ID if action is `"commit"` |

**Example tool call:**

```json
{
  "name": "mentu_triage",
  "arguments": {
    "reviewed": ["m_a1b2c3d4", "m_e5f6g7h8", "m_i9j0k1l2"],
    "summary": "Triaged 3 bugs: 1 committed, 1 dismissed (duplicate), 1 deferred",
    "decisions": [
      {
        "memory": "m_a1b2c3d4",
        "action": "commit",
        "reason": "Valid SQL injection risk, creating commitment",
        "commitment": "c_newcommit1"
      },
      {
        "memory": "m_e5f6g7h8",
        "action": "dismiss",
        "reason": "Duplicate of m_a1b2c3d4"
      },
      {
        "memory": "m_i9j0k1l2",
        "action": "defer",
        "reason": "Low severity, revisit next sprint"
      }
    ]
  }
}
```

**Example response:**

```json
{
  "triage_id": "t_abc123",
  "reviewed_count": 3,
  "decisions": {
    "commit": 1,
    "dismiss": 1,
    "defer": 1,
    "merge": 0
  },
  "created_at": "2025-06-15T14:00:00Z"
}
```

**Notes:**
- Triage sessions create an audit trail of review decisions -- even deferred items are recorded.
- Use this tool to record the output of the `mentu_triage` prompt or any manual review process.

---

### mentu_list_memories

List memories with optional filtering.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `limit` | `number` | No | Maximum number of results (default varies by server) |
| `offset` | `number` | No | Pagination offset |
| `kind` | `string` | No | Filter by memory kind (e.g., `"bug"`, `"idea"`) |
| `since` | `string` | No | ISO 8601 timestamp -- only return memories created after this time |

**Example tool call:**

```json
{
  "name": "mentu_list_memories",
  "arguments": {
    "kind": "bug",
    "limit": 10,
    "since": "2025-06-01T00:00:00Z"
  }
}
```

**Example response:**

```json
{
  "memories": [
    {
      "id": "m_a1b2c3d4",
      "body": "useClients hook does not sanitize search input...",
      "kind": "bug",
      "dismissed": false,
      "created_at": "2025-06-15T10:00:00Z"
    }
  ],
  "total": 1,
  "limit": 10,
  "offset": 0
}
```

**Notes:**
- Use `kind` to narrow results to a specific category.
- Combine `since` with `limit` to paginate through recent memories efficiently.

---

### mentu_list_commitments

List commitments with optional filtering.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `state` | `string` | No | Filter by state (`"committed"`, `"claimed"`, `"submitted"`, `"approved"`, `"closed"`) |
| `owner` | `string` | No | Filter by owner/source |
| `tags` | `string[]` | No | Filter by tags (commitments must match all provided tags) |
| `limit` | `number` | No | Maximum number of results |
| `offset` | `number` | No | Pagination offset |
| `since` | `string` | No | ISO 8601 timestamp -- only return commitments created after this time |

**Example tool call:**

```json
{
  "name": "mentu_list_commitments",
  "arguments": {
    "state": "claimed",
    "tags": ["bug"],
    "limit": 5
  }
}
```

**Example response:**

```json
{
  "commitments": [
    {
      "id": "c_9f3a2b1e",
      "body": "Fix login redirect loop on mobile Safari",
      "state": "claimed",
      "tags": ["bug", "auth", "mobile"],
      "created_at": "2025-06-15T10:30:00Z",
      "claimed_at": "2025-06-15T10:32:00Z"
    }
  ],
  "total": 1,
  "limit": 5,
  "offset": 0
}
```

**Notes:**
- When `tags` is provided, a commitment must have **all** of the specified tags to be included.
- Use `state` to find work in a specific stage (e.g., all `claimed` items to see what is in progress).

---

### mentu_get_status

Get a high-level summary of pipeline health. Takes no parameters.

**Example tool call:**

```json
{
  "name": "mentu_get_status",
  "arguments": {}
}
```

**Example response:**

```json
{
  "commitments": {
    "committed": 3,
    "claimed": 2,
    "submitted": 1,
    "approved": 12,
    "closed": 5
  },
  "memories": {
    "total": 47,
    "undismissed": 8,
    "by_kind": {
      "bug": 5,
      "idea": 2,
      "observation": 1
    }
  },
  "last_activity": "2025-06-15T14:00:00Z"
}
```

**Notes:**
- This is the quickest way to get an overview of where things stand.
- Use it at the start of a session to understand the current pipeline state before deciding what to work on.
