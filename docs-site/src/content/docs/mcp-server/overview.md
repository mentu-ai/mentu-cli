---
title: "MCP Server Overview"
description: "Introduction to the @mentu/mcp server -- tools, resources, and prompts for commitment-driven development inside any AI IDE."
---

The `@mentu/mcp` package is a [Model Context Protocol](https://modelcontextprotocol.io/) server that connects your AI-powered IDE directly to the Mentu commitment ledger. It gives your coding agent the ability to create commitments, record evidence, capture memories, run triage, and query pipeline health -- all without leaving your editor.

## Why it exists

Mentu is a commitment ledger, not a task tracker. Every state transition is append-only and evidence-bound: when an agent claims work, submits a fix, or closes a ticket, the proof is recorded permanently. The MCP server makes this ledger a first-class citizen inside AI coding tools so that agents and humans coordinate through a single source of truth.

## Supported IDEs and tools

The server works with any client that speaks the MCP protocol:

| IDE / Tool | Support |
|---|---|
| **Claude Code** | Native via `claude mcp add` |
| **Cursor** | Via `.cursor/mcp.json` |
| **Codex (OpenAI)** | Via MCP client config |
| **Windsurf (Codeium)** | Via `settings.json` |
| **Continue** | Via MCP client config |
| **Any MCP client** | Standard stdio transport |

## Quick install

The fastest way to get started depends on your IDE.

**Claude Code (one command):**

```bash
claude mcp add mentu -- npx @mentu/mcp
```

**Any other MCP client:**

```bash
npx @mentu/mcp
```

The server runs over stdio -- your IDE launches it as a child process and communicates through stdin/stdout. No ports, no HTTP, no daemon.

## What you get

### 12 Tools

The tools cover the full commitment lifecycle, memory management, and pipeline queries:

| Category | Tools |
|---|---|
| **Commitment lifecycle** | `mentu_commit`, `mentu_claim`, `mentu_submit`, `mentu_close`, `mentu_approve` |
| **Memory management** | `mentu_capture`, `mentu_dismiss`, `mentu_annotate` |
| **Triage and queries** | `mentu_triage`, `mentu_list_memories`, `mentu_list_commitments`, `mentu_get_status` |

### 5 Resources

MCP resources let your agent read ledger data directly:

- `mentu://commitments` -- all commitments
- `mentu://commitments/{id}` -- single commitment with full history
- `mentu://memories` -- all memories
- `mentu://memories/{id}` -- single memory with annotations
- `mentu://status` -- pipeline health summary

### 3 Prompts

Pre-built workflows your agent can invoke:

- **`mentu_triage`** -- 5-gate garbage filter that reviews and scores incoming memories
- **`mentu_fix`** -- end-to-end bug fix workflow from memory to closed commitment
- **`mentu_batch`** -- batch fix wave that processes multiple memories in sequence

## The commitment state machine

Every commitment follows a strict state machine. Transitions are append-only -- you cannot go backwards or skip states.

```
                ┌───────────┐
                │  committed │
                └─────┬─────┘
                      │ claim
                      ▼
                ┌───────────┐
                │  claimed   │
                └─────┬─────┘
                      │ submit
                      ▼
                ┌───────────┐
                │  submitted │
                └─────┬─────┘
                      │ approve
                      ▼
                ┌───────────┐
                │  approved  │
                └───────────┘

     Any state ──close──▶ closed
```

- **committed** -- work has been defined but not started
- **claimed** -- an agent or human has taken ownership
- **submitted** -- work is done and evidence has been attached for review
- **approved** -- the submission passed review
- **closed** -- terminal state; can be reached from any state (e.g., duplicates, won't-fix)

Each transition records who did it, when, and (for submit/close) what evidence supports it.

## Requirements

- **Node.js >= 18** (the server uses modern Node APIs)
- A Mentu workspace with an API token (see [Configuration](/mcp-server/configuration/))
