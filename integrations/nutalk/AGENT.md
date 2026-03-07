# Nutalk API Agent Reference

Complete reference for Claude agents interacting with Nutalk AI voice agents API.

## Overview

Nutalk provides AI-powered voice agents for inbound/outbound calling. This integration enables:
- Managing AI agents and their configurations
- Accessing call logs, transcripts, and recordings
- Managing contacts database
- Running outbound campaigns
- Receiving webhooks for real-time events

---

## Authentication

### API Key Format
```
sk_{prefix}_{secret}
```

- **Production**: `sk_live_...`
- **Test/Development**: `sk_test_...`

### Required Headers
```http
Authorization: Bearer sk_f945c94d_ca81a257e69215ccc73076fcaaa1366540b71cdc80746ce9
Content-Type: application/json
```

### Environment Variable
```bash
NUTALK_API_KEY=sk_f945c94d_ca81a257e69215ccc73076fcaaa1366540b71cdc80746ce9
```

---

## Base URL

```
https://api.nutalk.ai/v1
```

---

## Response Format

### Success
```json
{
  "success": true,
  "data": { ... }
}
```

### Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid parameters",
    "details": { }
  }
}
```

### Pagination
```json
{
  "pagination": {
    "total": 1250,
    "limit": 20,
    "offset": 0,
    "has_more": true
  }
}
```

Query params: `?limit=20&offset=40`

---

## Agents API

Manage AI voice agents.

### Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/agents` | List all agents |
| POST | `/api/v1/agents` | Create new agent |
| GET | `/api/v1/agents/:id` | Get agent details |
| PATCH | `/api/v1/agents/:id` | Update agent |
| DELETE | `/api/v1/agents/:id` | Delete agent |

### List Agents

```bash
curl -X GET "https://api.nutalk.ai/v1/agents?limit=10" \
  -H "Authorization: Bearer $NUTALK_API_KEY"
```

**Response:**
```json
{
  "success": true,
  "data": [{
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Sales Agent",
    "description": "Handles inbound sales inquiries",
    "created_at": "2024-01-15T10:30:00Z",
    "deployed_version": {
      "id": "v-abc123",
      "version_label": "v1.2"
    }
  }],
  "pagination": { "total": 5, "limit": 10, "offset": 0 }
}
```

### Create Agent

```bash
curl -X POST "https://api.nutalk.ai/v1/agents" \
  -H "Authorization: Bearer $NUTALK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Support Agent",
    "description": "Handles customer support inquiries",
    "instructions": "You are a helpful support agent..."
  }'
```

**Parameters:**
- `name` (required, string): 1-100 characters
- `description` (string): Max 500 characters
- `instructions` (required, string): System prompt, max 50,000 characters

### Get Agent

```bash
curl -X GET "https://api.nutalk.ai/v1/agents/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer $NUTALK_API_KEY"
```

**Response includes:**
- Agent details
- Deployed version with instructions
- All versions with deployment status

### Update Agent

```bash
curl -X PATCH "https://api.nutalk.ai/v1/agents/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer $NUTALK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Premium Sales Agent",
    "instructions": "Updated system prompt..."
  }'
```

Updating `instructions` creates a new draft version.

### Delete Agent

```bash
curl -X DELETE "https://api.nutalk.ai/v1/agents/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer $NUTALK_API_KEY"
```

---

## Calls API

Read-only access to call history.

### Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/calls` | List all calls |
| GET | `/api/v1/calls/:id` | Get call with transcript |

### List Calls

```bash
curl -X GET "https://api.nutalk.ai/v1/calls?status=completed&direction=inbound&limit=10" \
  -H "Authorization: Bearer $NUTALK_API_KEY"
```

**Query Parameters:**
- `limit` (integer): 1-100, default 20
- `offset` (integer): default 0
- `status` (string): queued, ringing, in-progress, completed, failed, busy, no-answer
- `direction` (string): inbound, outbound
- `from` (string): Filter by caller phone
- `to` (string): Filter by recipient phone
- `channel_id` (uuid): Filter by channel
- `started_after` (datetime): ISO-8601 timestamp
- `started_before` (datetime): ISO-8601 timestamp

**Response:**
```json
{
  "success": true,
  "data": [{
    "id": "call_abc123",
    "direction": "inbound",
    "status": "completed",
    "from_number": "+14155551234",
    "to_number": "+18005550100",
    "started_at": "2024-01-25T14:30:00Z",
    "ended_at": "2024-01-25T14:35:30Z",
    "duration_seconds": 330,
    "agent_name": "Sales Agent",
    "channel_name": "Main Line",
    "call_outcome": "appointment_booked",
    "is_test": false
  }],
  "pagination": { "total": 1250, "limit": 10, "offset": 0, "has_more": true }
}
```

