---
title: "Companion App Overview"
description: "macOS menu bar app for ambient pipeline awareness and quick actions"
---

The Mentu Companion is a native macOS menu bar application that provides ambient awareness of your commitment pipeline without requiring you to open the web dashboard.

## What It Is

The Companion lives in your macOS menu bar as a small, color-coded icon. At a glance, you know the health of your pipeline:

- **Green** — all clear, no commitments need attention
- **Yellow** — commitments are in review, awaiting approval
- **Red** — something needs urgent attention (stale commitments, failures)

Click the icon to expand a compact panel with quick actions and recent activity.

## Key Capabilities

### Pipeline Health at a Glance

The menu bar icon color reflects the aggregate state of your workspace. You never need to context-switch to the browser to check if something needs your attention.

### Quick Actions

Perform common operations directly from the menu bar panel without opening the web dashboard:

- **Approve** — close a commitment that is in review
- **Annotate** — add a note to a memory or commitment
- **Dismiss** — discard a commitment that is no longer relevant

Each action fires the corresponding operation to the Mentu API, keeping the ledger consistent whether you act from the Companion or the dashboard.

### Notifications

Receive native macOS notifications when commitments enter the `in_review` state. This is especially useful for team leads who need to know when an agent has submitted work for approval.

Notifications are configurable — you can choose which state transitions trigger alerts and set quiet hours.

### Deep Links to Dashboard

Every item in the Companion panel includes a deep link to its corresponding page in the web dashboard. Click to open the full detail view in your browser when you need more context.

## Design

The Companion is built as a native macOS application following Apple's Liquid Glass design language introduced in macOS 26. It blends seamlessly with the system UI, feeling like a natural extension of your desktop rather than a bolted-on tool.
