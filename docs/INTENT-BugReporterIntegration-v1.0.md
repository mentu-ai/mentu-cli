---
# ============================================================
# CANONICAL YAML FRONT MATTER
# ============================================================
id: INTENT-BugReporterIntegration-v1.0
path: docs/INTENT-BugReporterIntegration-v1.0.md
type: intent
intent: reference
version: "1.0"
created: 2026-01-10
last_updated: 2026-01-10

architect:
  actor: agent:claude-architect
  session: mentu-ai-workflow-v2.1
  context: conversation

tier_hint: T3

mentu:
  commitment: pending
  status: awaiting_audit

# Related documents
related:
  - RESULT-BugInvestigationWorkflow-v2.1
  - PRD-BugReportsInterface-v1.0
  - HANDOFF-BugReportsInterface-v1.0
---

# Strategic Intent: Bug Reporter Integration

> **Mode**: Architect
>
> You lack local filesystem access. Produce strategic intent only.
> State what and why. Do not specify file paths, schemas, or code.
> A local Leading Agent will audit and implement.

---

## What

Build a Bug Reporter Integration system in mentu-ai that:

1. **Receives bugs** from external sources (WarrantyOS, inline-substitute) via webhook or SDK
2. **Creates synchronized records** - memory, commitment, and workflow instance in a single atomic operation
3. **Maintains bidirectional sync** - updates flow back to source systems when workflow progresses
4. **Surfaces bugs correctly** in mentu-web Kanban view with bug indicator styling

The integration code lives in mentu-ai as the central orchestration point. External systems call into mentu-ai, not the other way around.

---

## Why

The Bug Investigation Workflow v2.1 and Bug Reports Interface v1.0 are implemented, but there's no automated way to:

1. **Ingest bugs** - External systems can't easily report bugs into the workflow
2. **Track origin** - No clear lineage from source system to Mentu memory
3. **Get feedback** - Source systems don't know when bugs are fixed
4. **See in Kanban** - Bug-sourced commitments don't stand out visually

Without integration:
- Bugs must be manually POSTed to `/bug-webhook`
- No feedback loop to WarrantyOS users who reported bugs
- Kanban shows bug commitments like any other commitment
- Memory → Commitment → Workflow linkage is fragile

With integration:
- One-liner SDK call from any JS/TS project
- Automatic feedback when workflow completes (webhook callback)
- Kanban cards show bug indicator (red border, bug icon)
- Full lineage: source system → memory → commitment → workflow → PR → close

---

## Constraints

- **mentu-ai is the hub** - Integration code lives here, not distributed across projects
- **Webhook API is stable** - `/bug-webhook` endpoint already exists and works
- **No new database tables** - Use existing operations table with metadata
- **Supabase sync** - All records must sync to Supabase for mentu-web visibility
- **Atomic operations** - Memory + Commitment + Workflow must be created together or not at all
- **Backwards compatible** - Existing `/bug-webhook` callers continue to work

---

## Expected Outcome

### For External Systems (WarrantyOS, inline-substitute)

```typescript
// Simple SDK usage in any project
import { MentuBugReporter } from '@mentu/bug-reporter';

const reporter = new MentuBugReporter({
  workspaceId: 'xxx',
  apiToken: process.env.MENTU_PROXY_TOKEN,
  source: 'WarrantyOS',
  callbackUrl: 'https://warrantyos.com/api/mentu-callback' // optional
});

// Report a bug - returns tracking IDs
const { memoryId, commitmentId, workflowInstanceId } = await reporter.report({
  title: 'Login fails with 500',
  description: 'User cannot log in after password reset',
  severity: 'high',
  metadata: { userId: 'usr_123', sessionId: 'sess_456' }
});

// Check status
const status = await reporter.getStatus(commitmentId);
// { state: 'in_progress', currentStep: 'executor', prUrl: null }

// Called when workflow completes (if callbackUrl provided)
// POST https://warrantyos.com/api/mentu-callback
// { commitmentId, state: 'closed', prUrl: '...', summary: '...' }
```

### For mentu-web Kanban

Commitments sourced from bug reports display:
- Red left border (like high-severity bugs in Bug Reports view)
- Bug icon next to title
- "Bug" badge
- Link to Bug Reports detail view

### For Ledger Integrity

Each bug report creates a clean lineage:
```
mem_xxx (kind: bug_report, source: WarrantyOS)
    ↓ commit operation
cmt_yyy (source: mem_xxx)
    ↓ workflow triggered
workflow_instance (parameters.commitment_id: cmt_yyy)
    ↓ on complete
cmt_yyy closed with evidence (pr_url)
    ↓ callback
WarrantyOS notified
```

