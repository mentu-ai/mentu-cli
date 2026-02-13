---
id: SPEC-AuthorTypes-v1.1
type: specification
version: "1.1"
created: 2025-01-02
last_updated: 2026-01-02
status: draft
---

# Author Types Specification v1.1

## Overview

This specification defines the **Author Type** system for the Mentu protocol, enabling stratified trust orchestration through the Architect→Auditor→Executor pattern.

**v1.1 Changes:**
- Added **Cognitive Stances** section defining reasoning modes for each author type
- Added `cognitive_stance` field to author type configuration
- Added cross-role failure handling rules
- Added `CognitiveStance` and `CrossRoleRule` types

---

## Core Concepts

### Identity vs Role

**Actor** (existing) = **Identity** — WHO are you?
- Examples: `agent:claude-code`, `rashid@example.com`, `service:cloudflare`
- Immutable for a given operation
- Used for permission checking and attribution

**Author Type** (new) = **Role** — WHAT role are you playing?
- Examples: `architect`, `auditor`, `executor`
- Contextual per operation
- Used for trust gradient enforcement

These are **orthogonal**. The same actor can play different roles at different times:
- `agent:claude-code` might be an `auditor` in one operation
- `agent:claude-code` might be an `executor` in another

### Trust Gradient

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│   TRUST GRADIENT                                                                │
│                                                                                  │
│   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐                     │
│   │  ARCHITECT  │  →   │   AUDITOR   │  →   │  EXECUTOR   │                     │
│   │  untrusted  │      │   trusted   │      │  authorized │                     │
│   └─────────────┘      └─────────────┘      └─────────────┘                     │
│                                                                                  │
│   trust_level:          trust_level:         trust_level:                       │
│   "untrusted"           "trusted"            "authorized"                       │
│                                                                                  │
│   Can: capture          Can: read all        Can: implement                     │
│   Cannot: execute       Can: validate        Bound by: audit scope              │
│                         Can: approve/reject                                     │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Author Types

### Architect

**Definition**: An agent operating without local filesystem access, producing strategic intent only.

**Characteristics**:
- No access to codebase
- No tools or execution capability
- Produces high-level "what" and "why"
- Output is inherently untrusted

**Allowed Operations**:
- `capture` (kind: `architect-intent`, `strategic-intent`)
- `annotate` (for clarifications)

**Forbidden**:
- Cannot produce file paths, code, or schemas
- Cannot close commitments
- Cannot approve or reject

**Trust Level**: `untrusted`

### Auditor

**Definition**: An agent with full local access, validating architect intent against codebase reality.

**Characteristics**:
- Full filesystem access
- All MCP tools available
- Can read and analyze everything
- Produces validation evidence

**Allowed Operations**:
- All read operations
- `capture` (kind: `audit-evidence`, `audit-approval`, `audit-rejection`)
- `annotate` (audit findings)
- `commit` (for validated instructions)
- `close` (audit commitments only)
- Transform intent → craft instruction

**Trust Level**: `trusted`

### Executor

**Definition**: An agent implementing audited instructions within scoped authority.

**Characteristics**:
- Full implementation capability
- Scoped to audit output
- Must verify provenance before acting
- Produces implementation evidence

**Allowed Operations**:
- All implementation operations
- `capture` (kind: `implementation-evidence`, `result-document`)
- `commit`, `claim`, `release`, `close`
- `submit` (with evidence)

**Constraints**:
- Cannot exceed audit scope
- Must link back to audit
- Cannot modify unrelated code

**Trust Level**: `authorized`

---

## Cognitive Stances

**NEW in v1.1**: Cognitive stances define HOW each role reasons about success and failure, converting attribution into action.

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

### Cognitive Stance Type

```typescript
/**
 * Cognitive stance for an author type.
 * Defines how the role should reason about success and failure.
 */
export interface CognitiveStance {
  /** The validation domain this role owns */
  owns: 'intent' | 'safety' | 'technical';

  /** Core operating principle - the role's guiding philosophy */
  mantra: string;

  /** How to reason when intent validation fails */
  when_intent_fails: string;

  /** How to reason when safety validation fails */
  when_safety_fails: string;

  /** How to reason when technical validation fails */
  when_technical_fails: string;
}
```

### Architect Stance

