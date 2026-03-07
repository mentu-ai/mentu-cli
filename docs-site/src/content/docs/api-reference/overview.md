---
title: API Overview
description: HTTP API reference for Mentu
order: 1
---

## Base URL

```
https://mentu-proxy.affihub.workers.dev
```

## Authentication

All requests require the `X-Proxy-Token` header:

```bash
curl -X POST https://mentu-proxy.affihub.workers.dev/ops \
  -H "X-Proxy-Token: your_token" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

## Response Format

All responses are JSON:

```json
{
  "success": true,
  "data": { ... }
}
```

Error responses:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Description"
  }
}
```

## Endpoints Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/status` | Workspace status |
| POST | `/ops` | Execute operation |
| GET | `/memories` | List memories |
| GET | `/commitments` | List commitments |

## Next

- [Endpoints](/knowledge-base/api-reference/endpoints/)
- [Authentication](/knowledge-base/api-reference/authentication/)
