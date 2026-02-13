---
id: GUIDE-BugInvestigationSystem-Complete-v1.0
type: guide
version: "1.0"
created: 2026-01-09
tier: T3

mentu:
  commitment: pending
  status: pending
---

# GUIDE: Bug Investigation System - Complete v1.0

**For the next coding agent implementing the full front-end system**

---

## What You're Building

A **three-agent front-end pipeline** that transforms WarrantyOS bug reports into commitments ready for the Dual Triad orchestrator.

**Trust the source**: WarrantyOS reports are high-quality. Your job is to understand them and route them to the back-end.

---

## The Pipeline (Simple)

```
Bug Report (WarrantyOS)
  ↓
Bug Triager Agent
  (Extract signal: what's broken, scope, impact)
  → mem_bug_triage
  ↓
Intent Generator Agent
  (Articulate What/Why/Constraints/Acceptance)
  → mem_intent
  ↓
Auditor Router Agent
  (Invoke craft--auditor, create commitment, trigger workflow)
  → mem_prd + mem_handoff + cmt_xxx + workflow trigger
```

**That's it.** No lengthy validation. No gatekeeping. Just clarity + routing.

---

## Architecture (Already Built)

### Back-End (DO NOT MODIFY)

These exist and work:

1. **Workflow Orchestrator** (`mentu-bridge/src/workflow-orchestrator.ts`)
   - Daemon that polls workflow_instances
   - Spawns Architect → Auditor → Executor sequence
   - Manages step state, branching, approval gates
   - 350 lines, production-ready

2. **Workflow Definition** (`.mentu/workflows/bug-investigation-dual-triad.yaml`)
   - V4.1 DAG workflow with 7 steps
   - Branches on auditor decision
   - Approval gate (AUTONOMOUS/MANUAL per workspace config)
   - Validators + deploy step
   - Output contracts enforce JSON validation

3. **Agent Prompts** (3 files)
   - `docs/ARCHITECT-BugInvestigation-v1.0.md` (Sonnet 4.5, no code)
   - `docs/AUDITOR-BugInvestigation-v1.0.md` (Sonnet 4.5, read-only)
   - `docs/EXECUTOR-BugInvestigation-v1.0.md` (Sonnet 4.5, scoped)

4. **Memory Contracts** (3 TypeScript files)
   - `src/types/architect-memory.ts`
   - `src/types/auditor-memory.ts`
   - `src/types/executor-memory.ts`

### Front-End (YOU BUILD THIS)

Three agents + webhook integration:

1. **Bug Triager** - Understands the bug
2. **Intent Generator** - Articulates What/Why/Constraints/Acceptance
3. **Auditor Router** - Routes to craft system, creates commitment, triggers workflow

---

## Implementation Guide

### Phase 1: Prompts (Minimal)

Create three prompt documents:

**`docs/PROMPT-BugTriager-v1.0.md`**
- Input: Raw bug report (title, description, severity, context)
- Output: JSON with signal, severity, reproducibility, scope, business_impact
- Key: No validation gatekeeping. Just extract signal.
- Attitude: "Trust WarrantyOS. Understand the bug."

**`docs/PROMPT-IntentGenerator-v1.0.md`**
- Input: Bug report + triage signal
- Output: INTENT JSON with What/Why/Constraints/Acceptance/Context
- Key: Make everything testable and quantified
- Attitude: "Be specific. Be tight. The Auditor depends on this."

**`docs/PROMPT-AuditorRouter-v1.0.md`**
- Input: INTENT document + workspace context
- Output: Invokes craft--auditor, creates commitment, triggers workflow
- Key: Don't second-guess craft. Just invoke it.
- Attitude: "Simple job: craft, commit, trigger. That's it."

These three prompts are your entire specification. They fit on one page each.

### Phase 2: Type Contracts

Create TypeScript interfaces for the three memory types:

**`src/types/bug-triage-signal.ts`**
```typescript
export interface BugTriageSignal {
  signal: string;           // What's broken
  severity: "high" | "medium" | "low";
  reproducibility: string;  // Steps
  scope: string;           // Component/service affected
  business_impact: string; // Quantified impact
  next_step: "proceed_to_intent";
}
```

