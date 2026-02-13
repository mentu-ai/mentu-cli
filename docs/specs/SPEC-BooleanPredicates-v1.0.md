---
id: SPEC-BooleanPredicates-v1.0
type: specification
version: "1.0"
created: 2026-01-02
last_updated: 2026-01-02
status: draft
---

# Boolean Predicates Specification v1.0

## Overview

This specification defines a **boolean decision primitive** system for the Mentu protocol, eliminating grey-area confidence scores in favor of binary queries against the ledger. Every decision decomposes into predicates that return `true` or `false`. Trust is computed from history, not assigned.

---

## Core Principle

```
NOT: "How confident am I?" (0.0 - 1.0)

BUT: "What do I know for certain?" (true / false)
```

Grey areas are where accountability diffuses. Boolean primitives ensure:
- Every decision has a reason (the predicate that passed/failed)
- History teaches directly (precedent exists or doesn't)
- The ledger becomes the decision engine, not just the record

---

## The Predicate Vocabulary

### Existence Predicates

Queries about what the ledger contains:

| Predicate | Definition | Query |
|-----------|------------|-------|
| `HAS_PRECEDENT` | Similar successful operation exists | `∃ op WHERE similar(op, current) AND outcome = success` |
| `EVIDENCE_EXISTS` | Proof of capability exists | `∃ mem WHERE kind = evidence AND refs(current)` |
| `LINEAGE_INTACT` | Unbroken chain to intent | `∃ chain FROM intent → audit → current` |
| `ACTOR_KNOWN` | Prior operations by this actor | `∃ op WHERE actor = current.actor` |

### Boundary Predicates

Queries about the current operation:

| Predicate | Definition | Query |
|-----------|------------|-------|
| `WITHIN_SCOPE` | Inside audited scope boundaries | `current.scope ⊆ audit.approved_scope` |
| `CONSTRAINT_CLEAR` | No known constraint violated | `¬∃ constraint WHERE violated(constraint, current)` |
| `RESOURCE_AVAILABLE` | Resource not locked or exhausted | `resource.locked = false AND resource.remaining > 0` |

### Temporal Predicates

Queries incorporating history patterns:

| Predicate | Definition | Query |
|-----------|------------|-------|
| `NO_RECENT_FAILURE` | No failure in last N operations | `¬∃ failure WHERE timestamp > now() - N` |
| `PATTERN_STABLE` | Low variance in outcomes | `stddev(outcomes) < threshold` |
| `MOMENTUM_POSITIVE` | Recent successes > recent failures | `count(success, recent) > count(failure, recent)` |

---

## Decision by Elimination

Instead of scoring options, **filter by predicate chain**:

```
OPTIONS: [A, B, C, D, E]

Filter: HAS_PRECEDENT?
        [A, B, C, D, E] → [A, C, E]       (B, D never done before)

Filter: WITHIN_SCOPE?
        [A, C, E] → [A, E]                (C exceeds audit boundary)

Filter: CONSTRAINT_VIOLATED?
        [A, E] → [A]                      (E violates known constraint)

RESULT: A                                  (or NONE → escalate)
```

The decision tree is data:

```
                              OPTIONS
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
               Option A      Option B     Option C
                    │            │            │
                    ▼            ▼            ▼
              HAS_PRECEDENT?
                /      \
             true      false
              │          │
              │          └──→ ELIMINATED
              ▼
         WITHIN_SCOPE?
            /      \
         true      false
          │          │
          │          └──→ ELIMINATED
          ▼
    CONSTRAINT_CLEAR?
         /      \
      true      false
       │          │
       │          └──→ ELIMINATED
       ▼
    SELECTED
```

---

## Temporal Trust Model

Trust is computed from history, not assigned:

```sql
-- Is this actor trusted for this action?
SELECT COUNT(*) >= threshold
FROM ledger
WHERE actor = $actor
  AND action_type = $action
  AND outcome = 'success'
  AND NOT EXISTS (
    SELECT 1 FROM ledger
    WHERE actor = $actor
      AND action_type = $action
      AND outcome = 'failure'
      AND timestamp > success.timestamp
  )
```

### Trust Progression

| History | Trust State | Behavior |
|---------|-------------|----------|
| First time | No precedent | → Escalate |
| Succeeded once | Weak precedent | → Proceed with witness |
| Succeeded 5x, no failures | Strong precedent | → Proceed |
| Failed after success | Precedent broken | → Reset, escalate |

---

## Adaptive Thresholds

Thresholds emerge from history, not static configuration:

```typescript
function adaptive_threshold(action: Action, actor: Actor): number {
  // More sensitive actions require more precedent
  const base = action.sensitivity_level;  // 1, 3, 5, 10

  // Reduce threshold if actor has broad success
  const actor_bonus = Math.floor(actor.success_rate * 2);

  // Increase threshold if recent failures exist
  const failure_penalty = count_recent_failures(actor) * 2;

  return Math.max(1, base - actor_bonus + failure_penalty);
}
```

The threshold adapts to the actor's history. Proven actors earn lower thresholds. Failures raise the bar.

**But crucially:** The evaluation is still boolean. Either you meet the threshold or you don't.

---

## Fractal Application

The same predicates apply at every level:

### Operation Level
```
Can this specific action proceed?
→ HAS_PRECEDENT(action) ∧ WITHIN_SCOPE(action) ∧ CONSTRAINT_CLEAR(action)
```

### Commitment Level
```
Can this commitment be closed?
→ HAS_PRECEDENT(commit_type) ∧ EVIDENCE_EXISTS ∧ LINEAGE_INTACT
```

### Session Level
```
Can this agent continue operating?
→ PATTERN_STABLE(session) ∧ NO_RECENT_FAILURE(session)
```

### Actor Level
```
Is this actor trusted in this workspace?
→ MOMENTUM_POSITIVE(actor) ∧ HAS_PRECEDENT(actor, workspace)
```

Same boolean vocabulary. Different scope. Triads all the way down.

---

## Type Definitions

```typescript
/**
 * A boolean predicate that queries the ledger.
 */
interface BooleanPredicate {
  /** Unique identifier for this predicate */
  name: string;

  /** Category of predicate */
  category: 'existence' | 'boundary' | 'temporal';

  /** Evaluate the predicate against context */
  query: (context: DecisionContext) => boolean;

  /** Human-readable explanation of result */
  explain: (context: DecisionContext) => string;
}

/**
 * Context for evaluating predicates.
 */
interface DecisionContext {
  actor: ActorId;
  action: ActionType;
  scope: ScopeRef;
  ledger: Operation[];
  options: Option[];
  option?: Option;  // Current option being evaluated
}

/**
 * Result of a decision-by-elimination process.
 */
interface DecisionResult {
  /** The selected option, or null if none passed */
  selected: Option | null;

  /** Options that were eliminated with reasons */
  eliminated: Array<{
    option: Option;
    failed_predicate: string;
    explanation: string;
  }>;

  /** Whether to escalate to human */
  escalate: boolean;

  /** Full trace of predicate evaluations */
  provenance: PredicateTrace[];
}

/**
 * A single predicate evaluation record.
 */
interface PredicateTrace {
  predicate: string;
  option: Option;
  result: boolean;
  explanation: string;
  timestamp: string;
}
```

---

## The Decision Function

```typescript
function decide(
  context: DecisionContext,
  predicates: BooleanPredicate[]
): DecisionResult {
  let remaining = context.options;
  const eliminated: DecisionResult['eliminated'] = [];
  const trace: PredicateTrace[] = [];

  for (const predicate of predicates) {
    const passed: Option[] = [];

    for (const option of remaining) {
      const optionContext = { ...context, option };
      const result = predicate.query(optionContext);

      trace.push({
        predicate: predicate.name,
        option,
        result,
        explanation: predicate.explain(optionContext),
        timestamp: new Date().toISOString()
      });

      if (result) {
        passed.push(option);
      } else {
        eliminated.push({
          option,
          failed_predicate: predicate.name,
          explanation: predicate.explain(optionContext)
        });
      }
    }

    remaining = passed;
  }

  return {
    selected: remaining.length === 1 ? remaining[0] : null,
    eliminated,
    escalate: remaining.length === 0 || remaining.length > 1,
    provenance: trace
  };
}
```

---

## Standard Predicates

### HAS_PRECEDENT

```typescript
const HAS_PRECEDENT: BooleanPredicate = {
  name: 'HAS_PRECEDENT',
  category: 'existence',

  query: (ctx) => {
    const threshold = adaptive_threshold(ctx.action, ctx.actor);
    const successes = ctx.ledger.filter(op =>
      op.actor === ctx.actor &&
      op.op === ctx.action &&
      op.outcome === 'success'
    );
    return successes.length >= threshold;
  },

  explain: (ctx) => {
    const count = ctx.ledger.filter(op =>
      op.actor === ctx.actor &&
      op.op === ctx.action &&
      op.outcome === 'success'
    ).length;
    const threshold = adaptive_threshold(ctx.action, ctx.actor);

    if (count >= threshold) {
      return `Actor has ${count} successful precedents (threshold: ${threshold})`;
    }
    return `Actor has only ${count} precedents, needs ${threshold}`;
  }
};
```

### WITHIN_SCOPE

```typescript
const WITHIN_SCOPE: BooleanPredicate = {
  name: 'WITHIN_SCOPE',
  category: 'boundary',

  query: (ctx) => {
    if (!ctx.scope?.approved_paths) return true;

    const actionPaths = ctx.option?.affected_paths || [];
    return actionPaths.every(path =>
      ctx.scope.approved_paths.some(approved =>
        path.startsWith(approved)
      )
    );
  },

  explain: (ctx) => {
    const actionPaths = ctx.option?.affected_paths || [];
    const approved = ctx.scope?.approved_paths || [];
    const violations = actionPaths.filter(path =>
      !approved.some(a => path.startsWith(a))
    );

    if (violations.length === 0) {
      return 'All paths within approved scope';
    }
    return `Paths outside scope: ${violations.join(', ')}`;
  }
};
```

### LINEAGE_INTACT

```typescript
const LINEAGE_INTACT: BooleanPredicate = {
  name: 'LINEAGE_INTACT',
  category: 'existence',

  query: (ctx) => {
    const provenance = ctx.option?.meta?.provenance;
    if (!provenance?.intent) return false;

    // Verify intent exists
    const intent = ctx.ledger.find(op => op.id === provenance.intent);
    if (!intent) return false;

    // Verify audit exists if required
    if (provenance.audit) {
      const audit = ctx.ledger.find(op => op.id === provenance.audit);
      if (!audit) return false;
    }

    return true;
  },

  explain: (ctx) => {
    const provenance = ctx.option?.meta?.provenance;
    if (!provenance?.intent) {
      return 'No intent reference in provenance';
    }

    const intent = ctx.ledger.find(op => op.id === provenance.intent);
    if (!intent) {
      return `Intent ${provenance.intent} not found in ledger`;
    }

    return `Lineage verified: intent=${provenance.intent}`;
  }
};
```

---

## What This Enables

### 1. Debuggable Decisions
```
Why was Option B rejected?
→ Failed WITHIN_SCOPE at step 2
→ "Option B requires file access to /etc, which is outside audited scope"
```

### 2. Learnable Trust
```
Why does agent:alice proceed without escalation?
→ HAS_PRECEDENT returned true
→ "agent:alice has 12 successful deploy_to_staging, 0 failures"
```

### 3. Adaptive Strictness
```
Why is the threshold higher today?
→ adaptive_threshold returned 5 (was 3)
→ "Recent failure by agent:alice on 2024-01-01 increased sensitivity"
```

### 4. Auditable History
```
Show me the decision chain for commit cmt_abc
→ [predicate trace from ledger queries]
→ Every boolean, every query, every result
```

---

## Integration with Dual Triad

Boolean predicates provide the foundation for the Dual Triad's trust model:

| Triad Role | Key Predicates |
|------------|----------------|
| Architect | `LINEAGE_INTACT` (their intent is the root) |
| Auditor | `WITHIN_SCOPE`, `CONSTRAINT_CLEAR` (they define boundaries) |
| Executor | `HAS_PRECEDENT`, `EVIDENCE_EXISTS` (they prove capability) |

Validators use predicates to make determinations:

```typescript
function validate_for_tier(tier: number, ctx: DecisionContext): boolean {
  switch (tier) {
    case 1:
      return EVIDENCE_EXISTS.query(ctx);
    case 2:
      return EVIDENCE_EXISTS.query(ctx) && CONSTRAINT_CLEAR.query(ctx);
    case 3:
      return EVIDENCE_EXISTS.query(ctx) &&
             CONSTRAINT_CLEAR.query(ctx) &&
             LINEAGE_INTACT.query(ctx);
  }
}
```

---

## The Invariant

> **Every decision is a query against history. Every query returns boolean. Every boolean is recorded.**

The ledger isn't just memory. It's the reasoning substrate.

---

## Implementation Path

### Phase 1: Define Predicate Vocabulary
- Core predicates (HAS_PRECEDENT, WITHIN_SCOPE, etc.)
- Query implementations against ledger
- Boolean return only, no scores

### Phase 2: Decision by Elimination
- Filter function over options
- Trace every predicate evaluation
- Store decision provenance in ledger

### Phase 3: Adaptive Thresholds
- Threshold functions that query history
- Actor-specific threshold modifiers
- Action-sensitivity weighting

### Phase 4: Fractal Application
- Same predicates at operation/commitment/session/actor levels
- Scope parameter determines query boundaries
- Recursive evaluation for nested triads

---

## References

- Dual Triad Framework: `docs/DUAL-TRIAD.md`
- Author Types Specification: `docs/specs/SPEC-AuthorTypes-v1.1.md`
- Cognitive Stances Implementation: `src/utils/stance.ts`
