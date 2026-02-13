---
title: "Dashboard Overview"
description: "Real-time web dashboard for visualizing the Mentu commitment ledger"
---

The Mentu Dashboard is a real-time web application for visualizing and managing the commitment ledger. It provides workspace-scoped views into every commitment, memory, and operation flowing through your Mentu pipeline.

**URL:** [app.mentu.dev](https://app.mentu.dev)

## What It Is

The dashboard is the primary human interface to the Mentu commitment ledger. While agents interact with Mentu through the MCP server and CLI, the dashboard gives developers and team leads a visual, interactive way to:

- Monitor commitment lifecycle in real time
- Review and approve agent-submitted work
- Browse the full operation history (ledger)
- Manage memories (bug reports, annotations, context)
- Issue commands to remote agents via the Bridge

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| UI | React 18 + Tailwind CSS + shadcn/ui |
| Backend | Supabase (PostgreSQL + Realtime + Auth) |
| Deployment | Vercel |

## Core Views

### Commitments
The primary view. Shows all commitments in the workspace with state badges (`open`, `claimed`, `in_review`, `closed`, `dismissed`). Click any commitment to see its full timeline — every operation that touched it, with timestamps and actors.

### Memories
Browse captured memories (bug reports, context, decisions). Filter by kind (`bug`, `context`, `decision`, `note`). Annotate memories to add follow-up context.

### Ledger
The raw operation log, displayed chronologically. Every `commit`, `claim`, `submit`, `close`, `capture`, and other operation appears here. Fully searchable.

### Bridge
The command queue for remote agent execution. See which machines are connected, queue commands, and monitor execution status.

### Settings
Workspace configuration: actor mappings, GitHub integration, webhook endpoints.

## Key Features

- **Workspace-scoped views** — each workspace is isolated; switch between workspaces from the sidebar
- **Real-time updates** — Supabase subscriptions push new operations to the UI as they arrive, no polling required
- **Kanban board** — drag-and-drop commitment management organized by state columns
- **Agent chat interface** — communicate with agents directly from the dashboard
- **State timeline** — every commitment detail page shows the full operation history as a visual timeline

## Authentication

The dashboard uses Supabase Auth with two sign-in methods:

- **Email / Password** — standard credential-based login
- **GitHub OAuth** — sign in with your GitHub account for seamless integration

Workspace access is controlled through the `workspace_members` table. Users can only see workspaces they belong to.
