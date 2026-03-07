---
title: Triage Commands
description: Commands for organizing and processing memories
order: 3
---

## mentu link

Link a memory or commitment to another commitment.

```bash
mentu link <source_id> <target_id> [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--kind <kind>` | Relationship type (related, duplicate, blocks, depends) |

### Examples

```bash
mentu link mem_abc123 cmt_def456
mentu link cmt_111111 cmt_222222 --kind duplicate
```

## mentu dismiss

Dismiss a memory as not actionable.

```bash
mentu dismiss <mem_id> --reason "<reason>" [options]
```

### Example

```bash
mentu dismiss mem_abc123 --reason "Already resolved in v2.0"
```

## mentu triage

Record a triage session.

```bash
mentu triage --reviewed <ids> --summary "<summary>" [options]
```

### Example

```bash
mentu triage \
  --reviewed mem_001,mem_002,mem_003 \
  --summary "Weekly inbox cleanup"
```

## mentu list

List memories or commitments with filters.

```bash
mentu list <type> [options]
```

### Memory Filters

```bash
mentu list memories --untriaged
mentu list memories --dismissed
mentu list memories --kind task
```

### Commitment Filters

```bash
mentu list commitments --open
mentu list commitments --claimed
mentu list commitments --duplicates
```

### Options

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |
| `--limit <n>` | Limit results |

## Workflow Example

```bash
# 1. See what needs triage
mentu list memories --untriaged

# 2. Link relevant memories to existing commitments
mentu link mem_abc cmt_existing

# 3. Dismiss noise
mentu dismiss mem_noise --reason "Not actionable"

# 4. Record the session
mentu triage --reviewed mem_abc,mem_noise --summary "Morning triage"
```
