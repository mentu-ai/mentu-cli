---
name: mentu-craft
description: Create PRD, HANDOFF, PROMPT, RESULT, CONTEXT, INTENT, and AUDIT documents using canonical templates with Mentu evidence capture. Use when writing documentation for agents, creating task specifications, documenting completed work, recording design decisions, or processing Architect intents.
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - Bash
  - Task
---

# Mentu Craft

Create agent-executable documents with proper Mentu integration.

---

## SACRED RULE: Ledger-First Pattern

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ⚠️  THE LEDGER IS THE ONLY SOURCE OF TRUTH                            │
│                                                                         │
│  YAML front matter `mentu:` fields are WRITE-ONCE, then READ-ONLY.     │
│  NEVER manually edit the mentu: block after initial creation.          │
│  State changes happen through CLI commands, NOT document edits.        │
└─────────────────────────────────────────────────────────────────────────┘
```

### Field Permissions

| Field | Write | After Initial Write |
|-------|-------|---------------------|
| `mentu.commitment` | ONCE (after `mentu commit`) | **FROZEN** |
| `mentu.evidence` | ONCE (after `mentu capture`) | **FROZEN** |
| `mentu.status` | ONCE (set to `pending`) | **FROZEN** - query ledger instead |

### To Check Current State

```bash
# CORRECT: Query the ledger
mentu show cmt_xxx --json | jq -r '.state'

# WRONG: Read document YAML (may be stale)
```

---

## Templates

Use templates from [docs/templates/](../../../docs/templates/):

| Template | Purpose |
|----------|---------|
| [TEMPLATE-PRD.md](../../../docs/templates/TEMPLATE-PRD.md) | Requirements and specifications |
| [TEMPLATE-Handoff.md](../../../docs/templates/TEMPLATE-Handoff.md) | Build instructions |
| [TEMPLATE-Prompt.md](../../../docs/templates/TEMPLATE-Prompt.md) | Launch commands |
| [TEMPLATE-Result.md](../../../docs/templates/TEMPLATE-Result.md) | Completion reports |
| [TEMPLATE-Context.md](../../../docs/templates/TEMPLATE-Context.md) | Design decisions |
| [TEMPLATE-Intent.md](../../../docs/templates/TEMPLATE-Intent.md) | Architect strategic intent (remote agents) |
| [TEMPLATE-Audit.md](../../../docs/templates/TEMPLATE-Audit.md) | Leading Agent audit reports |

### Architect Mode Templates

For the Architect → Leading Agent workflow (see `/craft--architect`):

```
Architect Agent (remote)           Leading Agent (local)
┌───────────────┐                 ┌────────────────┐
│ INTENT doc    │ ───────────────>│ AUDIT doc      │
│ (what + why)  │   Mentu-Bridge  │ (evaluation)   │
└───────────────┘                 └───────┬────────┘
                                          │
                                          ▼ if APPROVE
                                  ┌────────────────┐
                                  │ /craft chain   │
                                  │ PRD→HANDOFF→   │
                                  │ PROMPT→RESULT  │
                                  └────────────────┘
```

## Workflow

### 1. Read Template

```bash
cat docs/templates/TEMPLATE-{Type}.md
```

### 2. Create Document

- Copy template structure
- Replace ALL `{placeholders}`
- Set YAML front matter with INITIAL values:
  ```yaml
  mentu:
    commitment: pending  # or cmt_xxx if known
    evidence: pending    # will update ONCE after capture
    status: pending      # FROZEN - never edit after creation
  ```

### 3. Capture as Evidence

```bash
mentu capture "Created {TYPE}-{Name}: {summary}" \
  --kind document \
  --path docs/{TYPE}-{Name}.md \
  --refs cmt_XXXXXXXX
```

### 4. ONE-TIME Update (Evidence ID Only)

After capture returns `mem_XXXXXXXX`, update the document ONCE:

```yaml
mentu:
  commitment: cmt_XXXXXXXX  # Already set or set now
  evidence: mem_XXXXXXXX    # ← Write ONCE
  status: pending           # ← NEVER CHANGE
```

**This is the LAST time you edit `mentu:` fields.**

### 5. Submit (for RESULT)

Submit through CLI - this updates the LEDGER, not the document:

```bash
mentu submit cmt_XXX --summary "{summary}"
```

**DO NOT edit `mentu.status` in the document after submit.**

---

## RESULT Document Requirements

**MANDATORY:** Create RESULT document BEFORE `mentu submit`.

> **NOTE:** The HANDOFF template includes a **"Completion Phase (REQUIRED)"** section.
> Executing agents will see this directly in their HANDOFF.

### RESULT Steps

1. Read `docs/templates/TEMPLATE-Result.md`
2. Create `docs/RESULT-{Name}-v{X.Y}.md` with:
   ```yaml
   mentu:
     commitment: cmt_XXXXXXXX
     evidence: pending        # Will update ONCE
     status: pending          # FROZEN - never edit
   ```
3. Capture: `mentu capture "Created RESULT-{name}" --kind document --path ...`
4. ONE-TIME update `mentu.evidence` with returned ID
5. Submit: `mentu submit cmt_xxx --summary "..."`

### What NOT to Do

```
❌ Edit mentu.status to "in_review" after submit
❌ Edit mentu.status to "closed" after approve
❌ Edit mentu.evidence after initial write
❌ Trust document YAML for current state
```

---

## YAML Front Matter

Every document needs initial values:

```yaml
---
id: {TYPE}-{Name}-v{X.Y}
path: docs/{filename}.md
type: prd | handoff | prompt | result | context | intent | audit
intent: execute | reference
version: "1.0"
created: YYYY-MM-DD
last_updated: YYYY-MM-DD
mentu:
  commitment: pending | cmt_XXXXXXXX  # Set once after commit
  evidence: pending | mem_XXXXXXXX    # Set once after capture
  status: pending                     # FROZEN - never edit
---
```

### Architect Mode Fields

INTENT documents include:
```yaml
architect:
  actor: agent:claude-architect
  session: {session-id}
  context: {origin}
tier_hint: T2
```

AUDIT documents include:
```yaml
intent_ref: INTENT-{Name}-v{X.Y}
craft_ref: pending  # Set after /craft if approved
auditor: agent:claude-lead
checkpoint:
  git_sha: {sha}
  timestamp: YYYY-MM-DDTHH:MM:SSZ
verdict: pending | APPROVE | REJECT | REQUEST_CLARIFICATION
```

## Checklist

- [ ] Template used from `docs/templates/`
- [ ] All placeholders replaced
- [ ] Valid YAML front matter with `status: pending`
- [ ] `mentu capture` called
- [ ] `mentu.evidence` updated ONCE with returned ID
- [ ] For RESULT: `mentu submit` called (updates ledger, not document)
- [ ] **DID NOT** manually edit `mentu.status`

See [Canonical-Front-Matter-Spec.md](../../../docs/Canonical-Front-Matter-Spec.md) for details.
