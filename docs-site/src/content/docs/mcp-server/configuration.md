---
title: "Configuration"
description: "How to configure the @mentu/mcp server with environment variables, .mentu.json, and per-IDE setup."
---

The MCP server needs three things to connect to your Mentu workspace: an API token, a workspace ID, and (optionally) a custom API URL. You can provide these through environment variables, a `.mentu.json` file, or both.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `MENTU_API_TOKEN` | Yes | Your Mentu API token for authentication |
| `MENTU_WORKSPACE_ID` | Yes | The workspace UUID to operate against |
| `MENTU_API_URL` | No | Custom API endpoint. Defaults to the Mentu production API |

### VITE_MENTU_* prefix

If your project already uses `VITE_MENTU_*` environment variables (common in Vite-based frontends), the MCP server will pick those up automatically:

| Variable | Equivalent to |
|---|---|
| `VITE_MENTU_API_TOKEN` | `MENTU_API_TOKEN` |
| `VITE_MENTU_WORKSPACE_ID` | `MENTU_WORKSPACE_ID` |
| `VITE_MENTU_API_URL` | `MENTU_API_URL` |

This means you can reuse the same `.env` file for both your app and the MCP server without duplication.

## .mentu.json file

You can also place a `.mentu.json` file in your project root:

```json
{
  "apiUrl": "https://mentu-proxy.example.com/ops",
  "apiToken": "mnt_xxxxxxxxxxxxxxxxxxxx",
  "workspaceId": "2e78554d-9d92-4e4a-8866-aa126f25fbe6",
  "projectDomains": ["frontend", "backend", "infra"]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `apiUrl` | `string` | No | Custom API endpoint |
| `apiToken` | `string` | Yes | Mentu API token |
| `workspaceId` | `string` | Yes | Workspace UUID |
| `projectDomains` | `string[]` | No | Domain tags for filtering commitments and memories in this project |

:::caution
Do not commit `.mentu.json` to version control if it contains your API token. Add it to `.gitignore` or use environment variables instead.
:::

## Precedence order

When the same setting is defined in multiple places, the server resolves them in this order (highest priority first):

1. **Environment variables** (`MENTU_API_TOKEN`, `MENTU_WORKSPACE_ID`, `MENTU_API_URL`)
2. **VITE-prefixed env vars** (`VITE_MENTU_API_TOKEN`, etc.)
3. **`.mentu.json`** file in the current working directory
4. **Defaults** (only applies to `apiUrl`)

For example, if `MENTU_API_TOKEN` is set in your shell and `apiToken` is also in `.mentu.json`, the environment variable wins.

## Per-IDE setup

### Claude Code

The simplest setup -- one command registers the server:

```bash
claude mcp add mentu -- npx @mentu/mcp
```

This adds the server to your Claude Code MCP configuration. Make sure your environment variables are available in the shell where Claude Code runs (e.g., via `.env`, `.bashrc`, or your shell profile).

To pass environment variables explicitly:

```bash
claude mcp add mentu \
  -e MENTU_API_TOKEN=mnt_xxxxxxxxxxxxxxxxxxxx \
  -e MENTU_WORKSPACE_ID=your-workspace-id \
  -- npx @mentu/mcp
```

### Cursor

Create or edit `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "mentu": {
      "command": "npx",
      "args": ["@mentu/mcp"],
      "env": {
        "MENTU_API_TOKEN": "mnt_xxxxxxxxxxxxxxxxxxxx",
        "MENTU_WORKSPACE_ID": "your-workspace-id"
      }
    }
  }
}
```

### Windsurf (Codeium)

Add the server to your Windsurf `settings.json`:

```json
{
  "mcpServers": {
    "mentu": {
      "command": "npx",
      "args": ["@mentu/mcp"],
      "env": {
        "MENTU_API_TOKEN": "mnt_xxxxxxxxxxxxxxxxxxxx",
        "MENTU_WORKSPACE_ID": "your-workspace-id"
      }
    }
  }
}
```

### Codex (OpenAI)

Add to your Codex MCP client configuration:

```json
{
  "mcpServers": {
    "mentu": {
      "command": "npx",
      "args": ["@mentu/mcp"],
      "env": {
        "MENTU_API_TOKEN": "mnt_xxxxxxxxxxxxxxxxxxxx",
        "MENTU_WORKSPACE_ID": "your-workspace-id"
      }
    }
  }
}
```

### Generic MCP client

Any MCP client that supports the stdio transport can launch the server. The configuration shape is the same across clients:

```json
{
  "command": "npx",
  "args": ["@mentu/mcp"],
  "env": {
    "MENTU_API_TOKEN": "mnt_xxxxxxxxxxxxxxxxxxxx",
    "MENTU_WORKSPACE_ID": "your-workspace-id"
  }
}
```

The server communicates over stdin/stdout using the MCP JSON-RPC protocol. No HTTP server is started.
