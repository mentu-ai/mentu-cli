---
title: "Operations"
description: "Reference for all 12 operations available through the POST /ops endpoint."
---

The `POST /ops` endpoint is the single write path into the Mentu ledger. Every state change -- creating a memory, committing to a task, closing work -- flows through this endpoint as an operation.

**Base URL:** `https://mentu-proxy.affihub.workers.dev`

**Endpoint:** `POST /ops`

All requests require the standard [authentication headers](/api/authentication/).

---

## Operation Index

| Operation | Purpose |
|-----------|---------|
| [`capture`](#capture) | Create a memory (observation) |
| [`commit`](#commit) | Create a commitment (work item) |
| [`claim`](#claim) | Assign a commitment to an owner |
| [`release`](#release) | Unassign a commitment from its owner |
| [`close`](#close) | Close a commitment as passed or failed |
| [`annotate`](#annotate) | Add a note to a commitment or memory |
| [`submit`](#submit) | Submit a commitment for review |
| [`approve`](#approve) | Approve a submitted commitment |
| [`reopen`](#reopen) | Reopen a closed commitment |
| [`link`](#link) | Link a memory to a commitment |
| [`dismiss`](#dismiss) | Dismiss a memory |
| [`triage`](#triage) | Triage an untriaged memory |

---

## `capture`

**Create a memory (observation)**

Captures a piece of information -- a bug sighting, a design note, a metric snapshot -- and stores it as a memory in the workspace. Memories are the raw observations that feed into commitments.

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `op` | string | Must be `"capture"` |
| `body` | string | The content of the memory |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `kind` | string | Category of memory (e.g., `"bug-report"`, `"observation"`, `"metric"`, `"note"`) |
| `tags` | string[] | Tags for filtering and organization |
| `meta` | object | Arbitrary metadata to attach to the memory |

### Example

```bash
curl -X POST https://mentu-proxy.affihub.workers.dev/ops \
  -H "X-Proxy-Token: $MENTU_API_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WORKSPACE_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "op": "capture",
    "body": "Found bug in auth flow: session token not refreshed after password change",
    "kind": "bug-report",
    "tags": ["auth", "critical"]
  }'
```

### Response

```json
{
  "success": true,
  "op_id": "op_12345678",
  "record_id": "mem_abcdef12"
}
```

---

## `commit`

**Create a commitment (work item)**

Creates a new commitment in the `open` state. A commitment represents a unit of work that must be claimed, completed, and closed with evidence.

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `op` | string | Must be `"commit"` |
| `title` | string | Short title for the commitment |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `body` | string | Detailed description of the work |
| `tags` | string[] | Tags for filtering and organization |
| `priority` | string | Priority level (e.g., `"critical"`, `"high"`, `"medium"`, `"low"`) |
| `meta` | object | Arbitrary metadata |

### Example

```bash
curl -X POST https://mentu-proxy.affihub.workers.dev/ops \
  -H "X-Proxy-Token: $MENTU_API_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WORKSPACE_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "op": "commit",
    "title": "Fix session token refresh after password change",
    "body": "Session token is not refreshed when a user changes their password, leaving the old token valid.",
    "tags": ["auth", "bug"],
    "priority": "critical"
  }'
```

### Response

```json
{
  "success": true,
  "op_id": "op_23456789",
  "record_id": "cmt_bcdef123"
}
```

---

## `claim`

**Assign a commitment to an owner**

Transitions a commitment from `open` to `claimed`. The `owner` field records who is responsible for completing the work.

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `op` | string | Must be `"claim"` |
| `id` | string | The commitment ID to claim |
| `owner` | string | Identifier of the agent or person claiming the work |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `meta` | object | Arbitrary metadata (e.g., estimated duration) |

### Example

```bash
curl -X POST https://mentu-proxy.affihub.workers.dev/ops \
  -H "X-Proxy-Token: $MENTU_API_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WORKSPACE_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "op": "claim",
    "id": "cmt_bcdef123",
    "owner": "agent-ralph"
  }'
```

### Response

```json
{
  "success": true,
  "op_id": "op_34567890",
  "record_id": "cmt_bcdef123"
}
```

---

## `release`

**Unassign a commitment from its owner**

Transitions a commitment back from `claimed` to `open`, removing the current owner. Use this when an agent can no longer complete the work and it needs to be re-assigned.

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `op` | string | Must be `"release"` |
| `id` | string | The commitment ID to release |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `reason` | string | Why the commitment is being released |
| `meta` | object | Arbitrary metadata |

### Example

```bash
curl -X POST https://mentu-proxy.affihub.workers.dev/ops \
  -H "X-Proxy-Token: $MENTU_API_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WORKSPACE_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "op": "release",
    "id": "cmt_bcdef123",
    "reason": "Blocked on upstream dependency, needs different expertise"
  }'
```

### Response

```json
{
  "success": true,
  "op_id": "op_45678901",
  "record_id": "cmt_bcdef123"
}
```

---

## `close`

**Close a commitment as passed or failed**

Terminates a commitment. Every close operation **must** include an `evidence` array, even if empty for a failure. This is a hard requirement -- the API will reject close operations without the evidence field.

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `op` | string | Must be `"close"` |
| `id` | string | The commitment ID to close |
| `result` | string | Either `"pass"` or `"fail"` |
| `evidence` | array | Array of evidence objects documenting the outcome |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `summary` | string | Human-readable summary of the outcome |
| `meta` | object | Arbitrary metadata |

### Evidence Object

Each item in the `evidence` array should contain:

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Evidence type (e.g., `"build"`, `"test"`, `"pr"`, `"screenshot"`, `"log"`) |
| `url` | string | Link to the evidence (optional) |
| `body` | string | Description or inline content (optional) |

### Example (Pass)

```bash
curl -X POST https://mentu-proxy.affihub.workers.dev/ops \
  -H "X-Proxy-Token: $MENTU_API_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WORKSPACE_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "op": "close",
    "id": "cmt_bcdef123",
    "result": "pass",
    "evidence": [
      {
        "type": "pr",
        "url": "https://github.com/org/repo/pull/42",
        "body": "PR merged, fixes session refresh logic"
      },
      {
        "type": "build",
        "url": "https://ci.example.com/builds/1234",
        "body": "All tests passing"
      }
    ],
    "summary": "Session token now refreshes correctly after password change"
  }'
```

### Example (Fail)

```bash
curl -X POST https://mentu-proxy.affihub.workers.dev/ops \
  -H "X-Proxy-Token: $MENTU_API_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WORKSPACE_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "op": "close",
    "id": "cmt_bcdef123",
    "result": "fail",
    "evidence": [],
    "summary": "Could not reproduce the issue in staging environment"
  }'
```

### Response

```json
{
  "success": true,
  "op_id": "op_56789012",
  "record_id": "cmt_bcdef123"
}
```

---

## `annotate`

**Add a note to a commitment or memory**

Appends a note to an existing record without changing its state. Use annotations to log progress, add context, or record observations during work.

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `op` | string | Must be `"annotate"` |
| `id` | string | The commitment or memory ID to annotate |
| `body` | string | The annotation content |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `kind` | string | Annotation category (e.g., `"progress"`, `"blocker"`, `"question"`) |
| `meta` | object | Arbitrary metadata |

### Example

```bash
curl -X POST https://mentu-proxy.affihub.workers.dev/ops \
  -H "X-Proxy-Token: $MENTU_API_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WORKSPACE_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "op": "annotate",
    "id": "cmt_bcdef123",
    "body": "Root cause identified: token cache not invalidated on password change event",
    "kind": "progress"
  }'
```

### Response

```json
{
  "success": true,
  "op_id": "op_67890123",
  "record_id": "cmt_bcdef123"
}
```

---

## `submit`

**Submit a commitment for review**

Transitions a commitment from `claimed` to `in_review`. Use this when work is complete and ready for approval.

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `op` | string | Must be `"submit"` |
| `id` | string | The commitment ID to submit |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `body` | string | Submission notes or summary of work done |
| `evidence` | array | Array of evidence objects supporting the submission |
| `meta` | object | Arbitrary metadata |

### Example

```bash
curl -X POST https://mentu-proxy.affihub.workers.dev/ops \
  -H "X-Proxy-Token: $MENTU_API_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WORKSPACE_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "op": "submit",
    "id": "cmt_bcdef123",
    "body": "Fix implemented and tests added. Ready for review.",
    "evidence": [
      {
        "type": "pr",
        "url": "https://github.com/org/repo/pull/42"
      }
    ]
  }'
```

### Response

```json
{
  "success": true,
  "op_id": "op_78901234",
  "record_id": "cmt_bcdef123"
}
```

---

## `approve`

**Approve a submitted commitment**

Approves a commitment that is currently `in_review`. This is typically done by a human reviewer or a CI pipeline after verifying the work.

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `op` | string | Must be `"approve"` |
| `id` | string | The commitment ID to approve |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `body` | string | Approval notes or feedback |
| `meta` | object | Arbitrary metadata |

### Example

```bash
curl -X POST https://mentu-proxy.affihub.workers.dev/ops \
  -H "X-Proxy-Token: $MENTU_API_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WORKSPACE_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "op": "approve",
    "id": "cmt_bcdef123",
    "body": "LGTM. Tests pass, code is clean."
  }'
```

### Response

```json
{
  "success": true,
  "op_id": "op_89012345",
  "record_id": "cmt_bcdef123"
}
```

---

## `reopen`

**Reopen a closed commitment**

Transitions a closed commitment back to `open`. Use this when a previously closed item needs additional work -- for example, when a bug resurfaces after being marked as fixed.

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `op` | string | Must be `"reopen"` |
| `id` | string | The commitment ID to reopen |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `reason` | string | Why the commitment is being reopened |
| `meta` | object | Arbitrary metadata |

### Example

```bash
curl -X POST https://mentu-proxy.affihub.workers.dev/ops \
  -H "X-Proxy-Token: $MENTU_API_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WORKSPACE_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "op": "reopen",
    "id": "cmt_bcdef123",
    "reason": "Bug resurfaced in production after deploy v2.3.1"
  }'
```

### Response

```json
{
  "success": true,
  "op_id": "op_90123456",
  "record_id": "cmt_bcdef123"
}
```

---

## `link`

**Link a memory to a commitment**

Creates an association between a memory and a commitment. This connects raw observations to actionable work items, making it possible to trace why a commitment was created.

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `op` | string | Must be `"link"` |
| `id` | string | The memory ID to link |
| `target` | string | The commitment ID to link to |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `meta` | object | Arbitrary metadata |

### Example

```bash
curl -X POST https://mentu-proxy.affihub.workers.dev/ops \
  -H "X-Proxy-Token: $MENTU_API_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WORKSPACE_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "op": "link",
    "id": "mem_abcdef12",
    "target": "cmt_bcdef123"
  }'
```

### Response

```json
{
  "success": true,
  "op_id": "op_01234567",
  "record_id": "mem_abcdef12"
}
```

---

## `dismiss`

**Dismiss a memory**

Marks a memory as dismissed. Dismissed memories are excluded from triage views and default queries. Use this for noise, duplicates, or observations that do not require action.

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `op` | string | Must be `"dismiss"` |
| `id` | string | The memory ID to dismiss |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `reason` | string | Why the memory is being dismissed |
| `meta` | object | Arbitrary metadata |

### Example

```bash
curl -X POST https://mentu-proxy.affihub.workers.dev/ops \
  -H "X-Proxy-Token: $MENTU_API_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WORKSPACE_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "op": "dismiss",
    "id": "mem_abcdef12",
    "reason": "Duplicate of mem_xyz789"
  }'
```

### Response

```json
{
  "success": true,
  "op_id": "op_11234567",
  "record_id": "mem_abcdef12"
}
```

---

## `triage`

**Triage an untriaged memory**

Marks a memory as triaged, optionally assigning it a priority or kind. Use this as the first step in processing new observations before deciding whether to commit, link, or dismiss them.

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `op` | string | Must be `"triage"` |
| `id` | string | The memory ID to triage |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `priority` | string | Assigned priority (e.g., `"critical"`, `"high"`, `"medium"`, `"low"`) |
| `kind` | string | Reclassify the memory kind |
| `body` | string | Triage notes |
| `meta` | object | Arbitrary metadata |

### Example

```bash
curl -X POST https://mentu-proxy.affihub.workers.dev/ops \
  -H "X-Proxy-Token: $MENTU_API_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WORKSPACE_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "op": "triage",
    "id": "mem_abcdef12",
    "priority": "high",
    "kind": "bug-report",
    "body": "Confirmed reproducible. Needs a commitment."
  }'
```

### Response

```json
{
  "success": true,
  "op_id": "op_21234567",
  "record_id": "mem_abcdef12"
}
```

---

## Common Response Fields

Every successful operation returns:

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always `true` for successful operations |
| `op_id` | string | Unique identifier for this ledger entry |
| `record_id` | string | The ID of the affected commitment or memory |

For error responses, see [Errors](/api/errors/).
