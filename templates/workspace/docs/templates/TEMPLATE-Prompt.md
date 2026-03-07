---
# ============================================================
# CANONICAL YAML FRONT MATTER
# ============================================================
# All fields are machine-fetchable and deterministic.
# No narrative or prose is allowed in this block.
# Agents MUST upsert this metadata on execution or edit.
# ============================================================

# IDENTITY
# id: Unique identifier matching filename. Replace {Name} with PascalCase name.
# path: Relative path from repository root.
# type: Document classification. Fixed as "prompt" for this template.
# intent: Fixed as "execute" - prompts are meant to be executed by agents.
id: PROMPT-{Name}-v{X.Y}
path: docs/PROMPT-{Name}-v{X.Y}.md
type: prompt
intent: execute

# VERSIONING
# version: Semantic version. Start at "1.0", increment on changes.
# created: ISO 8601 date when document was created. Never modify.
# last_updated: ISO 8601 date of last edit. Update on every change.
version: "1.0"
created: YYYY-MM-DD
last_updated: YYYY-MM-DD

# TIER
# tier: Task complexity. T1=simple, T2=feature, T3=multi-part, T4=orchestrated.
tier: T2

# ACTOR
# actor: Agent identity is auto-resolved from repository manifest.
# Do not hardcode - the HANDOFF's author_type defines the role.
# This field documents the expected actor for this repository.
actor: (from manifest)

# RELATIONSHIPS
# parent: ID of parent HANDOFF document this prompt executes.
parent: HANDOFF-{Name}-v{X.Y}

# MENTU INTEGRATION
# Required for T2+ prompts. Tracks commitment lifecycle.
# commitment: Set to "pending" initially, then update to cmt_XXXXXXXX after mentu commit.
# status: Current state. pending -> claimed -> in_review -> closed/reopened.
mentu:
  commitment: pending
  status: pending
---

# Executable Prompt: {Name} v{X.Y}

## Launch Commands

### Option A: Native Claude (NO mentu-enforcer)

Use this when you do NOT need stop-time commitment enforcement:

```bash
claude \
  --dangerously-skip-permissions \
  --max-turns {N} \
  "
# IDENTITY
Your actor identity comes from the repository manifest (.mentu/manifest.yaml).
Your role (author_type) comes from the HANDOFF document you are executing.

Read .mentu/manifest.yaml to discover your actor.
Read the HANDOFF to discover your author_type (executor/auditor/architect).

# COGNITIVE STANCE
Your domain depends on your author_type:
- executor: TECHNICAL domain. Fix technical failures, defer on intent/safety.
- auditor: SAFETY domain. Fix safety failures, defer on technical/intent.
- architect: INTENT domain. Fix intent failures, defer on technical/safety.

The Rule: Failure in YOUR domain -> own and fix. Failure elsewhere -> you drifted.

# MISSION
{One sentence: What outcome to deliver}

# CONTRACT
Done when:
- completion.json checks pass (tsc, build, {other checks})
- Commitment submitted with evidence
- {Specific deliverable 1}
- {Specific deliverable 2}

# PROTOCOL
1. Read .mentu/manifest.yaml to discover your actor identity
2. Read docs/HANDOFF-{Name}-v{X.Y}.md (complete instructions, includes author_type)
3. Update .claude/completion.json with provided contract
4. Check commitment status - if already claimed, proceed. If not:
   mentu claim cmt_XXX --author-type executor  # Actor auto-resolved
5. Add commitment ID to completion.json mentu.commitments.ids
6. Follow Build Order in HANDOFF ({N} stages)
7. Capture evidence:
   mentu capture 'Progress' --kind execution-progress --author-type executor
8. On completion: mentu submit cmt_XXX --summary '{Summary}' --include-files

# IDENTITY MODEL
- Actor: auto-resolved from .mentu/manifest.yaml (WHO)
- Author Type: from HANDOFF's author_type field (ROLE)
- Context: added to operations via meta.context (WHERE)

# CONSTRAINTS
- DO NOT create new files outside the specified paths
- DO NOT modify existing behavior (backwards compatibility)
- DO NOT skip validation before submit
- {Constraint 1}
- {Constraint 2}

# RECOVERY
- If tsc fails: fix type errors before proceeding
- If build fails: check imports and exports
- If mentu commands fail: verify .mentu/ exists
- If validation fails: check stance (mentu stance executor --failure technical), fix, don't argue

# CONTEXT
Read: docs/HANDOFF-{Name}-v{X.Y}.md (build instructions)
Reference: docs/PRD-{Name}-v{X.Y}.md (full specification)
Reference: {Additional context document}

# EVIDENCE
Final message must include:
- All files created/modified
- Build status (npm run build)
- Test results (npm test)
- Commitment ID submitted
"
```

---

### Option B: With Mentu Enforcer (WRAPPER SCRIPT)

Use this when you NEED stop-time commitment enforcement (agent cannot stop until commitments are closed):

```bash
~/claude-code-app/run-claude.sh \
  --dangerously-skip-permissions \
  --max-turns {N} \
  --mentu-enforcer \
  "Read .mentu/manifest.yaml for your actor, then read docs/HANDOFF-{Name}-v{X.Y}.md and execute."
```

> **IMPORTANT**: `--mentu-enforcer` is a CUSTOM FLAG that ONLY works with the wrapper script.
> The native `claude` command does NOT recognize this flag and will error.

---

## Minimal Prompts

### Without Enforcer (native claude):

```bash
claude \
  --dangerously-skip-permissions \
  --max-turns {N} \
  "Read .mentu/manifest.yaml for your actor identity, then read docs/HANDOFF-{Name}-v{X.Y}.md and execute as the HANDOFF's author_type."
```

### With Enforcer (wrapper script):

```bash
~/claude-code-app/run-claude.sh \
  --dangerously-skip-permissions \
  --max-turns {N} \
  --mentu-enforcer \
  "Read .mentu/manifest.yaml for your actor identity, then read docs/HANDOFF-{Name}-v{X.Y}.md and execute as the HANDOFF's author_type."
```

---

## What This Prompt Delivers

| Deliverable | Description |
|-------------|-------------|
| {File 1} | {What it does} |
| {File 2} | {What it does} |
| {File 3} | {What it does} |

---

## Expected Duration

- **Turns**: {N}-{M}
- **Complexity**: {Tier} ({Description})
- **Commitments**: {N}

---

## Verification After Completion

```bash
# Verify deliverables exist
ls -la {path/to/deliverables}

# Verify build passes
npm run build

# Verify tests pass
npm test

# Verify commitment closed
mentu show cmt_XXX
```

---

*{Closing statement relevant to the task}*
