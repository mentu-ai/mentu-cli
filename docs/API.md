# Mentu API Reference

Complete reference for the Mentu HTTP/WebSocket API.

---

## Overview

The Mentu API provides programmatic access to the commitment ledger. Build integrations, automate workflows, and connect external systems.

### Base URL

```
http://localhost:3000
```

### API Versioning

The API is currently at version 1.0. Future versions will use URL prefixing:

```
http://localhost:3000/v1/...
```

### Content Type

All requests and responses use JSON:

```
Content-Type: application/json
```

### Starting the Server

```bash
mentu serve --port 3000
```

Options:
| Option | Default | Description |
|--------|---------|-------------|
| `--port` | 3000 | Port to listen on |
| `--host` | localhost | Host to bind to |
| `--cors` | false | Enable CORS for browser clients |

---

## Authentication

### API Keys

Most endpoints require authentication via Bearer token:

```http
Authorization: Bearer mentu_key_xxx
```

### Creating API Keys

```bash
mentu api-key create --actor alice --name "Production Key"
```

Output:
```
API Key created:
  ID: key_1703750400000
  Key: mentu_key_xxx
  Actor: alice

  ⚠️  SAVE THIS KEY - it cannot be retrieved later
```

### Key Storage

API keys are stored as SHA-256 hashes. The plain text key is shown only once at creation.

### Actor Identity

**Important**: The actor for all operations is determined by the API key, not the request body. Any `actor` field in requests is ignored.

### Key Management

```bash
# List keys (shows prefix only)
mentu api-key list

# Revoke a key
mentu api-key revoke key_1703750400000
```

---

## Request Format

### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes* | Bearer token (`Bearer mentu_key_xxx`) |
| `Content-Type` | Yes** | Must be `application/json` |

\* Not required for `/health`
\** Only for POST requests

### Request Body

POST requests accept JSON bodies:

```json
{
  "op": "capture",
  "body": "Observed a bug in login"
}
```

---

## Response Format

### Success Response

```json
{
  "id": "mem_abc12345",
  "op": "capture",
  "ts": "2025-12-28T12:00:00Z",
  "actor": "alice",
  "body": "Observed a bug in login"
}
```

### Error Response

All errors follow this format:

```json
{
  "error": "E_ERROR_CODE",
  "message": "Human-readable description",
  "details": {}
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (invalid input) |
| 401 | Unauthorized (missing/invalid key) |
| 403 | Forbidden (permission denied) |
| 404 | Not Found |
| 409 | Conflict (invalid state) |
| 500 | Internal Server Error |

---

## Endpoints

### GET /health

Health check endpoint. **No authentication required.**

<details>
<summary><strong>Request</strong></summary>

```bash
curl http://localhost:3000/health
```

</details>

<details>
<summary><strong>Response</strong></summary>

```json
{
  "status": "healthy",
  "version": "1.0.6",
  "uptime_seconds": 3600,
  "workspace": "my-project"
}
```

</details>

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Always `"healthy"` if responding |
| `version` | string | Mentu version |
| `uptime_seconds` | number | Server uptime |
| `workspace` | string | Current workspace name |

---

### POST /ops

Append an operation to the ledger. This is the primary write endpoint.

**Authentication:** Required

#### Operation Types

| Operation | Description | Required Fields |
|-----------|-------------|-----------------|
| `capture` | Record an observation | `body` |
| `commit` | Create a commitment | `body`, `source` |
| `claim` | Take responsibility | `commitment` |
| `release` | Give up responsibility | `commitment` |
| `close` | Close with evidence or as duplicate | `commitment`, `evidence` (or `duplicate_of`) |
| `annotate` | Attach a note | `target`, `body` |
| `submit` | Submit commitment for review | `commitment`, `evidence` |
| `approve` | Approve a submission | `commitment` |
| `reopen` | Reopen a commitment | `commitment`, `reason` |
| `link` | Link a record to a commitment | `source`, `target` |
| `dismiss` | Dismiss a memory | `memory`, `reason` |
| `triage` | Record a triage session | `reviewed`, `summary` |

#### capture

Record an observation (creates a Memory).

<details>
<summary><strong>Request</strong></summary>

```bash
curl -X POST http://localhost:3000/ops \
  -H "Authorization: Bearer mentu_key_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "op": "capture",
    "body": "Customer reported login failing on mobile",
    "kind": "bug_report"
  }'
