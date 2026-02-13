---
id: GUIDE-PersonalTokens-v1.0
path: docs/GUIDE-PersonalTokens-v1.0.md
type: guide
intent: reference

version: "1.0"
created: 2026-01-12
last_updated: 2026-01-12

actor: agent:claude-code
---

# GUIDE: Personal Tokens v1.0

**Purpose:** Enable workspaces to create and manage integration tokens for external services (bug reporters, webhooks, automation tools).

---

## Overview

Personal tokens allow workspaces to authenticate external services. Each token is:
- **Scoped to a workspace** - Token maps to exactly one workspace
- **Source-specific** - Identifies the external service (e.g., "warrantyos")
- **Revocable** - Can be deactivated without affecting other tokens
- **Auditable** - Tracks creation, usage, and revocation

---

## Token Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TOKEN FLOW                                                                  │
│                                                                              │
│  External Service                Mentu Proxy              Mentu Bridge       │
│  ─────────────────               ───────────              ────────────       │
│                                                                              │
│  POST /bug-webhook ─────────────> Token Lookup ──────────> Create Command   │
│  X-API-Key: bug_xxx               │                        │                │
│                                   ▼                        ▼                │
│                              integrations              bridge_commands      │
│                              ┌───────────┐             ┌────────────┐       │
│                              │ token     │             │ workspace  │       │
│                              │ workspace │────────────>│ path       │       │
│                              │ source    │             │ command    │       │
│                              └───────────┘             └────────────┘       │
│                                   │                                          │
│                                   ▼                                          │
│                              workspaces.genesis_key                          │
│                              ┌────────────────────┐                          │
│                              │ paths.vps          │ ← Correct path           │
│                              │ paths.local        │                          │
│                              │ machines[executor] │ ← Target machine         │
│                              └────────────────────┘                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Token Format

```
{type}_{source}_{random12}

Examples:
- bug_warrantyos_885bdca89d9e  (bug reporter for WarrantyOS)
- bug_talisman_a1b2c3d4e5f6    (bug reporter for Talisman)
- hook_github_f6e5d4c3b2a1    (webhook for GitHub)
```

| Segment | Purpose |
|---------|---------|
| `type` | Integration type (bug, hook, api) |
| `source` | Source identifier (warrantyos, github, etc.) |
| `random` | 12-char random hex for uniqueness |

---

## Database Schema

### integrations table

```sql
CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Authentication
  token TEXT UNIQUE NOT NULL,

  -- Mapping
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  type TEXT NOT NULL,           -- "bug_reporter", "webhook", "api"
  source_name TEXT NOT NULL,    -- "warrantyos", "github", etc.

  -- Lifecycle
  created_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ,       -- NULL = active
  last_used_at TIMESTAMPTZ,

  -- Limits
  rate_limit_per_hour INT DEFAULT 100,

  -- Audit
  created_by TEXT,              -- "user:rashid", "agent:claude"

  UNIQUE (workspace_id, type, source_name)
);

-- Index for fast token lookup
CREATE INDEX idx_integrations_token_active
ON integrations(token)
WHERE revoked_at IS NULL;
```

### workspaces.genesis_key column

```sql
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS genesis_key JSONB;
```

Genesis key stores path resolution and machine targeting:

```json
{
  "genesis": {"version": "1.2"},
  "identity": {
    "workspace": "inline-substitute",
    "paths": {
      "local": "/Users/rashid/.../vin-to-value-main",
      "vps": "/home/mentu/.../vin-to-value-main"
    },
    "machines": [
      {"id": "vps-01", "role": "executor"},
      {"id": "macbook-rashid", "role": "development"}
    ]
  },
  "integrations": {
    "bug_reporter": {
      "enabled": true,
      "sources": [
        {"name": "warrantyos", "approval_mode": "autonomous", "timeout_seconds": 3600}
      ]
    }
  }
}
```

---

## mentu-web Integration

### Token Management Page

**Route:** `/workspace/{id}/settings/tokens`

**Features:**

1. **List Tokens**
   - Show all tokens for workspace
   - Display: type, source, created, last used, status
   - Filter by type, status

2. **Create Token**
   - Select type (bug_reporter, webhook, api)
   - Enter source name
   - Generate token
   - Display token ONCE (not stored in plaintext after creation)