---

## Open Questions

1. Should the SDK be a separate npm package (`@mentu/bug-reporter`) or embedded in mentu-ai CLI?
2. How should callback authentication work? Shared secret? Signed payloads?
3. Should we support polling in addition to callbacks for status updates?
4. What happens if workflow fails? Notify source with failure reason?

---

## Context

### Existing Infrastructure

| Component | Status | Purpose |
|-----------|--------|---------|
| `/bug-webhook` | ✅ Implemented | Receives bug reports, creates memory + commitment + workflow |
| Bug Investigation Workflow v2.1 | ✅ Active | 7-step Dual Triad pipeline |
| Bug Reports Interface | ✅ Implemented | Visualization in mentu-web |
| Kanban View | ✅ Exists | Commitment board - needs bug indicator |
| Supabase Sync | ✅ Works | Operations sync to cloud |

### What This Intent Adds

| Component | New | Purpose |
|-----------|-----|---------|
| Bug Reporter SDK | ✅ | Easy integration for external systems |
| Callback System | ✅ | Notify source when workflow completes |
| Kanban Bug Indicator | ✅ | Visual distinction for bug commitments |
| Atomic Creation | ✅ | Memory + Commitment + Workflow in one operation |
| Status Query | ✅ | Check workflow progress from external systems |

### Integration Points

| System | Integration |
|--------|-------------|
| WarrantyOS | Import SDK, call `reporter.report()` from bug form |
| inline-substitute | Call SDK from exception handler |
| mentu-web Kanban | Update CommitmentCard to show bug indicator |
| mentu-proxy | Relay callbacks to source systems |

---

## Routing Hints

```yaml
priority: high

tags:
  - integration
  - bug-workflow
  - sdk
  - kanban

target_repo: mentu-ai

related_repos:
  - mentu-web  # Kanban bug indicator
  - mentu-proxy  # Callback relay

ci_integration:
  github_actions: false
  auto_pr: false
```

---

## For the Leading Agent

When you receive this INTENT document:

1. **Establish checkpoint** (git + Mentu)
2. **Audit** using `/craft--architect` protocol
3. **Capture evidence** of your audit findings
4. **Decide**: APPROVE / REJECT / REQUEST_CLARIFICATION
5. **If approved**: Execute `/craft BugReporterIntegration-v1.0` to create full chain

### Key Files to Reference

| File | Purpose |
|------|---------|
| `src/server/routes/bug-webhook.ts` | Existing webhook implementation |
| `src/core/ledger.ts` | Memory and commitment creation |
| `src/core/supabase.ts` | Supabase sync operations |
| `.mentu/workflows/bug-investigation-dual-triad-v2.1.yaml` | Workflow definition |

### mentu-web Updates Needed

| File | Change |
|------|--------|
| `src/components/commitment/commitment-card.tsx` | Add bug indicator |
| `src/hooks/useCommitments.ts` | Add `isBugReport` derived field |

---

## Visual Reference

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  BUG REPORTER INTEGRATION                                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  EXTERNAL SYSTEM                    MENTU-AI                    MENTU-WEB       │
│  ───────────────                    ────────                    ────────        │
│                                                                                 │
│  WarrantyOS                                                                     │
│  ┌──────────────┐                   ┌──────────────┐            ┌──────────┐   │
│  │ Bug Form     │──── SDK ─────────▶│ /bug-webhook │───────────▶│ Kanban   │   │
│  │              │                   │              │            │ ┌──────┐ │   │
│  │ [Submit Bug] │                   │ Creates:     │            │ │🐛 Bug│ │   │
│  └──────────────┘                   │ • Memory     │            │ │ #123 │ │   │
│         │                           │ • Commitment │            │ └──────┘ │   │
│         │                           │ • Workflow   │            └──────────┘   │
│         │                           └──────┬───────┘                  │        │
│         │                                  │                          │        │
│         │                           ┌──────▼───────┐            ┌─────▼─────┐  │
│         │                           │   Workflow   │            │ Bug       │  │
│         │                           │   Pipeline   │            │ Reports   │  │
│         │                           │              │            │ Detail    │  │
│         │                           │ Arch→Aud→Exe │            │           │  │
│         │                           └──────┬───────┘            └───────────┘  │
│         │                                  │                                   │
│         │                           ┌──────▼───────┐                           │
│  ┌──────▼───────┐     callback      │   Complete   │                           │
│  │ Notification │◀──────────────────│   + PR URL   │                           │
│  │ "Bug Fixed!" │                   │   + Summary  │                           │
│  └──────────────┘                   └──────────────┘                           │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

*This intent was created by an Architect agent. It represents strategic direction, not implementation specification.*
