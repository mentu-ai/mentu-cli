---
title: "Quickstart"
description: "Get from zero to your first commitment lifecycle in under 5 minutes using the Mentu MCP server."
---

Mentu is an append-only commitment ledger where every obligation traces back to an observation and every closure requires evidence. It is not a task tracker — it is an accountability system designed for humans, AI agents, and hybrid workflows.

This guide uses the MCP server, the fastest path to working with Mentu.

## 1. Install the MCP server

If you are using Claude Code, add the Mentu MCP server directly:

```bash
claude mcp add mentu -- npx @mentu/mcp
```

For other MCP-compatible clients, run the server with:

```bash
npx @mentu/mcp
```

Or add it to your MCP client configuration (e.g., `mcp.json`):

```json
{
  "mcpServers": {
    "mentu": {
      "command": "npx",
      "args": ["@mentu/mcp"],
      "env": {
        "MENTU_API_TOKEN": "your-token-here",
        "MENTU_WORKSPACE_ID": "your-workspace-id"
      }
    }
  }
}
```

## 2. Configure credentials

The MCP server needs two values to connect to your workspace.

**Option A: Environment variables**

```bash
export MENTU_API_TOKEN="your-api-token"
export MENTU_WORKSPACE_ID="your-workspace-id"
```

**Option B: `.mentu.json` in your project root**

```json
{
  "token": "your-api-token",
  "workspace": "your-workspace-id"
}
```

You can get both values from your workspace settings at [app.mentu.dev](https://app.mentu.dev).

## 3. Capture your first memory

A memory is an observation — something you noticed, discovered, or want to record. Use the `mentu_capture` tool to create one:

```
mentu_capture({
  "title": "Login page has no rate limiting",
  "body": "Tested the /auth/login endpoint — no throttling after 50+ rapid requests. Could allow brute-force attacks.",
  "tags": ["security", "auth"]
})
```

The server returns a memory ID (prefixed with `mem_`). This observation now exists in your ledger permanently.

```json
{
  "id": "mem_a1b2c3d4",
  "title": "Login page has no rate limiting",
  "state": "untriaged",
  "captured_at": "2026-02-13T10:00:00Z"
}
```

## 4. Turn it into a commitment

A commitment is an obligation — a promise to do something about the observation. Use `mentu_commit` to create one, linking it back to the memory as its source:

```
mentu_commit({
  "title": "Add rate limiting to login endpoint",
  "body": "Implement sliding-window rate limiter: max 5 attempts per minute per IP.",
  "source": "mem_a1b2c3d4",
  "priority": "high"
})
```

This creates a commitment in the `open` state and transitions the source memory to `committed`.

```json
{
  "id": "cmt_e5f6g7h8",
  "title": "Add rate limiting to login endpoint",
  "state": "open",
  "source": "mem_a1b2c3d4"
}
```

## 5. Claim it, then close it with evidence

Before working on a commitment, claim it. This signals to the team (and other agents) that you own it:

```
mentu_claim({
  "commitment": "cmt_e5f6g7h8"
})
```

The commitment moves to the `claimed` state. Now do the work. When you are done, close the commitment with evidence proving completion:

```
mentu_close({
  "commitment": "cmt_e5f6g7h8",
  "evidence": [
    {
      "type": "link",
      "value": "https://github.com/acme/api/pull/247",
      "label": "PR #247 — rate limiter middleware"
    },
    {
      "type": "text",
      "value": "Verified: 6th login attempt within 60s returns 429. Tested with curl."
    }
  ]
})
```

The commitment moves to `closed`. The evidence is permanently attached to the ledger entry. You proved it was done rather than simply marking it done.

## 6. Check status

At any point, you can inspect the current state of your workspace:

```
mentu_get_status({})
```

This returns a summary of all memories and commitments, grouped by state:

```json
{
  "memories": { "untriaged": 0, "committed": 1, "linked": 0, "dismissed": 0 },
  "commitments": { "open": 0, "claimed": 0, "in_review": 0, "closed": 1, "reopened": 0 },
  "recent_ops": [
    { "op": "close", "target": "cmt_e5f6g7h8", "at": "2026-02-13T10:15:00Z" }
  ]
}
```

## What you just did

In five steps you completed a full lifecycle:

1. **Captured** an observation (memory)
2. **Committed** to an obligation sourced from that observation
3. **Claimed** ownership of the commitment
4. **Closed** with concrete evidence
5. **Verified** the final state

Every step was recorded as an immutable operation in the ledger. Nothing was edited. Nothing was deleted. The full history can be replayed to reconstruct the state at any point in time.

## Next steps

- [How Mentu Works](/concepts/how-mentu-works/) — understand the core model: memories, commitments, evidence chains, and the append-only ledger
- [State Machine](/concepts/state-machine/) — the full state diagram, transitions, and the accountability airlock
- [Three Rules](/concepts/three-rules/) — the invariants that make the system trustworthy
- [Glossary](/concepts/glossary/) — every term, operation, and ID prefix defined