```yaml
cognitive_stance:
  owns: intent
  mantra: |
    I dream freely because I cannot see reality.
    My job is clarity of vision, not feasibility.
  when_intent_fails: |
    This is my failure. My vision was unclear or misaligned.
    I should clarify, not defend.
  when_safety_fails: |
    This suggests my constraints were unclear.
    I should work with the auditor to sharpen boundaries.
  when_technical_fails: |
    This is not my failure. I trust the executor.
    I should not intervene in implementation.
```

### Auditor Stance

```yaml
cognitive_stance:
  owns: safety
  mantra: |
    I judge fairly because I cannot create vision.
    My job is boundaries, not dreams.
  when_intent_fails: |
    I approved something misaligned. My review was shallow.
    Question the architect. Tighten the review.
  when_safety_fails: |
    This is my failure. My boundaries were incomplete.
    I should add constraints, not blame the executor.
  when_technical_fails: |
    This is not my failure. Implementation is the executor's domain.
    I should not micromanage the how.
```

### Executor Stance

```yaml
cognitive_stance:
  owns: technical
  mantra: |
    I act decisively because I cannot exceed scope.
    My job is implementation, not interpretation.
  when_intent_fails: |
    I drifted from the vision. This is my failure to follow.
    Return to the HANDOFF. Read the intent again.
  when_safety_fails: |
    I violated boundaries set by another role.
    I should constrain, not argue. Respect the audit.
  when_technical_fails: |
    This is my failure. The implementation doesn't work.
    I should fix it, not explain why it should work.
```

### Cross-Role Rules

When an agent receives a failure attribution that doesn't match their role:

| Scenario | Stance | Action |
|----------|--------|--------|
| Executor receives intent failure | "I drifted from vision" | Re-read intent, rebuild |
| Executor receives safety failure | "I crossed a boundary" | Remove violation, constrain |
| Auditor receives intent failure | "My review was shallow" | Request clarification, re-audit |
| Auditor receives technical failure | "Not my failure to fix" | Trust executor |
| Architect receives safety failure | "My vision created a concern" | Refine constraints with auditor |
| Architect receives technical failure | "May be my failure to envision" | Reconsider if pattern repeats |

### Cross-Role Rule Type

```typescript
/**
 * Cross-role failure handling rule.
 */
export interface CrossRoleRule {
  /** Agent's current role */
  agent_role: AuthorType;

  /** Which validation domain failed */
  failure_domain: 'intent' | 'safety' | 'technical';

  /** Reasoning stance to adopt */
  stance: string;

  /** Recommended action */
  action: string;
}
```

---

## Data Model

### Operation Metadata Extension

The `meta` field on operations gains new standard fields:

```typescript
interface AuthorMeta {
  // Author type for this operation
  author_type?: 'architect' | 'auditor' | 'executor';

  // Trust level (computed or explicit)
  trust_level?: 'untrusted' | 'trusted' | 'authorized';

  // Provenance chain
  provenance?: {
    // Origin intent (for auditor/executor operations)
    intent?: string;           // mem_xxx of architect intent

    // Audit reference (for executor operations)
    audit?: string;            // mem_xxx of audit evidence

    // Full chain summary
    chain?: Array<{
      author_type: string;
      memory: string;
      actor: string;
      ts: string;
    }>;
  };
}
```

### Memory Kind Extensions

New standard memory kinds:

| Kind | Author Type | Purpose |
|------|-------------|---------|
| `architect-intent` | architect | Strategic intent document |
| `audit-evidence` | auditor | Audit findings and evaluation |
| `audit-approval` | auditor | Approval of intent |
| `audit-rejection` | auditor | Rejection of intent |
| `audit-modification` | auditor | Modification requirements |
| `validated-instruction` | auditor | Craft instruction after audit |
| `execution-progress` | executor | Implementation milestone |
| `result-document` | executor | Final implementation evidence |

### Commitment Tag Extensions

New standard tags for trust context:

| Tag | Purpose |
|-----|---------|
| `trust:untrusted` | Origin is architect (not validated) |
| `trust:audited` | Has been validated by auditor |
| `trust:authorized` | Ready for execution |
| `provenance:architect-intent` | Derived from architect intent |
| `provenance:audit-approved` | Audit approved this |
| `scope:bounded` | Executor scope is limited |

---

## Genesis Key Extensions

### Trust Gradient Section

