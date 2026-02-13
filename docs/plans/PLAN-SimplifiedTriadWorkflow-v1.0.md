---
id: PLAN-SimplifiedTriadWorkflow-v1.0
type: plan
created: 2026-01-12
status: draft
---

# Plan: Simplified Triad Workflow

## Analysis: Anthropic's Autonomous Coding vs Our Mentu Workflow

### Anthropic's Approach (Simple & Effective)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      ANTHROPIC LONG-RUNNING AGENT                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  SESSION 1: Initializer Agent                                                   │
│  ───────────────────────────                                                    │
│  1. Read app_spec.txt                                                           │
│  2. Generate feature_list.json (200 features)                                   │
│  3. Create init.sh                                                              │
│  4. Initialize git                                                              │
│                                                                                 │
│  SESSIONS 2+: Coding Agent                                                      │
│  ─────────────────────────                                                      │
│  1. Read progress (git log, claude-progress.txt)                                │
│  2. Run init.sh to start servers                                                │
│  3. Verify 1-2 existing features still work                                     │
│  4. Pick ONE feature from feature_list.json                                     │
│  5. Implement + test with browser automation                                    │
│  6. Mark "passes": true in feature_list.json                                    │
│  7. Git commit with descriptive message                                         │
│  8. Update claude-progress.txt                                                  │
│  9. Leave app in working state                                                  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

Files that persist across sessions:
├── feature_list.json      # Source of truth (200 test cases)
├── claude-progress.txt    # Human-readable progress notes
├── init.sh                # Environment setup
└── .git/                  # Full history
```

**Key Insights from Their Approach:**

1. **Two prompts, not two architectures** - Same agent, different initial message
2. **feature_list.json is sacred** - Only modify `passes` field, never remove features
3. **Incremental progress** - ONE feature per session is acceptable
4. **Git is the recovery mechanism** - Not custom tools
5. **Browser automation for verification** - Real testing, not curl
6. **Progress file is simple text** - Not structured ledger

### Our Current Mentu Workflow (Complex)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         MENTU DUAL TRIAD                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  TRUST GRADIENT                                                                 │
│  ──────────────                                                                 │
│  Architect (untrusted) → INTENT document                                        │
│       ↓                                                                         │
│  Auditor (trusted) → AUDIT document → CRAFT instruction                         │
│       ↓                                                                         │
│  Executor (authorized) → HANDOFF → code → RESULT document                       │
│                                                                                 │
│  MENTU PRIMITIVES                                                               │
│  ────────────────                                                               │
│  Memory → capture observations                                                  │
│  Commitment → create obligation                                                 │
│  Evidence → prove completion                                                    │
│  Tiers → T1/T2/T3/T4 validation gates                                          │
│                                                                                 │
│  DOCUMENT CHAIN                                                                 │
│  ──────────────                                                                 │
│  INTENT → AUDIT → HANDOFF → PROMPT → RESULT                                     │
│                                                                                 │
│  HOOKS                                                                          │
│  ─────                                                                          │
│  SessionStart → inject commitment context                                       │
│  PostToolUse → capture evidence                                                 │
│  Stop → enforce closure, run validators                                         │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

Files we generate:
├── docs/PRD-*.md
├── docs/HANDOFF-*.md
├── docs/INTENT-*.md
├── docs/AUDIT-*.md
├── docs/PROMPT-*.md
├── docs/RESULT-*.md
├── .mentu/ledger.jsonl
├── .mentu/genesis.key
├── .claude/completion.json
├── .claude/hooks/*.py
├── .claude/validators/*.sh
└── .claude/agents/*.md
```

**What We Overcomplicated:**

| Their Approach | Our Approach | Overhead |
|----------------|--------------|----------|
| `feature_list.json` | PRD + HANDOFF + INTENT + AUDIT + RESULT | 5x docs |
| `claude-progress.txt` | `.mentu/ledger.jsonl` + Supabase sync | Database + sync |
| `init.sh` | Various shell scripts | Similar |
| Git commits | Git + mentu capture + mentu submit | Extra ceremony |
| 2 prompts | Architect/Auditor/Executor chain | 3 agents |
| Browser test | Browser test + validators + tiers | Extra validation |

---

## Proposal: Merge Approaches

### Keep What Works

**From Anthropic:**
- Two-phase pattern (setup → iterate)
- `feature_list.json` as source of truth
- Simple progress file
- ONE feature per session
- Git as recovery
- Browser automation verification

**From Mentu:**
- Evidence capture (for accountability)
- Commitment tracking (for async work)
- Trust gradient (for untrusted inputs)
- Supabase sync (for visibility)

### New Simplified Workflow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    MENTU SIMPLIFIED TRIAD                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  PHASE 1: Planning (Architect)                                                  │
│  ─────────────────────────────                                                  │
│  Input: High-level request                                                      │
│  Output: feature_list.json + mentu commitment                                   │
│                                                                                 │
│  PHASE 2: Validation (Auditor) - OPTIONAL for trusted sources                   │
│  ──────────────────────────────────────────────────────────────────────         │
│  Input: feature_list.json from untrusted source                                 │
│  Output: Approved/modified feature_list.json                                    │
│                                                                                 │
│  PHASE 3: Execution (Executor) - LOOP                                           │
│  ─────────────────────────────────────                                          │
│  1. Read feature_list.json + progress.txt + git log                             │
│  2. Pick ONE failing feature                                                    │
│  3. Implement + test                                                            │
│  4. Mark passes: true                                                           │
│  5. Git commit + mentu capture                                                  │
│  6. Update progress.txt                                                         │
│  7. If all pass → mentu submit                                                  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

