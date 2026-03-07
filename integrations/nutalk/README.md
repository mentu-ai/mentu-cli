# Nutalk Integration

> **Status: SCAFFOLDED** - API documentation captured, webhook handler not implemented.
> Integration is planned but inactive. Do not include in active pipeline traces.

AI voice agents for inbound/outbound calling.

## Quick Start

```bash
# Set API key
export NUTALK_API_KEY=sk_f945c94d_ca81a257e69215ccc73076fcaaa1366540b71cdc80746ce9

# List agents
curl -X GET "https://api.nutalk.ai/v1/agents" \
  -H "Authorization: Bearer $NUTALK_API_KEY"

# Get recent calls
curl -X GET "https://api.nutalk.ai/v1/calls?limit=10" \
  -H "Authorization: Bearer $NUTALK_API_KEY"
```

## Credentials

| Key | Location | Format |
|-----|----------|--------|
| API Key | `/Workspaces/.env` | `NUTALK_API_KEY=sk_...` |
| Webhook Secret | Wrangler secrets | `NUTALK_WEBHOOK_SECRET` |

## API Resources

| Resource | Operations | Docs |
|----------|------------|------|
| Agents | CRUD | [AGENT.md](./AGENT.md) |
| Calls | Read-only | [AGENT.md](./AGENT.md#calls-api) |
| Contacts | CRUD | [AGENT.md](./AGENT.md#contacts-api) |
| Campaigns | CRUD + Control | [AGENT.md](./AGENT.md#campaigns-api) |

## Webhook Events

| Event | Description |
|-------|-------------|
| `call.started` | Call initiated |
| `call.completed` | Call ended with transcript |
| `call.failed` | Call failed |
| `appointment.booked` | Agent booked appointment |
| `campaign.enrollment.completed` | Contact finished campaign |

Webhook URL: `https://mentu-proxy.affihub.workers.dev/signals/nutalk`

## Rate Limits

- 1,000 requests/hour
- 100 requests/minute (burst)

## See Also

- [AGENT.md](./AGENT.md) - Complete API reference
- [Nutalk Docs](https://www.nutalk.ai/en/docs/api)
