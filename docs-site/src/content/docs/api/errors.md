---
title: "Errors"
description: "Error response format, HTTP status codes, error codes, and retry guidance for the Mentu Proxy API."
---

When a request fails, the Mentu Proxy API returns a consistent error response body along with an appropriate HTTP status code. Your client should check for `"success": false` to detect errors.

**Base URL:** `https://mentu-proxy.affihub.workers.dev`

---

## Error Response Shape

Every error response follows the same structure:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "A human-readable description of what went wrong."
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always `false` for error responses |
| `error.code` | string | Machine-readable error code (see table below) |
| `error.message` | string | Human-readable explanation of the error |

---

## HTTP Status Codes

| Status | Meaning | When It Occurs |
|--------|---------|----------------|
| `400` | Bad Request | Malformed JSON, missing required fields, or invalid operation name |
| `401` | Unauthorized | Missing or invalid `X-Proxy-Token` header |
| `403` | Forbidden | Valid token but insufficient access to the workspace |
| `404` | Not Found | The requested resource (commitment, memory) does not exist |
| `422` | Validation Error | Request is well-formed but fails business logic validation |
| `500` | Server Error | Unexpected internal error |

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_REQUEST` | 400 | The request body is malformed or missing required fields |
| `UNAUTHORIZED` | 401 | Authentication failed -- missing or invalid token |
| `FORBIDDEN` | 403 | Token does not have access to the specified workspace |
| `NOT_FOUND` | 404 | The referenced resource does not exist |
| `VALIDATION_ERROR` | 422 | The request is syntactically valid but violates a business rule |
| `SERVER_ERROR` | 500 | An unexpected internal error occurred |

---

## Common Error Scenarios

### Missing Authentication Headers

```bash
curl -X GET https://mentu-proxy.affihub.workers.dev/status
```

```
HTTP/1.1 401 Unauthorized
```

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid API token."
  }
}
```

### Invalid Operation Name

```bash
curl -X POST https://mentu-proxy.affihub.workers.dev/ops \
  -H "X-Proxy-Token: $MENTU_API_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WORKSPACE_ID" \
  -H "Content-Type: application/json" \
  -d '{"op": "invalid_op"}'
```

```
HTTP/1.1 400 Bad Request
```

```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Unknown operation: 'invalid_op'. Valid operations are: capture, commit, claim, release, close, annotate, submit, approve, reopen, link, dismiss, triage."
  }
}
```

### Missing Required Fields

```bash
curl -X POST https://mentu-proxy.affihub.workers.dev/ops \
  -H "X-Proxy-Token: $MENTU_API_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WORKSPACE_ID" \
  -H "Content-Type: application/json" \
  -d '{"op": "commit"}'
```

```
HTTP/1.1 400 Bad Request
```

```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Missing required field: 'title' is required for the 'commit' operation."
  }
}
```

### Resource Not Found

```bash
curl -X GET https://mentu-proxy.affihub.workers.dev/commitments/cmt_nonexistent \
  -H "X-Proxy-Token: $MENTU_API_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WORKSPACE_ID"
```

```
HTTP/1.1 404 Not Found
```

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Commitment 'cmt_nonexistent' not found."
  }
}
```

### Invalid State Transition

```bash
# Trying to claim a commitment that is already closed
curl -X POST https://mentu-proxy.affihub.workers.dev/ops \
  -H "X-Proxy-Token: $MENTU_API_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WORKSPACE_ID" \
  -H "Content-Type: application/json" \
  -d '{"op": "claim", "id": "cmt_bcdef123", "owner": "agent-ralph"}'
```

```
HTTP/1.1 422 Unprocessable Entity
```

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Cannot claim commitment 'cmt_bcdef123': current state is 'closed', but 'claim' requires state 'open'."
  }
}
```

### Closing Without Evidence

```bash
curl -X POST https://mentu-proxy.affihub.workers.dev/ops \
  -H "X-Proxy-Token: $MENTU_API_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WORKSPACE_ID" \
  -H "Content-Type: application/json" \
  -d '{"op": "close", "id": "cmt_bcdef123", "result": "pass"}'
```

```
HTTP/1.1 422 Unprocessable Entity
```

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The 'close' operation requires an 'evidence' array. Provide an empty array [] if no evidence is available."
  }
}
```

### Wrong Workspace

```bash
curl -X GET https://mentu-proxy.affihub.workers.dev/status \
  -H "X-Proxy-Token: $MENTU_API_TOKEN" \
  -H "X-Workspace-Id: 00000000-0000-0000-0000-000000000000"
```

```
HTTP/1.1 403 Forbidden
```

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Token does not have access to this workspace."
  }
}
```

---

## Retry Guidance

### Do Retry: 5xx Errors

Server errors (500) are typically transient. Retry with exponential backoff:

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, options);

    if (res.status < 500) {
      return res; // Success or client error -- do not retry
    }

    if (attempt < maxRetries) {
      const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw new Error(`Request failed after ${maxRetries + 1} attempts`);
}
```

**Backoff schedule:**

| Attempt | Delay |
|---------|-------|
| 1st retry | 1 second |
| 2nd retry | 2 seconds |
| 3rd retry | 4 seconds |

### Do Not Retry: 4xx Errors

Client errors (400, 401, 403, 404, 422) indicate a problem with the request itself. Retrying the same request will produce the same error. Instead:

- **400 / 422:** Fix the request body (add missing fields, correct the operation name, fix the state transition).
- **401:** Check that your `X-Proxy-Token` header is set and the token is valid.
- **403:** Verify the `X-Workspace-Id` matches a workspace your token has access to.
- **404:** Confirm the resource ID exists. It may have been created in a different workspace.

---

## Error Handling Example

A robust client pattern that handles all error categories:

```javascript
async function mentuOp(payload) {
  const res = await fetchWithRetry("https://mentu-proxy.affihub.workers.dev/ops", {
    method: "POST",
    headers: {
      "X-Proxy-Token": process.env.MENTU_API_TOKEN,
      "X-Workspace-Id": process.env.MENTU_WORKSPACE_ID,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!data.success) {
    switch (data.error.code) {
      case "UNAUTHORIZED":
        throw new Error("API token is invalid or expired. Check MENTU_API_TOKEN.");
      case "FORBIDDEN":
        throw new Error("Token lacks access to this workspace. Check MENTU_WORKSPACE_ID.");
      case "NOT_FOUND":
        throw new Error(`Resource not found: ${data.error.message}`);
      case "VALIDATION_ERROR":
        throw new Error(`Validation failed: ${data.error.message}`);
      case "INVALID_REQUEST":
        throw new Error(`Bad request: ${data.error.message}`);
      default:
        throw new Error(`Mentu API error: ${data.error.message}`);
    }
  }

  return data;
}
```
