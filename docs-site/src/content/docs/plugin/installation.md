---
title: "Installation"
description: "How to install the mentu-autopilot plugin for Claude Code, configure environment variables, and verify the connection to your Mentu workspace."
---

## Install the Plugin

Install mentu-autopilot directly from the Claude Code CLI:

```bash
claude plugin install mentu-ai/mentu-autopilot
```

This single command installs the plugin and registers its commands, agents, and hooks with Claude Code. No separate MCP server installation is needed.

## Bundled MCP Server

The plugin bundles `@mentu/mcp` automatically. When you install the plugin, it writes the necessary MCP configuration to your project's `.mcp.json` file. You do not need to install or configure the MCP server separately.

If you already have a `.mcp.json` with a Mentu MCP entry, the plugin will detect it and skip the duplicate registration.

## Environment Variables

The plugin needs three values to connect to your Mentu workspace. You can provide them as environment variables or in a config file.

### Option A: Environment Variables

Set the following in your shell profile, `.env` file, or CI environment:

```bash
# Required
MENTU_API_URL="https://mentu-proxy.affihub.workers.dev/ops"
MENTU_API_TOKEN="your-api-token"
MENTU_WORKSPACE_ID="your-workspace-id"
```

| Variable | Required | Description |
|---|---|---|
| `MENTU_API_URL` | Yes | The Mentu proxy API endpoint |
| `MENTU_API_TOKEN` | Yes | Your workspace API token (found in workspace settings) |
| `MENTU_WORKSPACE_ID` | Yes | The UUID of your Mentu workspace |

### Option B: `.mentu.json` Config File

Alternatively, create a `.mentu.json` file in your project root:

```json
{
  "apiUrl": "https://mentu-proxy.affihub.workers.dev/ops",
  "apiToken": "your-api-token",
  "workspaceId": "your-workspace-id"
}
```

The plugin checks for `.mentu.json` first, then falls back to environment variables. Add `.mentu.json` to your `.gitignore` to keep credentials out of version control.

:::caution
Never commit API tokens to your repository. Use environment variables in CI/CD, and `.mentu.json` (gitignored) for local development.
:::

## Verify the Connection

After installation, verify everything is working:

```
/status
```

You should see output similar to:

```
Mentu Pipeline Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Workspace:    my-project (a1b2c3d4-...)
Connection:   ✓ Connected

Commitments:
  Open:       3
  Claimed:    1
  Closed:     27

Recent Activity (last 24h):
  Submitted:  4
  Failed:     0

Throughput:   4.2 fixes/day (7-day avg)
```

If you see a connection error, double-check your API URL, token, and workspace ID.

## Interactive Onboarding

For a guided setup experience, use the `/setup` command:

```
/setup
```

This interactive flow will:

1. Prompt you for your Mentu API URL (or accept the default proxy URL)
2. Ask for your API token
3. Ask for your workspace ID
4. Test the connection by fetching workspace details
5. Write the validated configuration to `.mentu.json`
6. Add `.mentu.json` to `.gitignore` if not already present

This is the recommended approach for first-time setup, as it validates each value before saving.

## Updating the Plugin

To update to the latest version:

```bash
claude plugin update mentu-ai/mentu-autopilot
```

The update preserves your existing configuration and environment variables.

## Uninstalling

To remove the plugin:

```bash
claude plugin remove mentu-ai/mentu-autopilot
```

This removes the commands, agents, and hooks. Your `.mentu.json` and environment variables are left untouched.
