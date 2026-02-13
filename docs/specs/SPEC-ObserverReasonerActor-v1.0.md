---
id: SPEC-ObserverReasonerActor-v1.0
type: specification
version: "1.0"
created: 2026-01-02
last_updated: 2026-01-02
status: draft
---

# Observer-Reasoner-Actor Specification v1.0

## Overview

This specification defines the **Observer-Reasoner-Actor (O-R-A)** pattern—the operational layer that describes how signals become decisions become actions. The O-R-A pattern is the runtime pipeline; the Dual Triad is the trust structure that governs it.

---

## The Pattern

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   OBSERVER   │───▶│   REASONER   │───▶│    ACTOR     │
│              │    │              │    │              │
│  Watches     │    │  Thinks      │    │  Executes    │
│  signals     │    │  decides     │    │  actions     │
└──────────────┘    └──────────────┘    └──────────────┘
```

| Component | Purpose | Author Type Binding |
|-----------|---------|---------------------|
| Observer | Listens to signal sources | (none—perception only) |
| Reasoner | Decides what to do | Architect or Auditor |
| Actor | Executes the decision | Executor (always) |

---

## The Observer

The Observer watches multiple signal sources and captures incoming information.

### Signal Sources

| Source | Description | Examples |
|--------|-------------|----------|
| Supabase Realtime | Live database changes | Tickets, commands, ledger changes |
| Cron | Scheduled triggers | Daily checks, hourly syncs |
| Webhooks | External system events | GitHub, email, Slack |
| Filesystem | File change events | SyncThing, inotify |

### Observer Behavior

```
Signal arrives
    │
    ▼
Observer normalizes signal format
    │
    ▼
Observer captures to ledger (optional)
    │
    ├── Kind: `signal-received`
    ├── Body: normalized signal
    └── Meta: source, timestamp, raw data
    │
    ▼
Signal passed to Reasoner
```

### Observer Contract

- **Does NOT** make decisions
- **Does NOT** filter signals (all signals pass through)
- **Does NOT** have an author type (pure perception)
- **MAY** capture signals to ledger for audit trail
- **MUST** normalize signal format for Reasoner

---

## The Reasoner

The Reasoner receives signals and context, then decides what action to take.

### Reasoner Inputs

```typescript
interface ReasonerInput {
  signal: NormalizedSignal;
  context: {
    open_commitments: Commitment[];
    recent_actions: Operation[];
    workspace_state: WorkspaceState;
    actor_history: ActorHistory;
  };
}
```

### Reasoner Outputs

```typescript
interface ReasonerOutput {
  action_type: ActionType;
  parameters: Record<string, unknown>;
  confidence: number;  // 0.0 - 1.0
  reasoning: string;   // Explanation
  author_type: 'architect' | 'auditor';  // How Reasoner operated
}
```

### Confidence Thresholds

| Confidence | Trust Implication | Action |
|------------|-------------------|--------|
| High (>0.8) | Within established patterns | Execute immediately |
| Medium (0.5-0.8) | Novel but safe | Execute + log for review |
| Low (<0.5) | Uncertain or risky | Escalate to human |

### Reasoner Author Types

The Reasoner embodies different author types depending on the task:

| Signal Type | Reasoner Acts As | Output |
|-------------|------------------|--------|
| New feature request | Architect | Strategic intent |
| Validate a plan | Auditor | Approval + constraints |
| Execute approved work | (passes directly to Actor) | — |

When acting as **Architect**:
- Produces intent only
- Cannot see filesystem details
- Output requires validation

When acting as **Auditor**:
- Has full context access
- Validates feasibility
- Scopes the work

### Low Confidence Behavior

Low confidence signals that the Reasoner should not act as Executor. Instead:

1. Produce intent document (become Architect)
2. Escalate to human (await Auditor)
3. Record uncertainty in ledger

```
Reasoner confidence < 0.5
    │
    ▼
Capture: "Intent requiring human review"
    │
    ├── Kind: `architect-intent`
    ├── Body: What the Reasoner would do
    └── Meta: { requires_human_audit: true }
    │
    ▼
Await human response (become Architect awaiting Auditor)
```

---

## The Actor

The Actor executes decisions made by the Reasoner. It always operates as Executor.

### Actor Contract

- **ALWAYS** operates as Executor author type
- **BOUND BY** Reasoner's scope and parameters
- **CANNOT** exceed what was decided
- **MUST** capture evidence of work
- **SPAWNS** validators to check work

### Actor Execution Flow

```
Actor receives decision
    │
    ▼