```

</details>

<details>
<summary><strong>Response (201 Created)</strong></summary>

```json
{
  "id": "mem_abc12345",
  "op": "capture",
  "ts": "2025-12-28T12:00:00Z",
  "actor": "alice",
  "body": "Customer reported login failing on mobile",
  "kind": "bug_report"
}
```

</details>

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `op` | string | Yes | Must be `"capture"` |
| `body` | string | Yes | The observation text |
| `kind` | string | No | Type (e.g., `"evidence"`, `"bug_report"`) |
| `path` | string | No | Document path (for kind=document) |
| `refs` | string[] | No | Related IDs (`cmt_xxx`, `mem_yyy`) |
| `meta` | object | No | Arbitrary metadata |
| `source_key` | string | No | Idempotency key from external system |

#### commit

Create a commitment linked to a source memory.

<details>
<summary><strong>Request</strong></summary>

```bash
curl -X POST http://localhost:3000/ops \
  -H "Authorization: Bearer mentu_key_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "op": "commit",
    "body": "Fix mobile login bug",
    "source": "mem_abc12345",
    "tags": ["bug", "urgent"]
  }'
```

</details>

<details>
<summary><strong>Response (201 Created)</strong></summary>

```json
{
  "id": "cmt_def67890",
  "op": "commit",
  "ts": "2025-12-28T12:00:00Z",
  "actor": "alice",
  "body": "Fix mobile login bug",
  "source": "mem_abc12345",
  "tags": ["bug", "urgent"]
}
```

</details>

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `op` | string | Yes | Must be `"commit"` |
| `body` | string | Yes | The commitment description |
| `source` | string | Yes | Source memory ID (must exist) |
| `tags` | string[] | No | Tags for filtering |

#### claim

Take responsibility for a commitment.

<details>
<summary><strong>Request</strong></summary>

```bash
curl -X POST http://localhost:3000/ops \
  -H "Authorization: Bearer mentu_key_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "op": "claim",
    "commitment": "cmt_def67890"
  }'
```

</details>

<details>
<summary><strong>Response (201 Created)</strong></summary>

```json
{
  "id": "op_12345678",
  "op": "claim",
  "ts": "2025-12-28T12:00:00Z",
  "actor": "alice",
  "commitment": "cmt_def67890"
}
```

</details>

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `op` | string | Yes | Must be `"claim"` |
| `commitment` | string | Yes | Commitment ID to claim |

**Errors:**
- `E_ALREADY_CLAIMED` - Already claimed by another actor
- `E_ALREADY_CLOSED` - Commitment is already closed

#### release

Give up responsibility for a commitment.

<details>
<summary><strong>Request</strong></summary>

```bash
curl -X POST http://localhost:3000/ops \
  -H "Authorization: Bearer mentu_key_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "op": "release",
    "commitment": "cmt_def67890",
    "reason": "Reassigning to backend team"
  }'
```

</details>

<details>
<summary><strong>Response (201 Created)</strong></summary>

```json
{
  "id": "op_12345678",
  "op": "release",
  "ts": "2025-12-28T12:00:00Z",
  "actor": "alice",
  "commitment": "cmt_def67890",
  "reason": "Reassigning to backend team"
}
```

</details>

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `op` | string | Yes | Must be `"release"` |
| `commitment` | string | Yes | Commitment ID to release |
| `reason` | string | No | Reason for releasing |

**Errors:**
- `E_NOT_OWNER` - You don't own this commitment
- `E_ALREADY_CLOSED` - Commitment is already closed

#### close

Close a commitment with evidence (or as a duplicate).

<details>
<summary><strong>Request</strong></summary>

```bash
curl -X POST http://localhost:3000/ops \
  -H "Authorization: Bearer mentu_key_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "op": "close",
    "commitment": "cmt_def67890",
    "evidence": "mem_xyz12345"
  }'
