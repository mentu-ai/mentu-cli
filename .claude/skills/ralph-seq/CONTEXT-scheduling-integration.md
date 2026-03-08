# CONTEXT -- Scheduling Integration (CronCreate + Mentu Dashboard)

## Date
2026-03-07

## What Was Incorporated

This context module documents what was added to the ralph-seq skill and what external systems were analyzed to inform the design.

### Changes Made

| File | Change | Lines Added |
|------|--------|-------------|
| `SKILL.md` | "Monitoring & Scheduling" section after Troubleshooting | ~70 |
| `SKILL.md` | Step 5 output updated with `/loop` babysit + schedule examples | 6 |
| `reference.md` | "Scheduling Integration" section after CLI Reference | ~70 |

### Deployed To

| Workspace | Status |
|-----------|--------|
| Subtrace (source) | Committed |
| mentu-runtime | Synced |
| Crawlio-app | Synced |
| crawlio-agent | Synced (was already current) |
| ghidra-reconstructed | Synced |
| mentu-interceptor | Synced (no remote) |
| mentu-ane | Synced (no remote) |
| mentu-workspace-factory | Synced (template, no remote) |

---

## External Systems Analyzed (Read-Only Recon)

### mentu-web (not on this machine)

Source: `HANDOFF-ProtocolNativeSequences-v1.0.md` in Subtrace + plan recon notes.

**Commitment temporal fields** (defined in `mentu-web/src/lib/mentu/types.ts:156-178`):

```typescript
scheduled_start_at?: string    // ISO datetime — when sequence should begin
duration_estimate?: string     // estimated duration
depends_on?: string[]          // commitment IDs that must close first
execution_window?: {
  start: string                // earliest allowed start
  end: string                  // latest allowed start
  days?: string[]              // allowed days of week
}
late_policy?: 'skip' | 'execute_immediately' | 'reschedule'
trigger_source?: 'manual' | 'template' | 'calendar' | 'api'
```

These fields exist on the `Commitment` type but are **not yet surfaced in the UI**.

**Panorama `ActiveSequencesPanel`** (`active-sequences-panel.tsx`):
- Currently shows "Running Now" sequences
- Reads from `workflow_instances` cache
- Needs a companion "Scheduled" section (pending state + `scheduled_start_at` in future)

**`workflow_instances` states**: `pending | running | completed | failed | cancelled`
- `pending` is the natural fit for "scheduled but not yet running"
- State is computed from child commitment states, never stored directly

**Sequences list page** (`sequences-list-page.tsx`):
- Table columns: Name, State, Progress, Started, Duration
- State computed from commitment children (not mutable column)

### mentu-ai (not on this machine)

Source: `HANDOFF-ProtocolNativeSequences-v1.0.md`.

**Protocol-Native Sequences Architecture**:
- A sequence = composition of commitments with ordered execution
- Sequence definition = Memory (`kind: "sequence"`)
- Sequence instance = parent Commitment referencing definition memory
- Step = child Commitment linked to parent via `mentu link`
- State = computed from `f(child commitment states)`, never stored

**State Model Mapping**:
```
Any child claimed     → sequence "running"
All children closed   → sequence "completed"
No children claimed   → sequence "pending"
Circuit breaker trip  → sequence "failed"
```

**Workflow CLI** (`mentu workflow run <name>`):
- Creates pending commitment tree + workflow_instance cache row
- `ralph-seq` claims the parent commitment to start execution

---

## Integration Architecture

### How CronCreate Connects to Mentu Dashboard

```
1. User: "schedule ralph-seq at 2am"

2. Claude Code:
   a. mentu workflow run <name>     → creates pending commitments
   b. Set scheduled_start_at        → dashboard shows "Scheduled for 2am"
   c. CronCreate(cron="0 2 * * *") → session-scoped timer

3. At 2am (cron fires):
   a. ralph-seq <name>              → claims parent commitment
   b. Dashboard transitions         → "Scheduled" → "Running Now"
   c. /loop 10m monitor             → polls .current for progress

4. Dashboard visibility:
   Scheduled  → pending commitments with scheduled_start_at in future
   Running    → claimed commitments (ralph-seq running)
   Completed  → closed commitments with evidence
```

### What's NOT Yet Built (Future Work)

| Component | Location | What's Needed |
|-----------|----------|---------------|
| Scheduled panel in Panorama | `mentu-web/src/components/panorama/` | Filter pending instances with `scheduled_start_at` |
| `scheduled_start_at` column | `mentu-web/src/components/sequence/` | Show scheduled time in sequences table |
| `mentu workflow schedule` CLI | `mentu-ai/src/commands/workflow.ts` | Create pending instance with `scheduled_start_at` |
| Bridge daemon scheduling | `mentu-ai/src/bridge/` | Durable scheduling via `bridge_commands.scheduled_at` |

### Session-Scoped vs Durable

| Mechanism | Survives Restart | Dashboard Visible | Use Case |
|-----------|-----------------|-------------------|----------|
| CronCreate | No (session-scoped) | Yes (via pending commitment) | Quick scheduling from Claude Code |
| `/loop` | No (session-scoped) | No | Monitoring a running sequence |
| Bridge `scheduled_at` | Yes (daemon) | Yes (bridge_commands table) | Overnight/weekend batch runs |
| `mentu workflow run` | Yes (commitments persist) | Yes (Panorama + sequences list) | All scheduled sequences |

---

## Key Design Decisions

1. **Commitments are the source of truth** — CronCreate is just the trigger mechanism. The Mentu commitment tree is what the dashboard reads.

2. **Session-scoped is sufficient for now** — most scheduling happens within an active Claude Code session. Durable scheduling via Bridge is future work.

3. **Monitoring reads existing state files** — no new state files were introduced. `/loop` reads `.current` and `step-status/*.json` which ralph-seq already writes.

4. **No mentu-web code was modified** — this is a skill documentation change only. The temporal fields already exist in the type system; the UI integration is documented here as future work.
