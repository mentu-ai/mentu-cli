---
name: integration-add
description: Add external service integrations (Notion, GitHub, Slack, etc.) into the Mentu ecosystem. Use when connecting new services, setting up webhooks, configuring API credentials, or enabling bi-directional sync between external tools and Mentu. Handles both workspace-level and repo-level configuration.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - WebFetch
---

# Integration Add Skill

Connect external services to the Mentu ecosystem with proper credential management, webhook routing, and signal transformation.

## When to Use

- "Add Notion integration"
- "Connect Slack to Mentu"
- "Set up GitHub webhooks"
- "Enable Airtable sync"
- "Configure Stripe notifications"

---

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  External Service                                                    │
│  (Notion, GitHub, Slack, etc.)                                      │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ Webhook
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  mentu-proxy/src/signals/{service}.ts                               │
│  - Verify signature                                                  │
│  - Transform event → Mentu memory                                   │
│  - Capture with actor: signal:{service}                             │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  mentu-ai (Ledger)                                                   │
│  - Stores memories with kind: {service}_{event_type}                │
│  - Available to all repos via sync                                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Integration Checklist

Before starting, gather:

| Item | Example | Required |
|------|---------|----------|
| Service name | `notion`, `slack`, `airtable` | Yes |
| API credentials | Token, secret, workspace ID | Yes |
| Webhook events | `page.created`, `message.posted` | For sync |
| Webhook secret | HMAC signature verification | For webhooks |

See [CHECKLIST.md](./CHECKLIST.md) for full pre-flight checklist.

---

## Env Hierarchy

Credentials are managed at two levels:

| Level | Location | Scope | Use For |
|-------|----------|-------|---------|
| **Workspace** | `/Workspaces/.env` | All repos | Shared credentials, workspace IDs |
| **Repo** | `/{repo}/.env` | Single repo | Repo-specific overrides |

```
/Workspaces/
├── .env                 # Workspace-level: NOTION_TOKEN, shared secrets
├── mentu-ai/.env       # Repo-level: overrides or local-only
├── mentu-proxy/.env    # Repo-level: worker secrets
└── claude-code/.env    # Repo-level: coordination secrets
```

See [ENV-HIERARCHY.md](./ENV-HIERARCHY.md) for detailed credential management.

---

## Phase 1: Genesis Key (Permissions)

Add the integration as a service actor in `mentu-ai/.mentu/genesis.key`:

```yaml
permissions:
  actors:
    # ... existing actors ...
    "signal:{service}":
      role: "service"
      operations: [capture, annotate]
```

This grants the integration permission to write to the ledger.

### Command

```bash
# Read current genesis.key
cat mentu-ai/.mentu/genesis.key

# Add new actor (edit carefully - append only!)
# Look for the permissions.actors section
```

---

## Phase 2: Config Integration

Add integration configuration to `mentu-ai/.mentu/config.yaml`:

```yaml
integrations:
  {service}:
    enabled: true
    workspace_id: {from .env}
    webhook_url: https://mentu-proxy.affihub.workers.dev/signals/{service}
    events:
      - event.type.1
      - event.type.2
    sync:
      push:
        on_commit: false
        on_close: true
      pull:
        on_event_type: capture
```

---

## Phase 3: Workspace .env

Add credentials to `/Workspaces/.env`:

```bash
# {SERVICE} Integration
{SERVICE}_WORKSPACE_ID=xxx
{SERVICE}_INTEGRATION_TOKEN=xxx
{SERVICE}_WEBHOOK_SECRET=xxx

# Webhook URL to configure in {Service} settings:
# https://mentu-proxy.affihub.workers.dev/signals/{service}
```

Naming convention:
- `{SERVICE}_` prefix (uppercase)
- `_WORKSPACE_ID` for workspace/org identifier
- `_INTEGRATION_TOKEN` for API access
- `_WEBHOOK_SECRET` for webhook verification

---

## Phase 4: Signal Handler

Create `mentu-proxy/src/{service}-signals.ts`:

