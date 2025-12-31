# Agent Documentation: Universal Ticket Layer

> **For coding agents, LLMs, and automation systems**

This document provides everything needed to programmatically interact with the WarrantyOS Universal Ticket Layer API.

---

## Quick Reference

| Item | Value |
|------|-------|
| **Base URL** | `https://hlfxdqxinugyyfqbfwyn.supabase.co/functions/v1/tickets-api` |
| **Auth Header** | `x-api-key: YOUR_API_KEY` |
| **Content-Type** | `application/json` |
| **Rate Limit** | None (Supabase Edge Function limits apply) |

---

## Authentication

Use one of these authentication methods:

```bash
# Method 1: API Key (recommended for agents)
curl -H 'x-api-key: YOUR_API_KEY' ...

# Method 2: JWT Bearer Token (for authenticated users)
curl -H 'Authorization: Bearer USER_JWT_TOKEN' ...

# Method 3: Service Role Key (for server-to-server)
curl -H 'Authorization: Bearer SERVICE_ROLE_KEY' ...
```

---

## Create Ticket

**Endpoint:** `POST /tickets-api`

**Minimal Request:**
```json
{
  "source": "api",
  "description": "Description of the issue or request"
}
```

**Full Request:**
```json
{
  "source": "api",
  "type": "bug",
  "title": "Short summary of the issue",
  "description": "Detailed description of what happened",
  "priority": "high",
  "page_url": "https://app.warrantyos.com/quotes/123",
  "environment": {
    "browser": "Chrome 120",
    "os": "macOS 14.0",
    "viewport": "1920x1080"
  },
  "payload": {
    "console_logs": [
      {"level": "error", "message": "TypeError: Cannot read property 'id'", "timestamp": 1703012700000}
    ],
    "behavior_trace": [
      {"type": "click", "target": "button.submit", "timestamp": 1703012695000}
    ]
  },
  "source_id": "external-system-id-123",
  "source_metadata": {
    "external_field": "value"
  }
}
```

**Response (201):**
```json
{
  "success": true,
  "ticket": {
    "id": "215149d9-e58c-4950-b219-c110134bd341",
    "source": "api",
    "type": "bug",
    "title": "Short summary of the issue",
    "description": "Detailed description...",
    "priority": "high",
    "status": "submitted",
    "created_at": "2024-12-19T21:45:00.000Z"
  }
}
```

---

## List Tickets

**Endpoint:** `GET /tickets-api`

**Query Parameters:**
```
?type=bug           # Filter by type
?status=submitted   # Filter by status
?priority=high      # Filter by priority
?source=api         # Filter by source
?search=login       # Full-text search
?limit=50           # Results per page (max 100)
?offset=0           # Pagination offset
?order_by=created_at
?order=desc
```

**Example:**
```bash
curl 'https://.../tickets-api?type=bug&status=submitted&limit=10' \
  -H 'x-api-key: YOUR_API_KEY'
```

**Response (200):**
```json
{
  "success": true,
  "tickets": [
    {
      "id": "uuid",
      "source": "bug_reporter",
      "type": "bug",
      "title": "...",
      "status": "submitted",
      "priority": "medium",
      "created_at": "2024-12-19T21:45:00.000Z"
    }
  ],
  "count": 10,
  "total": 42,
  "limit": 10,
  "offset": 0
}
```

---

## Get Single Ticket

**Endpoint:** `GET /tickets-api/:id`

**Example:**
```bash
curl 'https://.../tickets-api/215149d9-e58c-4950-b219-c110134bd341' \
  -H 'x-api-key: YOUR_API_KEY'
```

**Response (200):**
```json
{
  "success": true,
  "ticket": {
    "id": "215149d9-e58c-4950-b219-c110134bd341",
    "source": "api",
    "type": "bug",
    "title": "Short summary",
    "description": "Detailed description...",
    "priority": "high",
    "status": "triaged",
    "assigned_to": null,
    "page_url": "https://app.warrantyos.com/quotes/123",
    "environment": {...},
    "payload": {...},
    "external_refs": [
      {
        "system": "github",
        "id": "1",
        "url": "https://github.com/rashidazarang/warrantyos/issues/1",
        "synced_at": "2024-12-19T21:46:00.000Z"
      }
    ],
    "created_at": "2024-12-19T21:45:00.000Z",
    "updated_at": "2024-12-19T21:46:00.000Z"
  }
}
```

---

## Update Ticket

**Endpoint:** `PATCH /tickets-api/:id`

**Request:**
```json
{
  "status": "in_progress",
  "priority": "critical",
  "assigned_to": "user-uuid",
  "resolution_notes": "Investigating the issue"
}
```

**Response (200):**
```json
{
  "success": true,
  "ticket": {
    "id": "...",
    "status": "in_progress",
    "priority": "critical",
    "updated_at": "2024-12-19T22:00:00.000Z"
  }
}
```

---

## Delete Ticket

**Endpoint:** `DELETE /tickets-api/:id`

**Response (200):**
```json
{
  "success": true,
  "message": "Ticket deleted"
}
```

---

## Field Reference

### source (required)
| Value | Description |
|-------|-------------|
| `bug_reporter` | In-app bug reporter UI |
| `email` | Email webhook |
| `slack` | Slack bot |
| `api` | Direct API call |
| `manual` | Manually created |
| `zapier` | Zapier integration |
| `webhook` | Generic webhook |

### type
| Value | Description | GitHub Label |
|-------|-------------|--------------|
| `bug` | Software defect | `bug` |
| `feature` | Feature request | `enhancement` |
| `support` | Support request | `question` |
| `task` | General task | `task` |
| `question` | Question | `question` |

