---
title: "Multi-Workspace Setup"
description: "How to manage multiple Mentu workspaces for team isolation and project separation"
---

Mentu supports multiple workspaces, allowing you to isolate commitment ledgers by team, project, or environment. This guide explains when and how to use multiple workspaces.

## Why Multiple Workspaces

There are several reasons to create separate workspaces:

### Team Isolation

Different teams within an organization may want their own commitment pipelines. A frontend team and a backend team can each have their own workspace with independent commitments, memories, and governance rules.

### Project Separation

If you manage multiple products or codebases, each can have its own workspace. This keeps the ledger focused and prevents cross-project noise.

### Environment Separation

Some teams use separate workspaces for staging and production pipelines, allowing different governance rules (e.g., stricter review requirements for production fixes).

## Creating Workspaces

Workspaces are created in the Mentu dashboard:

1. Open the dashboard at [app.mentu.dev](https://app.mentu.dev)
2. Click the workspace selector in the sidebar
3. Click **New Workspace**
4. Enter a name and slug (the slug is used in configuration files and API calls)
5. Invite team members by email

Each workspace gets its own unique ID (UUID) which you will use in configuration.

## Switching Workspaces in the MCP Server

The MCP server connects to a single workspace at a time, determined by the `MENTU_WORKSPACE_ID` environment variable.

### Global Configuration

Set the workspace in your shell profile or `.env` file:

```bash
export MENTU_WORKSPACE_ID="2e78554d-9d92-4e4a-8866-aa126f25fbe6"
```

### Per-Session Override

Override the workspace for a single session:

```bash
MENTU_WORKSPACE_ID="3314d347-ac52-4458-a7ad-0534acf4a51a" claude
```

## Per-Project Configuration

For the most common setup — different workspaces for different projects — use a `.mentu.json` file in each project root.

### File Format

Create a `.mentu.json` file in your project directory:

```json
{
  "workspace": "2e78554d-9d92-4e4a-8866-aa126f25fbe6",
  "api_url": "https://mentu-proxy.affihub.workers.dev/ops",
  "default_actor": "human:rashid"
}
```

| Field | Description | Required |
|-------|-------------|----------|
| `workspace` | Workspace UUID | Yes |
| `api_url` | Mentu API endpoint | No (uses default) |
| `default_actor` | Actor identity for operations from this project | No |

### How It Works

When the MCP server starts, it looks for `.mentu.json` in the current working directory (and parent directories, walking up to the filesystem root). If found, the `workspace` value takes precedence over the `MENTU_WORKSPACE_ID` environment variable.

This means you can `cd` into different project directories and the MCP server will automatically connect to the correct workspace.

### Example Setup

```
~/projects/
  frontend-app/
    .mentu.json    → workspace: "aaa-bbb-ccc"
    package.json
    src/
  backend-api/
    .mentu.json    → workspace: "ddd-eee-fff"
    package.json
    src/
  shared-lib/
    .mentu.json    → workspace: "aaa-bbb-ccc"  (same as frontend)
    package.json
```

## Cross-Workspace Visibility

Workspace administrators can view commitments across all workspaces they belong to.

### Admin Dashboard

In the dashboard, admins see a **Cross-Workspace** view in the sidebar that aggregates:

- Open commitments across all workspaces
- Recent activity from all workspaces
- Commitments in review from all workspaces

This is useful for engineering leads who oversee multiple teams or projects.

### Workspace Membership

Access is controlled through workspace membership:

| Role | Capabilities |
|------|-------------|
| **Owner** | Full access, can delete workspace, manage members |
| **Admin** | Full access, can manage members |
| **Member** | Can create and claim commitments, view ledger |
| **Viewer** | Read-only access to commitments and ledger |

Members can belong to multiple workspaces simultaneously. The dashboard sidebar shows all workspaces the user has access to, with a quick switcher.

## Best Practices

1. **One workspace per deployable unit** — if it has its own CI/CD pipeline, it should have its own workspace
2. **Use `.mentu.json` in every project** — avoid relying on environment variables for workspace selection
3. **Keep workspace slugs meaningful** — use names like `vendora-app`, `avolumen-api` rather than generic labels
4. **Use consistent actor names** — the same person should use the same actor identity across workspaces (e.g., always `human:rashid`)
5. **Review governance per workspace** — a library with a stable API may need less review overhead than a user-facing application
