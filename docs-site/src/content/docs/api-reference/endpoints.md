---
title: Endpoints
description: API endpoint reference
order: 2
---

## Health Check

```
GET /health
```

Returns server health status.

### Response

```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2026-01-03T12:00:00Z"
}
```

## Workspace Status

```
GET /status
```

Returns current workspace state.

### Response

```json
{
  "workspace_id": "ws_xxx",
  "memories": {
    "total": 42,
    "untriaged": 5
  },
  "commitments": {
    "total": 15,
    "open": 3,
    "claimed": 2,
    "in_review": 1
  }
}
```

## Execute Operation

```
POST /ops
```

Execute a Mentu operation.

### Request Body

```json
{
  "op": "capture",
  "body": "Found bug in auth",
  "kind": "observation",
  "actor": "agent:claude-code"
}
```

### Supported Operations

| Operation | Required Fields |
|-----------|-----------------|
| `capture` | body |
| `commit` | body, source |
| `claim` | target |
| `release` | target |
| `close` | target, evidence |
| `annotate` | target, body |

### Response

```json
{
  "success": true,
  "op_id": "op_12345678",
  "record_id": "mem_abcdef12"
}
```

## List Memories

```
GET /memories
```

### Query Parameters

| Parameter | Description |
|-----------|-------------|
| `state` | Filter by state |
| `kind` | Filter by kind |
| `limit` | Max results |
| `offset` | Pagination offset |

### Response

```json
{
  "memories": [
    {
      "id": "mem_abc123",
      "body": "Found bug",
      "kind": "observation",
      "state": "untriaged",
      "created_at": "2026-01-03T12:00:00Z"
    }
  ],
  "total": 42
}
```

## List Commitments

```
GET /commitments
```

### Query Parameters

| Parameter | Description |
|-----------|-------------|
| `state` | Filter by state |
| `claimed_by` | Filter by claimant |
| `limit` | Max results |

### Response

```json
{
  "commitments": [
    {
      "id": "cmt_def456",
      "body": "Fix auth bug",
      "state": "claimed",
      "source": "mem_abc123",
      "claimed_by": "agent:claude-code"
    }
  ],
  "total": 15
}
```

## Get Record

```
GET /records/:id
```

Get details for a specific memory or commitment.

### Response

```json
{
  "id": "cmt_def456",
  "type": "commitment",
  "body": "Fix auth bug",
  "state": "claimed",
  "source": "mem_abc123",
  "operations": [
    { "op_id": "op_111", "op": "commit", "at": "..." },
    { "op_id": "op_222", "op": "claim", "at": "..." }
  ]
}
```
