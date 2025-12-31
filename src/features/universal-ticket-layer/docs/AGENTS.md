# Universal Ticket Layer - Agent Documentation

> **For coding agents, LLMs, and automation systems**

Quick reference for programmatic interaction with UTL.

---

## Quick Reference

| Item | Value |
|------|-------|
| **Base URL** | `https://xxx.supabase.co/functions/v1/tickets-api` |
| **Auth Header** | `x-api-key: YOUR_API_KEY` |
| **Content-Type** | `application/json` |

---

## Create Ticket

```bash
curl -X POST 'BASE_URL' \
  -H 'x-api-key: KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "source": "api",
    "type": "bug",
    "description": "Error description"
  }'
```

**Response:**
```json
{"success": true, "ticket": {"id": "uuid", ...}}
```

---

## List Tickets

```bash
curl 'BASE_URL?type=bug&status=submitted&limit=10' \
  -H 'x-api-key: KEY'
```

---

## Get Ticket

```bash
curl 'BASE_URL/TICKET_ID' \
  -H 'x-api-key: KEY'
```

---

## Update Ticket

```bash
curl -X PATCH 'BASE_URL/TICKET_ID' \
  -H 'x-api-key: KEY' \
  -H 'Content-Type: application/json' \
  -d '{"status": "in_progress"}'
```

---

## Delete Ticket

```bash
curl -X DELETE 'BASE_URL/TICKET_ID' \
  -H 'x-api-key: KEY'
```

---

## Valid Values

| Field | Values |
|-------|--------|
| `source` | `bug_reporter`, `email`, `slack`, `api`, `manual`, `zapier`, `webhook` |
| `type` | `bug`, `feature`, `support`, `task`, `question` |
| `priority` | `low`, `medium`, `high`, `critical` |
| `status` | `submitted`, `triaged`, `in_progress`, `resolved`, `closed`, `wont_fix` |

---

## SDK Usage

```typescript
import { UTLClient } from '@warrantyos/utl-sdk';

const utl = new UTLClient({ apiUrl: '...', apiKey: '...' });

// Create
const ticket = await utl.tickets.create({...});

// List
const { tickets } = await utl.tickets.list({ type: 'bug' });

// Get
const t = await utl.tickets.get('uuid');

// Update
await utl.tickets.update('uuid', { status: 'resolved' });

// Delete
await utl.tickets.delete('uuid');
```
