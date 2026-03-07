---
title: Authentication
description: API authentication guide
order: 3
---

## Token Authentication

All API requests require a valid token in the `X-Proxy-Token` header.

```bash
curl -X GET https://mentu-proxy.affihub.workers.dev/status \
  -H "X-Proxy-Token: your_token_here"
```

## Obtaining Tokens

Tokens are provisioned per workspace. Contact your workspace administrator.

## Token Format

Tokens are opaque strings. Do not attempt to decode or modify them.

## Error Responses

### Missing Token

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "X-Proxy-Token header required"
  }
}
```

HTTP Status: 401

### Invalid Token

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Invalid or expired token"
  }
}
```

HTTP Status: 403

## Environment Variables

For CLI usage, set these environment variables:

```bash
export MENTU_API_URL="https://mentu-proxy.affihub.workers.dev"
export MENTU_PROXY_TOKEN="your_token"
export MENTU_WORKSPACE_ID="your_workspace_id"
```

## Security Best Practices

1. **Never commit tokens** to version control
2. **Use environment variables** for token storage
3. **Rotate tokens** periodically
4. **Use separate tokens** for different environments

## Actor Identity

Operations can specify an actor:

```json
{
  "op": "capture",
  "body": "Found bug",
  "actor": "agent:claude-code"
}
```

The actor is recorded in the ledger for accountability.
