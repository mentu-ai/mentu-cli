---
title: "Status"
description: "Check workspace health, commitment counts, memory triage state, and ledger throughput."
---

The status endpoint provides a snapshot of workspace health. Use it to monitor commitment progress, memory triage backlog, and overall ledger activity.

**Base URL:** `https://mentu-proxy.affihub.workers.dev`

All requests require the standard [authentication headers](/api/authentication/).

---

## Get Workspace Status

```
GET /status
```

Returns aggregate counts for commitments, memories, and ledger operations. No query parameters are needed.

### Example

```bash
curl -X GET https://mentu-proxy.affihub.workers.dev/status \
  -H "X-Proxy-Token: $MENTU_API_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WORKSPACE_ID"
```

### Response

```json
{
  "success": true,
  "data": {
    "commitments": {
      "open": 12,
      "claimed": 5,
      "in_review": 3,
      "closed": 87,
      "reopened": 2
    },
    "memories": {
      "total": 234,
      "untriaged": 18,
      "dismissed": 45,
      "committed": 67,
      "linked": 104
    },
    "ledger": {
      "total_operations": 1542,
      "last_operation_at": "2025-03-15T14:30:00Z"
    }
  }
}
```

---

## Response Fields

### `commitments`

| Field | Type | Description |
|-------|------|-------------|
| `open` | integer | Commitments waiting to be claimed |
| `claimed` | integer | Commitments currently being worked on |
| `in_review` | integer | Commitments submitted and awaiting approval |
| `closed` | integer | Commitments completed (passed or failed) |
| `reopened` | integer | Previously closed commitments that have been reopened |

### `memories`

| Field | Type | Description |
|-------|------|-------------|
| `total` | integer | Total number of memories in the workspace |
| `untriaged` | integer | Memories that have not been reviewed yet |
| `dismissed` | integer | Memories marked as not requiring action |
| `committed` | integer | Memories that led to a commitment being created |
| `linked` | integer | Memories linked to existing commitments |

### `ledger`

| Field | Type | Description |
|-------|------|-------------|
| `total_operations` | integer | Total number of operations recorded in the ledger |
| `last_operation_at` | string | ISO 8601 timestamp of the most recent operation |

---

## Interpreting Health Metrics

### Triage Backlog

The `memories.untriaged` count represents your triage inbox. A growing untriaged count means observations are being captured faster than they are being reviewed.

- **Healthy:** `untriaged` stays near zero or trends downward.
- **Needs attention:** `untriaged` is growing consistently over time.

### Work Distribution

Compare `commitments.open` against `commitments.claimed` to understand whether work is being picked up.

- **Balanced:** `open` is low relative to `claimed` -- agents are actively working.
- **Bottleneck:** `open` is high while `claimed` is low -- work is piling up and not being claimed.
- **Review bottleneck:** `in_review` is high -- submitted work is not being approved.

### Completion Rate

The `commitments.closed` count represents total completed work. Track it over time to measure team velocity.

### Reopen Rate

A high `commitments.reopened` count relative to `closed` indicates quality issues -- work is being closed prematurely and then reopened.

```
Reopen rate = reopened / (closed + reopened) * 100
```

A reopen rate above 10% warrants investigation.

---

## Throughput Calculation

Use the ledger metrics to calculate operational throughput.

### Operations Per Day

Poll the status endpoint at regular intervals and compute the delta:

```javascript
// Poll at T1 and T2
const opsAtT1 = status1.ledger.total_operations;
const opsAtT2 = status2.ledger.total_operations;
const hoursBetween = (new Date(t2) - new Date(t1)) / (1000 * 60 * 60);

const opsPerHour = (opsAtT2 - opsAtT1) / hoursBetween;
const opsPerDay = opsPerHour * 24;
```

### Activity Recency

The `ledger.last_operation_at` timestamp tells you when the workspace was last active. If this timestamp is stale (e.g., more than a few hours old during a workday), it may indicate that agents or team members have stopped interacting with the system.

---

## Monitoring Example

A simple health check that alerts on potential issues:

```bash
#!/bin/bash
STATUS=$(curl -s https://mentu-proxy.affihub.workers.dev/status \
  -H "X-Proxy-Token: $MENTU_API_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WORKSPACE_ID")

UNTRIAGED=$(echo "$STATUS" | jq '.data.memories.untriaged')
OPEN=$(echo "$STATUS" | jq '.data.commitments.open')
IN_REVIEW=$(echo "$STATUS" | jq '.data.commitments.in_review')

if [ "$UNTRIAGED" -gt 50 ]; then
  echo "WARNING: $UNTRIAGED untriaged memories in backlog"
fi

if [ "$OPEN" -gt 20 ]; then
  echo "WARNING: $OPEN open commitments not yet claimed"
fi

if [ "$IN_REVIEW" -gt 10 ]; then
  echo "WARNING: $IN_REVIEW commitments waiting for review"
fi
```
