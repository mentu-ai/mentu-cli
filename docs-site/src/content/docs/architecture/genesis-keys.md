---
title: Genesis Keys
description: Workspace governance configuration
order: 3
---

## What is a Genesis Key?

A genesis key is an optional YAML file that defines governance rules for a Mentu workspace.

```
.mentu/genesis.key
```

## Purpose

Genesis keys establish:
- Workspace identity
- Permission boundaries
- Operational constraints
- Actor policies

## Schema

```yaml
# Genesis Key v1.0
version: "1.0"

# Workspace identity
workspace:
  id: ws_mentu_core
  name: Mentu Core Development
  owner: user:rashid

# Permission boundaries
permissions:
  # Who can claim commitments
  claim:
    - user:*
    - agent:claude-*

  # Who can approve
  approve:
    - user:rashid
    - user:admin

  # Who can close without review
  close_direct:
    - user:rashid

# Tier policies
tiers:
  tier_1:
    auto_approve: true
    validators: []

  tier_2:
    auto_approve: false
    validators:
      - technical

  tier_3:
    auto_approve: false
    validators:
      - technical
      - safety
      - intent

# Actor mappings
actors:
  github:renovate:
    maps_to: agent:renovate-bot
    permissions:
      - claim
      - submit

# Constraints
constraints:
  max_open_per_actor: 10
  require_evidence_kind: true
  allowed_evidence_kinds:
    - evidence
    - test-result
    - deployment-log
```

## Sections

### workspace

Identifies the workspace.

| Field | Description |
|-------|-------------|
| `id` | Unique workspace identifier |
| `name` | Human-readable name |
| `owner` | Primary owner actor |

### permissions

Defines who can perform operations.

| Permission | Description |
|------------|-------------|
| `claim` | Who can claim commitments |
| `approve` | Who can approve submissions |
| `close_direct` | Who can close without review |

Patterns:
- `user:*` - Any user
- `agent:claude-*` - Any Claude agent
- `user:rashid` - Specific user

### tiers

Defines validation requirements per tier.

| Tier | Typical Use |
|------|-------------|
| `tier_1` | Small, low-risk changes |
| `tier_2` | Standard changes |
| `tier_3` | Major, high-risk changes |

### actors

Maps external identities to Mentu actors.

### constraints

Operational limits and requirements.

## Validation

The CLI validates operations against the genesis key:

```bash
mentu claim cmt_xxx
# Checks: Is current actor in permissions.claim?
```

## Optional

Genesis keys are optional. Without one:
- All operations allowed
- No tier validation
- No actor restrictions