```

</details>

<details>
<summary><strong>Response (201 Created)</strong></summary>

```json
{
  "id": "op_12345678",
  "op": "close",
  "ts": "2025-12-28T12:00:00Z",
  "actor": "alice",
  "commitment": "cmt_def67890",
  "evidence": "mem_xyz12345"
}
```

</details>

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `op` | string | Yes | Must be `"close"` |
| `commitment` | string | Yes | Commitment ID to close |
| `evidence` | string | Conditional | Evidence memory ID (must exist). Required unless `duplicate_of` is provided. |
| `duplicate_of` | string | Conditional | Close as duplicate of another commitment. Required unless `evidence` is provided. |

**Errors:**
- `E_REF_NOT_FOUND` - Evidence memory doesn't exist
- `E_REF_NOT_FOUND` - Duplicate target commitment doesn't exist
- `E_ALREADY_CLOSED` - Commitment is already closed
- `E_CONSTRAINT_VIOLATED` - Genesis Key constraint not met

#### annotate

Attach a note to any record.

<details>
<summary><strong>Request</strong></summary>

```bash
curl -X POST http://localhost:3000/ops \
  -H "Authorization: Bearer mentu_key_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "op": "annotate",
    "target": "cmt_def67890",
    "body": "Blocked by dependency issue",
    "kind": "blocker"
  }'
```

</details>

<details>
<summary><strong>Response (201 Created)</strong></summary>

```json
{
  "id": "op_12345678",
  "op": "annotate",
  "ts": "2025-12-28T12:00:00Z",
  "actor": "alice",
  "target": "cmt_def67890",
  "body": "Blocked by dependency issue",
  "kind": "blocker"
}
```

</details>

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `op` | string | Yes | Must be `"annotate"` |
| `target` | string | Yes | Memory or commitment ID |
| `body` | string | Yes | Annotation text |
| `kind` | string | No | Type of annotation |

---

#### Review + Triage Operations

The review (`submit`, `approve`, `reopen`) and triage (`link`, `dismiss`, `triage`) layers are also available via `POST /ops`.

**Example: submit**
```bash
curl -X POST http://localhost:3000/ops \
  -H "Authorization: Bearer mentu_key_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "op": "submit",
    "commitment": "cmt_def67890",
    "evidence": ["mem_xyz12345"],
    "summary": "Work complete; tests passing",
    "tier": "tier_2"
  }'
```

**Example: link**
```bash
curl -X POST http://localhost:3000/ops \
  -H "Authorization: Bearer mentu_key_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "op": "link",
    "source": "mem_xyz12345",
    "target": "cmt_def67890",
    "kind": "evidence",
    "reason": "This memory proves completion"
  }'
```

---

### GET /memories

List all memories with optional filters.

**Authentication:** Required

<details>
<summary><strong>Request</strong></summary>

```bash
curl "http://localhost:3000/memories?kind=evidence&limit=10" \
  -H "Authorization: Bearer mentu_key_xxx"
```

</details>

<details>
<summary><strong>Response (200 OK)</strong></summary>

```json
{
  "memories": [
    {
      "id": "mem_abc12345",
      "body": "Fixed in commit abc123",
      "ts": "2025-12-28T12:00:00Z",
      "actor": "alice",
      "kind": "evidence",
      "tags": [],
      "annotations": []
    }
  ],
  "total": 42,
  "limit": 10,
  "offset": 0
}
```

</details>

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `kind` | string | - | Filter by kind |
| `tags` | string | - | Comma-separated tag filter |
| `since` | ISO8601 | - | Memories after this timestamp |
| `limit` | number | 100 | Max results (1-1000) |
| `offset` | number | 0 | Pagination offset |

---

### GET /memories/:id

Get a specific memory with its annotations.

**Authentication:** Required

<details>
<summary><strong>Request</strong></summary>

```bash
curl http://localhost:3000/memories/mem_abc12345 \
  -H "Authorization: Bearer mentu_key_xxx"
