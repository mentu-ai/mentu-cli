# The Dual Triad

*A pattern for accountable AI agent collaboration.*

---

## The Insight

When AI agents collaborate, **creation** and **verification** should mirror each other. For every role that creates work, there should be a validator that checks whether that role's contribution was honored.

---

## The Two Triads

```
       CREATION                          VERIFICATION
       ────────                          ────────────

       Architect                         Intent
      ╱         ╲                       ╱       ╲
   Auditor ─── Executor            Safety ─── Technical
```

---

## The Mapping

| Creates | Validates | Question |
|---------|-----------|----------|
| **Architect** produces vision | **Intent** validator | Was the vision honored? |
| **Auditor** sets boundaries | **Safety** validator | Were boundaries respected? |
| **Executor** builds | **Technical** validator | Does it work? |

---

## The Operational Layer

```
Observer → Reasoner → Actor → Validators
```

| Component | Does | Acts As |
|-----------|------|---------|
| **Observer** | Watches signals | (perception only) |
| **Reasoner** | Decides action | Architect or Auditor |
| **Actor** | Executes | Executor (always) |

The operational layer is the **runtime pipeline**. The Dual Triad is the **trust structure** that governs it.

---

## The Constraints That Are Gifts

| Role | Cannot | Therefore Can |
|------|--------|---------------|
| Architect | See reality | Dream freely |
| Auditor | Create vision | Judge fairly |
| Executor | Exceed scope | Act decisively |

---

## The Trust Gradient

```
Untrusted ────────► Trusted ────────► Authorized
     │                  │                  │
 Architect           Auditor           Executor
     │                  │                  │
 produces           validates         implements
   intent              scope             work
```

---

## Boolean Decision Primitives

No grey areas. Every decision is a filter:

```
HAS_PRECEDENT?       → Has this pattern succeeded before?
WITHIN_SCOPE?        → Inside audited boundary?
CONSTRAINT_VIOLATED? → Crosses known boundary?
LINEAGE_INTACT?      → Can trace to original intent?
```

Trust is computed from history, not assigned.

---

## Cognitive Stances

**The Boundary Principle:**
- Your domain fails → Own it. Fix it.
- Another's domain fails → Route it. Trust them.
- You caused failure in another's domain → You drifted. Return to lane.

**The Mantras:**

| Role | Mantra |
|------|--------|
| Architect | I dream freely because I cannot see reality. |
| Auditor | I judge fairly because I cannot create vision. |
| Executor | I act decisively because I cannot exceed scope. |

---

## Why It Matters

When something fails, the chain reveals who failed:

- Technical fails → Executor's craft was wrong
- Safety fails → Executor broke Auditor's boundaries
- Intent fails → Executor ignored Architect's vision

**Accountability becomes structural, not aspirational.**

---

## Fractal Property

The triad recurses. Inside every role is another triad:

```
Diverge (generate) → Converge (evaluate) → Commit (produce)
```

Same pattern. Every scale. Triads all the way down.

---

## One Line

*Every creator has a validator. Every validator checks one creator.*

---

*Part of the [Mentu Protocol](https://github.com/mentu-ai/mentu)—a ledger where commitments require evidence.*
