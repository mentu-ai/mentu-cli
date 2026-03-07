---
title: CLI Overview
description: Command-line interface reference for Mentu
order: 1
---

## Installation

```bash
npm install -g mentu
```

## Command Groups

### Core Operations

| Command | Description |
|---------|-------------|
| `mentu capture` | Record an observation (creates Memory) |
| `mentu commit` | Create an obligation (creates Commitment) |
| `mentu claim` | Take responsibility for a commitment |
| `mentu release` | Give up responsibility |
| `mentu close` | Resolve with evidence |
| `mentu annotate` | Attach notes to any record |

### Query Operations

| Command | Description |
|---------|-------------|
| `mentu status` | Show current workspace state |
| `mentu log` | Show operation history |
| `mentu show` | Show record details |
| `mentu list` | List memories or commitments |

### Review Operations

| Command | Description |
|---------|-------------|
| `mentu submit` | Request closure review |
| `mentu approve` | Accept submission |
| `mentu reopen` | Reject or dispute |

## Global Flags

All commands support:

- `--json` - Output as JSON (for scripting)
- `--actor <id>` - Override actor identity
- `--help` - Show command help

## Next

- [Core Commands](/knowledge-base/cli-reference/core-commands/)
- [Triage Commands](/knowledge-base/cli-reference/triage-commands/)
