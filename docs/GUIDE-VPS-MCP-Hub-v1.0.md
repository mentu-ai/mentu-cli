# VPS MCP Hub Guide

> **TL;DR**: Query any MCP server from any Claude Code session via SSH to VPS.

---

## What Is This?

The VPS MCP Hub centralizes MCP (Model Context Protocol) servers on the VPS. Any Claude Code session—local Mac or remote—can query these MCPs via simple scripts.

```
┌─────────────────┐     SSH      ┌─────────────────┐     MCP      ┌─────────────────┐
│  Local Claude   │ ──────────▶  │   VPS Claude    │ ──────────▶  │   Supabase DB   │
│  Code Session   │              │  with MCP tools │              │   (or other)    │
└─────────────────┘              └─────────────────┘              └─────────────────┘
```

**Why?**
- MCPs often need credentials (tokens, API keys)
- Centralizing on VPS keeps secrets in one place
- Any agent can query without local MCP setup

---

## Quick Start

### List Available MCPs

```bash
.claude/skills/vps-mcp/scripts/list-mcps.sh
```

Output:
```
Available MCP Servers on VPS
============================

  amfirst2    → supabase-amfirst2
  utl         → supabase-utl
  warrantyos  → supabase-warrantyos

Use: mcp-query.sh <name> "<prompt>"
```

### Query an MCP

```bash
# Basic query
.claude/skills/vps-mcp/scripts/mcp-query.sh warrantyos "List all tables"

# SQL query
.claude/skills/vps-mcp/scripts/mcp-query.sh utl "Run: SELECT count(*) FROM users"

# Query all projects
.claude/skills/vps-mcp/scripts/mcp-query.sh all "Compare user counts"
```

---

## Available MCPs

| Short Name | Full MCP Name | Project Ref | Description |
|------------|---------------|-------------|-------------|
| `warrantyos` | supabase-warrantyos | hlfxdqxinugyyfqbfwyn | WarrantyOS database |
| `utl` | supabase-utl | uhwiegwpaagzulolmruz | UTL database |
| `amfirst2` | supabase-amfirst2 | synlhgktwrrojzmlgtfl | AmFirst2 database |

---

## How It Works

### Architecture

1. **Local script** (`mcp-query.sh`) receives your query
2. **SSH** connects to VPS (`mentu@208.167.255.71`)
3. **VPS script** (`supabase-cli.sh`) reads MCP config
4. **Claude spawns** with `--mcp-config <json> --strict-mcp-config`
5. **Claude uses MCP tools** to execute your query
6. **Results return** via SSH stdout

### VPS Components

| Component | Location | Purpose |
|-----------|----------|---------|
| MCP Config | `/home/mentu/.mcp-config.json` | MCP server definitions |
| CLI Script | `/home/mentu/Workspaces/mentu-bridge/scripts/supabase-cli.sh` | Spawns Claude with MCP |
| Claude Code | System-wide | Executes queries with MCP tools |

### MCP Config Format

```json
{
  "mcpServers": {
    "supabase-warrantyos": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--access-token", "sbp_YOUR_TOKEN",
        "--project-ref", "YOUR_PROJECT_REF"
      ]
    }
  }
}
```

---

## Expanding the Hub

### Add a New Supabase Project

**Option 1: Use the script**

```bash
.claude/skills/vps-mcp/scripts/add-mcp.sh newclient sbp_token123 projectref456
```

**Option 2: Manual edit**

1. SSH to VPS:
   ```bash
   ssh mentu@208.167.255.71
   ```

2. Edit config:
   ```bash
   nano /home/mentu/.mcp-config.json
   ```

3. Add entry:
   ```json
   {
     "mcpServers": {
       "supabase-newclient": {
         "command": "npx",
         "args": [
           "-y",
           "@supabase/mcp-server-supabase@latest",
           "--access-token", "sbp_YOUR_TOKEN",
           "--project-ref", "YOUR_PROJECT_REF"
         ]
       }
     }
   }
   ```

4. Update `mcp-query.sh` case statement (local):
   ```bash
   # In .claude/skills/vps-mcp/scripts/mcp-query.sh
   case "$MCP_NAME" in
     warrantyos|utl|amfirst2|newclient|all) ;;  # Add newclient
   ```

5. Update `supabase-cli.sh` case statement (VPS):
   ```bash
   # In /home/mentu/Workspaces/mentu-bridge/scripts/supabase-cli.sh
   newclient) MCP_NAME="supabase-newclient" ;;
   ```

### Add a Non-Supabase MCP

Any MCP that works with Claude Code can be added.

**Example: Perplexity MCP**

1. Edit `/home/mentu/.mcp-config.json`:
   ```json
   {
     "mcpServers": {
       "perplexity": {
         "command": "npx",
         "args": ["-y", "@perplexity-ai/mcp-server"],
         "env": {
           "PERPLEXITY_API_KEY": "pplx-YOUR_KEY"
         }
       }
     }
   }
   ```