**`src/types/intent-document.ts`**
```typescript
export interface Intent {
  what: string;
  why: string;
  constraints: string[];
  acceptance_criteria: string[];
  context: {
    affected_component: string;
    severity: "high" | "medium" | "low";
    affected_users: string;
    reproducibility: string;
  };
}
```

### Phase 3: Agent Implementations

Create three agent functions:

**`src/agents/bug-triager.ts`**
```typescript
export async function bugTriager(
  bugMemoryId: string,
  mentuClient: MentuClient
): Promise<BugTriageSignal> {
  // 1. Fetch bug memory
  // 2. Read PROMPT-BugTriager-v1.0.md
  // 3. Invoke claude-code with prompt + bug report
  // 4. Parse JSON response
  // 5. Create mem_bug_triage memory
  // 6. Return signal
}
```

**`src/agents/intent-generator.ts`**
```typescript
export async function intentGenerator(
  bugMemoryId: string,
  triageSignalId: string,
  mentuClient: MentuClient
): Promise<Intent> {
  // 1. Fetch both memories
  // 2. Read PROMPT-IntentGenerator-v1.0.md
  // 3. Invoke claude-code with prompt + both memories
  // 4. Parse JSON response
  // 5. Create mem_intent memory
  // 6. Return intent
}
```

**`src/agents/auditor-router.ts`**
```typescript
export async function auditorRouter(
  bugMemoryId: string,
  intentMemoryId: string,
  workspace: WorkspaceContext,
  mentuClient: MentuClient
): Promise<{
  commitmentId: string;
  workflowInstanceId: string;
}> {
  // 1. Invoke /craft --auditor <intent_id>
  // 2. Read PRD + HANDOFF from craft output
  // 3. Create mem_prd memory
  // 4. Create mem_handoff memory
  // 5. Create commitment (source: intentMemoryId, approval: workspace.config)
  // 6. Trigger workflow/run with parameters
  // 7. Return commitment + workflow IDs
}
```

### Phase 4: Webhook Integration

Modify mentu-proxy bug report webhook to orchestrate the pipeline:

**`mentu-proxy/src/handlers/bug-report.ts`**
```typescript
export async function bugReportWebhook(
  req: Request,
  context: ExecutionContext
): Promise<Response> {
  // 1. Parse bug report
  // 2. Create mem_bug
  // 3. Spawn bugTriager (await result)
  // 4. Spawn intentGenerator (await result)
  // 5. Spawn auditorRouter (await result)
  // 6. Return { commitment_id, workflow_instance_id }
}
```

Simple sequential pipeline. No branching. No error handling for happy path.

---

## Critical Details

### Memory Lineage

Every memory must have a source:
```
mem_bug
  ← source: raw bug report
mem_bug_triage (from Triager)
  ← source: mem_bug
mem_intent (from Intent Gen)
  ← source: mem_bug
mem_prd (from craft--auditor)
  ← source: mem_intent
mem_handoff (from craft--auditor)
  ← source: mem_intent
cmt_xxx (commitment)
  ← source: mem_intent
```

This lineage is traceable: `mentu show cmt_xxx --trace-source`

### Commitment Creation

When Auditor Router creates commitment:
```typescript
await mentuClient.commit({
  title: `Fix: ${intent.what}`,
  body: handoffContent,
  source: intentMemoryId,  // NOT bugMemoryId
  author_type: "auditor",
  tags: ["dual-triad", "bug-fix"]
});
```

The **source** determines the lineage. Always source to intentMemoryId so the chain is: bug → triage → **intent** → commitment.

### Workflow Trigger

After commitment created:
```typescript
await fetch("https://mentu-proxy/.../workflow/run", {
  method: "POST",
  body: JSON.stringify({
    workflow_id: "bug-investigation-dual-triad",
    parameters: {
      bug_memory_id: bugMemoryId,  // Original bug
      workspace_id: workspace.id,
      workspace_path: workspace.path
    }
  })
});
```

The orchestrator needs all three parameters to execute the Architect → Auditor → Executor chain with proper context.

