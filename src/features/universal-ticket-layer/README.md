# Universal Ticket Layer (UTL)

A standalone infrastructure service for unified work request management. Accepts tickets from any source, normalizes them into a unified data model, and synchronizes with external systems.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    UNIVERSAL TICKET LAYER                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Clients:                                                            │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐│
│  │ Bug Reporter │ │ Email Parser │ │  Slack Bot   │ │  Zapier/n8n  ││
│  │ (WarrantyOS) │ │  (service)   │ │  (service)   │ │  (webhook)   ││
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘│
│         └────────────────┴────────────────┴────────────────┘        │
│                                    │                                 │
│                                    ▼                                 │
│                        ┌─────────────────────┐                       │
│                        │   TICKETS API       │                       │
│                        └─────────────────────┘                       │
│                                    │                                 │
│                                    ▼                                 │
│                        ┌─────────────────────┐                       │
│                        │   tickets table     │                       │
│                        └─────────────────────┘                       │
│                                    │                                 │
│  External Systems:                 ▼                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                  │
│  │   GitHub     │ │   Linear     │ │   Slack      │                  │
│  │   Issues     │ │   (future)   │ │   Notify     │                  │
│  └──────────────┘ └──────────────┘ └──────────────┘                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Features

- **Multi-source ingestion**: Accept tickets from Bug Reporter, Email, Slack, Zapier, or any API client
- **Unified data model**: Normalize all tickets into a consistent schema
- **External system sync**: Bi-directional sync with GitHub Issues, Linear (future), Jira (future)
- **Full REST API**: CRUD operations with filtering, pagination, and search
- **TypeScript SDK**: Type-safe client for easy integration
- **Webhooks**: Notify client systems of ticket events

## Quick Start

### 1. Create a Ticket

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/tickets-api' \
  -H 'x-api-key: YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "source": "api",
    "type": "bug",
    "title": "Login not working",
    "description": "Users cannot log in on Safari",
    "priority": "high"
  }'
```

### 2. Using the SDK

```typescript
import { UTLClient } from '@warrantyos/utl-sdk';

const utl = new UTLClient({
  apiUrl: 'https://your-project.supabase.co/functions/v1',
  apiKey: 'YOUR_API_KEY',
});

const ticket = await utl.tickets.create({
  source: 'api',
  type: 'bug',
  description: 'Something went wrong',
});

console.log(`Created ticket: ${ticket.id}`);
```

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/tickets-api` | Create ticket |
| `GET` | `/tickets-api` | List tickets |
| `GET` | `/tickets-api/:id` | Get single ticket |
| `PATCH` | `/tickets-api/:id` | Update ticket |
| `DELETE` | `/tickets-api/:id` | Delete ticket |

See [docs/API.md](docs/API.md) for full documentation.

## Installation

### Deploy Edge Functions

```bash
# Clone the repository
git clone https://github.com/your-org/universal-ticket-layer.git
cd universal-ticket-layer

# Set up environment
cp .env.example .env
# Edit .env with your values

# Deploy to Supabase
supabase functions deploy tickets-api
supabase functions deploy ingest-ticket
supabase functions deploy create-github-issue
supabase functions deploy github-webhook
```

### Run Migrations

```bash
supabase db push
```

## Environment Variables

```bash
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# API Authentication
UTL_INGEST_API_KEY=utl_xxx

# GitHub Integration
GITHUB_TOKEN=ghp_xxx
GITHUB_OWNER=organization
GITHUB_REPO=repository
GITHUB_WEBHOOK_SECRET=xxx
```

## Project Structure

```
universal-ticket-layer/
├── supabase/
│   ├── functions/           # Edge Functions
│   │   ├── tickets-api/
│   │   ├── ingest-ticket/
│   │   ├── create-github-issue/
│   │   └── github-webhook/
│   └── migrations/          # Database schema
├── sdk/
│   └── typescript/          # TypeScript SDK
├── docs/                    # Documentation
├── .env.example
└── README.md
```

## Documentation

- [PRD-Universal-Ticket-Layer.md](./PRD-Universal-Ticket-Layer.md) - Full product requirements
- [docs/API.md](docs/API.md) - API reference
- [docs/AGENTS.md](docs/AGENTS.md) - For coding agents
- [docs/INTEGRATION.md](docs/INTEGRATION.md) - Client integration guide
- [CLAUDE.md](./CLAUDE.md) - Claude Code instructions

## Clients Using UTL

- **WarrantyOS Bug Reporter** - In-app bug reporting for WarrantyOS platform

## License

MIT
