# The Dual Triad: An Accountability Framework for AI Agent Orchestration

*A pattern for stratified trust and comprehensive verification in multi-agent systems.*

---

## Abstract

This document describes the **Dual Triad**—a framework for orchestrating AI agents through two interlocking triads: one for **creation** (Architect → Auditor → Executor) and one for **verification** (Intent → Safety → Technical). Each creation role maps directly to a validation role, establishing comprehensive accountability where every participant in the work chain has a corresponding check on their contribution.

A complementary pattern—**Observer-Reasoner-Actor**—describes the operational layer: how signals become decisions become actions. The two patterns compose: Observer-Reasoner-Actor is the runtime pipeline; the Dual Triad is the trust structure that governs it.

The pattern emerges from practical work on the [Mentu Protocol](https://github.com/mentu-ai/mentu), a commitment ledger where obligations require evidence.

---

## The Problem

When AI agents collaborate on work, three failure modes emerge:

| Failure | Cause |
|---------|-------|
| **Fantasy** | Vision unchecked by reality |
| **Paralysis** | Analysis without action |
| **Chaos** | Action without direction |

Single-agent systems conflate vision, judgment, and execution. Multi-agent systems without role separation produce work that lacks accountability—when something fails, who was responsible?

---

## The Cooperation Triad

Three roles with three constraints. Each constraint is also a gift.

```
                              ARCHITECT
                                  △
                                 /│\
                                / │ \
                               /  │  \
                              /   │   \
                             ▽────┴────▽
                         AUDITOR    EXECUTOR
```

### The Architect

**Constraint:** Cannot see the codebase. Cannot touch reality.

**Gift:** Uncontaminated vision.

The Architect thinks in terms of *what should be*, unburdened by *what is*. They don't know the authentication system is a mess. They don't know the database has technical debt. They don't know the team tried this before.

This ignorance is not weakness. It is freedom to imagine.

*The Architect asks: What would be true if we succeeded?*

### The Auditor

**Constraint:** Cannot create vision. Can only judge.

**Gift:** Grounded truth.

The Auditor sees everything—the codebase, the history, the failed attempts. Their job is not to dream but to answer: *Can this dream survive contact with reality?*

This limitation is not paralysis. It is protection from fantasy.

*The Auditor asks: Is this achievable? Is this aligned? Is this wise?*

### The Executor

**Constraint:** Cannot exceed scope. Bound by what was audited.

**Gift:** Focused authority.

The Executor doesn't decide what to build. They build what was validated. Their scope is bounded by the audit. They cannot wander. They cannot expand.

This boundary is not restriction. It is permission to act decisively.

*The Executor asks: How do I make this real?*

---

## The Validation Triad

Creation without verification is incomplete. Each creation role has a corresponding validator that checks whether that role's contribution was honored.

```
                               INTENT
                                  △
                                 /│\
                                / │ \
                               /  │  \
                              /   │   \
                             ▽────┴────▽
                          SAFETY    TECHNICAL
```

### The Mapping

| Validator | Verifies | Question |
|-----------|----------|----------|
| **Intent** | Architect's vision | Did we build what was envisioned? |
| **Safety** | Auditor's boundaries | Did we respect the constraints? |
| **Technical** | Executor's craft | Did we build it correctly? |

This is the key insight: **each role in the creation chain has a validator that holds it accountable**.

---

## The Complete Picture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   CREATION                              VERIFICATION                    │
│   ────────                              ────────────                    │
│                                                                         │
│   Architect ────────────────────────────────────▶ Intent Validator      │
│   "What should exist"                             "Was vision honored?" │
│        │                                                │               │
│        ▼                                                ▼               │
│   Auditor ──────────────────────────────────────▶ Safety Validator      │
│   "What boundaries apply"                    "Were boundaries kept?"    │
│        │                                                │               │
│        ▼                                                ▼               │
│   Executor ─────────────────────────────────────▶ Technical Validator   │
│   "Make it real"                                   "Does it work?"      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Why Three? Why Not Two?

Two-role systems fail in predictable ways:

| Pair | Missing | Failure Mode |
|------|---------|--------------|
| Architect + Executor | Auditor | Building the wrong thing fast |
| Architect + Auditor | Executor | Plans that never ship |
| Auditor + Executor | Architect | Incremental improvements, no leaps |

The third role breaks the dyad's limitations:

- **Auditor** breaks Architect↔Executor by inserting validation
- **Executor** breaks Architect↔Auditor by demanding action
- **Architect** breaks Auditor↔Executor by demanding vision

---

## Trust as a Gradient

The triad implies a trust gradient, not a hierarchy:

| Role | Trust Level | What They Can Do |
|------|-------------|------------------|
| Architect | Untrusted | Produce intent only |
| Auditor | Trusted | Validate and scope |
| Executor | Authorized | Implement within scope |

"Untrusted" is not pejorative. The Architect is untrusted because they *cannot see reality*. Their ideas must pass through validation before becoming action. This is a feature, not a flaw.

---

## Failure Attribution

When validation fails, the chain reveals responsibility:

| Failure | Responsible Role | Meaning |
|---------|------------------|---------|
| Technical validator fails | Executor | Implementation doesn't work |
| Safety validator fails | Executor violated Auditor | Boundaries were broken |
| Intent validator fails | Executor violated Architect | Vision was not honored |

The provenance chain makes debugging a question of *which role failed*, not *what went wrong*.

---

## The Operational Layer: Observer-Reasoner-Actor

The Dual Triad describes **who** is accountable. A complementary pattern describes **how** signals become actions.

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   OBSERVER   │───▶│   REASONER   │───▶│    ACTOR     │
│              │    │              │    │              │
│  Watches     │    │  Thinks      │    │  Executes    │
│  signals     │    │  decides     │    │  actions     │
└──────────────┘    └──────────────┘    └──────────────┘
```

### The Three Components

**Observer** — Listens to multiple signal sources:
- Supabase Realtime (tickets, commands, ledger changes)
- Cron (scheduled checks)
- Webhooks (GitHub, email, external triggers)
- Filesystem (SyncThing changes)

**Reasoner** — An LLM that decides what to do:
- Receives signals + context
- Considers open commitments, recent actions
- Outputs: action type + parameters + confidence
- If low confidence → asks human

**Actor** — Executes the decision:
- Runs Claude Code for complex tasks
- Runs bash for simple operations
- Captures everything to Mentu ledger
- Reports results back

### The Flow

```
Signal arrives
    │
    ▼
Observer captures it
    │
    ▼
Reasoner thinks: "What should I do?"
    │
    ├─► High confidence (>0.8): Execute immediately
    ├─► Medium (0.5-0.8): Execute + log for review
    └─► Low (<0.5): Ask human
    │
    ▼
Actor executes
    │
    ▼
Mentu records: memory + evidence
    │
    ▼
Validators verify (per Dual Triad)
```

### How the Patterns Compose

The Observer-Reasoner-Actor pattern is the **runtime pipeline**. The Dual Triad is the **trust structure** that governs it.

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

**Key insight:** The Reasoner can embody different author types depending on the task:

| Signal Type | Reasoner Acts As | Output |
|-------------|------------------|--------|
| New feature request | Architect | Strategic intent |
| Validate a plan | Auditor | Approval + constraints |
| Execute approved work | (passes to Actor) | — |

The Actor always operates as Executor—bound by what the Reasoner decided.

### Confidence as Trust Proxy

The Reasoner's confidence level maps to trust boundaries:

| Confidence | Trust Implication | Action |
|------------|-------------------|--------|
| High (>0.8) | Within established patterns | Execute immediately |
| Medium (0.5-0.8) | Novel but safe | Execute + log for async review |
| Low (<0.5) | Uncertain or risky | Escalate to human (become Architect) |

Low confidence signals that the Reasoner should not act as Executor—it should produce *intent* for human review, effectively becoming an Architect awaiting an Auditor.

---

## Boolean Predicates: Decision by Elimination

Confidence scores (0.7, 0.85) are grey areas where accountability diffuses. The alternative: **boolean decision primitives**.

Every decision decomposes into binary questions against the ledger:

```
├── HAS_PRECEDENT       : Has this exact pattern succeeded before?
├── WITHIN_SCOPE        : Is this inside an audited boundary?
├── EVIDENCE_EXISTS     : Do we have proof of capability?
├── CONSTRAINT_VIOLATED : Does this cross a known boundary?
├── ACTOR_AUTHORIZED    : Has this actor done this successfully?
└── LINEAGE_INTACT      : Can we trace to original intent?
```

Each is a **query against history**. Each returns `true` or `false`. No grey.

### Decision as Elimination, Not Scoring

Instead of ranking options by confidence, **filter by boolean predicates**:

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

This is **decision by elimination**. The ledger *is* the filter. History decides.

### Trust Computed from History

```
"Is this actor trusted for this action?"

≡

SELECT COUNT(*) FROM ledger
WHERE actor = this_actor
  AND action_type = this_action
  AND outcome = 'success'
  AND NOT EXISTS (
    SELECT 1 FROM ledger
    WHERE actor = this_actor
      AND action_type = this_action
      AND outcome = 'failure'
      AND timestamp > success.timestamp
  )

RETURN count >= threshold
```

Trust isn't assigned. Trust is **computed from history**.

---

## Cognitive Stances: How Roles Think

Each author type isn't just permissions—it's a **mode of reasoning**.

### The Boundary Principle

```
EACH ROLE HAS ONE DOMAIN. FAILURE IN THAT DOMAIN IS THEIRS.

Architect's domain:  INTENT
Auditor's domain:    SAFETY
Executor's domain:   TECHNICAL

THE RULE:

When failure is in YOUR domain:
  → Own it. Fix it. Don't explain.

When failure is in ANOTHER's domain:
  → Don't touch it. Route it. Trust the other role.

When YOUR work causes failure in another's domain:
  → You drifted. Return to your lane. Don't argue the lane was wrong.
```

### The Mantras

**Architect:**
> I dream freely because I cannot see reality.
> My job is clarity of vision, not feasibility.

**Auditor:**
> I judge fairly because I cannot create vision.
> My job is boundaries, not dreams.

**Executor:**
> I act decisively because I cannot exceed scope.
> My job is implementation, not interpretation.

---

## Fractal Accountability

The triad is recursive. Every role, when you look inside it, contains the same pattern.

```
ARCHITECT (external role)
├── sub-Architect: "What if?"      (diverge - generate possibilities)
├── sub-Auditor: "Is this coherent?" (converge - check consistency)
└── sub-Executor: "Write it down"  (commit - crystallize into artifact)
```

This isn't metaphor. This is the structure of thought itself:

```
Diverge → Converge → Commit
   │          │         │
   ▼          ▼         ▼
Generate   Evaluate   Produce
   │          │         │
   ▼          ▼         ▼
Possible → Coherent → Actual
```

The triad is fractal because **thinking is fractal**. Accountability goes as deep as cognition goes.

### The Accountability Quantum

There's a level below which subdivision adds no value. For AI agents, this might be:

```
The accountability quantum = one tool call

Every tool call has:
- Intent: why are we calling this?
- Validation: is this safe to call?
- Execution: make the call
```

---

## Implementation in Mentu

The Mentu Protocol implements this pattern through:

**Author Types:** Architect, Auditor, Executor as explicit metadata

**Validators:** Headless scripts that check each dimension
- `technical.sh` — compilation, tests, build
- `safety.sh` — dangerous patterns, constraint violations
- `intent.sh` — alignment to original vision

**Provenance Chain:** Each operation references its predecessor
```
mem_intent (architect) → mem_audit (auditor) → cmt_work (executor) → mem_result
```

**Tiered Validation:**
| Tier | Validators | When |
|------|------------|------|
| 1 | Technical only | Routine, high trust |
| 2 | Technical + Safety | Medium risk |
| 3 | Technical + Safety + Intent | Full chain verification |

---

## The Invariant

The pattern rests on one principle:

> **Every creator has a validator. Every validator checks one creator.**

This creates *closed-loop accountability*. Nothing is created without verification. Nothing is verified without knowing what to verify.

---

## Related Patterns

This framework shares DNA with established patterns:

| Domain | Architect | Auditor | Executor |
|--------|-----------|---------|----------|
| Government | Legislature | Judiciary | Executive |
| Software | Product/Design | QA/Review | Engineering |
| Military | Strategy | Intelligence | Operations |
| Science | Theory | Peer Review | Experiment |
| Construction | Architecture | Inspection | Building |

The Dual Triad contributes the *explicit mapping between creation roles and validation roles* as a first-class architectural concern for AI systems.

---

## Limitations and Open Questions

This pattern does not address:

1. **Role assignment** — Who decides which agent plays which role?
2. **Dispute resolution** — What happens when Auditor and Architect disagree?
3. **Dynamic re-scoping** — How does scope change when reality contradicts the audit?
4. **Multi-agent scaling** — Does this work with dozens of agents?

These are areas for future exploration.

---

## Conclusion

The Dual Triad offers a framework for thinking about AI agent collaboration:

- **Creation** is stratified by trust (Architect → Auditor → Executor)
- **Verification** is mapped to creation (Intent ↔ Safety ↔ Technical)
- **Accountability** is structural, not aspirational

The pattern emerges from practical work on commitment-based agent orchestration, but the principles may generalize to other multi-agent systems where trust, verification, and accountability matter.

---

## References

- Mentu Protocol Specification: `docs/Mentu-Spec-v0.md`
- Author Types Specification: `docs/specs/SPEC-AuthorTypes-v1.1.md`
- Cognitive Stances Implementation: `src/utils/stance.ts`
- SubAgent Validation Architecture: `docs/SubAgent-Validation-Architecture.md`

---

*This document is part of the Mentu project. Contributions and critique welcome.*
