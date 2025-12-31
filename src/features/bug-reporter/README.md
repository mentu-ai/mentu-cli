# Bug Reporter + Universal Ticket Layer

> **Part of WarrantyOS Cognitive Infrastructure**

This directory contains both the **In-App Bug Reporter** (frontend component) and documentation for the **Universal Ticket Layer** (backend API system). The Bug Reporter is one of several sources that feed into the Universal Ticket Layer.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       UNIVERSAL TICKET LAYER                             │
│                    (Centralized Ticket Management)                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Sources (Input Channels):                                              │
│   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│   │ BUG REPORTER │ │   Email      │ │   Slack      │ │  Zapier/n8n  │   │
│   │ ← THIS DIR   │ │   Webhook    │ │   Bot        │ │   Webhook    │   │
│   └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘   │
│          │                │                │                │            │
│          └────────────────┴────────────────┴────────────────┘            │
│                                    │                                     │
│                                    ▼                                     │
│                        ┌─────────────────────┐                           │
│                        │   TICKETS API       │                           │
│                        │   (Edge Function)   │                           │
│                        └─────────────────────┘                           │
│                                    │                                     │
│                                    ▼                                     │
│                        ┌─────────────────────┐                           │
│                        │   tickets table     │                           │
│                        │   (Supabase)        │                           │
│                        └─────────────────────┘                           │
│                                    │                                     │
│   Outputs (External Systems):      ▼                                     │
│   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                     │
│   │   GitHub     │ │   Linear     │ │   Jira       │                     │
│   │   Issues     │ │   (future)   │ │   (future)   │                     │
│   └──────────────┘ └──────────────┘ └──────────────┘                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Location**: `vin-to-value-main/src/features/bug-reporter/`

---

## Table of Contents

