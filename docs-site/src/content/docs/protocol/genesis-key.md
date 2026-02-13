---
title: "Genesis Key Specification"
description: "The optional workspace constitution that defines governance, tiers, permissions, and constraints"
---

The Genesis Key is the optional workspace constitution stored at `.mentu/genesis.key`. It defines the governance rules that control how commitments flow through the pipeline — who can do what, what evidence is required, and how review tiers work.

## What It Is

The Genesis Key is a YAML file that acts as the source of truth for workspace governance. It is:

- **Optional** — without it, the workspace runs in permissionless mode
- **Declarative** — defines rules, not procedures
- **Version controlled** — lives in the repository, changes are tracked in git
- **Machine-readable** — agents and tools parse it to enforce governance

## File Location

```
.mentu/genesis.key
```

The file is located in the `.mentu/` directory at the root of your project, alongside the `ledger.jsonl` file.

## YAML Format

The Genesis Key has five top-level sections:

```yaml
workspace:    # Metadata and defaults
permissions:  # Who can do what
tiers:        # Review tier configuration
actors:       # Identity mappings
constraints:  # Operational limits
```

## Sections

### `workspace`

Workspace metadata and default behavior.

```yaml
workspace:
  name: "My Project"
  slug: "my-project"
  description: "Governance rules for the project"
  default_tier: "t2"
```

| Field | Description | Default |
|-------|-------------|---------|
| `name` | Human-readable workspace name | Required |
| `slug` | URL-safe identifier | Required |
| `description` | Purpose of this governance config | Optional |
| `default_tier` | Tier assigned when no classification rule matches | `t2` |

### `permissions`

Defines which actors can perform which operations. Each operation key maps to `allow` and/or `deny` lists.

```yaml
permissions:
  claim:
    allow: ["agent:*", "human:*"]

  submit:
    allow: ["agent:*", "human:*"]

  close:
    allow: ["human:rashid", "human:maria"]
    deny: ["agent:*"]

  dismiss:
    allow: ["human:*"]
    deny: ["agent:*"]

  close_direct:
    allow: ["human:rashid"]

  reopen:
    allow: ["human:*"]
```

#### Permission Resolution Order

1. Check `deny` list — if the actor matches, **reject**
2. Check `allow` list — if the actor matches, **permit**
3. No match — **deny** (in governed mode) or **permit** (in permissionless mode)

#### Wildcard Patterns

- `human:*` — any human actor
- `agent:*` — any agent actor
- `*` — any actor of any type

#### Available Operations

Permissions can be defined for: `commit`, `claim`, `unclaim`, `evidence`, `submit`, `close`, `close_direct`, `reopen`, `dismiss`, `capture`, `annotate`, `triage`, `link`.

### `tiers`

Defines the review tiers and classification rules.

```yaml
tiers:
  t1:
    name: "Trivial"
    auto_close: true
    review_required: false
    description: "Typos, config changes, one-line fixes"

  t2:
    name: "Standard"
    auto_close: true
    review_window: "24h"
    description: "Localized bug fixes, 1-3 file changes"

  t3:
    name: "Complex"
    auto_close: false
    review_required: true
    approvers:
      - "human:rashid"
      - "human:maria"
    description: "Multi-file changes, architectural impact"
```

#### Tier Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Human-readable tier name |
| `auto_close` | boolean | Whether to close automatically upon submission |
| `review_required` | boolean | Whether human approval is needed before close |
| `review_window` | string | Duration string (e.g., `24h`, `7d`) for post-close review |
| `approvers` | string[] | Actor patterns authorized to approve this tier |
| `description` | string | Explanation of what falls into this tier |

#### Tier Behavior Summary

| Tier | On Submit | Review | Close |
|------|-----------|--------|-------|
| T1 | Auto-close immediately | None | Automatic |
| T2 | Auto-close immediately | 24h window to reopen | Automatic, reversible |
| T3 | Move to `in_review` | Required before close | Manual by approver |

### `tiers.classification`

Rules for automatically assigning tiers to new commitments.

```yaml
tiers:
  classification:
    rules:
      - match:
          tags: ["typo", "config", "docs", "style"]
        assign: "t1"

      - match:
          tags: ["bugfix", "hotfix", "test"]
          files_changed_max: 3
        assign: "t2"

      - match:
          tags: ["refactor", "architecture", "migration", "security"]
        assign: "t3"

    default: "t2"
```

#### Match Conditions

| Condition | Type | Description |
|-----------|------|-------------|
| `tags` | string[] | Commitment must have at least one of these tags |
| `files_changed_max` | number | Maximum number of files changed (estimated at commit time) |
| `files_changed_min` | number | Minimum number of files changed |
| `actor` | string | Actor pattern that created the commitment |

Rules are evaluated top-to-bottom. The first matching rule wins. If no rule matches, the `default` tier is assigned.

### `actors`

Maps external identities (GitHub usernames, CI systems) to Mentu actor identities.