### priority
| Value | GitHub Labels |
|-------|---------------|
| `low` | `priority: low` |
| `medium` | `priority: medium` |
| `high` | `priority: high` |
| `critical` | `priority: critical`, `urgent` |

### status
| Value | Description |
|-------|-------------|
| `submitted` | Initial state |
| `triaged` | Reviewed, GitHub issue created |
| `in_progress` | Being worked on |
| `resolved` | Fixed/completed |
| `closed` | Closed without resolution |
| `wont_fix` | Won't be addressed |

---

## Workflow: Create → Track → Resolve

```bash
# 1. Create a ticket
TICKET_ID=$(curl -s -X POST 'https://.../tickets-api' \
  -H 'x-api-key: YOUR_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "source": "api",
    "type": "bug",
    "title": "API returns 500 on invalid input",
    "description": "When posting invalid JSON to /api/quotes, server returns 500 instead of 400",
    "priority": "high"
  }' | jq -r '.ticket.id')

echo "Created ticket: $TICKET_ID"

# 2. Check ticket status (should be 'triaged' after GitHub issue created)
curl -s "https://.../tickets-api/$TICKET_ID" \
  -H 'x-api-key: YOUR_KEY' | jq '.ticket.status, .ticket.external_refs'

# 3. Update to in_progress
curl -s -X PATCH "https://.../tickets-api/$TICKET_ID" \
  -H 'x-api-key: YOUR_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"status": "in_progress"}'

# 4. Mark as resolved
curl -s -X PATCH "https://.../tickets-api/$TICKET_ID" \
  -H 'x-api-key: YOUR_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "status": "resolved",
    "resolution_notes": "Fixed in commit abc123. Added input validation."
  }'
```

---

## GitHub Integration

Tickets automatically sync with GitHub Issues:

1. **On ticket creation:** GitHub Issue created with labels
2. **On GitHub issue close:** Ticket status → `resolved` or `wont_fix`
3. **On GitHub issue reopen:** Ticket status → `in_progress`

**external_refs structure:**
```json
{
  "external_refs": [
    {
      "system": "github",
      "id": "1",
      "url": "https://github.com/owner/repo/issues/1",
      "synced_at": "2024-12-19T21:46:00.000Z"
    }
  ]
}
```

---

## Error Responses

**401 Unauthorized:**
```json
{
  "success": false,
  "error": "Unauthorized. Provide API key or Bearer token."
}
```

**400 Bad Request:**
```json
{
  "success": false,
  "error": "source is required and must be a string"
}
```

**404 Not Found:**
```json
{
  "success": false,
  "error": "Ticket not found"
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "error": "Failed to create ticket",
  "details": "Database connection error"
}
```

---

## Code Examples

### Python
```python
import requests

API_URL = "https://hlfxdqxinugyyfqbfwyn.supabase.co/functions/v1/tickets-api"
API_KEY = "your_api_key"

headers = {
    "x-api-key": API_KEY,
    "Content-Type": "application/json"
}

# Create ticket
response = requests.post(API_URL, headers=headers, json={
    "source": "api",
    "type": "bug",
    "title": "Test from Python",
    "description": "Testing the tickets API from Python",
    "priority": "medium"
})

ticket = response.json()["ticket"]
print(f"Created ticket: {ticket['id']}")

# List tickets
response = requests.get(f"{API_URL}?type=bug&limit=5", headers=headers)
tickets = response.json()["tickets"]
print(f"Found {len(tickets)} tickets")
```

### JavaScript/TypeScript
```typescript
const API_URL = "https://hlfxdqxinugyyfqbfwyn.supabase.co/functions/v1/tickets-api";
const API_KEY = "your_api_key";

const headers = {
  "x-api-key": API_KEY,
  "Content-Type": "application/json"
};

// Create ticket
const response = await fetch(API_URL, {
  method: "POST",
  headers,
  body: JSON.stringify({
    source: "api",
    type: "bug",
    title: "Test from JavaScript",
    description: "Testing the tickets API from JS",
    priority: "medium"
  })
});

const { ticket } = await response.json();
console.log(`Created ticket: ${ticket.id}`);

// List tickets
const listResponse = await fetch(`${API_URL}?type=bug&limit=5`, { headers });
const { tickets } = await listResponse.json();
console.log(`Found ${tickets.length} tickets`);
```

### cURL (Bash)
```bash
API_URL="https://hlfxdqxinugyyfqbfwyn.supabase.co/functions/v1/tickets-api"
API_KEY="your_api_key"

# Create ticket
curl -X POST "$API_URL" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "api",
    "type": "bug",
    "title": "Test from cURL",
    "description": "Testing the tickets API from bash",
    "priority": "medium"
  }'

# List tickets
curl "$API_URL?type=bug&limit=5" \
  -H "x-api-key: $API_KEY"
```

---

## Best Practices for Agents

1. **Always include source**: Use `"source": "api"` or a more specific identifier
2. **Provide context**: Include `page_url`, `environment`, and relevant `payload` data
3. **Use appropriate types**: Match ticket type to the nature of the request
4. **Set priority thoughtfully**: Reserve `critical` for production-breaking issues
5. **Track external_refs**: Check for GitHub issue links in responses
6. **Handle errors gracefully**: Implement retry logic for 5xx errors
7. **Use search**: Full-text search via `?search=` is indexed and fast

---

## Related Documentation

- [README.md](./README.md) - Full system documentation
- [CLAUDE.md](./CLAUDE.md) - Claude Code specific instructions
