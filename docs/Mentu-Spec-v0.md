# Mentu Spec v0.1

## Normative Specification

**Status**: Draft
**Version**: 0.1.0
**Date**: 2025-07-03

This document defines the Mentu protocol using normative language. Implementations MUST conform to all MUST requirements. Implementations SHOULD conform to SHOULD requirements. Implementations MAY implement MAY provisions.

---

## 1. Ledger

### 1.1 Structure

The ledger MUST be an ordered sequence of operations stored in JSON Lines format.

The ledger MUST be append-only. Implementations MUST NOT modify or delete existing records.

The ledger MUST be stored at `.mentu/ledger.jsonl` relative to workspace root.

### 1.2 Replay

State MUST be computed by replaying operations in order. Implementations MUST NOT store computed state as authoritative.

Replaying the same ledger MUST produce identical state across all conforming implementations.

### 1.3 Ordering

Operations MUST be ordered by append sequence, not by timestamp.

Timestamps are metadata. Append order is truth.

---

## 2. Operation Envelope

Every operation MUST include:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | MUST | Unique identifier |
| `op` | string | MUST | Operation type |
| `ts` | string | MUST | ISO 8601 timestamp |
| `actor` | string | MUST | Identity of performer |
| `workspace` | string | MUST | Workspace identifier |
| `payload` | object | MUST | Operation-specific data |

Every operation MAY include:

| Field | Type | Description |
|-------|------|-------------|
| `source_key` | string | Idempotency key from origin system |

### 2.1 Identifiers

The `id` field MUST be unique within the workspace.

Implementations SHOULD use the format `{prefix}_{8chars}` where prefix is:
- `mem` for memories
- `cmt` for commitments  
- `op` for other operations

### 2.2 Timestamps

The `ts` field MUST be a valid ISO 8601 datetime string.

Implementations SHOULD use UTC.

Timestamps MUST NOT be used for ordering. Append sequence is authoritative.

### 2.3 Idempotency

If `source_key` is present, it MUST be unique within the workspace.

Implementations MUST reject operations with duplicate `source_key`.

This enables safe replay from external systems.

---

## 3. Operations

### 3.1 capture

Creates a memory.

**Payload MUST include:**

| Field | Type | Description |
|-------|------|-------------|
| `body` | string | Content of observation |

**Payload MAY include:**

| Field | Type | Description |
|-------|------|-------------|
| `kind` | string | Classification of memory |
| `refs` | string[] | Related memory IDs |
| `meta` | object | Arbitrary metadata |

**Invariants:**
- `body` MUST be non-empty string
- `refs` entries MUST reference existing memory IDs

**Produces:** Memory

### 3.2 commit

Creates a commitment.

**Payload MUST include:**

| Field | Type | Description |
|-------|------|-------------|
| `body` | string | Description of obligation |
| `source` | string | Memory ID that originated this |

**Payload MAY include:**

| Field | Type | Description |
|-------|------|-------------|
| `tags` | string[] | Labels for filtering |
| `meta` | object | Arbitrary metadata |

**Invariants:**
- `body` MUST be non-empty string
- `source` MUST reference existing memory ID

**Produces:** Commitment with state `open`

### 3.3 claim

Takes responsibility for a commitment.

**Payload MUST include:**

| Field | Type | Description |
|-------|------|-------------|
| `commitment` | string | Commitment ID |

**Invariants:**
- `commitment` MUST reference existing commitment
- Commitment MUST NOT be closed
- Commitment MUST NOT be claimed by different actor

**Effect:** Commitment state becomes `claimed`, owner set to actor

### 3.4 release

Relinquishes responsibility for a commitment.

**Payload MUST include:**

| Field | Type | Description |
|-------|------|-------------|
| `commitment` | string | Commitment ID |

**Payload MAY include:**

| Field | Type | Description |
|-------|------|-------------|
| `reason` | string | Explanation for release |

**Invariants:**
- `commitment` MUST reference existing commitment
- Actor MUST be current owner
- Commitment MUST NOT be closed

**Effect:** Commitment state becomes `open`, owner set to null

### 3.5 close

Resolves a commitment with evidence.

**Payload MUST include:**

| Field | Type | Description |
|-------|------|-------------|
| `commitment` | string | Commitment ID |
| `evidence` | string | Memory ID proving completion |

**Invariants:**
- `commitment` MUST reference existing commitment
- `evidence` MUST reference existing memory
- Commitment MUST NOT already be closed

**Effect:** Commitment state becomes `closed`

### 3.6 annotate

