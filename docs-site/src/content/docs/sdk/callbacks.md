---
title: "Webhook Callbacks"
description: "Configure webhook callbacks to receive notifications when Mentu commitments change state. Integrate with Slack, CI pipelines, dashboards, and more."
---

When a commitment changes state in the Mentu ledger, Mentu can send a webhook callback to a URL you configure. This enables real-time integrations with external systems like Slack, CI/CD pipelines, monitoring dashboards, and issue trackers.

## How It Works

1. You register one or more webhook URLs in your workspace settings.
2. When a commitment transitions state (e.g., `open` to `claimed`, `claimed` to `closed`), Mentu sends an HTTP POST request to each registered URL.
3. Your endpoint processes the payload and takes whatever action is needed (post a Slack message, trigger a CI build, update a dashboard, etc.).

## Callback Payload

Every webhook callback sends a JSON payload with the following structure:

```json
{
  "event": "commitment.state_changed",
  "timestamp": "2025-01-15T10:35:24.000Z",
  "workspace": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "my-project"
  },
  "commitment": {
    "id": "cmt_x9y8z7w6",
    "memoryId": "mem_a8f3c21d",
    "title": "Login form rejects valid email",
    "previousState": "claimed",
    "currentState": "closed",
    "result": "pass",
    "tier": "T1",
    "evidence": [
      {
        "type": "progress",
        "label": "investigation",
        "payload": {
          "rootCause": "Email regex rejects + in local part",
          "affectedFiles": ["src/lib/validators.ts"]
        },
        "capturedAt": "2025-01-15T10:31:00.000Z"
      },
      {
        "type": "build",
        "payload": {
          "command": "npm run build",
          "exitCode": 0,
          "durationMs": 3200
        },
        "capturedAt": "2025-01-15T10:33:15.000Z"
      },
      {
        "type": "pr",
        "payload": {
          "url": "https://github.com/org/repo/pull/142",
          "number": 142
        },
        "capturedAt": "2025-01-15T10:34:50.000Z"
      }
    ],
    "createdAt": "2025-01-15T10:30:00.000Z",
    "closedAt": "2025-01-15T10:35:24.000Z"
  }
}
```

### Payload Fields

| Field | Type | Description |
|---|---|---|
| `event` | `string` | The event type. Currently always `commitment.state_changed`. |
| `timestamp` | `string` | ISO 8601 timestamp of when the event occurred. |
| `workspace.id` | `string` | Workspace UUID. |
| `workspace.name` | `string` | Workspace display name. |
| `commitment.id` | `string` | Commitment ID. |
| `commitment.memoryId` | `string` | The source memory ID that spawned this commitment. |
| `commitment.title` | `string` | Bug title from the original memory. |
| `commitment.previousState` | `string` | State before the transition: `open`, `claimed`, or `closed`. |
| `commitment.currentState` | `string` | State after the transition. |
| `commitment.result` | `string \| null` | `'pass'`, `'fail'`, or `null` if not yet closed. |
| `commitment.tier` | `string \| null` | Complexity tier: `'T1'`, `'T2'`, `'T3'`, or `null` if not yet estimated. |
| `commitment.evidence` | `array` | All evidence items attached to the commitment at the time of the event. |
| `commitment.createdAt` | `string` | When the commitment was created. |
| `commitment.closedAt` | `string \| null` | When the commitment was closed, or `null` if still open. |

### State Transitions

The following transitions trigger callbacks:

| Transition | Description |
|---|---|
| `open` -> `claimed` | An agent or human has started working on the fix. |
| `claimed` -> `closed` | The fix is complete (either `pass` or `fail`). |
| `open` -> `closed` | The commitment was closed without being claimed (e.g., marked as invalid). |

Evidence additions (`evidence` ops) do not trigger callbacks on their own. They are included in the commitment payload when a state transition occurs.

## Setting Up Webhooks

### Workspace Settings

Configure webhook URLs in your Mentu workspace settings:

1. Navigate to your workspace settings page.
2. Go to the **Webhooks** section.
3. Click **Add Webhook**.
4. Enter the URL that should receive callbacks.
5. Optionally filter by event type or commitment state.
6. Save the webhook.

### Programmatic Registration

You can also register webhooks via the API:

```bash
curl -X POST https://mentu-proxy.affihub.workers.dev/ops \
  -H "Authorization: Bearer your-api-token" \
  -H "Content-Type: application/json" \
  -d '{
    "op": "webhook.register",
    "workspaceId": "your-workspace-id",
    "url": "https://your-app.com/webhooks/mentu",
    "events": ["commitment.state_changed"],
    "secret": "your-webhook-secret"
  }'
```

