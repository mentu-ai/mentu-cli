# PRD: Universal Ticket Layer

> **Independent Infrastructure for Unified Work Request Management**

**Version**: 1.0
**Status**: Draft
**Author**: WarrantyOS Engineering
**Date**: 2024-12-19

---

## Executive Summary

The Universal Ticket Layer (UTL) is a standalone infrastructure service that accepts work requests from any source, normalizes them into a unified data model, and synchronizes with external systems (GitHub, Linear, Jira). This PRD defines the separation of UTL from WarrantyOS into an independent, reusable system that can serve multiple clients.

### Problem Statement

Currently, the ticket management infrastructure is embedded within the WarrantyOS codebase (`vin-to-value-main`). This creates several issues:

1. **Tight Coupling**: The Bug Reporter frontend is intertwined with backend ticket infrastructure
2. **Limited Reusability**: Other projects cannot leverage the ticketing system
3. **Deployment Complexity**: Changes to ticketing require full WarrantyOS deployments
4. **Configuration Confusion**: Shared environment variables across unrelated concerns

### Solution

Extract the Universal Ticket Layer into an independent repository with:
- Its own Supabase project (or shared with clear boundaries)
- Independent deployment pipeline
- Standalone API that any client can consume
- Clear separation between the UTL service and its clients (Bug Reporter, etc.)

---

## Architecture

### Current State (Coupled)

```
inline-substitute/
└── vin-to-value-main/                    # WarrantyOS Monolith
    ├── src/features/bug-reporter/        # Frontend (Bug Reporter)
    │   ├── components/
    │   ├── services/
    │   │   └── bugReporterService.ts     # Calls tickets table directly
    │   └── ...
    └── supabase/
        ├── functions/
        │   ├── tickets-api/              # Backend API
        │   ├── ingest-ticket/
        │   ├── create-github-issue/
        │   └── github-webhook/
        └── migrations/
            └── 20251219_003_create_tickets_table.sql
```

### Target State (Decoupled)

```
inline-substitute/
├── universal-ticket-layer/               # Independent UTL Repository
│   ├── supabase/
│   │   ├── functions/
│   │   │   ├── tickets-api/             # Core REST API
│   │   │   ├── ingest-ticket/           # Simple ingestion
│   │   │   ├── create-github-issue/     # GitHub integration
│   │   │   ├── github-webhook/          # Bi-directional sync
│   │   │   ├── create-linear-issue/     # Linear integration (future)
│   │   │   └── slack-notify/            # Slack notifications (future)
│   │   └── migrations/
│   │       └── 001_create_tickets_table.sql
│   ├── sdk/
│   │   ├── typescript/                  # TypeScript SDK
│   │   │   ├── src/
│   │   │   │   ├── client.ts
│   │   │   │   ├── types.ts
│   │   │   │   └── index.ts
│   │   │   └── package.json
│   │   └── python/                      # Python SDK (future)
│   ├── docs/
│   │   ├── README.md
│   │   ├── API.md
│   │   ├── AGENTS.md
│   │   └── INTEGRATION.md
│   ├── .env.example
│   ├── package.json
│   └── README.md
│
└── vin-to-value-main/                   # WarrantyOS (UTL Client)
    ├── src/features/bug-reporter/
    │   ├── components/                  # UI Components
    │   ├── services/
    │   │   └── bugReporterService.ts    # Uses UTL SDK
    │   └── ...
    ├── .env                             # WarrantyOS config + UTL_API_URL
    └── ...
```

---

## System Components

### 1. Universal Ticket Layer (UTL) - The Service

**Responsibilities:**
- Accept tickets from any authenticated source
- Normalize data into unified schema
- Sync with external systems (GitHub, Linear, Jira, Slack)
- Provide REST API for CRUD operations
- Manage ticket lifecycle

**Does NOT include:**
- Frontend UI components
- Client-specific business logic
- Application-specific authentication

### 2. Bug Reporter - A Client

**Responsibilities:**
- Provide in-app bug reporting UI
- Capture console logs, behavior traces, screenshots
- Collect environment metadata
- Submit to UTL via SDK or API

**Depends on:**
- UTL API for ticket submission
- UTL SDK for type-safe integration

### 3. Other Clients (Future)

- **Email Ingestion Service**: Parses emails → creates tickets
- **Slack Bot**: `/ticket` command → creates tickets
- **Zapier Connector**: Zapier triggers → creates tickets
- **Internal Tools**: Admin dashboards that manage tickets

---

## Data Model

### Ticket Schema (UTL Core)

