---
id: AUDIT-WorktreeIsolation-v1.0
type: audit
intent_ref: INTENT-WorktreeIsolation-v1.0 (inline)
created: 2026-01-03
auditor: agent:claude-code
mentu:
  evidence: pending
---

# Audit: VibeKanban-Style Worktree Isolation Integration

## Intent Summary

Unify the Mentu commitment lifecycle with per-task git worktree isolation. A commitment becomes an accountable, isolated execution context where:

- One ledger entry = one worktree = one branch = one evidence stream = one merge commit

The five key changes:
1. **CLAIM** creates git worktree + branch, starts diff stream
2. **EXECUTE** captures diffs as evidence memories in real-time
3. **SUBMIT** performs squash merge, crystallizes evidence
4. **APPROVE** pushes to main, cleans up worktree
5. **REOPEN** recreates worktree from existing branch

## Philosophy Alignment

| Principle | Alignment | Rationale |
|-----------|-----------|-----------|
| **evidence-required** | STRONG ALIGN | Diff streaming provides real-time evidence during execution |
| **lineage-preserved** | STRONG ALIGN | Diffs become memories auto-linked to commitments |
| **append-only** | ALIGNED | Diff captures are append operations to ledger |
| **hub-sovereignty** | NEUTRAL | Changes to child repos, not hub governance |
| **manifest-identity** | NEUTRAL | No changes to manifest structure |

**Sacred Rules Check:** No violations identified. Changes extend existing operations rather than replacing them.

## Technical Feasibility

### Architecture Support: YES

The existing codebase has strong extension points:

| Component | Extension Point | Complexity |
|-----------|-----------------|------------|
| `mentu-ai/src/commands/claim.ts` | Line 100, after `appendOperation()` | LOW |
| `mentu-ai/src/commands/submit.ts` | Line 221, after append | LOW |
| `mentu-ai/src/commands/approve.ts` | Line 95, after append | LOW |
| `mentu-ai/src/commands/release.ts` | Line 109, after append | LOW |
| `mentu-ai/src/commands/reopen.ts` | Line 96, after append | MEDIUM |
| `mentu-bridge/src/daemon.ts` | Lines 345-350 (pre-spawn), 417-432 (post-result) | MEDIUM |

### Critical Finding

**`mentu-ai/src/commands/parallel.ts` already implements worktree creation!**

```typescript
// Existing code in parallel.ts
execSync(`git worktree add "${worktreePath}" -b "${branch}" 2>&1`);
const mentuSrc = path.join(process.cwd(), '.mentu');
const mentuDst = path.join(worktreePath, '.mentu');
execSync(`cp -r "${mentuSrc}" "${mentuDst}"`);
```

This is not greenfield - it's a refactoring of existing functionality into core operations.

### Affected Components

1. **mentu-ai** (core ledger)
   - New: `src/utils/worktree.ts`
   - Modified: `src/commands/{claim,submit,approve,release,reopen}.ts`
   - Refactored: `src/commands/parallel.ts` (extract to utils)

2. **mentu-bridge** (daemon)
   - Modified: `src/daemon.ts` (lifecycle hooks)
   - New: worktree env injection

3. **mentu-dashboard** (visualization)
   - New: Diff viewer component
   - Integration with evidence display

### Existing Patterns

- **Metadata storage**: Operations already support `meta?: Record<string, unknown>`
- **External refs**: Annotate operations with `meta.kind === 'external_ref'`
- **Worktree pattern**: Same approach - `meta.kind === 'worktree_info'`

### Dependencies

- Node.js `child_process` for git commands (already used)
- Git CLI available on execution machines (already required)
- No new external dependencies

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| **Scope Creep** | LOW | Intent is bounded: 5 operations + bridge integration |
| **Breaking Changes** | LOW | Worktrees are opt-in via meta flag initially |
| **Security** | LOW | Inherits existing genesis.key validation |
| **Technical Debt** | MEDIUM | Refactor parallel.ts to core, create utils/worktree.ts |
| **Reversibility** | HIGH | Worktrees ephemeral, branches preserved, ledger append-only |
| **Disk Space** | MEDIUM | Add auto_cleanup flag, worktree pruning |
| **Race Conditions** | LOW | Per-path mutex locks (VibeKanban pattern) |

## Effort Estimate

- **Tier**: T3 (Multi-part, cross-cutting)
- **Rationale**:
  - Affects 3 repositories
  - Cross-cutting architectural change
  - Introduces new core primitive
  - Estimated 20-25 hours implementation

### Phase Breakdown

| Phase | Deliverables | Estimate |
|-------|--------------|----------|
| Phase 1: Core Utils | `utils/worktree.ts` | 2-3 hours |
| Phase 2: Operation Hooks | Extend 5 operations | 4-6 hours |
| Phase 3: Bridge Integration | Daemon lifecycle hooks | 3-4 hours |
| Phase 4: Diff Streaming | Evidence capture from diffs | 4-6 hours |
| Phase 5: Dashboard | Diff viewer component | 3-4 hours |
| Phase 6: Registry | Capability documentation | 1-2 hours |

## Verdict

**APPROVE**

## Rationale

1. **Strong philosophy alignment**: Intent directly supports "evidence-required" and "lineage-preserved" principles
2. **Proven pattern**: VibeKanban has validated this architecture in production
3. **Existing foundation**: `parallel.ts` already implements core worktree logic
4. **Clean extension points**: All affected operations have clear insertion points
5. **Low breaking change risk**: Worktrees are opt-in, ledger format unchanged
6. **High value**: Enables parallel agent execution at scale with zero collision

## Conditions

1. Worktree behavior MUST be opt-in initially (via `meta.worktree.enabled`)
2. Existing `parallel.ts` logic MUST be refactored to `utils/worktree.ts`, not duplicated
3. Worktree metadata MUST use the annotate pattern (`meta.kind === 'worktree_info'`)
4. Dashboard integration SHOULD be phased after CLI/bridge work is stable
5. Registry documentation MUST be updated before merge

## Implementation Approach

**The Unified Model**: A commitment is not five things mapped together, but one thing with five facets:
- Ledger entry (accountability)
- Git worktree (isolation)
- Git branch (history)
- Evidence stream (observability)
- Merge target (completion)

When `claim` is called on a commitment with `meta.worktree.enabled === true`:
1. Create branch `mentu/{cmt_id}`
2. Create worktree at `{repo}-wt-{cmt_id_suffix}/`
3. Copy `.mentu/` state
4. Annotate commitment with worktree metadata
5. Start diff monitoring (filesystem watcher or polling)

When `submit`/`approve`/`release` is called:
1. Capture final diff as evidence
2. Cleanup worktree directory
3. Preserve branch for history

When `reopen` is called:
1. Recreate worktree from existing branch
2. Resume work where it left off

---

*Audit completed by agent:claude-code acting as auditor*
*2026-01-03*