```

</details>

<details>
<summary><strong>Response (200 OK)</strong></summary>

```json
{
  "id": "mem_abc12345",
  "body": "Customer reported login failing on mobile",
  "ts": "2025-12-28T12:00:00Z",
  "actor": "alice",
  "kind": "bug_report",
  "tags": ["mobile", "auth"],
  "annotations": [
    {
      "id": "op_xyz789",
      "body": "Confirmed on iOS 17",
      "ts": "2025-12-28T13:00:00Z",
      "actor": "bob"
    }
  ],
  "commitments": ["cmt_def67890"]
}
```

</details>

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Memory ID |
| `body` | string | Memory content |
| `ts` | string | ISO8601 timestamp |
| `actor` | string | Creator |
| `kind` | string? | Memory type |
| `tags` | string[] | Tags |
| `annotations` | object[] | Attached annotations |
| `commitments` | string[] | Commitments referencing this memory |

---

### GET /commitments

List all commitments with computed state.

**Authentication:** Required

<details>
<summary><strong>Request</strong></summary>

```bash
curl "http://localhost:3000/commitments?state=claimed&limit=20" \
  -H "Authorization: Bearer mentu_key_xxx"
```

</details>

<details>
<summary><strong>Response (200 OK)</strong></summary>

```json
{
  "commitments": [
    {
      "id": "cmt_def67890",
      "body": "Fix mobile login bug",
      "source": "mem_abc12345",
      "state": "claimed",
      "owner": "alice",
      "created_at": "2025-12-28T12:00:00Z",
      "created_by": "alice",
      "tags": ["bug", "urgent"]
    }
  ],
  "total": 15,
  "limit": 20,
  "offset": 0
}
```

</details>

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `state` | string | - | Filter: `open`, `claimed`, `in_review`, `reopened`, `closed` |
| `owner` | string | - | Filter by current owner |
| `tags` | string | - | Comma-separated tag filter |
| `since` | ISO8601 | - | Created after this timestamp |
| `limit` | number | 100 | Max results (1-1000) |
| `offset` | number | 0 | Pagination offset |

**Commitment States:**

| State | Description |
|-------|-------------|
| `open` | Not claimed, not closed |
| `claimed` | Has an owner, not closed |
| `in_review` | Submitted, awaiting approval |
| `reopened` | Disputed, needs rework |
| `closed` | Closed (approved or direct close) |

---

### GET /commitments/:id

Get a specific commitment with full state and history.

**Authentication:** Required

<details>
<summary><strong>Request</strong></summary>

```bash
curl http://localhost:3000/commitments/cmt_def67890 \
  -H "Authorization: Bearer mentu_key_xxx"
```

</details>

<details>
<summary><strong>Response (200 OK)</strong></summary>

```json
{
  "id": "cmt_def67890",
  "body": "Fix mobile login bug",
  "source": "mem_abc12345",
  "state": "closed",
  "owner": null,
  "created_at": "2025-12-28T12:00:00Z",
  "created_by": "alice",
  "closed_at": "2025-12-28T15:00:00Z",
  "closed_by": "bob",
  "evidence": "mem_xyz12345",
  "duplicate_of": null,
  "tags": ["bug", "urgent"],
  "annotations": [],
  "external_refs": [
    {
      "system": "github",
      "type": "issue",
      "id": "42",
      "url": "https://github.com/org/repo/issues/42"
    }
  ],
  "history": [
    {"op": "commit", "ts": "2025-12-28T12:00:00Z", "actor": "alice"},
    {"op": "claim", "ts": "2025-12-28T12:30:00Z", "actor": "alice"},
    {"op": "submit", "ts": "2025-12-28T14:55:00Z", "actor": "alice"},
    {"op": "approve", "ts": "2025-12-28T15:00:00Z", "actor": "bob"}
  ]
}
```

</details>

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Commitment ID |
| `body` | string | Commitment description |
| `source` | string | Source memory ID |
| `state` | string | `open`, `claimed`, or `closed` |
| `owner` | string? | Current owner (null if open/closed) |
| `created_at` | string | ISO8601 creation time |
| `created_by` | string | Creator |
| `closed_at` | string? | ISO8601 close time |
| `closed_by` | string? | Actor who closed |
| `evidence` | string? | Evidence memory ID |
| `tags` | string[] | Tags |
| `annotations` | object[] | Attached annotations |
| `external_refs` | object[] | External system links |
| `history` | object[] | Operation history |

---

### GET /ledger

Raw ledger access for debugging and auditing.

**Authentication:** Required

<details>
<summary><strong>Request</strong></summary>

```bash
curl "http://localhost:3000/ledger?op=close&limit=10" \
  -H "Authorization: Bearer mentu_key_xxx"