3. **Revoke Token**
   - Soft delete (sets revoked_at)
   - Immediate effect
   - Cannot be undone

4. **Token Usage**
   - Show last_used_at
   - Show usage count (if tracked)

### UI Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Integrations                                                    [+ New]    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 🔑 bug_warrantyos_885bdca89d9e                                       │  │
│  │    Type: Bug Reporter  │  Source: warrantyos  │  Created: Jan 12     │  │
│  │    Last used: 2 hours ago                          [Revoke]          │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 🔑 hook_github_a1b2c3d4e5f6                                          │  │
│  │    Type: Webhook  │  Source: github  │  Created: Jan 10              │  │
│  │    Last used: never                                [Revoke]          │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Create Token Modal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Create Integration Token                                            [x]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Type                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Bug Reporter                                                    ▼   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Source Name                                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ warrantyos                                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ⓘ Unique identifier for this integration (lowercase, no spaces)           │
│                                                                             │
│                                               [Cancel]  [Create Token]      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Token Display (After Creation)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ✅ Token Created                                                    [x]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ⚠️  Copy this token now. It will not be shown again.                      │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ bug_warrantyos_885bdca89d9e                              [Copy]     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Use this token in your bug reporter's X-API-Key header:                   │
│                                                                             │
│  ```bash                                                                    │
│  curl -X POST "https://mentu-proxy.affihub.workers.dev/bug-webhook" \      │
│    -H "X-API-Key: bug_warrantyos_885bdca89d9e" \                           │
│    -d '{"bug_report": {...}}'                                              │
│  ```                                                                        │
│                                                                             │
│                                                              [Done]         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### List Tokens

```
GET /api/workspaces/{workspace_id}/integrations
Authorization: Bearer {user_token}

Response:
{
  "integrations": [
    {
      "id": "838e7cf9-c840-45a4-9494-ac1a74679388",
      "token_prefix": "bug_warrantyos_***",  // Masked
      "type": "bug_reporter",
      "source_name": "warrantyos",
      "created_at": "2026-01-13T01:41:45Z",
      "last_used_at": "2026-01-13T02:30:00Z",
      "is_active": true
    }
  ]
}
```

### Create Token

```
POST /api/workspaces/{workspace_id}/integrations
Authorization: Bearer {user_token}
Content-Type: application/json

{
  "type": "bug_reporter",
  "source_name": "warrantyos"
}

Response:
{
  "id": "838e7cf9-c840-45a4-9494-ac1a74679388",
  "token": "bug_warrantyos_885bdca89d9e",  // Full token, shown ONCE
  "type": "bug_reporter",
  "source_name": "warrantyos",
  "created_at": "2026-01-13T01:41:45Z"
}
```

### Revoke Token

```
DELETE /api/workspaces/{workspace_id}/integrations/{id}
Authorization: Bearer {user_token}

Response:
{
  "id": "838e7cf9-c840-45a4-9494-ac1a74679388",
  "revoked_at": "2026-01-13T03:00:00Z"
}
```

---

## Genesis Key Configuration

### Workspace genesis.key

Bug reporter sources must be configured in the workspace's genesis.key:

```yaml
# .mentu/genesis.key

genesis:
  version: "1.2"

identity:
  workspace: "inline-substitute"
  name: "WarrantyOS"
  paths:
    local: "/Users/rashid/Desktop/Workspaces/projects/inline-substitute/vin-to-value-main"
    vps: "/home/mentu/Workspaces/projects/inline-substitute/vin-to-value-main"
  machines:
    - id: "vps-01"
      role: "executor"
    - id: "macbook-rashid"
      role: "development"

integrations:
  bug_reporter:
    enabled: true
    sources:
      - name: "warrantyos"
        approval_mode: "autonomous"  # or "manual"
        timeout_seconds: 3600
```

### Syncing Genesis Key

The genesis.key must be synced to Supabase for the proxy to resolve paths:

```sql
UPDATE workspaces
SET genesis_key = '{...}'::jsonb
WHERE id = 'workspace-uuid';
```

This happens automatically when:
1. mentu-bridge daemon discovers workspaces
2. Manual sync via CLI: `mentu sync-genesis`

