---
title: "Commitments"
description: "Query and retrieve commitments from the Mentu ledger."
---

Commitments are the work items in Mentu. Each commitment has a lifecycle -- `open`, `claimed`, `in_review`, `closed`, `reopened` -- and an append-only history of every state transition.

**Base URL:** `https://mentu-proxy.affihub.workers.dev`

All requests require the standard [authentication headers](/api/authentication/).

---

## List Commitments

```
GET /commitments
```

Returns a paginated list of commitments in the workspace.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `state` | string | _(all)_ | Filter by state: `open`, `claimed`, `in_review`, `closed`, `reopened` |
| `owner` | string | _(all)_ | Filter by owner identifier |
| `tags` | string | _(all)_ | Comma-separated list of tags (matches any) |
| `limit` | integer | `50` | Number of results to return (max 100) |
| `offset` | integer | `0` | Number of results to skip for pagination |
| `since` | string | _(all)_ | ISO 8601 timestamp; return only commitments updated after this time |

### Example: List All Open Commitments

```bash
curl -X GET "https://mentu-proxy.affihub.workers.dev/commitments?state=open&limit=10" \
  -H "X-Proxy-Token: $MENTU_API_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WORKSPACE_ID"
```

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "cmt_bcdef123",
      "title": "Fix session token refresh after password change",
      "body": "Session token is not refreshed when a user changes their password.",
      "state": "open",
      "owner": null,
      "priority": "critical",
      "tags": ["auth", "bug"],
      "created_at": "2025-03-15T10:00:00Z",
      "updated_at": "2025-03-15T10:00:00Z",
      "meta": {}
    },
    {
      "id": "cmt_cdefg456",
      "title": "Add rate limiting to public API",
      "body": null,
      "state": "open",
      "owner": null,
      "priority": "high",
      "tags": ["security", "api"],
      "created_at": "2025-03-14T08:30:00Z",
      "updated_at": "2025-03-14T08:30:00Z",
      "meta": {}
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 2
  }
}
```

### Filter Examples

**Commitments claimed by a specific agent:**

```bash
curl -X GET "https://mentu-proxy.affihub.workers.dev/commitments?state=claimed&owner=agent-ralph" \
  -H "X-Proxy-Token: $MENTU_API_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WORKSPACE_ID"
```

**Commitments with specific tags:**

```bash
curl -X GET "https://mentu-proxy.affihub.workers.dev/commitments?tags=auth,security" \
  -H "X-Proxy-Token: $MENTU_API_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WORKSPACE_ID"
```

**Commitments updated in the last hour:**

```bash
curl -X GET "https://mentu-proxy.affihub.workers.dev/commitments?since=2025-03-15T09:00:00Z" \
  -H "X-Proxy-Token: $MENTU_API_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WORKSPACE_ID"
```

**Paginating through results:**

```bash
# Page 1
curl -X GET "https://mentu-proxy.affihub.workers.dev/commitments?limit=20&offset=0" \
  -H "X-Proxy-Token: $MENTU_API_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WORKSPACE_ID"

# Page 2
curl -X GET "https://mentu-proxy.affihub.workers.dev/commitments?limit=20&offset=20" \
  -H "X-Proxy-Token: $MENTU_API_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WORKSPACE_ID"
```

---

## Get a Single Commitment

```
GET /commitments/:id
```

Returns a single commitment with its full history of operations and annotations.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | The commitment ID (e.g., `cmt_bcdef123`) |

### Example

```bash
curl -X GET "https://mentu-proxy.affihub.workers.dev/commitments/cmt_bcdef123" \
  -H "X-Proxy-Token: $MENTU_API_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WORKSPACE_ID"
```

### Response

```json
{
  "success": true,
  "data": {
    "id": "cmt_bcdef123",
    "title": "Fix session token refresh after password change",
    "body": "Session token is not refreshed when a user changes their password.",
    "state": "closed",
    "result": "pass",
    "owner": "agent-ralph",
    "priority": "critical",
    "tags": ["auth", "bug"],
    "created_at": "2025-03-15T10:00:00Z",
    "updated_at": "2025-03-15T14:30:00Z",
    "meta": {},
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
    "history": [
      {
        "op_id": "op_23456789",
        "op": "commit",
        "actor": "ci-pipeline",
        "timestamp": "2025-03-15T10:00:00Z"
      },
      {
        "op_id": "op_34567890",
        "op": "claim",
        "actor": "agent-ralph",
        "owner": "agent-ralph",
        "timestamp": "2025-03-15T10:15:00Z"
      },
      {
        "op_id": "op_67890123",
        "op": "annotate",
        "actor": "agent-ralph",
        "body": "Root cause identified: token cache not invalidated on password change event",
        "kind": "progress",
        "timestamp": "2025-03-15T12:00:00Z"
      },
      {
        "op_id": "op_78901234",
        "op": "submit",
        "actor": "agent-ralph",
        "timestamp": "2025-03-15T13:45:00Z"
      },
      {
        "op_id": "op_89012345",
        "op": "approve",
        "actor": "rashid",
        "body": "LGTM. Tests pass, code is clean.",
        "timestamp": "2025-03-15T14:00:00Z"
      },
      {
        "op_id": "op_56789012",
        "op": "close",
        "actor": "ci-pipeline",
        "result": "pass",
        "summary": "Session token now refreshes correctly after password change",
        "timestamp": "2025-03-15T14:30:00Z"
      }
    ],
    "linked_memories": [
      {
        "id": "mem_abcdef12",
        "body": "Found bug in auth flow: session token not refreshed after password change",
        "kind": "bug-report"
      }
    ]
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique commitment identifier |
| `title` | string | Short title |
| `body` | string or null | Detailed description |
| `state` | string | Current state: `open`, `claimed`, `in_review`, `closed`, `reopened` |
| `result` | string or null | Outcome when closed: `pass` or `fail` |
| `owner` | string or null | Current owner identifier |
| `priority` | string or null | Priority level |
| `tags` | string[] | Array of tags |
| `created_at` | string | ISO 8601 creation timestamp |
| `updated_at` | string | ISO 8601 last-update timestamp |
| `meta` | object | Arbitrary metadata |
| `evidence` | array | Evidence objects attached at close |
| `history` | array | Ordered list of all operations on this commitment |
| `linked_memories` | array | Memories linked to this commitment |

---

## Pagination

All list endpoints use `limit` and `offset` pagination.

- `limit` controls how many records are returned per request (default: 50, max: 100).
- `offset` controls how many records to skip.
- The `pagination` object in the response includes `total` so you can calculate the number of pages.

```
Total pages = ceil(pagination.total / limit)
Current page = floor(offset / limit) + 1
```

To iterate through all results:

```javascript
let offset = 0;
const limit = 50;
let allCommitments = [];

while (true) {
  const res = await fetch(
    `https://mentu-proxy.affihub.workers.dev/commitments?limit=${limit}&offset=${offset}`,
    { headers }
  );
  const { data, pagination } = await res.json();
  allCommitments = allCommitments.concat(data);

  if (offset + limit >= pagination.total) break;
  offset += limit;
}
```