Attaches information to existing record.

**Payload MUST include:**

| Field | Type | Description |
|-------|------|-------------|
| `target` | string | Memory or commitment ID |
| `body` | string | Annotation content |

**Payload MAY include:**

| Field | Type | Description |
|-------|------|-------------|
| `kind` | string | Classification of annotation |
| `refs` | string[] | Related IDs |
| `meta` | object | Arbitrary metadata |

**Invariants:**
- `target` MUST reference existing memory or commitment
- `body` MUST be non-empty string

**Effect:** Annotation attached to target. MUST NOT affect computed state of target.

---

## 4. State Computation

### 4.1 Memory State

A memory is the payload of a `capture` operation plus its envelope metadata.

Memories are immutable after creation.

Annotations on memories are computed by collecting all `annotate` operations targeting that memory.

### 4.2 Commitment State

Commitment state MUST be computed by replaying operations in order:

```
Initial state: { state: "open", owner: null }

For each operation where payload.commitment == this commitment:
  if op == "claim":
    state = "claimed"
    owner = actor
  if op == "release":
    state = "open"
    owner = null
  if op == "close":
    state = "closed"
    owner = null
    evidence = payload.evidence
    closed_by = actor
    closed_at = ts
```

### 4.3 Annotation Collection

For any record, annotations MUST be computed by:

```
annotations = all operations where:
  op == "annotate" AND
  payload.target == record.id
```

Annotations MUST be ordered by append sequence.

Annotations MUST NOT affect the `state`, `owner`, or any computed field of the target.

---

## 5. Validation

### 5.1 Pre-Append Validation

Implementations MUST validate operations before appending.

An operation that fails validation MUST NOT be appended.

### 5.2 Error Codes

Implementations MUST return structured errors:

| Code | Meaning |
|------|---------|
| `E_INVALID_OP` | Unknown operation type |
| `E_MISSING_FIELD` | Required field absent |
| `E_EMPTY_BODY` | Body field is empty string |
| `E_REF_NOT_FOUND` | Referenced ID does not exist |
| `E_ALREADY_CLOSED` | Commitment already closed |
| `E_NOT_OWNER` | Actor is not current owner |
| `E_ALREADY_CLAIMED` | Commitment claimed by another |
| `E_DUPLICATE_ID` | ID already exists |
| `E_DUPLICATE_SOURCE_KEY` | Source key already exists |
| `E_PERMISSION_DENIED` | Genesis Key forbids operation |
| `E_CONSTRAINT_VIOLATED` | Genesis Key constraint not satisfied |

### 5.3 Validation Order

Implementations MUST validate in this order:

1. Envelope completeness
2. Payload completeness
3. Referential integrity
4. State constraints
5. Genesis Key permissions
6. Genesis Key constraints

---

## 6. Genesis Key

### 6.1 Presence

The Genesis Key is OPTIONAL.

If absent, all operations are permitted. No constraints apply.

If present, it MUST be stored at `.mentu/genesis.key` in YAML format.

### 6.2 Enforcement

If Genesis Key is present:

- Implementations MUST check permissions before append
- Implementations MUST check constraints before append
- Operations failing these checks MUST return `E_PERMISSION_DENIED` or `E_CONSTRAINT_VIOLATED`

Genesis Key semantics are defined in [Genesis Enforcement Semantics].

---

## 7. Conformance

### 7.1 Minimal Implementation

A conforming implementation MUST:

1. Store ledger as append-only JSONL
2. Implement all six operations
3. Enforce all MUST invariants
4. Compute state by replay
5. Return specified error codes

### 7.2 Compatibility

Two implementations are compatible if:

1. Given identical ledger, they compute identical state
2. Given identical operation, they produce identical validation result

### 7.3 Extensions

Implementations MAY extend the protocol with:

- Additional `meta` fields
- Additional `annotate.kind` values
- Additional query capabilities

Extensions MUST NOT:

- Add new operation types to core
- Modify invariant behavior
- Store authoritative state outside ledger

---

## 8. Security Considerations

### 8.1 Append-Only Guarantee

Implementations MUST NOT provide APIs to modify or delete existing records.

### 8.2 Actor Verification

This specification does not define actor authentication. Implementations SHOULD verify actor identity through external mechanisms.

### 8.3 Ledger Integrity

Implementations SHOULD provide mechanisms to detect ledger tampering (e.g., hash chains).

---

## 9. References

- [Genesis Key Schema]
- [Genesis Enforcement Semantics]
- [Interoperability Test Suite]

---