```yaml
actors:
  mappings:
    - external: "github:rashid-m"
      mentu: "human:rashid"

    - external: "github:claude-bot[bot]"
      mentu: "agent:claude"

    - external: "ci:github-actions"
      mentu: "agent:ci"

  defaults:
    unknown_human: "human:anonymous"
    unknown_agent: "agent:unknown"
```

#### Mapping Fields

| Field | Description |
|-------|-------------|
| `external` | The identity as it appears in external systems (`{system}:{username}`) |
| `mentu` | The corresponding Mentu actor identity |

#### Defaults

When an operation arrives from an unmapped identity:

| Field | Description |
|-------|-------------|
| `unknown_human` | Actor assigned to unrecognized human identities |
| `unknown_agent` | Actor assigned to unrecognized agent identities |

### `constraints`

Operational limits that prevent runaway or undesired behavior.

```yaml
constraints:
  max_open_per_actor: 5
  required_evidence_kinds:
    - "build"
    - "test"
  max_stale_days: 7
  stale_action: "notify"
```

| Constraint | Type | Description |
|-----------|------|-------------|
| `max_open_per_actor` | number | Maximum open + claimed commitments per actor |
| `required_evidence_kinds` | string[] | Evidence kinds required before `submit` or `close` |
| `max_stale_days` | number | Days without activity before a claimed commitment is stale |
| `stale_action` | string | Action on stale: `notify`, `unclaim`, or `dismiss` |

## Full Example

```yaml
workspace:
  name: "Vendora"
  slug: "vendora-app"
  description: "Governance for the Vendora business management platform"
  default_tier: "t2"

permissions:
  commit:
    allow: ["human:*", "agent:*"]

  claim:
    allow: ["agent:*", "human:*"]

  unclaim:
    allow: ["agent:*", "human:*"]

  evidence:
    allow: ["agent:*", "human:*", "ci:*"]

  submit:
    allow: ["agent:*", "human:*"]

  close:
    allow: ["human:rashid", "human:maria"]
    deny: ["agent:*"]

  close_direct:
    allow: ["human:rashid"]

  dismiss:
    allow: ["human:*"]
    deny: ["agent:*"]

  reopen:
    allow: ["human:*"]

  capture:
    allow: ["*"]

  annotate:
    allow: ["human:*", "agent:*"]

  triage:
    allow: ["human:*", "agent:*"]

  link:
    allow: ["human:*", "agent:*"]

tiers:
  t1:
    name: "Trivial"
    auto_close: true
    review_required: false
    description: "Typos, config changes, one-line fixes, documentation"

  t2:
    name: "Standard"
    auto_close: true
    review_window: "24h"
    description: "Localized bug fixes, small features, 1-3 files"

  t3:
    name: "Complex"
    auto_close: false
    review_required: true
    approvers:
      - "human:rashid"
      - "human:maria"
    description: "Multi-file refactors, architectural changes, security patches"

  classification:
    rules:
      - match:
          tags: ["typo", "config", "docs", "style", "formatting"]
        assign: "t1"

      - match:
          tags: ["bugfix", "hotfix", "test", "small-feature"]
          files_changed_max: 3
        assign: "t2"

      - match:
          tags: ["refactor", "architecture", "migration", "security", "breaking"]
        assign: "t3"

      - match:
          files_changed_min: 10
        assign: "t3"

    default: "t2"

actors:
  mappings:
    - external: "github:rashid-m"
      mentu: "human:rashid"
    - external: "github:maria-dev"
      mentu: "human:maria"
    - external: "github:claude-bot[bot]"
      mentu: "agent:claude"
    - external: "ci:github-actions"
      mentu: "agent:ci"
    - external: "sdk:bug-reporter"
      mentu: "sdk:bug-reporter"

  defaults:
    unknown_human: "human:anonymous"
    unknown_agent: "agent:unknown"

constraints:
  max_open_per_actor: 5
  required_evidence_kinds:
    - "build"
  max_stale_days: 7
  stale_action: "notify"
```

## Validation

The Genesis Key is validated when:

1. **The MCP server starts** — it reads `.mentu/genesis.key` and parses it
2. **An operation is submitted** — permissions and constraints are checked before the operation is appended to the ledger
3. **A commitment is classified** — tier rules are evaluated to assign the appropriate tier

Invalid YAML or unknown fields produce a validation error. The MCP server will refuse to start with a malformed Genesis Key.

## What Happens Without a Genesis Key

If no `.mentu/genesis.key` file exists, the workspace operates in **permissionless mode**:

| Aspect | Behavior |
|--------|----------|
| Permissions | Any actor can perform any operation |
| Tiers | No tier classification; all commitments are equal |
| Evidence | No evidence requirements; close without proof |
| Constraints | No actor limits; unlimited open commitments |
| Review | Direct close is always allowed; no Accountability Airlock |
| Actor mapping | Actors use their raw identity strings |

Permissionless mode is appropriate for:

- **Solo developers** who do not need governance overhead
- **Prototyping and experimentation** where speed matters more than process
- **Trusted small teams** where accountability is implicit

For production teams — especially those deploying autonomous agents — a Genesis Key is strongly recommended to maintain accountability, enforce review gates, and prevent unbounded agent behavior.