Verify provenance (Reasoner decision exists in ledger)
    │
    ▼
Execute within scope
    │
    ├── Run Claude Code for complex tasks
    ├── Run bash for simple operations
    └── Use appropriate tools
    │
    ▼
Capture evidence
    │
    ├── Kind: `execution-evidence`
    ├── Body: What was done
    └── Meta: { provenance: reasoner_decision_id }
    │
    ▼
Spawn validators
    │
    ├── Technical validator (always)
    ├── Safety validator (if tier >= 2)
    └── Intent validator (if tier >= 3)
    │
    ▼
Report results to ledger
```

### Actor Constraints

```typescript
interface ActorConstraints {
  // From Reasoner's decision
  approved_scope: ScopeRef;
  allowed_operations: string[];
  forbidden_paths: string[];

  // Computed from author type
  author_type: 'executor';  // Always
  requires_provenance: true;  // Always
}
```

---

## The Complete Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│   Signal arrives                                                                │
│       │                                                                         │
│       ▼                                                                         │
│   OBSERVER                                                                      │
│   ├── Normalize signal                                                          │
│   ├── Capture to ledger (optional)                                              │
│   └── Pass to Reasoner                                                          │
│       │                                                                         │
│       ▼                                                                         │
│   REASONER                                                                      │
│   ├── Receive signal + context                                                  │
│   ├── Evaluate using boolean predicates                                         │
│   ├── Decide: action + parameters + confidence                                  │
│   └── Output with author_type (architect/auditor)                               │
│       │                                                                         │
│       ├─► High confidence ───────────────────────────────────────┐              │
│       │                                                          │              │
│       ├─► Medium confidence ─────────────────────────┐           │              │
│       │                                              │           │              │
│       └─► Low confidence ──► Escalate to human       │           │              │
│                              (become Architect)      │           │              │
│                                                      │           │              │
│                                                      ▼           ▼              │
│                                                  ACTOR                          │
│                                                  ├── Verify provenance          │
│                                                  ├── Execute within scope       │
│                                                  ├── Capture evidence           │
│                                                  └── Spawn validators           │
│                                                      │                          │
│                                                      ▼                          │
│                                                  VALIDATORS                     │
│                                                  ├── Technical: Does it work?   │
│                                                  ├── Safety: Boundaries kept?   │
│                                                  └── Intent: Vision honored?    │
│                                                      │                          │
│                                                      ▼                          │
│                                                  LEDGER                         │
│                                                  └── Evidence recorded          │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Composition with Dual Triad

The O-R-A pattern is the runtime pipeline. The Dual Triad is the trust structure that governs it.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│   OPERATIONAL LAYER              ACCOUNTABILITY LAYER                           │
│   (How work flows)               (Who is responsible)                           │
│                                                                                 │
│   ┌──────────────┐                                                              │
│   │   OBSERVER   │               (No author type—just perception)               │
│   └──────┬───────┘                                                              │
│          │                                                                      │
│          ▼                                                                      │
│   ┌──────────────┐               ┌─────────────────────────────────────────┐    │
│   │   REASONER   │──────────────▶│  Operates as ARCHITECT or AUDITOR       │    │
│   └──────┬───────┘               │  - Architect: "This signal means X"     │    │
│          │                       │  - Auditor: "X is feasible, scope is Y" │    │
│          ▼                       └─────────────────────────────────────────┘    │
│   ┌──────────────┐               ┌─────────────────────────────────────────┐    │
│   │    ACTOR     │──────────────▶│  Operates as EXECUTOR                   │    │
│   └──────┬───────┘               │  - Bound by Reasoner's scope            │    │
│          │                       │  - Cannot exceed what was decided       │    │
│          ▼                       └─────────────────────────────────────────┘    │
│   ┌──────────────┐               ┌─────────────────────────────────────────┐    │
│   │  VALIDATORS  │──────────────▶│  Intent + Safety + Technical            │    │
│   └──────────────┘               │  - Check the complete chain             │    │
│                                  └─────────────────────────────────────────┘    │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## The Witness (Optional Extension)

The Observer has no accountability. An optional **Witness** role closes this gap:

```
       CREATION              VALIDATION
       ────────              ──────────

       Observer    →         Witness (signal fidelity)
       Architect   →         Intent
       Auditor     →         Safety
       Executor    →         Technical
