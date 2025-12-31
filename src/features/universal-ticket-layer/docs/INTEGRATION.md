# Universal Ticket Layer - Integration Guide

This guide explains how to integrate UTL into your application.

## Overview

UTL accepts tickets from any source and normalizes them into a unified data model. To integrate:

1. Obtain an API key
2. Choose integration method (SDK or direct API)
3. Configure your environment
4. Submit tickets

---

## Step 1: Obtain API Key

Contact the UTL administrator to receive:
- API Key (format: `utl_xxx...`)
- API URL (e.g., `https://xxx.supabase.co/functions/v1`)

---

## Step 2: Choose Integration Method

### Option A: TypeScript SDK (Recommended)

```bash
npm install @warrantyos/utl-sdk
```

```typescript
import { UTLClient } from '@warrantyos/utl-sdk';

const utl = new UTLClient({
  apiUrl: process.env.UTL_API_URL,
  apiKey: process.env.UTL_API_KEY,
});

// Create ticket
const ticket = await utl.tickets.create({
  source: 'your_app',
  type: 'bug',
  description: 'Something went wrong',
});
```

### Option B: Direct API

```bash
curl -X POST 'https://xxx.supabase.co/functions/v1/tickets-api' \
  -H 'x-api-key: YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "source": "your_app",
    "type": "bug",
    "description": "Something went wrong"
  }'
```

---

## Step 3: Configure Environment

Add to your `.env`:

```bash
# Universal Ticket Layer
UTL_API_URL=https://xxx.supabase.co/functions/v1
UTL_API_KEY=utl_xxx...
```

---

## Step 4: Submit Tickets

### Minimal Ticket

```typescript
await utl.tickets.create({
  source: 'your_app',
  description: 'Error when clicking submit button',
});
```

### Full Ticket

```typescript
await utl.tickets.create({
  source: 'your_app',
  type: 'bug',
  title: 'Submit button error',
  description: 'Clicking submit button causes 500 error',
  priority: 'high',
  page_url: 'https://app.example.com/form',
  environment: {
    browser: 'Chrome 120',
    os: 'macOS 14',
  },
  payload: {
    console_logs: [...],
    user_id: 'user-123',
  },
});
```

---

## Source Types

Choose the appropriate source for your integration:

| Source | Use Case |
|--------|----------|
| `bug_reporter` | In-app bug reporter UI |
| `email` | Email parsing webhook |
| `slack` | Slack bot integration |
| `api` | Generic API client |
| `manual` | Manually created tickets |
| `zapier` | Zapier automation |
| `webhook` | Generic webhook source |

---

## Receiving Updates

### Polling

Poll the API periodically to check for updates:

```typescript
const { tickets } = await utl.tickets.list({
  status: 'resolved',
  limit: 10,
});
```

### Webhooks (Future)

UTL can notify your system of ticket events via webhooks.

---

## Best Practices

1. **Always include `source`**: Identifies where tickets originate
2. **Use meaningful titles**: Helps with triage and search
3. **Include context**: Add `page_url`, `environment`, and relevant `payload` data
4. **Handle errors**: Implement retry logic for failed submissions
5. **Check `external_refs`**: Contains links to GitHub issues, etc.