2. Create a new query script or extend existing ones

**Example: Puppeteer MCP (already on VPS)**

```json
{
  "mcpServers": {
    "puppeteer": {
      "command": "docker",
      "args": ["exec", "-i", "puppeteer-mcp", "node", "dist/index.js"]
    }
  }
}
```

### Add HTTP-Based MCPs

Some MCPs are HTTP services (not stdio). Example:

```json
{
  "mcpServers": {
    "figma": {
      "type": "http",
      "url": "https://mcp.figma.com/mcp"
    }
  }
}
```

These work the same way—Claude connects to them when spawned with the config.

---

## Scripts Reference

| Script | Location | Purpose |
|--------|----------|---------|
| `mcp-query.sh` | `.claude/skills/vps-mcp/scripts/` | Query MCP via SSH |
| `list-mcps.sh` | `.claude/skills/vps-mcp/scripts/` | List available MCPs |
| `add-mcp.sh` | `.claude/skills/vps-mcp/scripts/` | Add Supabase MCP |
| `supabase-cli.sh` | VPS: `mentu-bridge/scripts/` | Spawns Claude with MCP |

### mcp-query.sh

```bash
# Usage
./mcp-query.sh <name> "<prompt>"

# Examples
./mcp-query.sh warrantyos "List tables"
./mcp-query.sh utl "SELECT * FROM users LIMIT 5"
./mcp-query.sh all "Count rows in users table"
```

### list-mcps.sh

```bash
# Human-readable
./list-mcps.sh

# JSON output
./list-mcps.sh --json
```

### add-mcp.sh

```bash
# Usage
./add-mcp.sh <short-name> <access-token> <project-ref>

# Example
./add-mcp.sh newclient sbp_abc123 ghijklmnop
```

---

## Troubleshooting

### SSH Connection Failed

```bash
# Test SSH access
ssh mentu@208.167.255.71 'echo OK'

# If fails, check SSH key
ssh-add -l
ssh-add ~/.ssh/id_rsa  # or your key
```

### MCP Not Found

```bash
# List what's configured
.claude/skills/vps-mcp/scripts/list-mcps.sh --json | jq '.mcpServers | keys'

# Check if name is in mcp-query.sh case statement
grep -A5 "case.*MCP_NAME" .claude/skills/vps-mcp/scripts/mcp-query.sh
```

### Query Timeout

Default: 30 max turns (~2 min). For longer queries:

```bash
# Direct SSH with custom settings
ssh mentu@208.167.255.71 '
  cd /home/mentu/Workspaces/mentu-bridge/scripts
  # Edit supabase-cli.sh to increase --max-turns
  ./supabase-cli.sh warrantyos "Your long query"
'
```

### Invalid Token

```bash
# Verify token on VPS
ssh mentu@208.167.255.71 'cat /home/mentu/.mcp-config.json | jq ".mcpServers[\"supabase-warrantyos\"].args"'
```

---

## Mentu Integration

Capture query results as evidence:

```bash
# Query and capture
RESULT=$(.claude/skills/vps-mcp/scripts/mcp-query.sh warrantyos "List tables")
mentu capture "Supabase WarrantyOS: $(echo "$RESULT" | head -3)..." \
  --kind evidence \
  --actor agent:claude-code
```

---

## VPS Details

| Setting | Value |
|---------|-------|
| Host | `208.167.255.71` |
| User | `mentu` |
| Config | `/home/mentu/.mcp-config.json` |
| Scripts | `/home/mentu/Workspaces/mentu-bridge/scripts/` |

---

## What's Next?

Potential expansions:

1. **Add Perplexity MCP** - Research queries via VPS
2. **Add Airtable MCP** - Query Airtable bases
3. **Add GitHub MCP** - Repository operations
4. **Generic MCP router** - Single script that works with any MCP type
5. **Result caching** - Cache frequent queries locally

---

## Files Reference

```
Workspaces/
├── .claude/skills/vps-mcp/
│   ├── SKILL.md                    # Skill documentation
│   └── scripts/
│       ├── mcp-query.sh            # Query MCP via SSH
│       ├── list-mcps.sh            # List available MCPs
│       └── add-mcp.sh              # Add new Supabase MCP
│
├── mentu-bridge/
│   ├── scripts/
│   │   └── supabase-cli.sh         # VPS: Spawns Claude with MCP
│   └── docs/
│       └── GUIDE-DynamicMCP-v1.0.md  # Technical reference
│
└── mentu-ai/docs/
    └── GUIDE-VPS-MCP-Hub-v1.0.md   # This guide
```

---

*One VPS. All your MCPs. Query from anywhere.*
