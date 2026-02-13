---
id: ROADMAP-Workspace-Meta-Layer
path: docs/roadmaps/ROADMAP-Workspace-Meta-Layer.md
type: roadmap
intent: reference
version: "1.0"
created: 2026-01-01
last_updated: 2026-01-01
parent: PRD-Workspace-Meta-Layer-v1.0
---

# Roadmap: Workspace Meta-Layer

## Vision

Transform the Mentu ecosystem from a collection of repositories into a self-describing, agent-navigable workspace where capabilities can be discovered, understood, and invoked without human guidance.

---

## Version Timeline

| Version | Name | Scope | Status | Trigger |
|---------|------|-------|--------|---------|
| **v1.0** | Manifest Initialization | Create `.mentu/manifest.yaml` in all repos | **In Progress** | Now |
| v1.1 | Capability Registry | Central index of all capabilities | Planned | After v1.0 validates |
| v1.2 | Cross-Repo Governance | Genesis keys for repos that need them | Planned | After patterns emerge |
| v1.3 | Agent Routing | Auto-discover and invoke capabilities | Planned | After registry stable |

---

## v1.0: Manifest Initialization

**Status**: In Progress
**Commitment**: `cmt_f651bd85`
**Actor**: `agent:claude-meta-layer`

### Goals

1. Create draft manifests for all ecosystem repositories
2. Document canonical manifest schema
3. Stage manifests for human review
4. Establish protected zone policy for existing .mentu folders

### Deliverables

| Deliverable | Location | Status |
|-------------|----------|--------|
| PRD | `docs/prds/PRD-Workspace-Meta-Layer-v1.0.md` | Done |
| Roadmap | `docs/roadmaps/ROADMAP-Workspace-Meta-Layer.md` | Done |
| mentu-bridge manifest draft | `docs/drafts/manifest-mentu-bridge.yaml` | Pending |
| mentu-proxy manifest draft | `docs/drafts/manifest-mentu-proxy.yaml` | Pending |
| mentu-web manifest draft | `docs/drafts/manifest-mentu-web.yaml` | Pending |
| claude-code manifest draft | `docs/drafts/manifest-claude-code.yaml` | Pending |
| CLAUDE.md update proposal | `docs/drafts/CLAUDE-workspaces-update.md` | Pending |

### Acceptance Criteria

- [ ] All 4 draft manifests created with accurate capability discovery
- [ ] Manifest schema documented and consistent with mentu-ai
- [ ] Human reviews and approves manifests before deployment
- [ ] No existing .mentu folders modified

### Deployment Steps (Post-Approval)

```bash
# For each repository (after human approval):
mkdir -p <repo>/.mentu
cp docs/drafts/manifest-<repo>.yaml <repo>/.mentu/manifest.yaml
```

---

## v1.1: Capability Registry (Planned)

**Status**: Not Started
**Trigger**: v1.0 proves useful in agent operations

### Goals

1. Create central registry indexing all capabilities across repos
2. Enable capability search by name, type, or description
3. Support cross-repo capability lookup

### Proposed Deliverables

| Deliverable | Purpose |
|-------------|---------|
| `Workspaces/.mentu/registry.yaml` | Aggregated capability index |
| `mentu registry` command | Query capabilities across repos |
| `mentu discover <repo>` command | Discover capabilities in a repo |

### Design Questions

- Should registry be generated or hand-maintained?
- How to handle capability versioning?
- Should registry live at Workspaces root or in mentu-ai?

### Success Criteria

- Agent can find "send email" capability without knowing which repo has it
- Registry stays in sync with individual manifests

---

## v1.2: Cross-Repo Governance (Planned)

**Status**: Not Started
**Trigger**: After patterns emerge from v1.0/v1.1 usage

### Goals

1. Determine which repositories need genesis.key governance
2. Establish signing/verification patterns for cross-repo operations
3. Define actor permission boundaries

### Proposed Deliverables

| Deliverable | Purpose |
|-------------|---------|
| Governance policy document | When to use genesis.key |
| Genesis key templates | Standard key structures |
| Cross-repo permission schema | Actor capability boundaries |

### Design Questions

- Which repos need independent governance vs inheriting from mentu-ai?
- How do genesis keys compose across repos?
- What operations require cross-repo authorization?

### Decision: Defer Until Patterns Emerge

Not enough operational data yet. Will revisit after 30 days of v1.0/v1.1 usage.

---

## v1.3: Agent Routing (Planned)

**Status**: Not Started
**Trigger**: After capability registry is stable

### Goals

1. Enable automatic capability invocation across repos
2. Build routing layer that maps intent to capability
3. Support capability composition (chaining)

### Proposed Deliverables

| Deliverable | Purpose |
|-------------|---------|
| `mentu invoke <capability>` | Cross-repo capability invocation |
| Routing configuration | Map intents to capabilities |
| Capability chaining spec | How to compose capabilities |

### Design Questions

- How to handle cross-repo authentication?
- How to manage capability dependencies?
- What's the error handling strategy for chained operations?

---

## Known Gaps

| Gap | Impact | Mitigation |
|-----|--------|------------|
| No ledger in new repos | Commits not tracked per-repo | Use mentu-ai ledger for all tracking |
| No genesis keys | No independent governance | Inherit governance from mentu-ai |
| Manual manifest updates | Drift from reality | Add manifest validation to CI |
| No capability versioning | Breaking changes unclear | Document versioning in v1.1 |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-01 | Stage manifests in docs/drafts/ | Sacred rule: never touch existing .mentu |
| 2026-01-01 | Skip ledger/genesis in v1.0 | Minimal viable identity first |
| 2026-01-01 | Capability discovery from source | Accuracy over speed |
| 2026-01-01 | Human review before deployment | Protection against agent errors |

---

## No Decisions (Explicit Rejections)

| Proposal | Rejection Reason |
|----------|------------------|
| Auto-create .mentu on agent entry | Too risky for existing repos |
| Centralized manifest storage | Violates per-repo identity principle |
| Skip human review for drafts | Insufficient trust in automated discovery |
| Include ledger.jsonl in v1.0 | Scope creep - focus on identity only |

---

## Evolution Principles

1. **Minimal First**: Start with manifest only, add complexity as needed
2. **Human Gate**: All .mentu modifications require human approval
3. **Discovery Over Assumption**: Analyze source code, don't guess
4. **Protected Existing**: Never modify working .mentu folders
5. **Staged Rollout**: Draft → Review → Deploy workflow

---

## Metrics (Future)

Once deployed, track:
- Agent manifest read frequency
- Capability lookup patterns
- Cross-repo operation success rate
- Manifest freshness (last updated vs repo changes)

---

*This roadmap will evolve as the meta-layer proves its value. Regular review every 30 days.*
