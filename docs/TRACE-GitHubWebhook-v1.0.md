---
id: TRACE-GitHubWebhook-v1.0
path: docs/TRACE-GitHubWebhook-v1.0.md
type: trace
intent: reference

created: 2026-01-02
last_updated: 2026-01-02

author: agent:claude-auditor
---

# TRACE: GitHub Webhook to Closed Commitment

This document traces the complete signal flow from GitHub webhook to closed commitment, with real file paths and code references.

---

## Two-Layer Model

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ OPERATIONAL LAYER: Observer → Reasoner → Actor                                  │
│                                                                                 │
│   Observer: mentu-proxy receives webhook, transforms to memory                  │
│   Reasoner: evaluate.ts gathers context, routes based on triage rules          │
│   Actor: mentu-bridge executes claude session, produces evidence               │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│ ACCOUNTABILITY LAYER: Architect → Auditor → Executor                           │
│                                                                                 │
│   Architect: Signal produces INTENT (low context, untrusted)                   │
│   Auditor: Reasoner validates, scopes, approves (high context, trusted)        │
│   Executor: Actor implements within scope (authorized, constrained)            │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Complete Flow Diagram

```
GitHub Repository
       │
       │ POST webhook (push, PR, issue)
       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ STAGE 1: OBSERVER (Signal Entry)                                                │
│                                                                                 │
│ File: mentu-proxy/src/signals.ts                                                │
│ Function: handleGitHubSignal() [line 101-207]                                   │
│                                                                                 │
│ Actions:                                                                        │
│   1. Verify HMAC signature (X-Hub-Signature-256)                               │
│   2. Get delivery ID for idempotency (X-GitHub-Delivery)                       │
│   3. Transform event via GITHUB_TRANSFORMS [line 21-52]                        │
│   4. POST to Mentu API (/ops with op=capture)                                  │
│                                                                                 │
│ Output: Memory created (mem_xxx) with kind=github_push|pr|issue                │
│                                                                                 │
│ Key Code [line 138-145]:                                                        │
│   const capturePayload = {                                                     │
│     op: 'capture',                                                             │
│     body: transform.body(event),                                               │
│     kind: transform.kind,                                                      │
│     source_key: sourceKey,  // Idempotency                                     │
│     actor: 'signal:github',                                                    │
│     meta: transform.meta(event),                                               │
│   };                                                                           │
└──────────────────────────────────┬──────────────────────────────────────────────┘
                                   │
                                   │ Fire-and-forget [line 179-194]
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ STAGE 2: REASONER (Context & Routing)                                          │
│                                                                                 │
│ File: mentu-proxy/src/handlers/evaluate.ts                                      │
│ Function: handleEvaluate() [line 105-196]                                       │
│                                                                                 │
│ Actions:                                                                        │
│   1. Load triage config from Supabase [line 127-131]                           │
│   2. Fetch memory by ID [line 142]                                             │
│   3. Match against triage rules [line 148]                                     │
│   4. Interpolate action template [line 154-157]                                │
│   5. Create commitment via /ops (op=commit)                                    │
│                                                                                 │
│ Output: Commitment created (cmt_xxx) if rule matches                           │
│                                                                                 │
│ Key Code [line 66-103]:                                                         │
│   const result = await createCommitment(                                        │
│     commitBody,                // Interpolated from rule.action.body           │
│     memory_id,                 // Source reference                             │
│     commitMeta,                // May include affinity: 'bridge'               │
│     workspace_id,                                                              │
│     env                                                                        │
│   );                                                                           │
│                                                                                 │
│ Resolution Level:                                                               │
│   - Low context (brief signal): Produces INTENT → needs audit                  │
│   - High context (full diff, HANDOFF ref): Can approve directly               │
└──────────────────────────────────┬──────────────────────────────────────────────┘
                                   │
                                   │ Commitment with meta.affinity='bridge'
                                   │ and meta.due_at (optional)
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ STAGE 3: ACTOR (Bridge Execution)                                              │
│                                                                                 │
│ File: mentu-bridge/src/daemon.ts                                                │
│ Class: BridgeDaemon                                                            │
│                                                                                 │
│ Entry Points:                                                                   │
│   A. Realtime subscription [line 193-199]                                      │
│      - Listens to bridge_commands INSERT events                                │
│      - Used for immediate execution requests                                   │
│                                                                                 │
│   B. Scheduler polling [line 100]                                              │
│      File: mentu-bridge/src/scheduler.ts                                       │
│      - Polls commitments with meta.affinity='bridge'                           │
│      - Checks meta.due_at <= now                                               │
│      - Interval: 60 seconds (default)                                          │
│                                                                                 │
│ Execution Flow [line 111-137]:                                                  │
│   1. Build prompt from commitment + context                                    │
│   2. Spawn Claude session via config.agents['claude']                          │
│   3. Execute with timeout                                                      │
│   4. Check commitment status after completion                                  │
│                                                                                 │
│ Key Code [line 80-97]:                                                          │
│   this.scheduler.setExecuteHandler(async (event) => {                           │
│     await this.executeAgent(                                                    │
│       'claude',                                                                │
│       event.prompt,                                                            │
│       event.workingDirectory,                                                  │
│       event.timeout                                                            │
│     );                                                                         │
│     const updated = await this.checkCommitmentStatus(event.commitment.id);     │
│   });                                                                          │
│                                                                                 │
│ Output: Claude session spawned, work begins                                    │
└──────────────────────────────────┬──────────────────────────────────────────────┘
                                   │
                                   │ Claude claims commitment, executes
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ STAGE 4: TRUST GRADIENT (Inside Claude Session)                                │
│                                                                                 │
│ The spawned Claude operates AS one of three roles:                             │
│                                                                                 │
│ A. AS ARCHITECT (Low Context Signal)                                           │
│    File: .claude/commands/craft--architect.md                                  │
│    - Produces INTENT document                                                  │
│    - mentu capture --author-type architect                                     │
│    - Needs audit before execution                                              │
│                                                                                 │
│ B. AS AUDITOR (High Context / HANDOFF Reference)                               │
│    File: .claude/commands/craft--auditor.md                                    │
│    - Validates INTENT, produces AUDIT + HANDOFF                                │
│    - mentu capture --author-type auditor                                       │
│    - Spawns executor or returns for human review                               │
│                                                                                 │
│ C. AS EXECUTOR (Audited HANDOFF)                                               │
│    File: .claude/commands/craft--executor.md                                   │
│    - Implements within scope                                                   │
│    - mentu capture --author-type executor                                      │
│    - Produces RESULT document                                                  │
│                                                                                 │
│ Output: Work completed, evidence captured                                      │
└──────────────────────────────────┬──────────────────────────────────────────────┘
                                   │
                                   │ Before submission
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ STAGE 5: VALIDATORS (Tier-Based)                                               │
│                                                                                 │
│ File: .claude/hooks/tier_validator.py                                          │
│                                                                                 │
│ Tier Classification [line 28-30]:                                               │
│   TIER_3_TAGS = {"security", "financial", "production", "critical"}           │
│   TIER_2_TAGS = {"database", "auth", "external-api", "new-pattern"}           │
│                                                                                 │
│ Validator Matrix [line 32-36]:                                                  │
│   T1: ["technical"]                                                            │
│   T2: ["technical", "safety"]                                                  │
│   T3: ["technical", "safety", "intent"]                                        │
│                                                                                 │
│ Validator Scripts:                                                             │
│   .claude/validators/technical.sh → tsc, npm test, npm build                  │
│   .claude/validators/safety.sh    → security pattern scanning                 │
│   .claude/validators/intent.sh    → scope alignment with INTENT               │
│                                                                                 │
│ Execution: Parallel via ThreadPoolExecutor                                     │
│                                                                                 │
│ Attribution (Provenance-Aware):                                                │
│   - technical failure → Executor responsibility                                │
│   - safety failure    → Auditor responsibility                                 │
│   - intent failure    → Architect responsibility                               │
│                                                                                 │
│ Output: JSON verdict { validator, verdict: PASS|FAIL, attribution }           │
└──────────────────────────────────┬──────────────────────────────────────────────┘
                                   │
                                   │ All validators PASS
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ STAGE 6: CLOSURE                                                               │
│                                                                                 │
│ File: mentu-ai/src/commands/submit.ts                                          │
│                                                                                 │
│ Submit Flow:                                                                   │
│   mentu submit cmt_xxx --summary "..." --include-files                         │
│                                                                                 │
│   T1 Behavior: Auto-approves → closed                                          │
│   T2/T3 Behavior: → in_review (awaits approval)                               │
│                                                                                 │
│ Approval Flow:                                                                 │
│   mentu approve cmt_xxx → closed                                               │
│   mentu reopen cmt_xxx --reason "..." → reopened                              │
│                                                                                 │
│ State Machine:                                                                 │
│   open → claimed → in_review → closed                                          │
│              ↓          ↓           ↓                                          │
│           release    reopen     reopen                                         │
│              ↓          ↓                                                      │
│            open    reopened → claim → claimed                                  │
│                                                                                 │
│ Evidence Capture:                                                              │
│   - RESULT document (docs/RESULT-{Name}.md)                                    │
│   - File changes (--include-files)                                             │
│   - Validator verdicts                                                         │
│                                                                                 │
│ Output: Commitment closed with full provenance chain                           │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## File Reference Summary

### mentu-proxy (Cloudflare Worker)

| File | Role | Key Functions |
|------|------|---------------|
| `src/signals.ts` | Observer | handleGitHubSignal(), verifyGitHubSignature() |
| `src/handlers/evaluate.ts` | Reasoner | handleEvaluate(), createCommitment() |
| `src/triage/loader.ts` | Config | loadTriageConfig() |
| `src/triage/matcher.ts` | Rules | findMatchingRule() |

### mentu-bridge (Mac Daemon)

| File | Role | Key Functions |
|------|------|---------------|
| `src/daemon.ts` | Actor | executeCommand(), executeAgent() |
| `src/scheduler.ts` | Poller | pollDueCommitments(), setExecuteHandler() |
| `src/approval.ts` | Gate | requestApproval() |

### mentu-ai (Core)

| File | Role | Key Functions |
|------|------|---------------|
| `.claude/commands/craft--architect.md` | Architect | Produce INTENT |
| `.claude/commands/craft--auditor.md` | Auditor | Validate, produce AUDIT+HANDOFF |
| `.claude/commands/craft--executor.md` | Executor | Implement, produce RESULT |
| `.claude/hooks/tier_validator.py` | Validator | Classify tier, run validators |
| `.claude/validators/*.sh` | Checks | technical, safety, intent |
| `src/commands/submit.ts` | Closure | Submit commitment |
| `src/commands/approve.ts` | Approval | Approve/reopen |

---

## Example: GitHub Push to Closed Commitment

```
1. Developer pushes to main branch
   │
   ▼
2. GitHub POSTs webhook to mentu-proxy
   URL: POST https://mentu-proxy.affihub.workers.dev/signals/github
   Headers:
     X-Hub-Signature-256: sha256=abc123...
     X-GitHub-Delivery: 550e8400-e29b-41d4-a716-446655440000
     X-GitHub-Event: push
   Body: { repository: {...}, ref: "refs/heads/main", ... }
   │
   ▼
3. signals.ts verifies signature, transforms event
   Memory created: mem_abc123
   Kind: github_push
   Body: "Push to refs/heads/main by developer: feat: add auth"
   │
   ▼
4. evaluate.ts matches triage rule
   Rule: { match: { kind: "github_push" }, action: { body: "Review: {body}" } }
   Commitment created: cmt_def456
   Meta: { affinity: "bridge", due_at: "2026-01-02T12:00:00Z" }
   │
   ▼
5. scheduler.ts polls, finds due commitment
   Claims commitment
   Builds prompt from commitment body + context
   │
   ▼
6. daemon.ts spawns Claude session
   Claude reads commitment, determines context level
   High context (has HANDOFF ref) → operates AS Auditor
   Produces AUDIT, approves, spawns executor
   │
   ▼
7. Executor implements changes
   Creates RESULT document
   Runs validators (T2: technical + safety)
   All PASS
   │
   ▼
8. Executor submits
   mentu submit cmt_def456 --summary "Implemented auth feature"
   State: in_review → closed (auto-approved for T1)
   Evidence: mem_xyz789 (RESULT capture)
   │
   ▼
9. Commitment closed with full provenance
   INTENT → AUDIT → HANDOFF → RESULT → CLOSURE
```

---

## Resolution Levels

| Stage | Input Resolution | Output Resolution |
|-------|-----------------|-------------------|
| Observer | Raw signal (lowest) | Memory with kind + meta |
| Reasoner | Memory + triage rules | Commitment with scope |
| Actor | Commitment + context | Execution with evidence |
| Validator | Execution output | Verdict with attribution |
| Closure | All evidence | Closed commitment (highest) |

Each layer ADDS resolution. Evidence is the highest resolution artifact.

---

*This trace documents the complete signal-to-closure flow as implemented in the Mentu ecosystem.*
