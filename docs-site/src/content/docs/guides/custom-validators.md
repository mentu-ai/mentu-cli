---
title: "Custom Validators & Genesis Key"
description: "Configure workspace governance with tiered review, permissions, and classification rules"
---

The Genesis Key is the workspace constitution — a YAML configuration file that defines governance rules, review tiers, permission boundaries, and actor mappings. It controls how commitments flow through the pipeline and who has authority over each transition.

## What Is a Genesis Key

The Genesis Key is an optional configuration file at `.mentu/genesis.key` in your project root. It acts as the constitution for your workspace, defining:

- **Who** can perform which operations
- **How** commitments are classified into review tiers
- **What** evidence is required before closing
- **When** human approval is mandatory vs. optional

Without a Genesis Key, the workspace operates in **permissionless mode** — any actor can perform any operation. This is fine for solo developers or small teams, but teams that need accountability and governance should define a Genesis Key.

## File Location

```
your-project/
  .mentu/
    genesis.key       <-- workspace constitution
    ledger.jsonl      <-- append-only operation log
  src/
  package.json
```

The Genesis Key is checked into version control alongside your code. Changes to governance rules are tracked in git history, providing an audit trail of policy changes.

## YAML Format

The Genesis Key uses YAML with four top-level sections:

```yaml
workspace:
  # Workspace metadata and defaults

permissions:
  # Who can do what

tiers:
  # Review tier configuration

actors:
  # Actor identity mappings

constraints:
  # Operational limits
```

## Tier Configuration

Tiers define the review requirements for commitments based on their complexity or risk.

### Tier 1: Auto-Close

Trivial changes that do not require human review.

```yaml
tiers:
  t1:
    name: "Trivial"
    auto_close: true
    review_required: false
    description: "Typos, config changes, one-line fixes"
```

When a T1 commitment is submitted, it closes automatically. No human needs to review or approve it.

### Tier 2: Auto-Close with Review Window

Standard changes that close automatically but have a grace period for human review.

```yaml
tiers:
  t2:
    name: "Standard"
    auto_close: true
    review_window: "24h"
    description: "Localized bug fixes, 1-3 file changes"
```

T2 commitments close automatically upon submission, but a 24-hour review window opens. During this window, any reviewer can reopen the commitment if they find issues.

### Tier 3: Human Approval Required

Complex or high-risk changes that must be explicitly approved by a human before closing.

```yaml
tiers:
  t3:
    name: "Complex"
    auto_close: false
    review_required: true
    approvers:
      - "human:rashid"
      - "human:maria"
    description: "Multi-file changes, architectural impact"
```

T3 commitments move to `in_review` upon submission and stay there until an authorized approver explicitly closes them.

## Permission Boundaries

Define which actors can perform which operations.

```yaml
permissions:
  claim:
    allow:
      - "agent:*"
      - "human:*"

  submit:
    allow:
      - "agent:*"
      - "human:*"

  close:
    allow:
      - "human:rashid"
      - "human:maria"
    deny:
      - "agent:*"

  dismiss:
    allow:
      - "human:*"
    deny:
      - "agent:*"

  close_direct:
    allow:
      - "human:rashid"
    description: "Skip review, close immediately (emergency only)"
```

### Wildcard Patterns

- `human:*` — matches any human actor
- `agent:*` — matches any agent actor
- `*` — matches all actors

### Permission Resolution

Permissions are evaluated in order:

1. If the actor matches a `deny` rule, the operation is rejected
2. If the actor matches an `allow` rule, the operation is permitted
3. If no rule matches, the operation falls through to the default (deny in governed mode, allow in permissionless mode)

## Actor Mappings

Map external identities to Mentu actors. This is useful for connecting GitHub usernames, CI systems, and other tools to their Mentu identities.

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

When an operation arrives from an external system (e.g., a GitHub webhook), the actor identity is resolved through these mappings before being recorded in the ledger.

## Constraints

Operational limits that prevent runaway behavior.

```yaml
constraints:
  max_open_per_actor: 5
  required_evidence_kinds:
    - "build"
    - "test"
  max_stale_days: 7
  stale_action: "notify"
```

| Constraint | Description |
|-----------|-------------|
| `max_open_per_actor` | Maximum number of open/claimed commitments per actor. Prevents an agent from claiming too many tasks at once. |
| `required_evidence_kinds` | Evidence kinds that must be present before a `submit` or `close` operation is accepted. |
| `max_stale_days` | Number of days a claimed commitment can go without activity before it is considered stale. |
| `stale_action` | What happens when a commitment goes stale: `notify` (alert the actor), `unclaim` (release the commitment), or `dismiss` (discard it). |

## Classification Rules

Define how commitments are automatically classified into tiers based on tags or metadata.

```yaml
tiers:
  classification:
    rules:
      - match:
          tags: ["typo", "config", "docs"]
        assign: "t1"

      - match:
          tags: ["bugfix", "hotfix"]
          files_changed_max: 3
        assign: "t2"

      - match:
          tags: ["refactor", "architecture", "migration"]
        assign: "t3"

    default: "t2"
```

When a commitment is created, the classification rules are evaluated in order. The first matching rule determines the tier. If no rule matches, the `default` tier is assigned.

## Full Example

Here is a complete Genesis Key with all sections:

```yaml
workspace:
  name: "Vendora"
  slug: "vendora-app"
  description: "Governance rules for the Vendora business management platform"

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

  close_direct:
    allow: ["human:rashid"]

  reopen:
    allow: ["human:*"]

tiers:
  t1:
    name: "Trivial"
    auto_close: true
    review_required: false

  t2:
    name: "Standard"
    auto_close: true
    review_window: "24h"

  t3:
    name: "Complex"
    auto_close: false
    review_required: true
    approvers: ["human:rashid", "human:maria"]

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

  defaults:
    unknown_human: "human:anonymous"
    unknown_agent: "agent:unknown"

constraints:
  max_open_per_actor: 5
  required_evidence_kinds: ["build"]
  max_stale_days: 7
  stale_action: "notify"
```

## What Happens Without a Genesis Key

If no `.mentu/genesis.key` file exists, the workspace operates in **permissionless mode**:

- Any actor can perform any operation
- No tier classification is enforced — all commitments are treated equally
- No evidence requirements — commitments can be closed without evidence
- No actor limits — an agent can claim unlimited commitments
- No review flow — `close` works directly without going through `in_review`

Permissionless mode is suitable for:

- Solo developers who do not need governance overhead
- Experimentation and prototyping
- Workspaces where trust is implicit

For production teams, especially those using autonomous agents, a Genesis Key is strongly recommended to maintain accountability and prevent uncontrolled changes.
