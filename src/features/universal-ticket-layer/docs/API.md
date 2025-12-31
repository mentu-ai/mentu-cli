# Universal Ticket Layer - API Reference

## Base URL

```
https://your-project.supabase.co/functions/v1/tickets-api
```

## Authentication

Include one of these headers with every request:

| Method | Header |
|--------|--------|
| API Key | `x-api-key: YOUR_API_KEY` |
| JWT | `Authorization: Bearer USER_JWT` |
| Service Role | `Authorization: Bearer SERVICE_ROLE_KEY` |

---

## Endpoints

### POST /tickets-api

Create a new ticket.

**Request:**
```json
{
  "source": "api",           // Required: bug_reporter, email, slack, api, manual, zapier, webhook
  "description": "...",      // Required: Full description
  "type": "bug",             // Optional: bug, feature, support, task, question
  "title": "...",            // Optional: Auto-generated if omitted
  "priority": "medium",      // Optional: low, medium, high, critical
  "page_url": "...",         // Optional
  "environment": {},         // Optional
  "payload": {},             // Optional
  "source_id": "...",        // Optional
  "source_metadata": {}      // Optional
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
    "created_at": "..."
  }
}
```

---

### GET /tickets-api

List tickets with optional filters.

**Query Parameters:**
- `type` - Filter by ticket type
- `status` - Filter by status
- `priority` - Filter by priority
- `source` - Filter by source
- `assigned_to` - Filter by assignee UUID
- `created_by` - Filter by creator UUID
- `search` - Full-text search
- `limit` - Results per page (default: 50, max: 100)
- `offset` - Pagination offset
- `order_by` - Sort field (default: created_at)
- `order` - Sort direction: asc or desc

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

Get a single ticket.

**Response (200):**
```json
{
  "success": true,
  "ticket": {
    "id": "uuid",
    "source": "...",
    "type": "...",
    "title": "...",
    "description": "...",
    "priority": "...",
    "status": "...",
    "external_refs": [...],
    "created_at": "...",
    "updated_at": "..."
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
  "resolution_notes": "..."
}
```

**Response (200):**
```json
{
  "success": true,
  "ticket": {...}
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
