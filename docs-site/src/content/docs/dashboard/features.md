---
title: "Dashboard Features"
description: "Detailed walkthrough of every feature in the Mentu web dashboard"
---

The Mentu dashboard provides a comprehensive set of views and tools for managing your commitment pipeline. This page covers each feature in detail.

## Workspace Dashboard

The landing page after login. Provides a high-level overview of your workspace health:

- **Commitment counts** by state: open, claimed, in_review, closed, dismissed
- **Recent activity** feed showing the latest operations
- **Quick stats** — commitments opened today, average time-to-close, active agents

This view gives you an at-a-glance understanding of pipeline throughput and where attention is needed.

## Commitments View

The primary working view. Displays all commitments in the workspace as a filterable, sortable list.

### Filtering and Search

- Filter by **state**: open, claimed, in_review, closed, dismissed
- Filter by **actor**: see only commitments claimed by a specific agent or human
- Filter by **tags**: narrow down by classification labels
- Full-text **search** across commitment titles and descriptions

### State Badges

Each commitment displays a color-coded badge indicating its current state:

| State | Badge | Meaning |
|-------|-------|---------|
| `open` | Blue | Awaiting someone to claim it |
| `claimed` | Yellow | An actor is actively working on it |
| `in_review` | Purple | Submitted, awaiting approval |
| `closed` | Green | Completed with evidence |
| `dismissed` | Gray | Discarded without completion |

### Detail Page

Click any commitment to open its detail page, which shows:

- The full **state timeline** — every operation that touched this commitment, rendered as a vertical timeline with timestamps and actors
- **Evidence chain** — all evidence items submitted with the commitment (PR links, build logs, test results)
- **Related memories** — any memories referenced by the commitment
- **Action buttons** — contextual actions based on current state

## Commitment Actions

From the detail page (or inline in the list), you can perform state-changing actions. Each action fires a `POST /ops` request to the Mentu API.

| Action | Operation | From State | To State |
|--------|-----------|------------|----------|
| **Approve** | `close` | `in_review` | `closed` |
| **Submit** | `submit` | `claimed` | `in_review` |
| **Reopen** | `reopen` | `closed` / `dismissed` | `open` |
| **Dismiss** | `dismiss` | `open` / `claimed` | `dismissed` |

Actions are only available when they are valid for the commitment's current state. Invalid transitions are disabled in the UI.

## Memories View

Browse and manage all memories captured in the workspace. Memories are context objects — bug reports, decisions, annotations, notes — that inform commitment work.

### Kind Badges

Each memory displays a badge for its kind:

| Kind | Description |
|------|-------------|
| `bug` | Bug report captured by the BugReporter SDK or manually |
| `context` | Background context for a task or project |
| `decision` | An architectural or process decision |
| `note` | General-purpose annotation |

### Annotation Support

Click any memory to view its full content. From the detail view, you can add annotations — follow-up notes that append to the memory without modifying the original capture.

## Ledger View

The raw, chronological operation log. Every operation that has been applied to the workspace appears here in time-descending order.

### Searchable

The ledger is fully searchable. Search by:

- **Operation type** (`commit`, `claim`, `submit`, `close`, `capture`, etc.)
- **Actor** (`human:rashid`, `agent:claude`, etc.)
- **Payload content** (free-text search into operation payloads)

This view is invaluable for debugging and auditing — you can reconstruct the exact sequence of events that led to any state.

## Bridge

The Bridge is the command queue for remote agent execution. It enables asynchronous communication between the dashboard and agents running in development environments.

### Command Queue

Queue commands from the dashboard that agents will pick up and execute:

- View **pending commands** waiting for agent pickup
- See **completed commands** with their results
- Cancel commands that are no longer needed

### Machine Status

The Bridge displays connected machines and their health:

- **Online** — agent is connected and polling for commands
- **Offline** — agent has not checked in recently
- **Busy** — agent is currently executing a command

## Kanban Board

An alternative view for commitment management. Commitments are organized into columns by state:

```
| Open | Claimed | In Review | Closed |
|------|---------|-----------|--------|
| ...  | ...     | ...       | ...    |
```

Drag and drop commitments between columns to trigger state transitions. The board enforces valid transitions — you cannot drag a commitment to an invalid state.

## Settings

Workspace configuration and integrations.

### Actor Mappings

Map external identities to Mentu actors. For example, map a GitHub username to a `human:` actor so that PR events are correctly attributed.

### GitHub Integration

Connect your GitHub repositories to the workspace:

- Automatic commitment creation from GitHub Issues
- PR status synced to commitment evidence
- Label management (`mentu-tracked`, `claude`, `autonomous`)

### Webhook Configuration

Set up outgoing webhooks to notify external systems when operations occur:

- Configure webhook URLs
- Select which operation types trigger the webhook
- View delivery logs and retry failed deliveries

## Real-Time Updates

The dashboard uses Supabase Realtime subscriptions to receive live updates. When any operation arrives in the `operations` table:

1. The subscription fires immediately
2. The relevant view updates without a page refresh
3. State badges, counts, and timelines all reflect the new state

This means multiple team members can watch the same workspace and see changes as they happen — when an agent submits a commitment, the team lead sees it move to `in_review` instantly.
