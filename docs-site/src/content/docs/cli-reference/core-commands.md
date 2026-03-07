---
title: Core Commands
description: Essential Mentu CLI commands
order: 2
---

## mentu init

Initialize a Mentu workspace in the current directory.

```bash
mentu init
```

Creates `.mentu/` directory with `ledger.jsonl` and `config.yaml`.

## mentu capture

Record an observation.

```bash
mentu capture "<body>" [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--kind <kind>` | Memory kind (observation, evidence, task, bug, idea) |
| `--actor <id>` | Override actor identity |
| `--refs <ids>` | Reference other memories or commitments |

### Examples

```bash
mentu capture "Found bug in login flow"
mentu capture "All tests passing" --kind evidence
mentu capture "User auth feature" --kind task
```

## mentu commit

Create a commitment.

```bash
mentu commit "<body>" --source <mem_id> [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--source <id>` | **Required.** Source memory ID |
| `--actor <id>` | Override actor identity |

### Example

```bash
mentu commit "Fix login bug" --source mem_abc123
```

## mentu claim

Take responsibility for a commitment.

```bash
mentu claim <cmt_id> [options]
```

### Example

```bash
mentu claim cmt_def456
```

## mentu release

Give up responsibility for a commitment.

```bash
mentu release <cmt_id> [options]
```

### Example

```bash
mentu release cmt_def456
```

## mentu close

Close a commitment with evidence.

```bash
mentu close <cmt_id> --evidence <mem_id> [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--evidence <id>` | Evidence memory ID |
| `--duplicate-of <id>` | Close as duplicate of another commitment |

### Examples

```bash
mentu close cmt_def456 --evidence mem_xyz789
mentu close cmt_def456 --duplicate-of cmt_abc123
```

## mentu annotate

Attach notes to any record.

```bash
mentu annotate <id> "<body>" [options]
```

### Example

```bash
mentu annotate cmt_def456 "Blocked on API access"
```

## mentu status

Show current workspace state.

```bash
mentu status [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--all` | Show all commitments |
| `--json` | Output as JSON |

## mentu show

Show details for a specific record.

```bash
mentu show <id> [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--links` | Show linked memories |
| `--duplicates` | Show duplicate commitments |

## mentu log

Show operation history.

```bash
mentu log [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--limit <n>` | Limit output to n entries |
| `--json` | Output as JSON |
