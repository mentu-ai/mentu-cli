---
id: PRD-Workspace-Meta-Layer-v1.0
path: docs/prds/PRD-Workspace-Meta-Layer-v1.0.md
type: prd
intent: reference
version: "1.0"
created: 2026-01-01
last_updated: 2026-01-01
tier: T2
children:
  - HANDOFF-Workspace-Meta-Layer-v1.0
dependencies:
  - Workspaces/CLAUDE.md
  - mentu-ai/.mentu/manifest.yaml
mentu:
  commitment: cmt_f651bd85
  status: claimed
---

# PRD: Workspace Meta-Layer v1.0

## Mission

Establish a unified identity and capability discovery system across all Mentu ecosystem repositories by creating standardized `.mentu/manifest.yaml` files that enable agents to understand what each repository does, what capabilities it exposes, and how it relates to other repositories.

---

## Problem Statement

### Current State

```
Workspaces/
├── mentu-ai/
│   └── .mentu/           ✅ Has identity (manifest, ledger, genesis)
├── mentu-bridge/         ❌ No .mentu - agents enter blind
├── mentu-proxy/          ❌ No .mentu - agents enter blind
├── mentu-web/            ❌ No .mentu - agents enter blind
├── claude-code/          ❌ No .mentu - agents enter blind
└── projects/             ❌ No .mentu - agents enter blind
```

When an agent enters `mentu-bridge`, it has no machine-readable way to know:
- This is a Mac daemon that executes commands
- It depends on mentu-ai for API access
- It consumes mentu-proxy as a gateway
- It can spawn Claude agents, poll commitments, and capture evidence

Agents must read source code, package.json, and scattered documentation to understand context. This is inefficient and error-prone.

### Desired State

```
Workspaces/
├── CLAUDE.md             ✅ Root governance (exists)
├── mentu-ai/
│   └── .mentu/           ✅ Existing (PROTECTED)
├── mentu-bridge/
│   └── .mentu/
│       └── manifest.yaml ✅ Daemon identity + capabilities
├── mentu-proxy/
│   └── .mentu/
│       └── manifest.yaml ✅ Gateway identity + capabilities
├── mentu-web/
│   └── .mentu/
│       └── manifest.yaml ✅ Dashboard identity + capabilities
└── claude-code/
    └── .mentu/
        └── manifest.yaml ✅ Tooling identity + capabilities
```

Agents entering any repository can read `.mentu/manifest.yaml` to instantly understand:
- Repository purpose and version
- Runtime requirements
- Exposed capabilities (with command syntax)
- Dependencies on other repos
- Default actor identity

---

## Core Concepts

### Manifest

A YAML document at `.mentu/manifest.yaml` declaring repository identity. Following the canonical structure from `mentu-ai/.mentu/manifest.yaml`:

```yaml
name: repository-name
description: What this repository does
version: "X.Y.Z"

requires:
  - runtime dependency

capabilities:
  - name: capability-name
    description: What it does
    command: how to invoke it
    inputs: {...}
    outputs: {...}

dependencies:
  - name: other-repo
    relationship: api-client|schema-consumer|gateway-consumer

mentu:
  actor: agent:name
  auto_capture: boolean
```

### Capability

A discrete operation a repository can perform. Capabilities are machine-readable, enabling future auto-discovery and routing:

| Field | Purpose |
|-------|---------|
| `name` | Unique identifier within repo |
| `description` | Human-readable explanation |
| `command` | Invocation syntax (CLI, HTTP endpoint, file path) |
| `inputs` | Expected parameters (optional) |
| `outputs` | Expected results (optional) |

### Dependency Relationship

How one repository relates to another:

| Relationship | Meaning |
|--------------|---------|
| `api-client` | Consumes REST/GraphQL API |
| `schema-consumer` | Uses database schema |
| `gateway-consumer` | Routes through proxy |
| `tooling-provider` | Provides utilities/tools |

---

## Specification

### Manifest Schema

```yaml
# REQUIRED
name: string              # Must match directory name
description: string       # One-line purpose
version: string           # Semantic version from package.json

# OPTIONAL
requires:                 # Runtime dependencies
  - string

capabilities:             # What this repo can do
  - name: string          # Unique within repo
    description: string   # What it does
    command: string       # How to invoke
    inputs:               # Optional: parameter spec
      {name}:
        type: string
        required: boolean
        description: string
    outputs:              # Optional: result spec
      {name}:
        type: string
        description: string

dependencies:             # Other repos in ecosystem
  - name: string          # Repository name
    relationship: string  # api-client, schema-consumer, etc.

mentu:                    # Mentu integration
  actor: string           # Default actor identity
  auto_capture: boolean   # Auto-capture on operations
```

### Validation Rules

- `name` MUST match the repository directory name
- `version` MUST be a valid semantic version string
- `capabilities` SHOULD contain at least one entry for non-archive repos
- `dependencies.name` MUST reference a valid repository in Workspaces
- `mentu.actor` SHOULD follow the `{type}:{name}` pattern

### Discovery Protocol

When an agent enters a repository:

```
1. Check for .mentu/manifest.yaml
2. IF exists: parse and understand context
3. IF not exists: operate without context (or request initialization)
```