---

## Usage Examples

### Example 1: WarrantyOS Bug Reporter

**Setup:**

1. Create token in mentu-web for workspace `inline-substitute`
2. Configure genesis.key with paths and executor machine
3. Add token to WarrantyOS environment:
   ```bash
   export MENTU_BUG_TOKEN="bug_warrantyos_885bdca89d9e"
   ```

**Reporting a bug:**

```bash
curl -X POST "https://mentu-proxy.affihub.workers.dev/bug-webhook" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $MENTU_BUG_TOKEN" \
  -d '{
    "bug_report": {
      "title": "Login fails on mobile",
      "description": "Users on iOS 17 cannot log in...",
      "severity": "high",
      "steps_to_reproduce": ["1. Open app", "2. Tap login", "3. Enter credentials"],
      "screenshot_urls": ["https://..."]
    }
  }'
```

**Flow:**

```
POST /bug-webhook
    │
    ▼
Token lookup → workspace_id: b30a0651-e069-4204-843d-78767c31677f
    │
    ▼
Genesis key → paths.vps: /home/mentu/.../vin-to-value-main
           → machines[executor]: vps-01
    │
    ▼
Create bridge_command with correct VPS path
    │
    ▼
VPS daemon picks up → Architect+Auditor → Executor → Fix bug
```

### Example 2: Adding a New Bug Reporter

**Step 1: Create token**
```sql
INSERT INTO integrations (token, workspace_id, type, source_name, created_by)
VALUES (
  'bug_talisman_' || substr(md5(random()::text), 1, 12),
  'workspace-uuid',
  'bug_reporter',
  'talisman',
  'user:rashid'
);
```

**Step 2: Update genesis.key**
```yaml
integrations:
  bug_reporter:
    sources:
      - name: "warrantyos"
        approval_mode: "autonomous"
      - name: "talisman"           # New source
        approval_mode: "manual"    # Requires human approval
        timeout_seconds: 7200
```

**Step 3: Sync to Supabase**
```bash
mentu sync-genesis
```

---

## Security Considerations

### Token Storage

- Tokens are stored in plaintext in Supabase
- Consider hashing with bcrypt for production:
  ```sql
  -- Store hash
  INSERT INTO integrations (token_hash, ...)
  VALUES (crypt('bug_xxx', gen_salt('bf')), ...);

  -- Verify
  SELECT * FROM integrations
  WHERE token_hash = crypt('bug_xxx', token_hash);
  ```

### Rate Limiting

- Default: 100 requests per hour per token
- Enforced at proxy level
- Configurable per integration

### Revocation

- Immediate effect (checked on every request)
- Partial index ensures fast lookup of active tokens only

### Audit Trail

- `created_by` tracks who created the token
- `created_at` and `revoked_at` provide lifecycle timestamps
- `last_used_at` tracks activity

---

## CLI Commands (Future)

```bash
# List tokens for current workspace
mentu integration list

# Create new token
mentu integration create --type bug_reporter --source talisman

# Revoke token
mentu integration revoke --id 838e7cf9-...

# Rotate token (revoke old, create new)
mentu integration rotate --id 838e7cf9-...
```

---

## Implementation Checklist for mentu-web

### Phase 1: Read-Only View
- [ ] Add `/workspace/{id}/settings/tokens` route
- [ ] Query integrations table for workspace
- [ ] Display tokens in list format
- [ ] Show token prefix (masked), type, source, dates

### Phase 2: Token Creation
- [ ] Add "New Token" modal
- [ ] Type selector (bug_reporter, webhook, api)
- [ ] Source name input with validation
- [ ] Token generation (random 12 hex chars)
- [ ] Display full token once, copy button
- [ ] Insert into integrations table

### Phase 3: Token Management
- [ ] Revoke button with confirmation
- [ ] Last used tracking
- [ ] Usage analytics (optional)

### Phase 4: Genesis Key Editor
- [ ] Read genesis_key from workspaces table
- [ ] JSON/YAML editor for paths and machines
- [ ] Validate structure before save
- [ ] Sync to file system (optional)

---

*Token identifies WHO. Genesis key defines HOW. The machine knows both.*
