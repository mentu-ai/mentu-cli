# Glossary

## Core Primitives

### Memory

An observation recorded in the ledger. Created by `capture` operation.

A memory is immutable after creation. It represents something that was seen, reported, or discovered.

Memories are the raw material of accountability. They provide origin and evidence.

### Commitment

An obligation recorded in the ledger. Created by `commit` operation.

A commitment MUST reference a source memory. It represents something that must be done.

Commitments have computed state: `open`, `claimed`, or `closed`.

### Evidence

A memory used to prove a commitment was fulfilled.

Evidence is not a separate type. It is a memory referenced by a `close` operation.

The distinction is contextual: any memory can become evidence when used to close a commitment.

### Closure

The resolution of a commitment with evidence.

Closure is not a state change. It is the `close` operation itself, which references both commitment and evidence.

After closure, a commitment's computed state is `closed`.

### Annotation

Information attached to a memory or commitment. Created by `annotate` operation.

Annotations MUST NOT affect computed state. They are metadata: comments, links, flags, validations.

Annotations accumulate. They are never edited or deleted.

---

## Operations

### capture

Record an observation. Produces a memory.

### commit

Create an obligation. Produces a commitment. Requires source memory.

### claim

Take responsibility for a commitment. Sets owner.

### release

Give up responsibility for a commitment. Clears owner.

### close

Resolve a commitment with evidence. Requires evidence memory.

### annotate

Attach information to existing record. Does not affect state.

---

## Governance

### Genesis Key

The constitutional document governing a workspace.

Defines identity, permissions, constraints, and federation rules.

Optional for single-user. Required for multi-user orchestration.

### Constitution

The principles section of a Genesis Key.

Principles are declarative statements of values. They inform governance but are not automatically enforced.

### Permission

Authorization to perform an operation.

Permissions are defined per actor or actor pattern in the Genesis Key.

### Constraint

A condition that must be satisfied for an operation to succeed.

Constraints add requirements beyond basic permissions: require_claim, require_validation, require_human.

---

## Actors

### Actor

An identity that performs operations. Recorded in every operation's `actor` field.

Actors may be humans, agents, or services.

### Agent

A non-human actor that operates on the ledger.

Agents follow the Agent Protocol. They claim, work, produce evidence, and respect governance.

### Validator

An agent or human that verifies evidence before closure.

Validators do not do work. They check work. They produce validation memories.

---

## Workflow

### Triage

The process of converting observations into obligations.

Triage clusters related memories, creates commitments, links duplicates, and dismisses noise.

### Objective

A standing intention that generates commitments.

Objectives do not close. They continuously compare reality to intent and create commitments when gaps appear.

### Routing

Event-driven consequence triggered by closure.

When a commitment closes, routing rules may trigger actions: deploys, notifications, chained commitments.

---

## Scale

### Workspace

A bounded domain of accountability containing one ledger and optionally one Genesis Key.

### Federation

Connection between sovereign workspaces for cross-boundary coordination.

Federated workspaces share commitments and accept evidence according to compatibility rules.

### Sync

Bidirectional replication of ledger operations between local and cloud.

Sync enables multi-machine and multi-user collaboration while preserving local-first operation.

---

## Integrity

### Ledger

The append-only sequence of operations that constitutes the source of truth.

State is computed from the ledger. The ledger is never modified after append.

### Lineage

The traceable chain from commitment to source memory.

Every commitment traces to its origin. Lineage enables accountability and audit.

### Replay

Computing state by processing all operations in order.

Any conforming implementation replaying the same ledger produces identical state.

---