```

</details>

<details>
<summary><strong>Response (200 OK)</strong></summary>

```json
{
  "operations": [
    {
      "id": "op_12345678",
      "op": "close",
      "ts": "2025-12-28T15:00:00Z",
      "actor": "alice",
      "workspace": "my-project",
      "payload": {
        "commitment": "cmt_def67890",
        "evidence": "mem_xyz12345"
      }
    }
  ],
  "total": 156,
  "limit": 10,
  "offset": 0
}
```

</details>

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `since` | ISO8601 | - | Operations after this timestamp |
| `op` | string | - | Filter by operation type |
| `actor` | string | - | Filter by actor |
| `limit` | number | 100 | Max results (1-1000) |
| `offset` | number | 0 | Pagination offset |

---

### GET /status

Workspace status summary.

**Authentication:** Required

<details>
<summary><strong>Request</strong></summary>

```bash
curl http://localhost:3000/status \
  -H "Authorization: Bearer mentu_key_xxx"
```

</details>

<details>
<summary><strong>Response (200 OK)</strong></summary>

```json
{
  "workspace": "my-project",
  "ledger": {
    "operations": 156,
    "last_operation": "2025-12-28T15:00:00Z"
  },
  "memories": {
    "total": 42
  },
  "commitments": {
    "total": 15,
    "open": 5,
    "claimed": 8,
    "in_review": 0,
    "reopened": 0,
    "closed": 2
  },
  "genesis_key": {
    "present": true,
    "version": "1.0"
  },
  "integrations": {
    "github": {
      "enabled": true,
      "linked_commitments": 3
    }
  }
}
```

</details>

---

## WebSocket API

### Connection

Connect to the WebSocket endpoint for real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:3000');
```

### Authentication

Authenticate via the first message (not query string for security):

```javascript
ws.onopen = () => {
  ws.send(JSON.stringify({
    action: 'auth',
    token: 'mentu_key_xxx'
  }));
};
```

**Success Response:**
```json
{
  "event": "authenticated",
  "actor": "alice"
}
```

**Error Response:**
```json
{
  "event": "error",
  "error": "E_UNAUTHORIZED",
  "message": "Invalid API key"
}
```

### Subscribing to Events

After authentication, subscribe to events:

```javascript
ws.send(JSON.stringify({
  action: 'subscribe',
  filters: {
    ops: ['commit', 'close'],
    actors: ['alice'],
    commitments: ['cmt_def67890']
  }
}));
```

**Filter Options:**

| Filter | Type | Description |
|--------|------|-------------|
| `ops` | string[] | Operation types to receive |
| `actors` | string[] | Filter by actor |
| `commitments` | string[] | Specific commitment IDs |
| `memories` | string[] | Specific memory IDs |

Empty filters = receive all events.

### Event Messages

When a matching operation occurs:

```json
{
  "event": "operation",
  "data": {
    "id": "op_xyz789",
    "op": "close",
    "ts": "2025-12-28T15:00:00Z",
    "actor": "alice",
    "payload": {
      "commitment": "cmt_def67890",
      "evidence": "mem_ghi789"
    }
  }
}
```

### Complete Example

```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.onopen = () => {
  // Step 1: Authenticate
  ws.send(JSON.stringify({
    action: 'auth',
    token: 'mentu_key_xxx'
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  switch (msg.event) {
    case 'authenticated':
      console.log('Authenticated as:', msg.actor);
      // Step 2: Subscribe
      ws.send(JSON.stringify({
        action: 'subscribe',
        filters: { ops: ['close'] }
      }));
      break;

    case 'subscribed':
      console.log('Subscribed to events');
      break;

    case 'operation':
      console.log('New operation:', msg.data);
      break;

    case 'error':
      console.error('Error:', msg.message);
      break;
  }
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Connection closed');
};
```