```yaml
genesis:
  version: "1.0"
  created: "2025-01-02T00:00:00Z"

# ... existing sections ...

trust_gradient:
  enabled: true

  # Author type definitions with cognitive stances
  author_types:
    architect:
      trust_level: untrusted
      allowed_operations: [capture, annotate]
      allowed_kinds: [architect-intent, strategic-intent, clarification]
      cognitive_stance:
        owns: intent
        mantra: "I dream freely because I cannot see reality. My job is clarity of vision, not feasibility."
        when_intent_fails: "This is my failure. My vision was unclear or misaligned. I should clarify, not defend."
        when_safety_fails: "This suggests my constraints were unclear. I should work with the auditor to sharpen boundaries."
        when_technical_fails: "This is not my failure. I trust the executor. I should not intervene in implementation."
      constraints:
        - no_file_paths: true
        - no_code_snippets: true
        - no_implementation_details: true

    auditor:
      trust_level: trusted
      allowed_operations: [capture, annotate, commit, claim, release, close]
      allowed_kinds: [audit-evidence, audit-approval, audit-rejection, validated-instruction]
      cognitive_stance:
        owns: safety
        mantra: "I judge fairly because I cannot create vision. My job is boundaries, not dreams."
        when_intent_fails: "I approved something misaligned. My review was shallow. Question the architect. Tighten the review."
        when_safety_fails: "This is my failure. My boundaries were incomplete. I should add constraints, not blame the executor."
        when_technical_fails: "This is not my failure. Implementation is the executor's domain. I should not micromanage the how."
      can_approve_intents: true
      can_reject_intents: true
      can_transform_to_craft: true

    executor:
      trust_level: authorized
      allowed_operations: [capture, commit, claim, release, close, annotate, submit]
      allowed_kinds: [execution-progress, result-document, implementation-evidence]
      cognitive_stance:
        owns: technical
        mantra: "I act decisively because I cannot exceed scope. My job is implementation, not interpretation."
        when_intent_fails: "I drifted from the vision. This is my failure to follow. Return to the HANDOFF. Read the intent again."
        when_safety_fails: "I violated boundaries set by another role. I should constrain, not argue. Respect the audit."
        when_technical_fails: "This is my failure. The implementation doesn't work. I should fix it, not explain why it should work."
      requires_audit: true
      scope_bounded: true

  # Constraints based on author type
  constraints:
    # Architects cannot close commitments
    - match: { author_type: architect }
      deny: [close, approve, submit]

    # Executors must have audit provenance
    - match: { author_type: executor }
      require_provenance: true

    # Untrusted operations cannot create commitments directly
    - match: { trust_level: untrusted }
      deny: [commit]
      except_kinds: [architect-intent]  # Can commit for audit queue
```

### Actor-Author Type Bindings

Actors can have preferred or required author types:

```yaml
permissions:
  actors:
    "agent:claude-architect":
      role: "agent"
      author_type: architect           # Always operates as architect
      operations: [capture, annotate]

    "agent:claude-auditor":
      role: "agent"
      author_types: [auditor, executor]  # Can operate as either
      operations: [capture, commit, claim, release, close, annotate, submit]

    "agent:claude-*":
      role: "agent"
      author_types: [architect, auditor, executor]  # Can operate as any
      operations: [capture, commit, claim, release, annotate, submit]
```

---

## Provenance Tracking

### Intent→Audit→Execution Chain

Every operation in the trust gradient carries provenance:

```yaml
# Architect captures intent
- op: capture
  actor: agent:claude-architect
  payload:
    body: "Add user data export capability"
    kind: architect-intent
    meta:
      author_type: architect
      trust_level: untrusted

# Auditor validates (provenance points back to intent)
- op: capture
  actor: agent:claude-auditor
  payload:
    body: "APPROVED: Intent aligned with project philosophy"
    kind: audit-approval
    refs: [mem_intent]
    meta:
      author_type: auditor
      trust_level: trusted
      provenance:
        intent: mem_intent
        chain:
          - { author_type: architect, memory: mem_intent, actor: agent:claude-architect }

# Executor implements (provenance includes full chain)
- op: capture
  actor: agent:claude-executor
  payload:
    body: "Implemented data export feature"
    kind: result-document
    refs: [mem_intent, mem_audit, cmt_execution]
    meta:
      author_type: executor
      trust_level: authorized
      provenance:
        intent: mem_intent
        audit: mem_audit
        chain:
          - { author_type: architect, memory: mem_intent, actor: agent:claude-architect }
          - { author_type: auditor, memory: mem_audit, actor: agent:claude-auditor }
          - { author_type: executor, memory: mem_result, actor: agent:claude-executor }
```

### Trust Elevation

Trust can only be elevated, never lowered:

