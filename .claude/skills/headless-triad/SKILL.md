---
name: headless-triad
description: Run the Architect → Auditor → Executor chain headlessly via `claude -p`. No human in the loop after PRD creation. Stratified trust execution with full evidence trail.
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
  - TodoWrite
---

# Headless Triad Execution

Run the complete Architect → Auditor → Executor chain headlessly via `claude -p`.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│   THE PATTERN                                                                   │
│   ═══════════                                                                   │
│                                                                                 │
│   PRD (Architect)  ──────>  INSTRUCTION (Auditor)  ──────>  FILES (Executor)   │
│   Strategic Intent         Exact Specification             Implementation      │
│   What + Why               Exactly How                     Proof It Was Done   │
│                                                                                 │
│   Three commands. Zero human intervention. Full evidence trail.                │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Insight

An idea is not the same as an instruction.

| Role | Sees | Produces | Trust Level |
|------|------|----------|-------------|
| **Architect** | Nothing (vision only) | PRD (strategic intent) | Untrusted |
| **Auditor** | PRD + Codebase + References | INSTRUCTION (exact spec) | Trusted |
| **Executor** | INSTRUCTION only | Files + RESULT | Authorized |

**Key constraint:** The Executor cannot see the PRD. Only the INSTRUCTION. This enforces that the Auditor must be complete and unambiguous.

---

## The Trust Gradient

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│   Layer      │ Access           │ Produces                    │ Trust Level    │
│   ───────────┼──────────────────┼─────────────────────────────┼───────────────│
│   Architect  │ None (remote)    │ Strategic Intent            │ Untrusted     │
│   Auditor    │ Full (local)     │ Audit Evidence + Instruction│ Trusted       │
│   Executor   │ Scoped           │ Implementation + Evidence   │ Authorized    │
│                                                                                 │
│   The Auditor bridges untrusted intent and authorized execution.               │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Artifacts

### Legacy Location (Existing)

```
{repo}/.claude/craft/
├── PRD-{task}.md          ← Architect (strategic intent)
├── INSTRUCTION.md         ← Auditor (exact implementation spec)
└── RESULT.md              ← Executor (evidence of completion)
```

### Node-Enhanced Location (New)

```
{repo}/.mentu/craft/{task-name}/
├── node.yaml              ← Node identity and relationships
├── PRD.md                 ← Architect (strategic intent)
├── INSTRUCTION.md         ← Auditor (exact implementation spec)
└── RESULT.md              ← Executor (evidence of completion)
```

To initialize a craft node:
```bash
mentu craft-node init {task-name} --tier T2
```

---

## Headless Execution

### Step 1: Architect (Human or Agent)

Create the PRD with strategic intent. No code, no paths, no schemas.

```bash
mkdir -p .claude/craft

cat > .claude/craft/PRD-{task}.md << 'EOF'
# PRD: {Task Name}

**Mode:** Architect
**Target:** {repo}

## Strategic Intent
{What needs to be built or changed}
{No file paths. No schemas. No code snippets.}

## Rationale
{Why this matters. What problem it solves.}

## Constraints
- {What this change must NOT do}
- {Boundaries and guardrails}

## Expected Outcome
{What success looks like}

## References
- {Path to reference files for Auditor to read}
EOF
```

### Step 2: Auditor (Headless)

The Auditor reads PRD + codebase and produces an exact INSTRUCTION.

```bash
cd /path/to/repo

claude -p "
# IDENTITY
You are agent:claude-auditor in the Headless Triad.

# PROTOCOL
Read and follow: /Users/rashid/Desktop/Workspaces/mentu-ai/.claude/commands/craft--auditor.md

# MISSION
1. Read .claude/craft/PRD-{task}.md
2. Read the current codebase state
3. Read reference files if specified in the PRD
4. Audit against philosophy (CLAUDE.md, .mentu/genesis.key, .mentu/manifest.yaml)
5. Assess technical feasibility
6. If APPROVE: Produce .claude/craft/INSTRUCTION.md with EXACT file contents

# INSTRUCTION REQUIREMENTS
The INSTRUCTION.md must contain:
- Exact file paths to create/modify
- Exact content for each file (copy-paste ready)
- No ambiguity - the Executor implements literally what you write
- Audit context section with provenance

# CONSTRAINT
Be specific. No ambiguity. The Executor will implement literally what you write.
The Executor cannot see the PRD - only your INSTRUCTION.
" --dangerously-skip-permissions
```

### Step 3: Executor (Headless)

The Executor reads INSTRUCTION only and implements exactly.

```bash
claude -p "
# IDENTITY
You are agent:claude-executor in the Headless Triad.

# PROTOCOL
Read and follow: /Users/rashid/Desktop/Workspaces/mentu-ai/.claude/commands/craft--executor.md

# PROVENANCE
This instruction has been AUDITED and APPROVED.
Instruction: .claude/craft/INSTRUCTION.md
Trust Level: authorized

# MISSION
1. Read .claude/craft/INSTRUCTION.md
2. Implement exactly what it specifies
3. Create the files with the exact contents provided
4. Create .claude/craft/RESULT.md documenting what you created
5. Run any verification commands specified

# CONSTRAINTS
- Implement EXACTLY what the INSTRUCTION specifies
- Do NOT read the PRD - you are bounded by the INSTRUCTION only
- Do NOT add features not in the INSTRUCTION
- Document everything in RESULT.md
" --dangerously-skip-permissions
```

---

## One-Liner Chain

