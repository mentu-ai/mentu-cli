## The Problem: Over-Engineering

You've built **6 agents** for a bug fix:

```
FRONT-END (3 agents)          BACK-END (3 agents)
─────────────────────         ───────────────────
Bug Triager                   Architect
Intent Generator              Auditor  
Auditor Router                Executor
```

**Cost per bug**: 6 LLM invocations, 8 memories, ~$2-5 in API costs, 10+ minutes

**The front-end duplicates the back-end:**
- Bug Triager "understands the bug" → Architect already does this
- Intent Generator "articulates what's broken" → Architect already does this
- Auditor Router "creates PRD/HANDOFF" → The back-end Auditor defines scope anyway

---

## The Correct Abstraction

```
Bug Report
    ↓
    ↓  (direct routing, no agent)
    ↓
┌─────────────────────────────────────────────────────────┐
│                    DUAL TRIAD                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Architect ─── "What's broken? How do we fix it?"       │
│      ↓         (reads bug, proposes strategy)           │
│                                                          │
│  Auditor ───── "Is this feasible? What's the scope?"    │
│      ↓         (validates against codebase)             │
│                                                          │
│  Executor ──── "Implement within scope"                 │
│                (writes code, runs tests)                │
│                                                          │
└─────────────────────────────────────────────────────────┘
    ↓
GitHub PR
```

**Cost per bug**: 3 LLM invocations, 3 memories, ~$0.50-1.50, 3-5 minutes

---

## What to Delete

| Component | Action | Rationale |
|-----------|--------|-----------|
| Bug Triager | **DELETE** | Architect reads the bug directly |
| Intent Generator | **DELETE** | Architect articulates the intent |
| Auditor Router | **SIMPLIFY** | Becomes a webhook that creates commitment + triggers workflow |
| Front-end prompts (3) | **DELETE** | No longer needed |
| Front-end type contracts (2) | **DELETE** | No longer needed |
| Front-end agents (3) | **DELETE** | No longer needed |

---

## The Simplified System

### One File: Webhook Handler

```typescript
// mentu-proxy/src/handlers/bug-webhook.ts

export async function bugWebhook(req: Request): Promise<Response> {
  const bug = await req.json();
  
  // 1. Create bug memory (10ms)
  const memBug = await supabase.from("memories").insert({
    kind: "bug",
    body: JSON.stringify(bug),
    workspace_id: bug.workspace_id
  }).select("id").single();

  // 2. Create commitment (10ms)
  const commitment = await supabase.from("commitments").insert({
    title: `Fix: ${bug.title}`,
    body: bug.description,
    source: memBug.data.id,
    priority: severityToPriority(bug.severity),
    state: "open"
  }).select("id").single();

  // 3. Trigger Dual Triad workflow (10ms)
  const instance = await supabase.from("workflow_instances").insert({
    workflow_id: "dual-triad",
    parameters: {
      bug_memory_id: memBug.data.id,
      commitment_id: commitment.data.id,
      workspace_id: bug.workspace_id
    },
    state: "pending"
  }).select("id").single();

  // Done. No LLM calls. Total: ~30ms.
  return Response.json({
    commitment_id: commitment.data.id,
    workflow_instance_id: instance.data.id
  }, { status: 202 });
}
```

**This replaces 800+ lines of front-end agent code with 40 lines of routing.**

---

### One Workflow: Dual Triad

```yaml
# .mentu/workflows/dual-triad.yaml
id: dual-triad
name: Dual Triad Bug Fix
version: 1

parameters:
  - name: bug_memory_id
    required: true
  - name: commitment_id
    required: true
  - name: workspace_id
    required: true

steps:
  - id: architect
    type: commitment
    name: "Investigate and strategize"
    body: |
      Bug report: {{parameters.bug_memory_id}}
      
      1. Understand what's broken
      2. Develop investigation strategy
      3. Propose implementation approach
      
      Output JSON: { hypothesis, approach, files_likely_affected, confidence }
    model: claude-sonnet-4-5
    isolation: no_code
    timeout: 300

  - id: auditor
    type: commitment  
    name: "Validate strategy"
    body: |
      Architect's strategy: {{steps.architect.output}}
      
      1. Review codebase (read-only)
      2. Validate feasibility
      3. Define scope boundaries
      
      Output JSON: { decision, scope_boundaries, prompt_for_executor }
    model: claude-sonnet-4-5
    isolation: read_only
    timeout: 300

  - id: auditor_gate
    type: branch
    conditions:
      - condition: "{{steps.auditor.output.decision}} == 'approved'"
        target: executor
      - condition: "{{steps.auditor.output.decision}} == 'rejected'"
        target: architect
        max_loops: 2

  - id: executor
    type: commitment
    name: "Implement fix"
    body: |
      Scope: {{steps.auditor.output.scope_boundaries}}
      Instructions: {{steps.auditor.output.prompt_for_executor}}
      
      Implement the fix. Run tests. Create PR.
    model: claude-sonnet-4-5
    isolation: scoped
    scope_source: "{{steps.auditor.output.scope_boundaries}}"
    timeout: 600

  - id: complete
    type: terminal

edges:
  - from: architect, to: auditor
  - from: auditor, to: auditor_gate
  - from: auditor_gate, to: executor, condition: approved
  - from: auditor_gate, to: architect, condition: rejected
  - from: executor, to: complete
```