The `secret` is used to sign payloads (see [Verifying Signatures](#verifying-signatures) below).

## Verifying Signatures

Every webhook request includes an `X-Mentu-Signature` header containing an HMAC-SHA256 signature of the request body, computed using your webhook secret:

```
X-Mentu-Signature: sha256=a1b2c3d4e5f6...
```

Verify the signature in your handler to ensure the request came from Mentu:

```ts
import crypto from 'crypto';

function verifyWebhook(body: string, signature: string, secret: string): boolean {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected),
  );
}

// Express example
app.post('/webhooks/mentu', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-mentu-signature'] as string;
  const body = req.body.toString();

  if (!verifyWebhook(body, signature, process.env.MENTU_WEBHOOK_SECRET!)) {
    return res.status(401).send('Invalid signature');
  }

  const event = JSON.parse(body);
  // Process the event...

  res.status(200).send('OK');
});
```

## Use Cases

### Slack Notifications

Post a message to a Slack channel when a fix is shipped:

```ts
app.post('/webhooks/mentu', async (req, res) => {
  const event = req.body;

  if (
    event.commitment.currentState === 'closed' &&
    event.commitment.result === 'pass'
  ) {
    const pr = event.commitment.evidence.find(e => e.type === 'pr');
    await fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `Bug fixed: *${event.commitment.title}* (${event.commitment.tier})\nPR: ${pr?.payload?.url || 'N/A'}`,
      }),
    });
  }

  res.status(200).send('OK');
});
```

### CI Triggers

Trigger a test suite when a new PR is created by the autopilot:

```ts
app.post('/webhooks/mentu', async (req, res) => {
  const event = req.body;
  const pr = event.commitment.evidence.find(e => e.type === 'pr');

  if (pr && event.commitment.currentState === 'closed') {
    await fetch('https://api.github.com/repos/org/repo/actions/workflows/test.yml/dispatches', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: `pull/${pr.payload.number}/head`,
      }),
    });
  }

  res.status(200).send('OK');
});
```

### Dashboard Updates

Push real-time updates to a monitoring dashboard:

```ts
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

app.post('/webhooks/mentu', (req, res) => {
  const event = req.body;

  // Broadcast to all connected dashboard clients
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({
        type: 'commitment_update',
        commitment: event.commitment,
      }));
    }
  });

  res.status(200).send('OK');
});
```

### Issue Tracker Sync

Close a corresponding issue when a Mentu commitment passes:

```ts
app.post('/webhooks/mentu', async (req, res) => {
  const event = req.body;

  if (
    event.commitment.currentState === 'closed' &&
    event.commitment.result === 'pass'
  ) {
    // Look up the linked issue by memory ID
    const issueNumber = await db.getIssueByMemoryId(event.commitment.memoryId);

    if (issueNumber) {
      await fetch(`https://api.github.com/repos/org/repo/issues/${issueNumber}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          state: 'closed',
          state_reason: 'completed',
        }),
      });
    }
  }

  res.status(200).send('OK');
});
```

## Retry Policy

When a webhook delivery fails (non-2xx response or network error), Mentu retries with exponential backoff:

| Attempt | Delay |
|---|---|
| 1st retry | 30 seconds |
| 2nd retry | 2 minutes |
| 3rd retry | 10 minutes |
| 4th retry | 1 hour |
| 5th retry | 6 hours |

After 5 failed retries, the delivery is marked as failed and no further attempts are made. Failed deliveries are visible in the workspace webhook logs.

### Handling Retries

Your endpoint should be idempotent — processing the same event twice should not cause duplicate side effects. Use the `commitment.id` + `event` + `timestamp` combination as a deduplication key:

```ts
const eventKey = `${event.commitment.id}:${event.event}:${event.timestamp}`;

if (await isAlreadyProcessed(eventKey)) {
  return res.status(200).send('Already processed');
}

// Process the event...
await markAsProcessed(eventKey);
```

### Timeouts

Mentu waits up to **10 seconds** for a response from your webhook endpoint. If your processing takes longer than that, accept the webhook immediately with a `200` response and process it asynchronously:

```ts
app.post('/webhooks/mentu', (req, res) => {
  // Respond immediately
  res.status(200).send('OK');

  // Process asynchronously
  processWebhookEvent(req.body).catch(console.error);
});
```