Files (simplified):
├── feature_list.json      # Source of truth (replaces PRD detail)
├── progress.txt           # Human-readable progress (replaces RESULT chain)
├── init.sh                # Environment setup
├── .mentu/ledger.jsonl    # Keep for accountability
└── .git/                  # Full history
```

### Document Reduction

| Before | After | Notes |
|--------|-------|-------|
| PRD-*.md | feature_list.json | Features are the spec |
| HANDOFF-*.md | (embedded in prompt) | Inline instructions |
| INTENT-*.md | (only for untrusted) | Skip for internal work |
| AUDIT-*.md | (only for untrusted) | Skip for internal work |
| PROMPT-*.md | (inline) | No separate file |
| RESULT-*.md | progress.txt + git | Simpler closure |

### When to Use Full Triad

```
IF source == "external" OR source == "untrusted":
    Use full triad: INTENT → AUDIT → HANDOFF → RESULT
ELSE IF source == "internal" AND trusted:
    Use simplified: feature_list.json → iterate → progress.txt
```

---

## Implementation Plan

### Stage 1: Create Simplified Harness

Create `mentu-harness/` with:

```
mentu-harness/
├── harness.py               # Main loop (like autonomous_agent_demo.py)
├── prompts/
│   ├── architect.md         # Phase 1: Generate feature_list.json
│   └── executor.md          # Phase 2+: Iterate on features
├── security.py              # Bash allowlist
└── README.md
```

### Stage 2: Simplify Prompt Templates

**architect.md** (Phase 1):
```markdown
You are setting up a project. Based on the specification:

1. Create feature_list.json with comprehensive test cases
2. Create init.sh for environment setup
3. Initialize git
4. Create initial mentu commitment

Output format for feature_list.json:
{
  "features": [
    {
      "id": "F001",
      "description": "...",
      "steps": ["...", "..."],
      "passes": false
    }
  ]
}
```

**executor.md** (Phase 2+):
```markdown
You are making incremental progress on a project.

## Startup Protocol
1. pwd
2. Read progress.txt and git log
3. Read feature_list.json
4. Run init.sh if needed
5. Verify 1-2 passing features still work

## Work Protocol
1. Pick ONE failing feature (highest priority)
2. Implement the feature
3. Test with browser automation (screenshots required)
4. If working: mark passes: true
5. Git commit with descriptive message
6. Update progress.txt
7. mentu capture "Completed feature: {id}"

## Completion
When all features pass:
1. mentu submit cmt_xxx --summary "All features complete"
2. Stop

## Rules
- ONE feature per session is acceptable
- NEVER remove features from feature_list.json
- ALWAYS leave app in working state
- ALWAYS take screenshots when testing
```

### Stage 3: Integrate Mentu Checkpoints

Add mentu operations at key points:

```python
# In harness.py

async def run_session(is_first: bool):
    if is_first:
        # Architect phase
        prompt = get_architect_prompt()
        # After completion, auto-capture:
        # mentu commit "Build {project_name}" --source mem_xxx
    else:
        # Executor phase
        prompt = get_executor_prompt()
        # Progress captured via executor prompt instructions
```

### Stage 4: Trust Gradient (Optional Layer)

For untrusted inputs, add auditor phase:

```python
if source_is_untrusted(feature_list):
    # Run auditor before executor
    prompt = get_auditor_prompt()
    # Validates feature_list.json against codebase reality
    # Produces approved feature_list.json
```

---

## Decision Points

### Question 1: Replace Documents with feature_list.json?

**Option A: Yes, full replacement**
- PRD content → feature_list.json features
- HANDOFF content → executor prompt
- RESULT content → progress.txt + git

**Option B: Hybrid**
- Keep PRD for strategic context
- Use feature_list.json for execution tracking
- Replace HANDOFF/RESULT with progress.txt

**Recommendation**: Option A for internal work, Option B for external/formal projects

### Question 2: When to Use Trust Gradient?

**Option A: Always (current)**
- Every task goes through Architect → Auditor → Executor

**Option B: Conditional (proposed)**
- Internal/trusted: Direct to Executor with feature_list.json
- External/untrusted: Full gradient

**Recommendation**: Option B - trust gradient for untrusted inputs only

### Question 3: Mentu Integration Level?

**Option A: Minimal**
- Only `mentu commit` at start, `mentu submit` at end
- No intermediate captures

**Option B: Key checkpoints**
- Commit at start
- Capture at feature completion
- Submit at project completion

**Option C: Full (current)**
- Every operation captured
- SessionStart hook injects context
- PostToolUse captures evidence

**Recommendation**: Option B - key checkpoints only

---

## Comparison Summary

| Aspect | Anthropic | Mentu Current | Mentu Proposed |
|--------|-----------|---------------|----------------|
| Setup time | Minutes | Hours (docs) | Minutes |
| Documents | 2 (spec + features) | 5+ per task | 2 (spec + features) |
| Progress tracking | JSON + text | Ledger + DB | JSON + text + ledger |
| Recovery | Git | Git + rewind | Git |
| Verification | Browser | Browser + validators | Browser |
| Trust model | Implicit | Explicit gradient | Conditional gradient |
| Complexity | Low | High | Medium |

---

## Next Steps

1. **Approve plan direction** - Simplify or maintain current?
2. **Create mentu-harness/** - Minimal working harness
3. **Test with real project** - Build something using new approach
4. **Document patterns** - Update CLAUDE.md with simplified workflow
5. **Migrate existing docs** - Convert PRDs to feature_list.json format

---

*Simpler is better. Complexity is a bug, not a feature.*
