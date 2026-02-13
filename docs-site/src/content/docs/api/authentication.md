---
title: "Authentication"
description: "How to authenticate requests to the Mentu Proxy API using API tokens and workspace IDs."
---

Every request to the Mentu Proxy API must include two authentication headers. There are no anonymous endpoints.

## Required Headers

| Header | Description | Example |
|--------|-------------|---------|
| `X-Proxy-Token` | Your API token | `mnt_sk_a1b2c3d4e5f6...` |
| `X-Workspace-Id` | Your workspace UUID | `2e78554d-9d92-4e4a-8866-aa126f25fbe6` |

All request bodies must be sent as JSON with the `Content-Type: application/json` header.

```bash
curl -X POST https://mentu-proxy.affihub.workers.dev/ops \
  -H "X-Proxy-Token: $MENTU_API_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WORKSPACE_ID" \
  -H "Content-Type: application/json" \
  -d '{"op":"capture","body":"Hello from the API"}'
```

## Obtaining Tokens

API tokens are provisioned by workspace administrators. Each token is scoped to a single workspace and grants full read/write access to that workspace's ledger, commitments, and memories.

To get a token:

1. Ask your workspace admin to generate an API token for your use case.
2. The admin will provide you with a token string and the workspace UUID.
3. Store both values securely (see [Environment Variables](#environment-variables) below).

A single workspace can have multiple active tokens, allowing you to issue separate credentials for different agents, services, or team members.

## Environment Variables

Store your credentials as environment variables. Never hardcode them in source files.

```bash
# .env (local development)
MENTU_API_TOKEN=mnt_sk_a1b2c3d4e5f6...
MENTU_WORKSPACE_ID=2e78554d-9d92-4e4a-8866-aa126f25fbe6
```

Then reference them in your requests:

```bash
curl -X GET https://mentu-proxy.affihub.workers.dev/status \
  -H "X-Proxy-Token: $MENTU_API_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WORKSPACE_ID"
```

In application code (Node.js example):

```javascript
const headers = {
  "X-Proxy-Token": process.env.MENTU_API_TOKEN,
  "X-Workspace-Id": process.env.MENTU_WORKSPACE_ID,
  "Content-Type": "application/json",
};

const res = await fetch("https://mentu-proxy.affihub.workers.dev/status", { headers });
```

## Error Responses

When authentication fails, the API returns one of two error codes:

### 401 Unauthorized

Returned when the `X-Proxy-Token` header is missing or the token is invalid.

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid API token."
  }
}
```

### 403 Forbidden

Returned when the token is valid but does not have access to the specified workspace.

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Token does not have access to this workspace."
  }
}
```

## Actor Identity

Every operation recorded in the Mentu ledger includes an `actor` field that identifies who or what performed the action. The actor is derived from the API token used to authenticate the request.

When reviewing ledger history, the actor field lets you trace which agent, service, or human initiated each state transition:

```json
{
  "op_id": "op_12345678",
  "op": "commit",
  "actor": "ci-pipeline",
  "timestamp": "2025-03-15T10:30:00Z"
}
```

This is especially important in multi-agent environments where several automated systems and humans interact with the same workspace.

## Security Best Practices

1. **Never commit tokens to version control.** Add `.env` to your `.gitignore` and use environment variables or a secrets manager.

2. **Use separate tokens per environment.** Issue distinct tokens for development, staging, and production so you can revoke one without disrupting others.

3. **Rotate tokens periodically.** Ask your workspace admin to generate a new token and retire old ones on a regular cadence (e.g., quarterly).

4. **Limit token distribution.** Each agent, CI pipeline, or service should have its own token. Avoid sharing a single token across multiple systems.

5. **Audit token usage.** The ledger records the actor for every operation, making it possible to detect unexpected or unauthorized activity.

6. **Use HTTPS only.** The API base URL (`https://mentu-proxy.affihub.workers.dev`) enforces TLS. Never downgrade to plain HTTP.