1. [Bug Reporter (Frontend)](#bug-reporter-frontend)
2. [Universal Ticket Layer (Backend API)](#universal-ticket-layer-backend-api)
3. [API Reference](#api-reference)
4. [Database Schema](#database-schema)
5. [GitHub Integration](#github-integration)
6. [Deployment](#deployment)
7. [Testing](#testing)

---

# Bug Reporter (Frontend)

The in-app bug reporting component that allows users to submit issues directly from WarrantyOS. Reports are submitted to the Universal Ticket Layer.

## Features

- **One-click bug reporting** from anywhere in the app
- **Automatic capture** of console logs, user behavior, and environment data
- **Screenshot capture** using DOM-to-canvas rendering (no permissions required)
- **Element selection** to pinpoint specific UI components
- **Video link attachment** for complex issues (Loom integration)

## Quick Start

### 1. Add Provider to App

```tsx
// In App.tsx or main layout
import { BugReporterProvider } from '@/features/bug-reporter';
import { supabase } from '@/integrations/supabase/client';

function App() {
  return (
    <BugReporterProvider supabaseClient={supabase}>
      {/* Your app content */}
    </BugReporterProvider>
  );
}
```

### 2. Add Trigger Button

```tsx
// In ProtectedLayout.tsx header
import { BugReporterTrigger } from '@/features/bug-reporter';

<header>
  <div className="flex items-center gap-2">
    <BugReporterTrigger />
  </div>
</header>
```

### 3. Keyboard Shortcut

Press `Ctrl+Shift+B` (or `Cmd+Shift+B` on Mac) to open the reporter.

## Data Captured Automatically

| Category | Data Captured |
|----------|--------------|
| **Console Logs** | `log`, `warn`, `error`, `debug`, `info` + uncaught exceptions |
| **Behavior Trace** | Clicks, form interactions, navigation, scroll positions |
| **Environment** | Browser, OS, viewport, URL, timezone, screen resolution |
| **User-Provided** | Description (required), selected element, video URL |

## Component Structure

```
components/
├── BugReporterModal.tsx      # Main reporting UI
├── BugReporterTrigger.tsx    # Header button (🐛 icon)
├── BugReporterProvider.tsx   # App wrapper with initialization
├── ElementHighlighter.tsx    # Element selection overlay
├── LoomRecordButton.tsx      # Video recording button
└── SettingsPanel.tsx         # Configuration UI
```

---

# Universal Ticket Layer (Backend API)

A unified ticket ingestion and management system that accepts work requests from multiple sources and normalizes them into a single data layer with bi-directional GitHub Issues sync.

## Architecture

```
                          UNIVERSAL TICKET LAYER

  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
  │ Bug Reporter │   │    Email     │   │    Slack     │   │  Zapier/n8n  │
  │   (In-App)   │   │   Webhook    │   │    Bot       │   │   Webhook    │
  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
         │                  │                  │                  │
         ▼                  ▼                  ▼                  ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │                    TICKETS API (Edge Function)                        │
  │   POST /tickets-api     - Create ticket                               │
  │   GET  /tickets-api     - List/search tickets                         │
  │   GET  /tickets-api/:id - Get single ticket                           │
  │   PATCH /tickets-api/:id - Update ticket                              │
  │   DELETE /tickets-api/:id - Delete ticket                             │
  └──────────────────────────────────────────────────────────────────────┘
         │
         ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │                         SUPABASE (tickets table)                      │
  │   - Source tracking (bug_reporter, email, slack, api, zapier, etc.)   │
  │   - Normalized fields (type, priority, status, description)           │
  │   - Rich payload (console logs, behavior trace, screenshots)          │
  │   - External refs (GitHub issue links, Linear tickets, etc.)          │
  └───────────────────────────────┬──────────────────────────────────────┘
                                  │
                     ┌────────────┴────────────┐
                     │   DATABASE WEBHOOK      │
                     │   (on INSERT)           │
                     └────────────┬────────────┘
                                  ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │                    CREATE-GITHUB-ISSUE (Edge Function)                │
  │   - Creates GitHub Issue from ticket                                  │
  │   - Maps priority → labels                                            │
  │   - Stores issue URL in external_refs                                 │
  │   - Updates ticket status to 'triaged'                                │
  └──────────────────────────────────────────────────────────────────────┘
         │
         ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │                         GITHUB ISSUES                                 │
  │   - Kanban board for visualization                                    │
  │   - Webhook sends events back to Supabase                             │
  └───────────────────────────────┬──────────────────────────────────────┘
                                  │
                     ┌────────────┴────────────┐
                     │   GITHUB WEBHOOK        │
                     │   (issues.*)            │
                     └────────────┬────────────┘
                                  ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │                    GITHUB-WEBHOOK (Edge Function)                     │
  │   - Syncs closed/reopened/assigned status back to tickets             │
  │   - Updates external_refs with sync timestamp                         │
  │   - Bi-directional sync: Supabase ↔ GitHub                            │
  └──────────────────────────────────────────────────────────────────────┘
```

## Quick Start (API)

### Create a Ticket

```bash
curl -X POST 'https://hlfxdqxinugyyfqbfwyn.supabase.co/functions/v1/tickets-api' \
  -H 'x-api-key: YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "source": "api",
    "type": "bug",
    "title": "Login button not responding",
    "description": "Users report the login button does not respond on Safari 17",
    "priority": "high"
  }'
```

### Response

```json
{
  "success": true,
  "ticket": {
    "id": "215149d9-e58c-4950-b219-c110134bd341",
    "source": "api",
    "type": "bug",
    "title": "Login button not responding",
    "status": "submitted",
    "priority": "high",
    "created_at": "2024-12-19T21:45:00.000Z"
  }
}
```

**What happens next:**
1. Ticket stored in Supabase `tickets` table
2. Database webhook triggers `create-github-issue`
3. GitHub Issue created with labels
4. Ticket updated with `external_refs` and status → `triaged`

---

# API Reference

## Base URL

```
https://hlfxdqxinugyyfqbfwyn.supabase.co/functions/v1/tickets-api
```

## Authentication

| Method | Header | Use Case |
|--------|--------|----------|
| API Key | `x-api-key: YOUR_KEY` | Server-to-server integrations |
| JWT | `Authorization: Bearer TOKEN` | Authenticated users |
| Service Role | `Authorization: Bearer SERVICE_KEY` | Edge Functions |

---

## Endpoints

### POST /tickets-api

Create a new ticket.

**Request:**

```json
{
  "source": "api",           // Required: bug_reporter, email, slack, api, manual, zapier, webhook
  "description": "...",      // Required: Full description
  "type": "bug",             // Optional: bug, feature, support, task, question (default: bug)
  "title": "...",            // Optional: Auto-generated from description if omitted
  "priority": "medium",      // Optional: low, medium, high, critical (default: medium)
  "page_url": "...",         // Optional: URL where issue occurred
  "environment": {},         // Optional: Browser, OS, viewport info
  "payload": {},             // Optional: Rich diagnostic data
  "source_id": "...",        // Optional: ID from source system
  "source_metadata": {}      // Optional: Source-specific metadata
}
```

**Response (201):**

```json
{
  "success": true,
  "ticket": {
    "id": "uuid",
    "source": "api",
    "type": "bug",
    "title": "...",
    "status": "submitted",
    "created_at": "2024-12-19T21:45:00.000Z"
  }
}
```

---

### GET /tickets-api

List tickets with optional filters.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | Filter by type (bug, feature, etc.) |
| `status` | string | Filter by status |
| `priority` | string | Filter by priority |
| `source` | string | Filter by source |
| `assigned_to` | uuid | Filter by assignee |
| `search` | string | Full-text search in title/description |
| `limit` | number | Results per page (default: 50, max: 100) |
| `offset` | number | Pagination offset |
| `order_by` | string | Sort field (default: created_at) |
| `order` | string | Sort direction: asc or desc (default: desc) |

**Example:**

```bash
curl 'https://.../tickets-api?type=bug&status=submitted&limit=10' \
  -H 'x-api-key: YOUR_KEY'
```

**Response (200):**

```json
{
  "success": true,
  "tickets": [...],
  "count": 10,
  "total": 42,
  "limit": 10,
  "offset": 0
}
```

---

### GET /tickets-api/:id

Get a single ticket by ID.

**Response (200):**

```json
{
  "success": true,
  "ticket": {
    "id": "uuid",
    "source": "bug_reporter",
    "type": "bug",
    "title": "...",
    "description": "...",
    "priority": "high",
    "status": "triaged",
    "external_refs": [
      {
        "system": "github",
        "id": "1",
        "url": "https://github.com/owner/repo/issues/1",
        "synced_at": "2024-12-19T21:46:00.000Z"
      }
    ],
    "payload": {
      "console_logs": [...],
      "behavior_trace": [...],
      "screenshot": "data:image/png;base64,..."
    }
  }
}
```

---

### PATCH /tickets-api/:id

Update a ticket.

**Request:**

```json
{
  "status": "in_progress",
  "priority": "critical",
  "assigned_to": "user-uuid",
  "resolution_notes": "Fixed in commit abc123"
}
```

---

### DELETE /tickets-api/:id

Delete a ticket.

**Response (200):**

```json
{
  "success": true,
  "message": "Ticket deleted"
}
```

---

# Database Schema

## tickets table

```sql
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source tracking
  source TEXT NOT NULL DEFAULT 'bug_reporter',
  source_id TEXT,
  source_metadata JSONB DEFAULT '{}',

  -- Normalized fields
  type TEXT NOT NULL DEFAULT 'bug',       -- bug, feature, support, task, question
  title TEXT,
  description TEXT NOT NULL,
  priority TEXT DEFAULT 'medium',         -- low, medium, high, critical
  status TEXT DEFAULT 'submitted',        -- submitted, triaged, in_progress, resolved, closed, wont_fix

  -- Assignment
  assigned_to UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ,

  -- Rich payload
  payload JSONB DEFAULT '{}',             -- console_logs, behavior_trace, element, screenshot

  -- Location context
  page_url TEXT,
  environment JSONB DEFAULT '{}',

  -- External system sync
  external_refs JSONB DEFAULT '[]',       -- [{system, id, url, synced_at}]

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT
);
```

## Valid Values

| Field | Valid Values |
|-------|--------------|
| `source` | `bug_reporter`, `email`, `slack`, `api`, `manual`, `zapier`, `webhook` |
| `type` | `bug`, `feature`, `support`, `task`, `question` |
| `priority` | `low`, `medium`, `high`, `critical` |
| `status` | `submitted`, `triaged`, `in_progress`, `resolved`, `closed`, `wont_fix` |

---

# GitHub Integration

## Automatic Issue Creation

When a ticket is inserted, a database webhook calls `create-github-issue`:

1. Creates GitHub Issue with title, body, and labels
2. Stores issue URL in `external_refs`
3. Updates ticket status to `triaged`

**Label Mapping:**

| Priority | Labels |
|----------|--------|
| critical | `priority: critical`, `urgent` |
| high | `priority: high` |
| medium | `priority: medium` |
| low | `priority: low` |

| Type | Label |
|------|-------|
| bug | `bug` |
| feature | `enhancement` |
| support | `question` |
| task | `task` |

## Bi-directional Sync

| GitHub Event | Ticket Update |
|--------------|---------------|
| `issues.closed` (completed) | status → `resolved` |
| `issues.closed` (not_planned) | status → `wont_fix` |
| `issues.reopened` | status → `in_progress` |
| `issues.assigned` | Updates `source_metadata.github_assignee` |

---

# Deployment

## Edge Functions

```bash
supabase functions deploy tickets-api
supabase functions deploy ingest-ticket
supabase functions deploy create-github-issue
supabase functions deploy github-webhook
```

## Environment Variables

```bash
# Set Supabase secrets
supabase secrets set INGEST_API_KEY=wos_ingest_xxx
supabase secrets set GITHUB_TOKEN=ghp_xxx
supabase secrets set GITHUB_OWNER=rashidazarang
supabase secrets set GITHUB_REPO=warrantyos
supabase secrets set GITHUB_WEBHOOK_SECRET=xxx
```

## Database Webhook

1. Supabase Dashboard → Database → Webhooks
2. Create webhook:
   - **Name:** `ticket-created-github`
   - **Table:** `tickets`
   - **Events:** `INSERT`
   - **Type:** Supabase Edge Functions
   - **Function:** `create-github-issue`

## GitHub Webhook

1. GitHub repo → Settings → Webhooks
2. Add webhook:
   - **URL:** `https://hlfxdqxinugyyfqbfwyn.supabase.co/functions/v1/github-webhook`
   - **Content type:** `application/json`
   - **Secret:** Same as `GITHUB_WEBHOOK_SECRET`
   - **Events:** Select "Issues"

---

# Testing

```bash
# Create ticket
curl -X POST 'https://hlfxdqxinugyyfqbfwyn.supabase.co/functions/v1/tickets-api' \
  -H 'x-api-key: <WOS_INGEST_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{"source": "api", "type": "bug", "title": "Test", "description": "Test ticket"}'

# List tickets
curl 'https://hlfxdqxinugyyfqbfwyn.supabase.co/functions/v1/tickets-api?type=bug&limit=5' \
  -H 'x-api-key: <WOS_INGEST_KEY>'

# Get single ticket
curl 'https://hlfxdqxinugyyfqbfwyn.supabase.co/functions/v1/tickets-api/TICKET_ID' \
  -H 'x-api-key: <WOS_INGEST_KEY>'
```

---

# File Structure

```
vin-to-value-main/src/features/bug-reporter/
├── components/
│   ├── BugReporterModal.tsx      # Main reporting UI
│   ├── BugReporterTrigger.tsx    # Header button
│   ├── BugReporterProvider.tsx   # App wrapper
│   ├── ElementHighlighter.tsx    # Element selection
│   ├── LoomRecordButton.tsx      # Video recording
│   └── SettingsPanel.tsx         # Configuration
├── hooks/
│   ├── useBugReporter.ts         # Main hook
│   ├── useConsoleCapture.ts      # Console capture
│   └── useBehaviorTracking.ts    # Behavior tracking
├── services/
│   ├── bugReporterService.ts     # API submission
│   └── loomService.ts            # Loom integration
├── stores/
│   ├── bugReporterStore.ts       # Zustand state
│   └── loomSettingsStore.ts      # Loom preferences
├── types/
│   └── bugReport.types.ts        # TypeScript definitions
├── utils/
│   ├── screenshotCapture.ts      # Screenshot utility
│   ├── elementSelector.ts        # CSS selector
│   └── environmentCollector.ts   # Environment detection
├── index.ts                      # Public exports
├── README.md                     # This file
├── AGENTS.md                     # Agent documentation
├── CLAUDE.md                     # Claude Code instructions
└── package.json

supabase/functions/
├── tickets-api/                  # Full REST API
├── ingest-ticket/                # Simple ingestion
├── create-github-issue/          # GitHub integration
└── github-webhook/               # Bi-directional sync

supabase/migrations/
└── 20251219_003_create_tickets_table.sql
```

---

# Related Documentation

- [AGENTS.md](./AGENTS.md) - Documentation for coding agents
- [CLAUDE.md](./CLAUDE.md) - Claude Code specific instructions
- [PRD: In-App Bug Reporting](../../docs/PRD-Bug-Reporting.md)
