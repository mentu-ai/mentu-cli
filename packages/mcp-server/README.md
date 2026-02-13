# @mentu/mcp

Model Context Protocol server for the [Mentu](https://mentu.dev) commitment ledger. Gives any MCP-compatible AI IDE (Claude Code, Cursor, Codex, Windsurf, etc.) the ability to track work as append-only commitments with full evidence chains.

Mentu is **not** a task tracker. It is:

- **Commitment ledger** -- append-only, never mutate
- **Evidence-bound** -- every state transition (build pass/fail, PR created, triage decision) is captured
- **Coordination-first** -- any agent or human can query Mentu to reconstruct pipeline state without local files
- **Agent-compatible** -- designed for human+AI interoperability

## Installation

Run directly with npx (no install required):

```bash
npx @mentu/mcp
```

### Claude Code

```bash
claude mcp add mentu -- npx @mentu/mcp
```

### Cursor / Windsurf / Other MCP clients

Add to your MCP config (e.g. `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "mentu": {
      "command": "npx",
      "args": ["@mentu/mcp"],
      "env": {
        "MENTU_API_TOKEN": "your-token",
        "MENTU_WORKSPACE_ID": "your-workspace-id"
      }
    }
  }
}
```

## Configuration

The server reads configuration from environment variables, falling back to a `.mentu.json` file in your project root.

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MENTU_API_TOKEN` | Yes | Authentication token for the Mentu proxy API |
| `MENTU_WORKSPACE_ID` | Yes | Your Mentu workspace ID |
| `MENTU_API_URL` | No | API endpoint (defaults to `https://mentu-proxy.affihub.workers.dev`) |

The server also accepts `VITE_MENTU_*` prefixed variants for compatibility with Vite-based projects.

### `.mentu.json`

Place a `.mentu.json` file in your project root as an alternative to environment variables:

```json
{
  "apiUrl": "https://mentu-proxy.affihub.workers.dev",
  "apiToken": "your-token",
  "workspaceId": "your-workspace-id",
  "projectDomains": ["myapp.com", "staging.myapp.com"]
}
```

Environment variables take precedence over `.mentu.json` values.

## Tools (12)

### Commitment lifecycle

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `mentu_commit` | Create a new commitment (promise to do work) | `body` (string), `source` (mem_xxx), `tags?`, `meta?` |
| `mentu_claim` | Claim a commitment for execution | `commitment` (cmt_xxx) |
| `mentu_submit` | Submit a commitment for review with evidence | `commitment` (cmt_xxx), `evidence` (mem_xxx[]), `summary?`, `tier?`, `validation?` |
| `mentu_close` | Close a commitment directly | `commitment` (cmt_xxx), `evidence?`, `duplicate_of?` |
| `mentu_approve` | Approve a submitted commitment, closing it as passed | `commitment` (cmt_xxx), `comment?`, `auto?` |

### Memory management

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `mentu_capture` | Capture a memory (bug report, progress note, validation result) | `body` (string), `kind?`, `refs?`, `meta?`, `source_key?` |
| `mentu_dismiss` | Dismiss a memory as junk/test/duplicate | `memory` (mem_xxx), `reason` (string), `tags?` |
| `mentu_annotate` | Add a comment or note to a memory or commitment | `target` (mem_xxx or cmt_xxx), `body` (string), `kind?` |

### Triage and queries

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `mentu_triage` | Record a triage session with decisions per memory | `reviewed` (mem_xxx[]), `summary`, `decisions` (action per memory) |
| `mentu_list_memories` | List memories with optional filters | `limit?`, `offset?`, `kind?`, `since?` |
| `mentu_list_commitments` | List commitments with lifecycle state | `state?`, `owner?`, `tags?`, `limit?`, `offset?`, `since?` |
| `mentu_get_status` | Get pipeline health: counts by state, totals, ledger stats | *(none)* |

### Commitment state machine

```
OPEN --> CLAIMED --> IN_REVIEW --> CLOSED
                  /                  |
            REOPENED <--------------+
```

## Resources (5)

| URI | Description |
|-----|-------------|
| `mentu://commitments` | All commitments with lifecycle state |
| `mentu://commitments/{id}` | Single commitment with history and annotations |
| `mentu://memories` | All memories (bug reports, evidence) |
| `mentu://memories/{id}` | Single memory with annotations |
| `mentu://status` | Pipeline health summary |

## Prompts (3)

| Prompt | Description | Arguments |
|--------|-------------|-----------|
| `mentu_triage` | Triage bug memories using the 5-gate garbage filter. Fetches untriaged memories, scores survivors, and presents an actionable dashboard. | `project_name?`, `batch_size?` |
| `mentu_fix` | Fix a single bug ticket end-to-end: fetch, investigate, branch, fix, PR, submit. | `memory_id` (required) |
| `mentu_batch` | Batch fix multiple bug tickets in a wave. Triage first, then fix top tickets sequentially with full evidence chain. | `batch_size?`, `dry_run?` |

## Supported IDEs

This MCP server works with any IDE or tool that supports the [Model Context Protocol](https://modelcontextprotocol.io):

- **Claude Code** (Anthropic)
- **Cursor**
- **Codex** (OpenAI)
- **Windsurf** (Codeium)
- **Continue**
- Any other MCP-compatible client

## Requirements

- Node.js >= 18.0.0

## License

MIT -- see [LICENSE](./LICENSE)
