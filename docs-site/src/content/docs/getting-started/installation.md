---
title: Installation
description: How to install Mentu
order: 2
---

## Requirements

- Node.js 18 or higher
- npm, yarn, or pnpm

## Global Installation

Install Mentu globally to use the `mentu` command anywhere:

```bash
npm install -g mentu
```

Verify the installation:

```bash
mentu --version
```

## Project Installation

For project-specific usage, install as a dev dependency:

```bash
npm install --save-dev mentu
```

Then use via npx:

```bash
npx mentu init
npx mentu status
```

## Configuration

After installation, initialize Mentu in your project:

```bash
cd your-project
mentu init
```

This creates the `.mentu/` directory with:
- `ledger.jsonl` - The append-only operation ledger
- `config.yaml` - Local configuration

## Environment Variables

Optional environment variables for remote sync:

| Variable | Description |
|----------|-------------|
| `MENTU_API_URL` | Proxy server URL |
| `MENTU_PROXY_TOKEN` | Authentication token |
| `MENTU_WORKSPACE_ID` | Workspace identifier |
| `MENTU_ACTOR` | Default actor identity |

## Next Steps

- [Quickstart](/knowledge-base/getting-started/quickstart/) - Your first commitment
- [Core Concepts](/knowledge-base/core-concepts/overview/) - Understand the protocol