### Approval Mode

Read from workspace config:
```typescript
const approvalMode = workspace.config.orchestration?.approval?.mode || "MANUAL";
// AUTONOMOUS = auto-approve, proceed immediately
// MANUAL = wait for human approval (via API)
```

Pass this to commitment creation so approval gate knows the mode.

---

## Execution Model

### For Triager & Intent Generator
Use **synchronous Task tool invocation**:
- Fast (< 60 sec each)
- Return results immediately
- Can wait in webhook handler

### For Auditor Router
Use **async bridge spawn** (if craft--auditor is slow):
- craft--auditor may take 180+ seconds
- Don't block webhook handler
- Spawn to bridge, poll for completion
- Or keep webhook simple: spawn + return immediately, let router finish async

**Recommended**: Keep webhook synchronous for now. Speed is OK (<3 min total for all three agents).

---

## Testing

### Unit Tests (Optional)
- Triager produces valid BugTriageSignal schema
- Intent Generator produces valid Intent schema
- Auditor Router creates commitment with correct source

### E2E Test

```bash
# 1. Send test bug
curl -X POST "https://mentu-proxy.../bug-report-webhook" \
  -H "X-API-Key: $BUG_REPORTER_KEY" \
  -d '{
    "title": "Login fails with 500",
    "description": "Steps: 1) Go to /login 2) Enter credentials 3) See 500 error",
    "severity": "high",
    "context": "production, 50% of users"
  }'

# 2. Monitor memories
mentu list memories --recent 10
mentu show <mem_bug_triage_xxx>
mentu show <mem_intent_xxx>

# 3. Check commitment
mentu show <cmt_xxx>
mentu show <cmt_xxx> --trace-source

# 4. Verify workflow
curl "https://mentu-proxy/.../workflow/status/<instance_id>"
```

---

## Files to Create

1. `docs/PROMPT-BugTriager-v1.0.md`
2. `docs/PROMPT-IntentGenerator-v1.0.md`
3. `docs/PROMPT-AuditorRouter-v1.0.md`
4. `src/types/bug-triage-signal.ts`
5. `src/types/intent-document.ts`
6. `src/agents/bug-triager.ts`
7. `src/agents/intent-generator.ts`
8. `src/agents/auditor-router.ts`
9. `mentu-proxy/src/handlers/bug-triager-webhook.ts` (new) OR modify `bug-report.ts`

**Total**: 9 files, ~800 lines of code.

---

## Key Principles

1. **Trust WarrantyOS**: They send real bugs. Don't validate to death.
2. **Minimal filtering**: No lengthy checks. Extract signal, proceed.
3. **Proper lineage**: Every memory has a source. Trace it.
4. **Leverage craft**: Don't reinvent PRD/HANDOFF generation. Invoke craft--auditor.
5. **Simple routing**: Webhook → Triager → Intent Gen → Auditor Router → workflow.
6. **No nesting**: Don't spawn agents from agents. Linear pipeline only.

---

## What's Already Built (Don't Touch)

- Workflow orchestrator (execution engine)
- Workflow definition (DAG, branching, approval gates)
- Agent prompts for Architect/Auditor/Executor
- Memory contracts for back-end
- Workspace configs (AUTONOMOUS/MANUAL)

---

## Success

When done:
- [ ] Bug reports from WarrantyOS → webhook
- [ ] Webhook creates mem_bug
- [ ] Triager → mem_bug_triage
- [ ] Intent Gen → mem_intent
- [ ] Auditor Router → mem_prd + mem_handoff + cmt_xxx
- [ ] Workflow triggered automatically
- [ ] Full lineage traceable
- [ ] Dual Triad orchestrator runs Architect → Auditor → Executor

---

## Philosophy

**The front-end is not a gatekeeper. It's a translator.**

Take raw WarrantyOS bug reports. Understand them. Articulate them. Route them to the back-end system that solves them.

No gatekeeping. No rejection. Just clarity.

---

**Document Created**: 2026-01-09
**Tier**: T3 (Agent Implementation)
**Status**: Ready for Next Agent