```typescript
interface Ticket {
  // Identity
  id: string;                    // UUID

  // Source tracking
  source: TicketSource;          // Where it came from
  source_id?: string;            // Original ID in source system
  source_metadata?: object;      // Source-specific data

  // Normalized fields
  type: TicketType;
  title?: string;
  description: string;
  priority: Priority;
  status: TicketStatus;

  // Assignment
  assigned_to?: string;          // User ID
  assigned_at?: string;          // ISO timestamp

  // Rich payload (client-provided diagnostic data)
  payload?: object;

  // Location context
  page_url?: string;
  environment?: object;

  // External system sync
  external_refs: ExternalRef[];

  // Metadata
  created_by?: string;
  session_id?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  resolved_by?: string;
  resolution_notes?: string;
}

type TicketSource =
  | 'bug_reporter'
  | 'email'
  | 'slack'
  | 'api'
  | 'manual'
  | 'zapier'
  | 'webhook';

type TicketType =
  | 'bug'
  | 'feature'
  | 'support'
  | 'task'
  | 'question';

type Priority =
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

type TicketStatus =
  | 'submitted'
  | 'triaged'
  | 'in_progress'
  | 'resolved'
  | 'closed'
  | 'wont_fix';

interface ExternalRef {
  system: string;               // 'github', 'linear', 'jira'
  id: string;                   // External system ID
  url?: string;                 // Link to external system
  synced_at: string;            // Last sync timestamp
}
```

---

## API Contract

### Base URL

```
# Production
https://utl.warrantyos.com/api/v1
# or
https://<project>.supabase.co/functions/v1

# Development
http://localhost:54321/functions/v1
```

### Authentication

| Method | Header | Use Case |
|--------|--------|----------|
| API Key | `x-api-key: <key>` | Server-to-server, agents |
| JWT | `Authorization: Bearer <token>` | Authenticated users |
| Service Role | `Authorization: Bearer <service_key>` | Internal services |

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/tickets` | Create ticket |
| `GET` | `/tickets` | List tickets (paginated, filterable) |
| `GET` | `/tickets/:id` | Get single ticket |
| `PATCH` | `/tickets/:id` | Update ticket |
| `DELETE` | `/tickets/:id` | Delete ticket |
| `POST` | `/tickets/:id/sync` | Force sync with external systems |

### Webhooks (Outbound)

UTL can notify client systems of ticket events:

```json
{
  "event": "ticket.created",
  "ticket_id": "uuid",
  "timestamp": "2024-12-19T21:45:00.000Z",
  "data": { ... }
}
```

Events: `ticket.created`, `ticket.updated`, `ticket.resolved`, `ticket.assigned`

---

## Environment Configuration

### UTL Environment (.env)

```bash
# ===========================================
# UNIVERSAL TICKET LAYER CONFIGURATION
# ===========================================

# Supabase (Core Database)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...

# API Authentication
UTL_API_KEY_PREFIX=utl_             # API keys start with this
UTL_INGEST_API_KEY=utl_ingest_xxx   # Default ingestion key

# GitHub Integration
GITHUB_ENABLED=true
GITHUB_TOKEN=ghp_xxx
GITHUB_OWNER=organization
GITHUB_REPO=repository
GITHUB_WEBHOOK_SECRET=xxx

# Linear Integration (Future)
LINEAR_ENABLED=false
LINEAR_API_KEY=lin_xxx
LINEAR_TEAM_ID=xxx

# Jira Integration (Future)
JIRA_ENABLED=false
JIRA_URL=https://xxx.atlassian.net
JIRA_EMAIL=xxx
JIRA_API_TOKEN=xxx
JIRA_PROJECT_KEY=xxx

# Slack Notifications (Future)
SLACK_ENABLED=false
SLACK_WEBHOOK_URL=https://hooks.slack.com/xxx
SLACK_CHANNEL=#tickets

# Webhook Outbound (notify clients of ticket events)
WEBHOOK_ENABLED=false
WEBHOOK_URL=https://client.example.com/webhooks/utl
WEBHOOK_SECRET=xxx
```

### Client Environment (.env) - e.g., Bug Reporter in WarrantyOS

```bash
# ===========================================
# WARRANTYOS CLIENT CONFIGURATION
# ===========================================

# WarrantyOS-specific config
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Universal Ticket Layer Connection
VITE_UTL_API_URL=https://utl.warrantyos.com/api/v1
VITE_UTL_API_KEY=utl_client_xxx

