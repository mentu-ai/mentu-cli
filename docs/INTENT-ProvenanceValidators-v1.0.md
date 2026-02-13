---
id: INTENT-ProvenanceValidators-v1.0
type: intent
created: 2025-01-02
author: agent:claude-architect
author_type: architect
trust_level: untrusted
mentu:
  commitment: pending
  evidence: pending
---

# INTENT: Provenance-Aware Validation Triad

## What

Upgrade the existing Validation Triad (`.claude/validators/`) to be provenance-aware, connecting each validator to the Cooperation Triad role it verifies. When validation fails, the system should attribute failure to the responsible author type.

```
COOPERATION TRIAD                    VALIDATION TRIAD
(Who does the work)                  (Who verifies the work)

     ARCHITECT ────────────────────────► INTENT VALIDATOR
     "What should exist"                 "Was vision honored?"
          │                                    │
          ▼                                    ▼
     AUDITOR ──────────────────────────► SAFETY VALIDATOR
     "What boundaries apply"             "Were boundaries respected?"
          │                                    │
          ▼                                    ▼
     EXECUTOR ─────────────────────────► TECHNICAL VALIDATOR
     "Make it real"                      "Does it work?"
```

---

## Why

### The Gap

The validators exist but operate in isolation. They don't know:
- What the Architect originally intended (INTENT_ID)
- What boundaries the Auditor approved (AUDIT_ID)
- Which author role failed when validation fails

This breaks the trust chain. An executor could violate auditor boundaries and we'd detect the pattern but not attribute it correctly.

### The Opportunity

By connecting validators to provenance:

1. **Intent validator** can read the original architect-intent memory and compare against actual work
2. **Safety validator** can read audit-approval constraints and verify they were respected
3. **Technical validator** can verify the executor's implementation compiles/tests/builds
4. **Failure attribution** can route back to the responsible role

### The Value

When a commitment fails to close:
- "technical fails" → Executor's craft is bad
- "safety fails" → Executor violated Auditor's boundaries
- "intent fails" → Executor didn't honor Architect's vision

This creates **accountability** in the trust gradient.

---

## Constraints

### MUST

- Use existing validator structure (don't rewrite from scratch)
- Maintain backward compatibility (work without provenance vars)
- Return structured JSON verdicts matching existing schema
- Support tier-based execution (T1: technical, T2: +safety, T3: +intent)

### MUST NOT

- Validators must not modify files
- Validators must not require provenance (graceful degradation)
- Safety validator must not execute arbitrary code
- No network calls from validators

### SHOULD

- Extend verdict schema to include attribution field
- Create tier_validator.py orchestrator
- Document environment variable interface
- Consider parallel execution for performance

---

## Expected Outcome

### Success Criteria

1. Validators accept `INTENT_ID` and `AUDIT_ID` environment variables
2. Intent validator reads architect-intent memory when INTENT_ID provided
3. Safety validator reads audit-approval constraints when AUDIT_ID provided
4. Verdict JSON includes `attribution` field showing responsible role
5. tier_validator.py orchestrates execution based on tier
6. All existing functionality continues to work without provenance vars

### Artifacts

| Artifact | Purpose |
|----------|---------|
| Updated intent.sh | Reads INTENT_ID memory |
| Updated safety.sh | Reads AUDIT_ID constraints |
| Updated verdict.json schema | Adds attribution field |
| New tier_validator.py | Orchestrates by tier |
| Updated README.md | Documents provenance interface |

---

## Open Questions

1. **Constraint extraction**: How should safety.sh extract constraints from audit-approval? CLI query or file read?

2. **Memory lookup**: Should validators call `mentu show $INTENT_ID --json` or assume the memory body is passed via env var?

3. **Tier selection**: Should tier be explicit (`TIER=2`) or inferred from presence of provenance vars?

4. **Integration point**: Should tier_validator.py be called from a Claude Code hook, or from `mentu submit`?

---

## Provenance

This intent originates from the Dual Triad Architecture vision documented in the conversation. It is the first step toward completing the accountability framework.

```
Author Type: architect
Trust Level: untrusted
Status: Awaiting audit
```

---

*Strategic Intent Document - Created by Architect for Auditor validation.*