### Heartbeat

Send periodic pings to keep the connection alive:

```javascript
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ action: 'ping' }));
  }
}, 30000);
```

Response:
```json
{ "event": "pong" }
```

---

## Error Reference

### Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `E_UNAUTHORIZED` | 401 | Missing or invalid API key |
| `E_FORBIDDEN` | 403 | Valid key but insufficient permissions |
| `E_NOT_FOUND` | 404 | Resource not found |
| `E_MISSING_FIELD` | 400 | Required field missing |
| `E_INVALID_OP` | 400 | Invalid operation type or data |
| `E_EMPTY_BODY` | 400 | Body cannot be empty |
| `E_REF_NOT_FOUND` | 404 | Referenced ID doesn't exist |
| `E_ALREADY_CLOSED` | 409 | Commitment already closed |
| `E_ALREADY_CLAIMED` | 409 | Commitment claimed by another |
| `E_NOT_OWNER` | 403 | Not the owner of commitment |
| `E_PERMISSION_DENIED` | 403 | Genesis Key permission denied |
| `E_CONSTRAINT_VIOLATED` | 403 | Genesis Key constraint violated |
| `E_DUPLICATE_SOURCE_KEY` | 409 | Source key already exists |

### Example Error Responses

**Permission Denied:**
```json
{
  "error": "E_PERMISSION_DENIED",
  "message": "Actor 'agent:triage' is not permitted to perform 'commit'",
  "actor": "agent:triage",
  "operation": "commit"
}
```

**Constraint Violated:**
```json
{
  "error": "E_CONSTRAINT_VIOLATED",
  "message": "Constraint 'require_claim' violated: commitment must be claimed before close",
  "constraint": "require_claim",
  "commitment": "cmt_def67890"
}
```

**Reference Not Found:**
```json
{
  "error": "E_REF_NOT_FOUND",
  "message": "Memory 'mem_invalid' not found",
  "ref": "mem_invalid"
}
```

---

## Genesis Key Enforcement

All write operations enforce Genesis Key rules when a Genesis Key is present:

1. **Permission Check**: Verify actor has permission for operation
2. **Constraint Check**: Enforce `require_claim`, `require_human`, `require_validation`
3. **Actor Verification**: Actor is determined by API key, never from request body

See [Genesis Key Guide](./GENESIS-KEY.md) for configuration details.

---

## Pagination

List endpoints support pagination via `limit` and `offset`:

```bash
# First page
curl "http://localhost:3000/commitments?limit=20"

# Second page
curl "http://localhost:3000/commitments?limit=20&offset=20"
```

Response includes pagination metadata:

```json
{
  "commitments": [...],
  "total": 150,
  "limit": 20,
  "offset": 20
}
```

**Best Practices:**
- Use reasonable page sizes (20-100)
- Maximum limit is 1000
- Use `since` parameter for time-based pagination to avoid missing new items

---

## Rate Limiting

Rate limiting is not currently implemented. The GitHub integration respects GitHub's API rate limits.

**Future Enhancement:** Rate limiting will be added with headers:
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1703750400
```

---

## CORS

CORS is disabled by default. Enable for browser clients:

```bash
mentu serve --cors
```

When enabled, the following headers are set:
```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type
```

---

## SDK Examples

### JavaScript/TypeScript

```typescript
class MentuClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  private async request(method: string, path: string, body?: object) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    return response.json();
  }

  async capture(body: string, options?: { kind?: string; tags?: string[] }) {
    return this.request('POST', '/ops', {
      op: 'capture',
      body,
      ...options,
    });
  }

  async commit(body: string, source: string, options?: { tags?: string[] }) {
    return this.request('POST', '/ops', {
      op: 'commit',
      body,
      source,
      ...options,
    });
  }

  async claim(commitment: string) {
    return this.request('POST', '/ops', { op: 'claim', commitment });
  }

  async close(commitment: string, evidence: string) {
    return this.request('POST', '/ops', { op: 'close', commitment, evidence });
  }

  async getCommitments(filters?: { state?: string; limit?: number }) {
    const params = new URLSearchParams(filters as any);
    return this.request('GET', `/commitments?${params}`);
  }

  async getStatus() {
    return this.request('GET', '/status');
  }
}