```

The Witness validates:
- Was the signal correctly perceived?
- Was normalization accurate?
- Did the Observer introduce errors?

This fully closes the accountability loop—every participant has a validator.

---

## Type Definitions

```typescript
/**
 * A normalized signal from any source.
 */
interface NormalizedSignal {
  id: string;
  source: SignalSource;
  timestamp: string;
  payload: unknown;
  normalized_at: string;
}

type SignalSource =
  | { type: 'realtime'; table: string; event: string }
  | { type: 'cron'; schedule: string; job_name: string }
  | { type: 'webhook'; provider: string; event_type: string }
  | { type: 'filesystem'; path: string; event: 'create' | 'modify' | 'delete' };

/**
 * Context provided to the Reasoner.
 */
interface ReasonerContext {
  open_commitments: Commitment[];
  recent_actions: Operation[];
  workspace_state: WorkspaceState;
  actor_history: ActorHistory;
}

/**
 * Decision output from the Reasoner.
 */
interface ReasonerDecision {
  id: string;
  signal_id: string;
  action_type: string;
  parameters: Record<string, unknown>;
  confidence: number;
  reasoning: string;
  author_type: 'architect' | 'auditor';
  scope: ScopeRef;
  timestamp: string;
}

/**
 * Execution result from the Actor.
 */
interface ActorResult {
  decision_id: string;
  outcome: 'success' | 'failure';
  evidence: string[];  // Memory IDs
  validators: ValidatorResult[];
  timestamp: string;
}

/**
 * Validator result.
 */
interface ValidatorResult {
  validator: 'technical' | 'safety' | 'intent';
  verdict: 'PASS' | 'FAIL';
  attribution?: {
    author_type: AuthorType;
    responsible_for: ValidationDomain;
  };
  summary: string;
}
```

---

## Implementation Considerations

### Signal Debouncing

Rapidly arriving signals should be debounced:

```typescript
const DEBOUNCE_MS = 500;

function debounced_observe(signal: Signal) {
  if (recent_signals.has(signal.dedup_key)) {
    return; // Skip duplicate
  }
  recent_signals.set(signal.dedup_key, Date.now());
  forward_to_reasoner(signal);
}
```

### Reasoner Batching

Multiple signals can be batched for a single reasoning pass:

```typescript
const BATCH_WINDOW_MS = 1000;

function batch_reasoning() {
  const batch = signal_queue.drain();
  if (batch.length === 0) return;

  const decision = reasoner.evaluate_batch(batch, context);
  forward_to_actor(decision);
}
```

### Actor Parallelism

Independent actions can execute in parallel:

```typescript
async function parallel_execution(decisions: Decision[]) {
  const independent = partition_by_dependencies(decisions);

  await Promise.all(
    independent.map(group =>
      Promise.all(group.map(d => execute(d)))
    )
  );
}
```

---

## VPS Deployment Topology

The O-R-A pattern is designed for always-on execution:

```
                              ┌─────────────────────┐
                              │        VPS          │
                              │   (Always On)       │
                              │                     │
                              │  ┌───────────────┐  │
                              │  │   OBSERVER    │  │
                              │  │   (daemon)    │  │
                              │  └───────┬───────┘  │
                              │          │          │
                              │          ▼          │
                              │  ┌───────────────┐  │
                              │  │   REASONER    │  │
                              │  │   (LLM call)  │  │
                              │  └───────┬───────┘  │
                              │          │          │
                              │          ▼          │
                              │  ┌───────────────┐  │
                              │  │    ACTOR      │  │
                              │  │ (Claude Code) │  │
                              │  └───────────────┘  │
                              │                     │
                              └──────────┬──────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
                    ▼                    ▼                    ▼
            ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
            │   Phone     │      │    Mac      │      │   iPad      │
            │ (Architect) │      │   (Dev)     │      │ (Architect) │
            └─────────────┘      └─────────────┘      └─────────────┘
```

**Key insight:** The VPS runs the full O-R-A pipeline 24/7. Human devices send Architect intents and receive results.

---

## References

- Dual Triad Framework: `docs/DUAL-TRIAD.md`
- Boolean Predicates: `docs/specs/SPEC-BooleanPredicates-v1.0.md`
- Author Types: `docs/specs/SPEC-AuthorTypes-v1.1.md`
- Cognitive Stances: `src/utils/stance.ts`