### Get Call Details

```bash
curl -X GET "https://api.nutalk.ai/v1/calls/call_abc123" \
  -H "Authorization: Bearer $NUTALK_API_KEY"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "call_abc123",
    "direction": "inbound",
    "status": "completed",
    "from_number": "+14155551234",
    "to_number": "+18005550100",
    "started_at": "2024-01-25T14:30:00Z",
    "ended_at": "2024-01-25T14:35:30Z",
    "duration_seconds": 330,
    "agent_name": "Sales Agent",
    "channel_name": "Main Line",
    "channel_id": "ch_xyz789",
    "call_outcome": "appointment_booked",
    "is_test": false,
    "transcript": "Agent: Hello, thank you for calling...\nCaller: Hi, I'd like to schedule a demo...",
    "transcript_summary": "Customer requested a product demo. Agent scheduled appointment for next Tuesday at 2 PM.",
    "recording_url": "https://storage.nutalk.ai/recordings/call_abc123.mp3",
    "metadata": { "campaign_id": "camp_def456" },
    "quality_metrics": {
      "mos": 4.2,
      "jitter_ms": 12.5,
      "packet_loss_pct": 0.1
    },
    "answered_by": "human",
    "call_result": "completed",
    "credits_charged": 7
  }
}
```

### Call Statuses

| Status | Description |
|--------|-------------|
| `queued` | Waiting to be initiated |
| `ringing` | Ringing on recipient's phone |
| `in-progress` | Active conversation |
| `completed` | Ended normally |
| `failed` | Technical error |
| `busy` | Recipient line busy |
| `no-answer` | Not answered within timeout |

### Quality Metrics

| Metric | Description | Good Range |
|--------|-------------|------------|
| `mos` | Mean Opinion Score (1-5) | > 4.0 |
| `jitter_ms` | Network jitter | < 30ms |
| `packet_loss_pct` | Lost audio packets | < 1% |

**Note:** Recording URLs expire after 24 hours.

---

## Contacts API

Manage contact database.

### Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/contacts` | List contacts |
| POST | `/api/v1/contacts` | Create contact |
| GET | `/api/v1/contacts/:id` | Get contact |
| PATCH | `/api/v1/contacts/:id` | Update contact |
| DELETE | `/api/v1/contacts/:id` | Delete contact |

### List Contacts

```bash
curl -X GET "https://api.nutalk.ai/v1/contacts?search=john&limit=20" \
  -H "Authorization: Bearer $NUTALK_API_KEY"
```

**Query Parameters:**
- `limit` (integer): 1-100, default 20
- `offset` (integer): default 0
- `search` (string): Filter by phone, name, or email
- `tag` (string): Filter by tag value

### Create Contact

```bash
curl -X POST "https://api.nutalk.ai/v1/contacts" \
  -H "Authorization: Bearer $NUTALK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+14155551234",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "company": "Acme Corp",
    "notes": "VIP customer",
    "tags": ["vip", "enterprise"]
  }'
```

**Parameters:**
- `phone_number` (required): E.164 format (+14155551234)
- `first_name` (string): Max 200 chars
- `last_name` (string): Max 200 chars
- `display_name` (string): Max 200 chars
- `email` (string): Max 200 chars
- `company` (string): Max 200 chars
- `notes` (string): Max 2000 chars
- `tags` (array of strings)

**Constraint:** Phone numbers must be unique within workspace (409 Conflict if duplicate).

### Contact Sources

| Source | Description |
|--------|-------------|
| `api` | Created via API |
| `import` | Imported from CSV |
| `manual` | Added via dashboard |
| `inbound` | Generated from call/message |
| `webhook` | From webhook integration |

---

## Campaigns API

Manage outbound calling campaigns.

### Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/campaigns` | List campaigns |
| POST | `/api/v1/campaigns` | Create campaign |
| GET | `/api/v1/campaigns/:id` | Get campaign |
| PATCH | `/api/v1/campaigns/:id` | Update campaign |
| DELETE | `/api/v1/campaigns/:id` | Archive campaign |
| POST | `/api/v1/campaigns/:id/start` | Start campaign |
| POST | `/api/v1/campaigns/:id/pause` | Pause campaign |

### List Campaigns

```bash
curl -X GET "https://api.nutalk.ai/v1/campaigns?status=active&limit=10" \
  -H "Authorization: Bearer $NUTALK_API_KEY"
```

**Query Parameters:**
- `status`: draft, active, paused, completed, archived
- `type`: outbound, inbound, webhook

### Create Campaign

