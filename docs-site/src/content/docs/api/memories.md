---
title: "Memories"
description: "Query and retrieve memories (observations) from the Mentu ledger."
---

Memories are raw observations captured into the Mentu ledger -- bug sightings, design notes, metric snapshots, or any piece of information that may later be triaged, linked to a commitment, or dismissed.

**Base URL:** `https://mentu-proxy.affihub.workers.dev`

All requests require the standard [authentication headers](/api/authentication/).

---

## List Memories

```
GET /memories
```

Returns a paginated list of memories in the workspace.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `kind` | string | _(all)_ | Filter by memory kind (e.g., `"bug-report"`, `"observation"`, `"metric"`, `"note"`) |
| `limit` | integer | `50` | Number of results to return (max 100) |
| `offset` | integer | `0` | Number of results to skip for pagination |
| `since` | string | _(all)_ | ISO 8601 timestamp; return only memories created after this time |

### Example: List All Bug Reports

```bash
curl -X GET "https://mentu-proxy.affihub.workers.dev/memories?kind=bug-report&limit=10" \
  -H "X-Proxy-Token: $MENTU_API_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WORKSPACE_ID"
```

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "mem_abcdef12",
      "body": "Found bug in auth flow: session token not refreshed after password change",
      "kind": "bug-report",
      "status": "linked",
      "tags": ["auth", "critical"],
      "created_at": "2025-03-15T09:45:00Z",
      "updated_at": "2025-03-15T10:15:00Z",
      "meta": {}
    },
    {
      "id": "mem_bcdefg34",
      "body": "Login page throws 500 when email contains a plus sign",
      "kind": "bug-report",
      "status": "untriaged",
      "tags": ["auth"],
      "created_at": "2025-03-14T16:20:00Z",
      "updated_at": "2025-03-14T16:20:00Z",
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

**All untriaged memories (triage inbox):**

```bash
curl -X GET "https://mentu-proxy.affihub.workers.dev/memories?kind=observation&limit=50" \
  -H "X-Proxy-Token: $MENTU_API_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WORKSPACE_ID"
```

**Memories captured in the last 24 hours:**

```bash
curl -X GET "https://mentu-proxy.affihub.workers.dev/memories?since=2025-03-14T10:00:00Z" \
  -H "X-Proxy-Token: $MENTU_API_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WORKSPACE_ID"
```

**Paginating through results:**

```bash
# Page 1
curl -X GET "https://mentu-proxy.affihub.workers.dev/memories?limit=20&offset=0" \
  -H "X-Proxy-Token: $MENTU_API_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WORKSPACE_ID"

# Page 2
curl -X GET "https://mentu-proxy.affihub.workers.dev/memories?limit=20&offset=20" \
  -H "X-Proxy-Token: $MENTU_API_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WORKSPACE_ID"
```

---

## Get a Single Memory

```
GET /memories/:id
```

Returns a single memory with its annotations and linked commitments.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | The memory ID (e.g., `mem_abcdef12`) |

### Example

```bash
curl -X GET "https://mentu-proxy.affihub.workers.dev/memories/mem_abcdef12" \
  -H "X-Proxy-Token: $MENTU_API_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WORKSPACE_ID"
```

### Response

```json
{
  "success": true,
  "data": {
    "id": "mem_abcdef12",
    "body": "Found bug in auth flow: session token not refreshed after password change",
    "kind": "bug-report",
    "status": "linked",
    "tags": ["auth", "critical"],
    "priority": "high",
    "created_at": "2025-03-15T09:45:00Z",
    "updated_at": "2025-03-15T10:15:00Z",
    "meta": {},
    "annotations": [
      {
        "op_id": "op_31234567",
        "body": "Confirmed reproducible. Needs a commitment.",
        "kind": "triage",
        "actor": "rashid",
        "timestamp": "2025-03-15T09:55:00Z"
      },
      {
        "op_id": "op_41234567",
        "body": "Linked to cmt_bcdef123 for resolution.",
        "kind": "note",
        "actor": "agent-ralph",
        "timestamp": "2025-03-15T10:15:00Z"
      }
    ],
    "linked_commitments": [
      {
        "id": "cmt_bcdef123",
        "title": "Fix session token refresh after password change",
        "state": "closed",
        "result": "pass"
      }
    ],
    "history": [
      {
        "op_id": "op_12345678",
        "op": "capture",
        "actor": "ci-pipeline",
        "timestamp": "2025-03-15T09:45:00Z"
      },
      {
        "op_id": "op_21234567",
        "op": "triage",
        "actor": "rashid",
        "priority": "high",
        "timestamp": "2025-03-15T09:55:00Z"
      },
      {
        "op_id": "op_01234567",
        "op": "link",
        "actor": "agent-ralph",
        "target": "cmt_bcdef123",
        "timestamp": "2025-03-15T10:15:00Z"
      }
    ]
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique memory identifier |
| `body` | string | The content of the memory |
| `kind` | string or null | Category of the memory |
| `status` | string | Current status: `untriaged`, `triaged`, `linked`, `dismissed`, `committed` |
| `tags` | string[] | Array of tags |
| `priority` | string or null | Assigned priority (set during triage) |
| `created_at` | string | ISO 8601 creation timestamp |
| `updated_at` | string | ISO 8601 last-update timestamp |
| `meta` | object | Arbitrary metadata |
| `annotations` | array | Notes and annotations added to this memory |
| `linked_commitments` | array | Commitments this memory is linked to |
| `history` | array | Ordered list of all operations on this memory |

### Memory Statuses

| Status | Description |
|--------|-------------|
| `untriaged` | Newly captured, not yet reviewed |
| `triaged` | Reviewed and prioritized, but no commitment created yet |
| `linked` | Associated with one or more commitments |
| `committed` | A commitment was created directly from this memory |
| `dismissed` | Marked as not requiring action |

---

## Pagination

List endpoints use `limit` and `offset` pagination, identical to the [commitments](/api/commitments/#pagination) endpoint.

- `limit` controls how many records are returned per request (default: 50, max: 100).
- `offset` controls how many records to skip.
- The `pagination` object in the response includes `total` for calculating page counts.

```javascript
let offset = 0;
const limit = 50;
let allMemories = [];

while (true) {
  const res = await fetch(
    `https://mentu-proxy.affihub.workers.dev/memories?limit=${limit}&offset=${offset}`,
    { headers }
  );
  const { data, pagination } = await res.json();
  allMemories = allMemories.concat(data);

  if (offset + limit >= pagination.total) break;
  offset += limit;
}
```