# Bug Reporter Settings
VITE_BUG_REPORTER_ENABLED=true
VITE_BUG_REPORTER_CAPTURE_CONSOLE=true
VITE_BUG_REPORTER_CAPTURE_BEHAVIOR=true
VITE_BUG_REPORTER_MAX_CONSOLE_ENTRIES=100
```

---

## Migration Plan

### Phase 1: Directory Structure (Week 1)

1. Create `universal-ticket-layer/` directory
2. Move Edge Functions:
   - `tickets-api/`
   - `ingest-ticket/`
   - `create-github-issue/`
   - `github-webhook/`
3. Move migrations (renumber with `001_` prefix)
4. Create SDK scaffold
5. Create documentation structure

### Phase 2: SDK Development (Week 2)

1. Create TypeScript SDK:
   ```typescript
   import { UTLClient } from '@warrantyos/utl-sdk';

   const utl = new UTLClient({
     apiUrl: process.env.UTL_API_URL,
     apiKey: process.env.UTL_API_KEY,
   });

   const ticket = await utl.tickets.create({
     source: 'bug_reporter',
     type: 'bug',
     description: 'Something went wrong',
   });
   ```
2. Publish to npm as `@warrantyos/utl-sdk`
3. Add TypeScript types for all operations

### Phase 3: Client Migration (Week 3)

1. Update Bug Reporter to use SDK:
   ```typescript
   // Before (direct Supabase call)
   await supabase.from('tickets').insert({...});

   // After (SDK call)
   await utl.tickets.create({...});
   ```
2. Update environment variables
3. Test end-to-end flow
4. Deploy updated Bug Reporter

### Phase 4: Deployment Separation (Week 4)

1. Create separate Supabase project for UTL (optional)
2. Set up independent CI/CD pipeline
3. Configure custom domain (`utl.warrantyos.com`)
4. Create GitHub repository for UTL
5. Update documentation with new URLs

### Phase 5: Client Onboarding (Ongoing)

1. Document onboarding process for new clients
2. Create client API keys with scoped permissions
3. Provide integration examples

---

## File Structure

```
universal-ticket-layer/
├── supabase/
│   ├── functions/
│   │   ├── _shared/
│   │   │   ├── cors.ts
│   │   │   ├── auth.ts
│   │   │   └── supabase.ts
│   │   ├── tickets-api/
│   │   │   └── index.ts
│   │   ├── ingest-ticket/
│   │   │   └── index.ts
│   │   ├── create-github-issue/
│   │   │   └── index.ts
│   │   ├── github-webhook/
│   │   │   └── index.ts
│   │   ├── create-linear-issue/       # Future
│   │   │   └── index.ts
│   │   └── slack-notify/              # Future
│   │       └── index.ts
│   ├── migrations/
│   │   ├── 001_create_tickets_table.sql
│   │   ├── 002_create_api_keys_table.sql
│   │   └── 003_create_webhook_logs_table.sql
│   └── config.toml
├── sdk/
│   ├── typescript/
│   │   ├── src/
│   │   │   ├── client.ts
│   │   │   ├── tickets.ts
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   ├── tests/
│   │   │   └── client.test.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── README.md
│   └── python/                        # Future
│       ├── utl_sdk/
│       │   ├── __init__.py
│       │   ├── client.py
│       │   └── types.py
│       ├── setup.py
│       └── README.md
├── docs/
│   ├── README.md                      # Overview
│   ├── API.md                         # Full API reference
│   ├── AGENTS.md                      # For coding agents
│   ├── INTEGRATION.md                 # Client integration guide
│   ├── SELF-HOSTING.md                # Self-hosting instructions
│   └── ARCHITECTURE.md                # System architecture
├── scripts/
│   ├── deploy.sh                      # Deploy Edge Functions
│   ├── migrate.sh                     # Run migrations
│   └── generate-api-key.sh            # Generate client API keys
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── CLAUDE.md                          # Claude Code instructions
```

---

## Security Considerations

### API Key Management

```sql
-- API Keys table
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash TEXT NOT NULL,              -- SHA-256 hash of the key
  prefix TEXT NOT NULL,                -- First 8 chars for identification
  name TEXT NOT NULL,                  -- Human-readable name
  client_id TEXT,                      -- Optional client identifier
  scopes TEXT[] DEFAULT '{}',          -- Permissions: ['read', 'write', 'delete']
  rate_limit INTEGER DEFAULT 1000,     -- Requests per hour
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);
```

### Rate Limiting

- Default: 1000 requests/hour per API key
- Configurable per client
- 429 response when exceeded

### Audit Logging

```sql
-- Audit log table
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id),
  action TEXT NOT NULL,                -- 'create', 'read', 'update', 'delete'
  resource_type TEXT NOT NULL,         -- 'ticket'
  resource_id UUID,
  request_ip TEXT,
  request_headers JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| API Response Time (p95) | < 500ms |