**60 lines. Complete workflow.**

---

### Three Prompts (Already Exist)

You already have these. They're good. Keep them:
- `ARCHITECT-BugInvestigation-v1.0.md`
- `AUDITOR-BugInvestigation-v1.0.md`
- `EXECUTOR-BugInvestigation-v1.0.md`

---

## What to Tell the Agent

```markdown
# DIRECTIVE: Simplify Bug Investigation System

## Delete These Files
- docs/PROMPT-BugTriager-v1.0.md
- docs/PROMPT-IntentGenerator-v1.0.md
- docs/PROMPT-AuditorRouter-v1.0.md
- src/types/bug-triage-signal.ts
- src/types/intent-document.ts
- src/agents/bug-triager.ts
- src/agents/intent-generator.ts
- src/agents/auditor-router.ts
- mentu-proxy/src/handlers/bug-triager-webhook.ts (if created)

## Replace With
A single webhook handler (40 lines) that:
1. Creates bug memory
2. Creates commitment
3. Triggers Dual Triad workflow
4. Returns immediately

No LLM calls in the webhook. All intelligence lives in the Dual Triad.

## Keep These Files
- docs/ARCHITECT-BugInvestigation-v1.0.md
- docs/AUDITOR-BugInvestigation-v1.0.md  
- docs/EXECUTOR-BugInvestigation-v1.0.md
- .mentu/workflows/dual-triad.yaml (simplified version)
- mentu-bridge/src/workflow-orchestrator.ts

## Philosophy
The Dual Triad IS the bug investigation system.
- Architect: Understands + strategizes
- Auditor: Validates + scopes
- Executor: Implements + ships

Three agents. Three memories. One workflow. Done.

## Anti-Patterns to Avoid
- Pre-processing agents that duplicate Architect's job
- "Intent articulation" separate from investigation
- Multiple layers of routing/validation
- Memory proliferation (8 memories per bug)

## Cost Target
- 3 LLM invocations per bug (not 6)
- 3 memories per bug (not 8)
- <5 minutes total (not 10+)
- <$1 per bug (not $2-5)
```

---

## The Architectural Principle

**One workflow. Three agents. No pre-processing.**

The front-end system was solving a problem that doesn't exist. WarrantyOS sends quality bug reports. The Architect is capable of reading them directly.

The Dual Triad pattern works because:
1. **Architect** = Strategic reasoning (what's broken, how to fix)
2. **Auditor** = Reality check (is strategy feasible given codebase)
3. **Executor** = Implementation (write code within scope)

Each role does ONE thing. No overlap. No duplication.

---

## Before/After

| Metric | Before (6 agents) | After (3 agents) |
|--------|-------------------|------------------|
| LLM calls | 6 | 3 |
| Memories | 8 | 3 |
| Files | 15+ | 5 |
| Lines of code | 2000+ | ~400 |
| Cost per bug | $2-5 | $0.50-1 |
| Time per bug | 10+ min | 3-5 min |
| Complexity | High | Low |

---

## Final Architecture

```
Bug Report (webhook)
    │
    │ (no LLM - just routing)
    ↓
┌──────────────────┐
│ Create Memory    │ (10ms)
│ Create Commitment│ (10ms)  
│ Trigger Workflow │ (10ms)
└────────┬─────────┘
         │
         ↓
┌─────────────────────────────────────────┐
│            DUAL TRIAD                    │
│                                          │
│  Architect ──→ Auditor ──→ Executor     │
│                                          │
│  (3 agents, 3 memories, done)           │
└─────────────────────────────────────────┘
         │
         ↓
    GitHub PR
```

**That's it. Ship this.**