```typescript
// {Service} webhook signal handling for mentu-proxy

interface Env {
  {SERVICE}_WEBHOOK_SECRET: string;
  MENTU_API_KEY: string;
  MENTU_ENDPOINT: string;
  WORKSPACE_ID: string;
}

// Event transforms
const {SERVICE}_TRANSFORMS: Record<string, {
  kind: string;
  body: (e: any) => string;
  meta: (e: any) => object;
}> = {
  'event.type': {
    kind: '{service}_event',
    body: (e) => `Description: ${e.field}`,
    meta: (e) => ({ id: e.id, ... }),
  },
};

// Signature verification
async function verify{Service}Signature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  // HMAC-SHA256 verification
}

// Main handler
export async function handle{Service}Signal(
  request: Request,
  body: string,
  env: Env
): Promise<Response> {
  // 1. Verify signature
  // 2. Parse event
  // 3. Transform to memory
  // 4. Forward to Mentu API
}
```

See existing handlers:
- `mentu-proxy/src/signals.ts` (GitHub)
- `mentu-proxy/src/notion-signals.ts` (Notion)

---

## Phase 5: Proxy Routing

Update `mentu-proxy/src/index.ts`:

```typescript
// Add import
import { handle{Service}Signal } from './{service}-signals.js';

// Add to Env interface
interface Env {
  // ... existing ...
  {SERVICE}_WEBHOOK_SECRET: string;
}

// Add route in signals section
if (source === '{service}') {
  return handle{Service}Signal(request, body, env);
}
```

---

## Phase 6: Manifest Update

Add capability to `mentu-proxy/.mentu/manifest.yaml`:

```yaml
capabilities:
  # ... existing ...

  - name: signal-{service}
    description: Accept {Service} webhook events and transform to memories
    command: POST /signals/{service}
    inputs:
      type:
        type: string
        required: true
        description: Event type
      payload:
        type: object
        required: true
        description: Webhook payload
    outputs:
      memory_id:
        type: string
        description: Created memory ID
      source_key:
        type: string
        description: Idempotency key
```

---

## Phase 7: Deploy & Configure

```bash
# 1. Set secret in Cloudflare
cd mentu-proxy
wrangler secret put {SERVICE}_WEBHOOK_SECRET

# 2. Deploy
wrangler deploy

# 3. Configure webhook in {Service} settings
# URL: https://mentu-proxy.affihub.workers.dev/signals/{service}
# Events: [selected events]
# Secret: [the secret you set]
```

---

## Phase 8: Test Integration

```bash
# 1. Check health
curl https://mentu-proxy.affihub.workers.dev/health

# 2. Trigger test event from {Service}
# (Create/update something in the connected workspace)

# 3. Verify memory was captured
mentu list memories --kind {service}_{event} --limit 5
```

---

## Quick Reference

### Service-Specific Patterns

| Service | Events | Signature Header |
|---------|--------|------------------|
| GitHub | `push`, `pull_request`, `issues` | `X-Hub-Signature-256` |
| Notion | `page.*`, `database.*`, `comment.*` | `X-Notion-Signature` |
| Slack | `message`, `reaction`, `channel` | `X-Slack-Signature` |
| Stripe | `invoice.*`, `payment.*` | `Stripe-Signature` |
| Linear | `Issue.*`, `Project.*` | `Linear-Signature` |

### Memory Kind Naming

Format: `{service}_{event_type}`

Examples:
- `github_push`
- `notion_page`
- `slack_message`
- `stripe_payment`

---

## Scripts

```bash
# Generate integration boilerplate
.claude/skills/integration-add/scripts/add-integration.sh {service}
```

---

## Supporting Documents

- [ENV-HIERARCHY.md](./ENV-HIERARCHY.md) - Credential management levels
- [CHECKLIST.md](./CHECKLIST.md) - Pre-flight checklist

---

## Mentu Evidence

After completing an integration:

```bash
mentu capture "Added {Service} integration: {summary}" \
  --kind integration \
  --meta '{"service": "{service}", "events": ["list", "of", "events"]}'
```

---

*Connect once, sync forever. Every signal becomes a memory.*