// Usage
const client = new MentuClient('http://localhost:3000', 'mentu_key_xxx');

const memory = await client.capture('Bug found in login', { kind: 'bug_report' });
const commitment = await client.commit('Fix login bug', memory.id);
await client.claim(commitment.id);

const evidence = await client.capture('Fixed in PR #123', { kind: 'evidence' });
await client.close(commitment.id, evidence.id);
```

### Python

```python
import requests
from typing import Optional, List, Dict, Any

class MentuClient:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip('/')
        self.headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }

    def _request(self, method: str, path: str, json: dict = None) -> dict:
        response = requests.request(
            method,
            f'{self.base_url}{path}',
            headers=self.headers,
            json=json
        )
        response.raise_for_status()
        return response.json()

    def capture(self, body: str, kind: str = None, tags: List[str] = None) -> dict:
        payload = {'op': 'capture', 'body': body}
        if kind:
            payload['kind'] = kind
        if tags:
            payload['tags'] = tags
        return self._request('POST', '/ops', payload)

    def commit(self, body: str, source: str, tags: List[str] = None) -> dict:
        payload = {'op': 'commit', 'body': body, 'source': source}
        if tags:
            payload['tags'] = tags
        return self._request('POST', '/ops', payload)

    def claim(self, commitment: str) -> dict:
        return self._request('POST', '/ops', {'op': 'claim', 'commitment': commitment})

    def close(self, commitment: str, evidence: str) -> dict:
        return self._request('POST', '/ops', {
            'op': 'close',
            'commitment': commitment,
            'evidence': evidence
        })

    def get_commitments(self, state: str = None, limit: int = 100) -> dict:
        params = f'?limit={limit}'
        if state:
            params += f'&state={state}'
        return self._request('GET', f'/commitments{params}')

    def get_status(self) -> dict:
        return self._request('GET', '/status')


# Usage
client = MentuClient('http://localhost:3000', 'mentu_key_xxx')

memory = client.capture('Bug found in login', kind='bug_report')
commitment = client.commit('Fix login bug', memory['id'])
client.claim(commitment['id'])

evidence = client.capture('Fixed in PR #123', kind='evidence')
client.close(commitment['id'], evidence['id'])
```

### cURL

```bash
# Set your API key
export MENTU_KEY="mentu_key_xxx"
export MENTU_URL="http://localhost:3000"

# Capture a memory
curl -X POST "$MENTU_URL/ops" \
  -H "Authorization: Bearer $MENTU_KEY" \
  -H "Content-Type: application/json" \
  -d '{"op": "capture", "body": "Bug found", "kind": "bug_report"}'

# Create a commitment
curl -X POST "$MENTU_URL/ops" \
  -H "Authorization: Bearer $MENTU_KEY" \
  -H "Content-Type: application/json" \
  -d '{"op": "commit", "body": "Fix bug", "source": "mem_abc123"}'

# Claim it
curl -X POST "$MENTU_URL/ops" \
  -H "Authorization: Bearer $MENTU_KEY" \
  -H "Content-Type: application/json" \
  -d '{"op": "claim", "commitment": "cmt_def456"}'

# Close with evidence
curl -X POST "$MENTU_URL/ops" \
  -H "Authorization: Bearer $MENTU_KEY" \
  -H "Content-Type: application/json" \
  -d '{"op": "close", "commitment": "cmt_def456", "evidence": "mem_ghi789"}'

# Get status
curl "$MENTU_URL/status" \
  -H "Authorization: Bearer $MENTU_KEY"
```

---

## Changelog

| Version | Changes |
|---------|---------|
| 1.0.0 | Initial release with 9 endpoints |

---

## See Also

- [CLI Reference](./CLI.md) - Command-line interface
- [Quick Start](./QUICKSTART.md) - 5-minute guide
- [Genesis Key Guide](./GENESIS-KEY.md) - Governance configuration
