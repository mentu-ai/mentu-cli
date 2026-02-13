---
id: AUDIT-GmailCLI-v1.0
type: audit
intent_ref: PRD-GmailCLI-v1.0 (inline)
created: 2026-01-03
auditor: agent:claude-auditor
checkpoint:
  git_sha: 1f62a3343ba36430907878add2a5d8fd21451b4b
  timestamp: 2026-01-03T14:54:46Z
verdict: APPROVE
tier: T2
mentu:
  checkpoint: mem_04d7cbfd
  evidence: mem_84b5e63b
---

# Audit: Minimal Gmail API CLI for Agent-Safe Triage

## Intent Summary

Build a minimal, agent-safe Gmail CLI that provides a stable JSON-first contract for email triage workflows. The CLI prioritizes:

- **Safety**: Read-only default, dry-run for mutations, confirmation thresholds
- **Machine-consumability**: Deterministic JSON envelope, predictable output shapes
- **Portability**: Reusable tool surface for humans and coding agents

**Core Value Proposition:** A portable tool surface that coding agents can drive programmatically with guardrails that prevent accidental data mutation.

## Philosophy Alignment

| Principle | Alignment | Rationale |
|-----------|-----------|-----------|
| **JSON-first contract** | STRONG ALIGN | Machine-consumable outputs for agent workflows |
| **Read-safe by default** | STRONG ALIGN | Guardrails before power |
| **Ledger compatibility** | ALIGNED | Output structure supports intent/target/outcome reconstruction |
| **Predictable surface** | ALIGNED | Small verbs, stable arguments, no implicit side effects |
| **Hub-sovereignty** | NEUTRAL | New standalone repo under projects/ |

**Sacred Rules Check:** No violations. New repo creation, follows Workspaces conventions.

## Technical Feasibility

### Architecture Support: YES (New Repo)

| Aspect | Assessment | Notes |
|--------|------------|-------|
| Location | `projects/gmail-cli/` | Standalone under Workspaces |
| Language | TypeScript | Consistent with mentu-web, mentu-dashboard |
| Package Manager | pnpm | Ecosystem standard |
| Dependencies | googleapis, commander | Standard, well-maintained |

### No Conflicts

- New repository, no existing code to modify
- Clean integration path via Skills/Hooks
- Standalone binary distribution

## Risk Assessment

| Risk Category | Level | Rationale | Mitigation |
|---------------|-------|-----------|------------|
| Scope Creep | Medium | Email clients expand | v1.1 boundary explicit (send/reply) |
| Breaking Changes | Low | New repo | N/A |
| Security | Medium | OAuth tokens | 0600 perms, warning, scope minimization |
| Technical Debt | Low | Clean implementation | TypeScript strict mode |
| Reversibility | High | Standalone | Can delete entirely |

## Effort Estimation

**Tier:** T2 (Feature)

**Rationale:**
- Multiple files (8-12 source files)
- Single repo scope
- Standard patterns (CLI + API client)
- Estimated: hours to 1-2 days

## Verdict

### APPROVE

**Approval Rationale:**

1. Clear problem statement (agent-safe Gmail tooling gap)
2. Appropriate scope (read + label mutation, no send)
3. Strong guardrails (read-only default, dry-run, confirmation)
4. Machine-consumable contract (JSON envelope)
5. Security awareness (token warnings, scope minimization)
6. Clean integration path (standalone repo, Skills/Hooks compatible)

## Audit Conditions

The executor MUST:

1. Implement `--enable-mutations` gate - mutations impossible without explicit flag
2. Implement `--dry-run` for all mutating operations
3. Store credentials with 0600 permissions
4. Display token security warning on first auth
5. Create `.mentu/manifest.yaml` following Workspaces conventions

The executor MUST NOT:

1. Implement send/reply in v1 (explicit v1.1 boundary)
2. Store tokens without proper file permissions
3. Skip confirmation for batch operations above threshold

## Provenance

| Stage | Artifact | ID |
|-------|----------|----|
| Checkpoint | Git SHA | `1f62a3343ba36430907878add2a5d8fd21451b4b` |
| Checkpoint Memory | Mentu | `mem_04d7cbfd` |
| Approval Evidence | Mentu | `mem_84b5e63b` |
| HANDOFF | Document | `HANDOFF-GmailCLI-v1.0.md` |
| PROMPT | Document | `PROMPT-GmailCLI-v1.0.md` |
| Commitment | Pending | See below |

---

*Audited by agent:claude-auditor on 2026-01-03*