```
untrusted → trusted → authorized
     ↑           ↑           ↑
  Architect   Auditor    Executor
   creates    validates   implements
```

An operation with `trust_level: authorized` must have:
1. A valid provenance chain
2. An audit approval in the chain
3. All chain links verified

---

## Validation Rules

### Author Type Validation

When an operation specifies `meta.author_type`:

1. **Check actor binding** - If actor has fixed author_type, must match
2. **Check allowed operations** - Operation type must be allowed for author type
3. **Check allowed kinds** - Memory kind must be allowed for author type
4. **Check constraints** - Author-type-specific constraints must be satisfied

### Provenance Validation

For operations with `meta.provenance`:

1. **Chain integrity** - All referenced memories must exist
2. **Chain continuity** - Each link must reference the previous
3. **Trust elevation** - Trust level must increase or stay same through chain
4. **Actor consistency** - Actors in chain must have appropriate author types

### Executor Scope Validation

For executor operations:

1. **Audit exists** - Must have `provenance.audit` reference
2. **Audit approved** - Referenced audit must be an approval
3. **Scope respected** - Files/operations must be within audit scope
4. **No scope creep** - Cannot modify anything not in audit

---

## Utility Functions

### stance.ts (NEW in v1.1)

```typescript
import type { AuthorType, TrustLevel } from './author.js';

export type ValidationDomain = 'intent' | 'safety' | 'technical';

export interface CognitiveStance {
  owns: ValidationDomain;
  mantra: string;
  when_intent_fails: string;
  when_safety_fails: string;
  when_technical_fails: string;
}

export interface CrossRoleRule {
  agent_role: AuthorType;
  failure_domain: ValidationDomain;
  stance: string;
  action: string;
}

export interface FailureReasoning {
  is_owned: boolean;
  stance: string;
  action: string;
  cross_role_rule?: CrossRoleRule;
}

export interface Attribution {
  author_type: AuthorType;
  responsible_for: ValidationDomain;
}

// Constants
export const COGNITIVE_STANCES: Record<AuthorType, CognitiveStance>;
export const DOMAIN_OWNERS: Record<ValidationDomain, AuthorType>;
export const CROSS_ROLE_RULES: Record<string, CrossRoleRule>;

// Functions
export function getStance(authorType: AuthorType): CognitiveStance;
export function getDomainOwner(domain: ValidationDomain): AuthorType;
export function ownsValidationDomain(authorType: AuthorType, domain: ValidationDomain): boolean;
export function getCrossRoleRule(agentRole: AuthorType, failureDomain: ValidationDomain): CrossRoleRule | undefined;
export function reasonAboutFailure(currentRole: AuthorType, attribution: Attribution): FailureReasoning;
export function buildStancePrompt(authorType: AuthorType): string;
export function buildStanceReminder(authorType: AuthorType): string;
export function buildFailureInstructions(authorType: AuthorType): string;
```

### author.ts