```bash
# The entire chain in three commands
cd /path/to/repo && \
claude -p "You are the AUDITOR. Read .claude/craft/PRD-{task}.md and the codebase. Produce .claude/craft/INSTRUCTION.md with EXACT implementation details. Follow /Users/rashid/Desktop/Workspaces/mentu-ai/.claude/commands/craft--auditor.md protocol." --dangerously-skip-permissions && \
claude -p "You are the EXECUTOR. Read .claude/craft/INSTRUCTION.md and implement exactly. Create .claude/craft/RESULT.md. Follow /Users/rashid/Desktop/Workspaces/mentu-ai/.claude/commands/craft--executor.md protocol." --dangerously-skip-permissions && \
echo "Chain complete. Check .claude/craft/RESULT.md"
```

---

## Full Sophistication Mode

For maximum rigor, use the full craft commands which include:
- Mentu evidence capture at each phase
- Checkpoint creation before work
- Multi-phase validation
- Provenance chain documentation
- Commitment tracking

### Auditor (Full Protocol)

```bash
claude -p "
Execute /craft--auditor with intent: .claude/craft/PRD-{task}.md

This means:
1. Read the full protocol at /Users/rashid/Desktop/Workspaces/mentu-ai/.claude/commands/craft--auditor.md
2. Follow every phase exactly
3. Create checkpoint before work
4. Capture Mentu evidence
5. Produce AUDIT document if T2+
6. If approved, produce INSTRUCTION.md via craft chain
" --dangerously-skip-permissions --max-turns 100
```

### Executor (Full Protocol)

```bash
claude -p "
Execute /craft--executor with instruction: .claude/craft/INSTRUCTION.md

This means:
1. Read the full protocol at /Users/rashid/Desktop/Workspaces/mentu-ai/.claude/commands/craft--executor.md
2. Verify provenance (audit context exists)
3. Follow every phase exactly
4. Create RESULT document
5. Submit via Mentu with evidence
" --dangerously-skip-permissions --max-turns 100
```

---

## INSTRUCTION.md Format

The Auditor must produce INSTRUCTION.md in this format:

```markdown
---
id: INSTRUCTION-{Name}
type: instruction
prd_ref: PRD-{task}.md
created: YYYY-MM-DD
auditor: agent:claude-auditor
verdict: APPROVE
---

# INSTRUCTION: {Task Name}

## Audit Context

**PRD Source**: .claude/craft/PRD-{task}.md
**Auditor**: agent:claude-auditor
**Verdict**: APPROVE
**Checkpoint**: {git_sha}

## Files to Create

### File 1: {path/to/file.ext}

```{language}
{EXACT content - copy-paste ready}
```

### File 2: {path/to/file.ext}

```{language}
{EXACT content - copy-paste ready}
```

## Files to Modify

### Modify: {path/to/existing.ext}

**Location**: Line {N} or after `{marker}`

**Add**:
```{language}
{EXACT content to add}
```

## Verification

After implementation, run:

```bash
{verification command}
```

Expected: {what success looks like}

## Scope Boundaries

The Executor is authorized to:
- {What they can do}

The Executor must NOT:
- {What they cannot do}
```

---

## RESULT.md Format

The Executor must produce RESULT.md in this format:

```markdown
---
id: RESULT-{Name}
type: result
instruction_ref: INSTRUCTION-{Name}
created: YYYY-MM-DD
executor: agent:claude-executor
---

# RESULT: {Task Name}

## Summary

{What was implemented - one paragraph}

## Files Created

| File | Purpose |
|------|---------|
| {path} | {why} |

## Files Modified

| File | Change |
|------|--------|
| {path} | {what changed} |

## Verification

| Check | Status | Output |
|-------|--------|--------|
| {check} | {PASS/FAIL} | {summary} |

## Scope Compliance

| Instruction | Followed |
|-------------|----------|
| {instruction 1} | Yes |
| {instruction 2} | Yes |

## Provenance

- PRD: .claude/craft/PRD-{task}.md (Architect)
- INSTRUCTION: .claude/craft/INSTRUCTION.md (Auditor)
- RESULT: This document (Executor)

Trust chain: Architect → Auditor → Executor
```

---

## When to Use This Pattern

| Scenario | Use Headless Triad |
|----------|-------------------|
| Batch processing multiple repos | Yes |
| CI/CD automation | Yes |
| Parallel agent execution | Yes |
| One-off interactive work | No (use /craft directly) |
| Exploration/research | No |

---

## The Invariant

```
PRD contains WHAT and WHY.
INSTRUCTION contains EXACTLY HOW.
RESULT contains PROOF IT WAS DONE.

Architect dreams. Auditor scopes. Executor implements.
Each role produces one artifact. Each artifact enables the next.
Nothing bypasses the Auditor's judgment.
```

---

## Relationship to /craft Commands

This skill provides the **headless invocation pattern** for:

| Command | Interactive | Headless (this skill) |
|---------|-------------|----------------------|
| `/craft--architect` | User in loop | `claude -p "..." --dangerously-skip-permissions` |
| `/craft--auditor` | User in loop | `claude -p "..." --dangerously-skip-permissions` |
| `/craft--executor` | User in loop | `claude -p "..." --dangerously-skip-permissions` |

The commands contain the full protocol sophistication. This skill provides the invocation wrapper.

---

## References

- Protocol: `.claude/commands/craft--auditor.md` (Auditor full protocol)
- Protocol: `.claude/commands/craft--executor.md` (Executor full protocol)
- Protocol: `.claude/commands/craft--architect.md` (Architect receipt protocol)
- Template: `docs/templates/TEMPLATE-Audit.md` (Audit document format)
- Skill: `.claude/skills/mentu-craft/SKILL.md` (Mentu integration)

---

*Stratified Trust Orchestration — Headless execution with full accountability.*