---

## Implementation

### Deliverables

| File | Purpose |
|------|---------|
| `docs/prds/PRD-Workspace-Meta-Layer-v1.0.md` | This specification |
| `docs/roadmaps/ROADMAP-Workspace-Meta-Layer.md` | Versioned evolution pathway |
| `docs/drafts/manifest-mentu-bridge.yaml` | Draft manifest for human review |
| `docs/drafts/manifest-mentu-proxy.yaml` | Draft manifest for human review |
| `docs/drafts/manifest-mentu-web.yaml` | Draft manifest for human review |
| `docs/drafts/manifest-claude-code.yaml` | Draft manifest for human review |
| `docs/drafts/CLAUDE-workspaces-update.md` | Proposed additions to root CLAUDE.md |

### Build Order

1. **Discovery**: Analyze each repository's package.json, source code, and documentation
2. **Draft Manifests**: Create manifest.yaml drafts based on discovered capabilities
3. **PRD + Roadmap**: Document the specification and evolution pathway
4. **Human Review**: Drafts staged for human approval before .mentu creation

### Repository Capability Summary

#### mentu-bridge (v1.0.0)

**Purpose**: Terminal bridge daemon for Mentu - executes commands from cloud

**Discovered Capabilities**:
- `start-daemon`: Start the bridge daemon polling for commands
- `execute-command`: Execute spawned agent commands locally
- `capture-memory`: Capture Mentu memories for task tracking
- `poll-commitments`: Poll and execute due commitments on schedule

**Dependencies**:
- mentu-ai (api-client via proxy)
- mentu-proxy (gateway-consumer)

#### mentu-proxy (v1.0.0)

**Purpose**: Cloudflare Worker proxy for Mentu API - secure mobile access

**Discovered Capabilities**:
- `route-ops`: Forward ledger operations to Mentu API
- `bridge-commands`: Accept and store commands for Mac execution
- `signal-ingestion`: Accept GitHub webhooks, transform to memories
- `health-check`: Return service health status

**Dependencies**:
- mentu-ai (schema-consumer via Supabase)

#### mentu-web (v0.1.0)

**Purpose**: Next.js dashboard for commitment visualization and management

**Discovered Capabilities**:
- `view-commitments`: Display commitment list and details
- `view-memories`: Display memory timeline
- `view-ledger`: Display operation history
- `view-bridge`: Display bridge command history
- `manage-settings`: Configure actors, GitHub, webhooks

**Dependencies**:
- mentu-ai (api-client)
- mentu-proxy (gateway-consumer)

#### claude-code (v1.0.0)

**Purpose**: Claude Code coordination repository for Mentu operations and remote agent execution

**Discovered Capabilities**:
- `capture-memory`: Shell tool to capture memories via proxy
- `create-commitment`: Shell tool to create commitments
- `claim-commitment`: Shell tool to claim commitments
- `close-commitment`: Shell tool to close with evidence
- `send-command`: Shell tool to dispatch bridge commands
- `discover`: Discover repository capabilities
- `invoke`: Invoke discovered capabilities

**Dependencies**: None (standalone tooling)

---

## Constraints

- **MUST NOT** modify existing `.mentu/` folders
- **MUST NOT** create `.mentu/` directly - all manifests go to `docs/drafts/`
- **MUST** preserve exact structure of mentu-ai manifest
- **MUST** use capability discovery from actual source code, not assumptions
- **MUST** stage all manifests for human review before deployment

---

## Success Criteria

### Functional

- [ ] PRD document created at `docs/prds/PRD-Workspace-Meta-Layer-v1.0.md`
- [ ] Roadmap created at `docs/roadmaps/ROADMAP-Workspace-Meta-Layer.md`
- [ ] Draft manifest for mentu-bridge created
- [ ] Draft manifest for mentu-proxy created
- [ ] Draft manifest for mentu-web created
- [ ] Draft manifest for claude-code created
- [ ] CLAUDE.md update proposal created

### Quality

- [ ] All manifests follow canonical schema from mentu-ai
- [ ] All capabilities accurately reflect actual repository functionality
- [ ] All dependencies correctly mapped
- [ ] Version numbers match package.json

### Process

- [ ] Mentu commitment created and claimed
- [ ] Evidence captured for all deliverables
- [ ] Commitment submitted for review

---

## Verification Commands

```bash
# Verify PRD exists
cat docs/prds/PRD-Workspace-Meta-Layer-v1.0.md

# Verify roadmap exists
cat docs/roadmaps/ROADMAP-Workspace-Meta-Layer.md

# Verify drafts exist
ls docs/drafts/manifest-*.yaml
cat docs/drafts/CLAUDE-workspaces-update.md

# Verify mentu state
mentu status
```

---

## References

- `Workspaces/CLAUDE.md`: Root governance document with sacred rules
- `mentu-ai/.mentu/manifest.yaml`: Canonical manifest structure
- `mentu-ai/.claude/commands/craft.md`: Document chain protocol

---

*This PRD establishes the meta-layer specification that enables agents to discover and understand the Mentu ecosystem through standardized manifests.*
