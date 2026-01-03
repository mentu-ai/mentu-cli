# Environment Variable Hierarchy

Credential and configuration management across the Mentu workspace.

## The Two Levels

```
/Users/rashid/Desktop/Workspaces/
│
├── .env                          # WORKSPACE LEVEL (macro)
│   └── Shared across all repos
│   └── Global credentials
│   └── Workspace-wide identifiers
│
├── mentu-ai/
│   └── .env                      # REPO LEVEL (micro)
│       └── Repo-specific overrides
│       └── Local development values
│       └── Test credentials
│
├── mentu-proxy/
│   └── .env
│       └── Worker secrets reference
│       └── Deployment-specific config
│
└── claude-code/
    └── .env
        └── Coordination credentials
```

---

## Precedence Rules

```
1. Repo-level .env (highest priority)
   ↓
2. Workspace-level .env
   ↓
3. System environment variables
   ↓
4. Default values in code
```

When the same variable exists at multiple levels, repo-level wins.

---

## Workspace Level (`/Workspaces/.env`)

### When to Use

- Credentials shared across multiple repos
- Workspace/organization identifiers that don't change
- Integration tokens used by multiple services
- Webhook URLs (for reference)

### Standard Variables

```bash
# Core Mentu
MENTU_WORKSPACE_ID=xxx
MENTU_ACTOR=agent:claude-code

# Supabase (shared backend)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=xxx

# Proxy (central gateway)
MENTU_PROXY_URL=https://mentu-proxy.affihub.workers.dev
MENTU_PROXY_TOKEN=xxx

# Integrations (shared credentials)
NOTION_WORKSPACE_ID=xxx
NOTION_INTEGRATION_TOKEN=xxx
GITHUB_OWNER=xxx
```

### Example

```bash
# /Workspaces/.env

# Mentu Core
MENTU_WORKSPACE_ID=9584ae30-14f5-448a-9ff1-5a6f5caf6312
MENTU_ACTOR=rashid

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbG...

# Notion Integration
NOTION_WORKSPACE_ID=8eaec1b3-5799-4f89-9397-3edac82a79d6
NOTION_INTEGRATION_TOKEN=ntn_xxx

# GitHub Integration
GITHUB_OWNER=rashidazarang
GITHUB_REPO=tickets
```

---

## Repo Level (`/{repo}/.env`)

### When to Use

- Development/test credentials that differ from production
- Repo-specific secrets (not shared)
- Local overrides for debugging
- Credentials only needed by this repo

### mentu-ai/.env

```bash
# Local development overrides
MENTU_API_KEY=local_dev_key
NODE_ENV=development
```

### mentu-proxy/.env

```bash
# Reference for wrangler secret put
# Actual values stored in Cloudflare

# PROXY_TOKEN=xxx
# MENTU_API_KEY=xxx
# GITHUB_WEBHOOK_SECRET=xxx
# NOTION_WEBHOOK_SECRET=xxx
```

### mentu-bridge/.env

```bash
# Local machine config
BRIDGE_MACHINE_ID=rashids-mac
POLL_INTERVAL_MS=5000
```

### claude-code/.env

```bash
# Coordination credentials
# (May reference workspace .env)
```

---

## Loading Pattern

### In Node.js

```typescript
import dotenv from 'dotenv';
import path from 'path';

// Load workspace-level first
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Load repo-level (overrides workspace)
dotenv.config({ path: path.resolve(__dirname, '.env') });
```

### In Shell Scripts

```bash
#!/bin/bash

# Load workspace-level
if [[ -f "/Users/rashid/Desktop/Workspaces/.env" ]]; then
  export $(grep -v '^#' /Users/rashid/Desktop/Workspaces/.env | xargs)
fi

# Load repo-level (overrides)
if [[ -f ".env" ]]; then
  export $(grep -v '^#' .env | xargs)
fi
```

### In Cloudflare Workers

```bash
# Workers use wrangler secret, not .env files
# But .env documents what secrets are needed

wrangler secret put NOTION_WEBHOOK_SECRET
wrangler secret put GITHUB_WEBHOOK_SECRET
```

---

## Security Rules

### Never Commit

```gitignore
# .gitignore (every repo)
.env
.env.local
.env.*.local
*.local.yaml
config.local.yaml
```

### Never in Workspace .env

- Production database passwords
- Root/admin tokens
- Private keys
- Secrets that rotate frequently

### Workspace .env is Safe For

- Workspace identifiers (public IDs)
- API endpoints (URLs are not secrets)
- Integration tokens with limited scope
- Webhook URLs (for documentation)

---

## Integration Credential Pattern

When adding a new integration, follow this pattern:

### Step 1: Workspace .env

```bash
# {SERVICE} Integration
# Added: YYYY-MM-DD
# Purpose: {what this integration does}

{SERVICE}_WORKSPACE_ID=xxx       # Organization/workspace ID
{SERVICE}_INTEGRATION_TOKEN=xxx  # API access token (read/write)

# Webhook configuration
# URL: https://mentu-proxy.affihub.workers.dev/signals/{service}
# {SERVICE}_WEBHOOK_SECRET=xxx   # Set via wrangler, not here
```

### Step 2: mentu-proxy/.env (reference)

```bash
# {Service} webhook verification
# Set via: wrangler secret put {SERVICE}_WEBHOOK_SECRET
```

### Step 3: wrangler secret

```bash
cd mentu-proxy
wrangler secret put {SERVICE}_WEBHOOK_SECRET
# Enter the secret when prompted
```

---

## Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Workspace ID | `{SERVICE}_WORKSPACE_ID` | `NOTION_WORKSPACE_ID` |
| API Token | `{SERVICE}_INTEGRATION_TOKEN` | `SLACK_INTEGRATION_TOKEN` |
| Webhook Secret | `{SERVICE}_WEBHOOK_SECRET` | `GITHUB_WEBHOOK_SECRET` |
| Endpoint URL | `{SERVICE}_API_URL` | `LINEAR_API_URL` |
| Feature Flag | `{SERVICE}_ENABLED` | `AIRTABLE_ENABLED` |

### Service Name Casing

- Environment variable: `UPPERCASE_WITH_UNDERSCORES`
- Config key: `lowercase_with_underscores`
- Signal handler: `camelCase` or `PascalCase`
- Webhook route: `lowercase-with-dashes`

---

## Cross-Repo Access

### From claude-code to Mentu

```bash
# claude-code/tools/capture-memory.sh reads:
# 1. /Workspaces/.env (workspace credentials)
# 2. ./config/config.local.yaml (repo config)

# The script uses:
MENTU_ENDPOINT  # From workspace .env
MENTU_API_KEY   # From workspace .env or config
```

### From mentu-proxy to Supabase

```bash
# mentu-proxy/wrangler.toml references secrets
# Secrets set via: wrangler secret put {NAME}

SUPABASE_URL         # Set from workspace knowledge
SUPABASE_SERVICE_KEY # Set via wrangler
MENTU_API_KEY        # Set via wrangler
```

---

## Migration Guide

### Adding New Credential

1. Document in workspace `.env` (or repo `.env` if repo-specific)
2. Update any config files that reference it
3. For workers: `wrangler secret put {NAME}`
4. Update wrangler.toml comments to document requirement
5. Test with `mentu capture "Added {credential}" --kind config`

### Rotating a Secret

1. Generate new secret
2. Update in workspace `.env` (or wrangler secret)
3. Update in external service
4. Verify connectivity
5. `mentu capture "Rotated {SECRET_NAME}" --kind security`

---

*Two levels, clear precedence, secure by default.*
