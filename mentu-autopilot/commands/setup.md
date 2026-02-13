---
description: "Onboard a project to Mentu — create .mentu.json, test connection, verify MCP server"
allowed-tools: ["mcp__mentu__mentu_get_status", "mcp__mentu__mentu_list_memories", "Read", "Write", "Bash(npm:*)"]
---

# Mentu Setup

Interactive setup for connecting a project to the Mentu commitment ledger.

## Instructions

### Step 1: Check Existing Configuration

Look for existing configuration:
1. Check if `.mentu.json` exists in the project root
2. Check env vars: `MENTU_API_URL`, `MENTU_API_TOKEN`, `MENTU_WORKSPACE_ID`

If `.mentu.json` already exists, read it and skip to Step 3 (verification).

### Step 2: Create Configuration

If no configuration found, ask the user for:

1. **API URL** — default: `https://mentu-proxy.affihub.workers.dev`
2. **API Token** — the proxy token for authentication
3. **Workspace ID** — the Mentu workspace UUID

Create `.mentu.json` in the project root:

```json
{
  "apiUrl": "https://mentu-proxy.affihub.workers.dev",
  "workspaceId": "{workspace_id}",
  "projectDomains": ["{project-name}.vercel.app", "localhost"]
}
```

**Important:** Do NOT store the API token in `.mentu.json` (it would be committed to git). Instead, tell the user to set it as an env var:

```bash
export MENTU_API_TOKEN="your-token"
```

Or add to `.env` (make sure `.env` is in `.gitignore`).

### Step 3: Verify Connection

Use **mentu_get_status** to test the connection.

If successful, show:
```
Mentu is connected!

  Workspace: {workspace_name}
  Memories:  {total}
  Commitments: {open} open, {claimed} claimed, {closed} closed
  Ledger:    {operations} ops

MCP tools are available. Try:
  /triage — see your bug dashboard
  /fix <mem_id> — fix a single ticket
  /status — quick pipeline overview
```

If it fails, show the error and suggest fixes:
- Missing token → "Set MENTU_API_TOKEN env var"
- Missing workspace → "Set MENTU_WORKSPACE_ID in .mentu.json"
- Network error → "Check MENTU_API_URL"

### Step 4: Add to .gitignore

Check if `.mentu.json` should be in `.gitignore`. If the project has a `.gitignore`, ensure `.mentu.json` is listed (since it may contain workspace-specific config).

## Rules

1. **Never store tokens in files that get committed.** API token goes in env vars or `.env` only.
2. **Idempotent.** If already configured, just verify and show status.
3. **No secrets in output.** Don't display tokens or credentials.
