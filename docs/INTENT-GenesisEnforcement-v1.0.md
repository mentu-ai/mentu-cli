---
id: INTENT-GenesisEnforcement-v1.0
type: intent
origin: architect
created: 2026-01-02
architect:
  actor: user:rashid
  session: genesis-audit-2026-01-02
  context: Audit findings from Genesis.key formalization review across Mentu ecosystem
---

# Strategic Intent: Genesis.key Enforcement

## What

Enforce the Genesis.key constitutional layer across the Mentu ecosystem, so that agents are actually bound by the permissions and constraints defined in their workspace's constitution. The Dual Triad trust gradient (Architect → Auditor → Executor) must be enforced at runtime, not just documented.

## Why

The Genesis.key audit revealed critical gaps:

1. **mentu-bridge has NO enforcement** — The bridge daemon executes commands without checking genesis.key permissions. An architect agent could bypass its constraints by routing commands through the bridge.

2. **Author type enforcement is advisory** — The `recommend_provenance` constraint is a suggestion, not a block. Executors can operate without provenance validation.

3. **Triage tier rules are disconnected** — The `genesis-matcher.ts` classifier exists but doesn't read from the actual `genesis.key` triage section.

4. **No cross-repo inheritance** — Each repo has its own genesis.key but there's no mechanism for ecosystem-wide policy inheritance.

Without enforcement, the Dual Triad is documentation only. Agents can claim any role, bypass trust gradients, and close commitments without proper authority.

## Constraints

- Must NOT break existing CLI operations
- Must NOT require genesis.key migration (v1.0 schema is stable)
- Must be backward compatible (repos without genesis.key continue working)
- Must NOT add external dependencies to mentu-bridge
- Enforcement should be opt-in per workspace (via `enforcement.strict: true`)
- Must fail closed (deny if genesis.key is malformed)

## Expected Outcome

1. **mentu-bridge enforces genesis.key** — Before executing any command, bridge checks actor permissions and author type constraints
2. **Provenance validation is mandatory** — Executors cannot close without audit trail (`requires_audit: true` actually blocks)
3. **Genesis-matcher reads genesis.key** — Tier classification uses the workspace's triage rules, not hardcoded patterns
4. **Author type violations are blocking** — Operations denied, not warned

Success looks like: "An architect agent tries to close a commitment via bridge. Bridge reads genesis.key, sees architect cannot close, returns 403. The architect must route through an auditor."

## Open Questions

1. Should enforcement be global default or per-workspace opt-in?
2. How do we handle legacy workspaces without genesis.key during transition?
3. Should federation (cross-repo inheritance) be part of this scope or deferred?
4. What's the error response format for genesis violations?

## Audit Trail

This intent originates from the Genesis.key audit conducted 2026-01-02:
- Captured as: `mem_f2c7787a`
- Reviewed: mentu-ai, mentu-bridge, mentu-proxy, mentu-web genesis.key files
- Examined: `src/core/genesis.ts`, `src/triage/genesis-matcher.ts`