```bash
curl -X POST "https://api.nutalk.ai/v1/campaigns" \
  -H "Authorization: Bearer $NUTALK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Summer Sale Campaign",
    "description": "Outreach for summer promotion",
    "type": "outbound",
    "business_hours": {
      "timezone": "America/Los_Angeles",
      "days": {
        "monday": { "start": "10:00", "end": "18:00" },
        "tuesday": { "start": "10:00", "end": "18:00" }
      }
    },
    "rate_limits": {
      "max_concurrent_calls": 5,
      "calls_per_minute": 3
    }
  }'
```

**Parameters:**
- `name` (required, string): 1-200 characters
- `description` (string): Max 1000 characters
- `type` (string): outbound, inbound, webhook (default: outbound)
- `outbound_channel_id` (uuid): Channel for outbound calls
- `business_hours` (object): Operating hours config
- `rate_limits` (object): Call throttling settings

### Start Campaign

```bash
curl -X POST "https://api.nutalk.ai/v1/campaigns/camp_abc123/start" \
  -H "Authorization: Bearer $NUTALK_API_KEY"
```

**Requirement:** Outbound campaigns require `outbound_channel_id` before starting.

### Pause Campaign

```bash
curl -X POST "https://api.nutalk.ai/v1/campaigns/camp_abc123/pause" \
  -H "Authorization: Bearer $NUTALK_API_KEY"
```

### Campaign Statuses

| Status | Description | Allowed Actions |
|--------|-------------|-----------------|
| `draft` | Being configured | start, update, delete |
| `active` | Running | pause, update |
| `paused` | Halted | start, update, delete |
| `completed` | All enrollments processed | delete (archive) |
| `archived` | Read-only | none |

---

## Webhooks

Receive real-time events from Nutalk.

### Available Events

| Event | Trigger |
|-------|---------|
| `call.started` | Call initiated |
| `call.completed` | Call ended with transcript |
| `call.failed` | Call failed or not answered |
| `appointment.booked` | Agent booked appointment |
| `campaign.enrollment.completed` | Contact finished campaign |

### Payload Format

```json
{
  "id": "evt_unique123",
  "type": "call.completed",
  "created_at": "2024-01-25T14:35:30Z",
  "data": {
    "call_id": "call_abc123",
    "duration_seconds": 330,
    "transcript": "...",
    "transcript_summary": "...",
    "recording_url": "...",
    "metadata": { "campaign_id": "camp_def456" }
  }
}
```

### Signature Verification

Headers:
- `X-Nutalk-Signature`: HMAC-SHA256 signature
- `X-Nutalk-Timestamp`: Unix timestamp

**Verification (Node.js):**
```javascript
const crypto = require('crypto');

function verifyWebhook(body, signature, timestamp, secret) {
  // Reject if timestamp > 5 minutes old
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    return false;
  }

  const signedPayload = `${timestamp}.${body}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

### Retry Policy

| Attempt | Delay |
|---------|-------|
| 1st | 1 minute |
| 2nd | 5 minutes |
| 3rd | 30 minutes |
| 4th | 2 hours |

After 4 failures, webhook marked failed.

### Best Practices

- Return 2xx within 5 seconds
- Process asynchronously for long operations
- Use event `id` for deduplication
- Always verify signatures
- Design idempotent handlers

---

## Rate Limits

### Limits

- **Hourly**: 1,000 requests per API key
- **Burst**: 100 requests per minute

### Response Headers

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 987
X-RateLimit-Reset: 1706198400
```

### Rate Limited Response

```http
HTTP/1.1 429 Too Many Requests

{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please slow down."
  }
}
```

### Best Practices

- Monitor `X-RateLimit-Remaining` header
- Implement exponential backoff (1s, 2s, 4s, 8s...)
- Cache responses when possible
- Use webhooks instead of polling
- Batch operations where possible

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing/invalid Authorization header |
| `INVALID_API_KEY` | 401 | Invalid or revoked API key |
| `RATE_LIMITED` | 429 | Too many requests |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `VALIDATION_ERROR` | 400 | Invalid parameters |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Quick Reference

### cURL Template

```bash
curl -X {METHOD} "https://api.nutalk.ai/v1/{endpoint}" \
  -H "Authorization: Bearer $NUTALK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

### Common Operations

| Task | Command |
|------|---------|
| List agents | `GET /api/v1/agents` |
| Get call transcript | `GET /api/v1/calls/:id` |
| Create contact | `POST /api/v1/contacts` |
| Start campaign | `POST /api/v1/campaigns/:id/start` |
| Check rate limits | Inspect `X-RateLimit-*` headers |

---

## Support

- Email: support@nutalk.ai
- Enterprise rate limits: sales@nutalk.ai
- Documentation: https://www.nutalk.ai/en/docs/api

---

*This document was generated from the official Nutalk API documentation for agent reference.*