| API Availability | 99.9% |
| GitHub Sync Latency | < 30s |
| Client Integration Time | < 1 hour |
| SDK Install → First Ticket | < 15 min |

---

## Open Questions

1. **Shared vs Separate Supabase Project?**
   - Shared: Simpler, lower cost, but tighter coupling
   - Separate: Full isolation, independent scaling, higher cost
   - **Recommendation**: Start shared, migrate to separate if needed

2. **Custom Domain for UTL API?**
   - `utl.warrantyos.com` vs `api.warrantyos.com/utl`
   - **Recommendation**: Subdomain for clear separation

3. **SDK Distribution?**
   - npm (`@warrantyos/utl-sdk`) vs bundled
   - **Recommendation**: npm for versioning and discoverability

4. **Multi-tenancy?**
   - Single UTL instance for all clients vs per-client instances
   - **Recommendation**: Single instance with client_id scoping

---

## Implementation Checklist

### Phase 1: Directory Structure
- [ ] Create `universal-ticket-layer/` directory
- [ ] Create `supabase/functions/` structure
- [ ] Create `sdk/typescript/` scaffold
- [ ] Create `docs/` structure
- [ ] Create `.env.example`
- [ ] Create `README.md`
- [ ] Create `CLAUDE.md`

### Phase 2: SDK Development
- [ ] Implement `UTLClient` class
- [ ] Implement `tickets.create()`
- [ ] Implement `tickets.list()`
- [ ] Implement `tickets.get()`
- [ ] Implement `tickets.update()`
- [ ] Implement `tickets.delete()`
- [ ] Add TypeScript types
- [ ] Write unit tests
- [ ] Publish to npm

### Phase 3: Client Migration
- [ ] Install SDK in WarrantyOS
- [ ] Update `bugReporterService.ts`
- [ ] Add UTL environment variables
- [ ] Test Bug Reporter → UTL flow
- [ ] Deploy updated WarrantyOS

### Phase 4: Deployment Separation
- [ ] Create GitHub repository
- [ ] Set up GitHub Actions CI/CD
- [ ] Configure Supabase project
- [ ] Set up custom domain (optional)
- [ ] Update DNS records
- [ ] Deploy Edge Functions
- [ ] Verify integrations

---

## Appendix: SDK Usage Examples

### TypeScript

```typescript
import { UTLClient } from '@warrantyos/utl-sdk';

// Initialize client
const utl = new UTLClient({
  apiUrl: 'https://utl.warrantyos.com/api/v1',
  apiKey: 'utl_client_xxx',
});

// Create a ticket
const ticket = await utl.tickets.create({
  source: 'bug_reporter',
  type: 'bug',
  title: 'Button not working',
  description: 'The submit button does not respond on click',
  priority: 'high',
  payload: {
    console_logs: [...],
    screenshot: 'data:image/png;base64,...',
  },
});

console.log(`Created ticket: ${ticket.id}`);

// List tickets
const { tickets, total } = await utl.tickets.list({
  type: 'bug',
  status: 'submitted',
  limit: 10,
});

// Update ticket
await utl.tickets.update(ticket.id, {
  status: 'in_progress',
  assigned_to: 'user-uuid',
});

// Get ticket with external refs
const fullTicket = await utl.tickets.get(ticket.id);
console.log(`GitHub Issue: ${fullTicket.external_refs[0]?.url}`);
```

### Python (Future)

```python
from utl_sdk import UTLClient

# Initialize client
utl = UTLClient(
    api_url="https://utl.warrantyos.com/api/v1",
    api_key="utl_client_xxx"
)

# Create a ticket
ticket = utl.tickets.create(
    source="api",
    type="bug",
    title="API error",
    description="500 error on /api/quotes",
    priority="high"
)

print(f"Created ticket: {ticket.id}")

# List tickets
tickets = utl.tickets.list(type="bug", limit=10)
for t in tickets:
    print(f"- {t.title} ({t.status})")
```

---

## Related Documentation

- [README.md](./README.md) - Project overview
- [CLAUDE.md](./CLAUDE.md) - Claude Code instructions
- [WarrantyOS Bug Reporter](../vin-to-value-main/src/features/bug-reporter/README.md)