```typescript
// Author types
export type AuthorType = 'architect' | 'auditor' | 'executor';

// Trust levels
export type TrustLevel = 'untrusted' | 'trusted' | 'authorized';

/**
 * Get author type from operation meta
 */
export function getAuthorType(op: Operation): AuthorType | undefined {
  return op.payload?.meta?.author_type;
}

/**
 * Get trust level from operation or compute from author type
 */
export function getTrustLevel(op: Operation): TrustLevel {
  if (op.payload?.meta?.trust_level) {
    return op.payload.meta.trust_level;
  }

  const authorType = getAuthorType(op);
  switch (authorType) {
    case 'architect': return 'untrusted';
    case 'auditor': return 'trusted';
    case 'executor': return 'authorized';
    default: return 'trusted';  // Default for operations without author type
  }
}

/**
 * Check if operation has valid provenance
 */
export function hasValidProvenance(
  op: Operation,
  ledger: Operation[]
): boolean {
  const provenance = op.payload?.meta?.provenance;
  if (!provenance) return false;

  // Verify intent exists
  if (provenance.intent) {
    const intent = ledger.find(o =>
      o.op === 'capture' && o.id === provenance.intent
    );
    if (!intent) return false;
  }

  // Verify audit exists and is approval
  if (provenance.audit) {
    const audit = ledger.find(o =>
      o.op === 'capture' &&
      o.id === provenance.audit &&
      o.payload?.kind?.includes('audit-approval')
    );
    if (!audit) return false;
  }

  return true;
}

/**
 * Build provenance chain for an operation
 */
export function buildProvenanceChain(
  ledger: Operation[],
  intentId?: string,
  auditId?: string
): ProvenanceChain {
  const chain = [];

  if (intentId) {
    const intent = ledger.find(o => o.id === intentId);
    if (intent) {
      chain.push({
        author_type: 'architect',
        memory: intentId,
        actor: intent.actor,
        ts: intent.ts
      });
    }
  }

  if (auditId) {
    const audit = ledger.find(o => o.id === auditId);
    if (audit) {
      chain.push({
        author_type: 'auditor',
        memory: auditId,
        actor: audit.actor,
        ts: audit.ts
      });
    }
  }

  return { intent: intentId, audit: auditId, chain };
}

/**
 * Validate author type constraints for an operation
 */
export function validateAuthorTypeConstraints(
  op: Operation,
  genesis: GenesisKey,
  ledger: Operation[]
): ValidationResult {
  const authorType = getAuthorType(op);
  if (!authorType) return { valid: true };  // No author type = no constraints

  const config = genesis.trust_gradient?.author_types?.[authorType];
  if (!config) return { valid: true };

  // Check allowed operations
  if (config.allowed_operations && !config.allowed_operations.includes(op.op)) {
    return {
      valid: false,
      error: new MentuError(
        'E_CONSTRAINT_VIOLATED',
        `${authorType} cannot perform ${op.op} operation`
      )
    };
  }

  // Check allowed kinds for capture
  if (op.op === 'capture' && config.allowed_kinds) {
    const kind = op.payload?.kind;
    if (kind && !config.allowed_kinds.includes(kind)) {
      return {
        valid: false,
        error: new MentuError(
          'E_CONSTRAINT_VIOLATED',
          `${authorType} cannot create memories of kind ${kind}`
        )
      };
    }
  }

  // Check requires_audit for executor
  if (authorType === 'executor' && config.requires_audit) {
    if (!hasValidProvenance(op, ledger)) {
      return {
        valid: false,
        error: new MentuError(
          'E_CONSTRAINT_VIOLATED',
          'Executor operations require valid audit provenance'
        )
      };
    }
  }

  return { valid: true };
}
```

---

## CLI Integration

### Author Type Flag

```bash
# Specify author type explicitly
mentu capture "Strategic intent" --author-type architect --kind architect-intent

# Auditor creating audit evidence
mentu capture "APPROVED" --author-type auditor --kind audit-approval --refs mem_intent

# Executor with provenance
mentu capture "Implemented" --author-type executor --kind result-document \
  --provenance-intent mem_intent \
  --provenance-audit mem_audit
```

### Environment Variable

```bash
# Set default author type
export MENTU_AUTHOR_TYPE=auditor
```

### Resolution Priority

1. `--author-type` flag
2. `MENTU_AUTHOR_TYPE` environment variable
3. Actor's default author_type (from genesis.key)
4. None (no author type constraints)

---

## Migration Path

### Phase 1: Non-Breaking Addition (v1.0)

1. Add `author.ts` utility functions
2. Update genesis.key schema to support `trust_gradient`
3. Add optional `meta.author_type` to capture operations
4. No validation enforcement yet

### Phase 2: Cognitive Stances (v1.1 - Current)

1. Add `stance.ts` with cognitive stance types and functions
2. Add `cognitive_stance` to author type configuration
3. Add cross-role failure handling rules
4. Document prompt injection patterns

### Phase 3: Opt-In Enforcement

1. Add `trust_gradient.enabled: true` to genesis.key
2. Enforce constraints for operations with author_type
3. Validate provenance for executor operations
4. Existing operations without author_type continue to work

### Phase 4: Full Integration

1. Document best practices
2. Update craft commands to set author types automatically
3. Add provenance building to audit and execution flows
4. Consider making author_type recommended for agent operations

---

## Backward Compatibility

- Operations without `meta.author_type` are unaffected
- Existing genesis.key files without `trust_gradient` work unchanged
- Author type is strictly additive
- No migration required for existing ledgers
- Cognitive stances are optional—agents without stance config continue to work

---

## References

- `src/utils/stance.ts` - Cognitive stance utilities
- `src/utils/author.ts` - Author type utilities
- `/craft--architect` command
- `/craft--auditor` command
- `/craft--executor` command
- `docs/templates/TEMPLATE-Intent.md`
- `docs/templates/TEMPLATE-Audit.md`
- `src/core/genesis.ts`
