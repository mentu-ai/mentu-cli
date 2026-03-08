# Ralph Sequences Reference

## Sequence JSON Schema

```json
{
  "name": "string (required) — kebab-case identifier, matches filename",
  "description": "string (required) — human-readable summary of all steps",
  "steps": [
    {
      "label": "string (required) — unique step identifier, appears in logs",
      "auth": "string (optional, default: 'work') — OAuth profile name",
      "dir": "string (optional, default: '.') — working directory relative to project root",
      "args": ["string array (optional) — args passed to ralph run"],
      "protocols": ["string array (optional) — active protocol enforcement tags"],
      "auto_review": "boolean (optional, default: false) — enable Stop hook review gate",
      "recon_artifact": "string (optional) — path to Ghidra recon doc (for ghidra-gate steps)",
      "circuit_breaker": "boolean (optional, default: true) — include in circuit breaker evaluation"
    }
  ]
}
```

### Step Fields

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `label` | Yes | — | Unique identifier for the step. Used in logs and status display. |
| `auth` | No | `"work"` | OAuth profile. Maps to `ralph-${auth}` alias and `~/.claude/${auth}-token`. |
| `dir` | No | `"."` | Working directory relative to project root. Use for worktree steps. |
| `args` | No | `[]` | Array of args passed through to `ralph run`. Typically `["-P", "<prompt-path>"]`. |
| `protocols` | No | `[]` | Protocol tags that activate **structural enforcement hooks** for this step. See [Protocol Tags](#protocol-tags). |
| `auto_review` | No | `false` | Enable the Stop hook review gate. Blocks agent exit unless build passes, LOOP_COMPLETE is present, and git has changes. See [Review Gate](#review-gate). |
| `recon_artifact` | No | `""` | Path to the Ghidra recon document for this step. Used by ghidra-gate enforcement to verify the artifact exists before allowing source code writes. |
| `circuit_breaker` | No | `true` | Whether this step participates in circuit breaker evaluation. Set to `false` for steps that are expected to exit non-zero (e.g., exploratory recon). See [Circuit Breaker](#circuit-breaker). |

### Auth Profiles

Profiles are defined in `~/.zshrc` via the `ralph()` function. Each profile:
1. Reads OAuth token from `~/.claude/${profile}-token`
2. Exports `CLAUDE_CODE_OAUTH_TOKEN`
3. Sets `MAX_THINKING_TOKENS=63999`
4. Runs `ralph run <args> -- --dangerously-skip-permissions`

Available profiles (from `~/.zshrc`):
```
work, talisman, rashidaeg, affihub, ppw, vendora, uxrouter, proton, rashid
```

To add a new profile:
1. Create token file: `~/.claude/<name>-token`
2. Add to `ralph()` case statement in `~/.zshrc`: `--<name>) profile="<name>" ;;`
3. Add to alias loop: update the `for _p in ...` list

### Args: `-P` (Prompt File)

The `-P <file>` flag is ralph's native `--prompt-file` option. It overrides the `prompt_file` in `ralph.yml` for that run.

```json
"args": ["-P", ".ralph/PROMPT-my-step.md"]
```

Path is relative to the step's working directory (resolved from `dir`).

---

## Protocol Tags

The `protocols` array activates **structural enforcement hooks** that make protocol violations mechanically impossible. This is not documentation metadata — `ralph-seq` writes a `.claude/protocol-state.json` file before each step, and Claude Code hooks read it to enforce constraints at the tool-call level.

### How It Works

```
Sequence JSON                ralph-seq.zsh               .claude/protocol-state.json       Hooks
  "protocols": [...]    -->  reads protocols array   -->  writes state file              -->  enforce constraints
  "auto_review": true   -->  reads auto_review       -->  {active_protocols, ...}        -->  blocks violations
  "recon_artifact": "..." -> reads artifact path     -->  {ghidra_gate: {...}}           -->  gate checks
```

The state file is written before each step launches and cleared after completion.

### Available Protocol Tags

| Tag | Enforcement Hook | Event | What It Blocks |
|-----|-----------------|-------|----------------|
| `"context-isolation"` | `context_isolation_gate.py` | SubagentStop | Sub-agent returns with >200 lines, hex dumps, large JSON arrays, raw addresses |
| `"ghidra-gate"` | `ghidra_gate_guard.py` | PreToolUse | Ghidra/Spectre MCP tools in downstream (non-recon) steps; source code writes when recon artifact is missing |

### Ghidra Gate — How Enforcement Decides

The hook uses **two signals** to decide what to allow:

**Signal 1 — Step label.** The hook reads `step_label` from `protocol-state.json`. If the label contains the substring `recon` (case-insensitive), the step is treated as a **recon step** and Ghidra/Spectre MCP tools are **allowed**. Otherwise, the step is **downstream** and RE tools are **blocked**.

**Signal 2 — Recon artifact existence.** For downstream steps, the hook reads `recon_artifact` from `protocol-state.json` and checks `Path(recon_artifact).exists()`. If the file is missing, **Write/Edit to source code directories** (Sources/, src/, lib/, Tests/, tests/, Package.swift) are **blocked**.

| Step type | Label contains `recon`? | Ghidra tools | Source writes |
|-----------|------------------------|-------------|---------------|
| Recon step | YES | ALLOWED | ALLOWED |
| Downstream, artifact exists | NO | BLOCKED | ALLOWED |
| Downstream, artifact missing | NO | BLOCKED | BLOCKED |

### The Recon → Impl → Review Triplet

**Every feature that needs ghidra-gate enforcement requires a minimum of three steps:**

```json
// 1. Recon step — label MUST contain "recon" so RE tools are allowed
{
  "label": "feature-recon",
  "protocols": ["ghidra-gate", "context-isolation"],
  "args": ["-P", ".ralph/PROMPT-feature-recon.md"],
  "circuit_breaker": false
}

// 2. Impl step — recon_artifact MUST point to the file created by step 1
{
  "label": "feature-impl",
  "protocols": ["ghidra-gate", "context-isolation"],
  "args": ["-P", ".ralph/PROMPT-feature-impl.md"],
  "recon_artifact": "docs/ghidra-analysis/feature-recon.md",
  "auto_review": true
}

// 3. Review step — no protocols needed (review is manual quality gate)
{
  "label": "feature-review",
  "args": ["-P", ".ralph/PROMPT-feature-review.md"]
}
```

**If you skip the recon step, the impl step is structurally deadlocked.** Ghidra tools are blocked (label doesn't contain "recon") AND source writes are blocked (recon artifact doesn't exist). The agent cannot do anything productive.

### Sequence Design Validation Checklist

When creating a sequence with `ghidra-gate` steps, verify ALL of these:

- [ ] Every ghidra-gate impl step is preceded by a recon step whose label contains `recon`
- [ ] The recon step's PROMPT writes to the exact path that the impl step's `recon_artifact` points to
- [ ] `recon_artifact` paths are **relative to project root** (never absolute cross-repo paths)
- [ ] Recon steps have `circuit_breaker: false` (RE is exploratory, exit code may be non-zero)
- [ ] Recon steps do NOT have `auto_review: true` (git-changes check may false-positive on untracked summaries)
- [ ] Impl steps have `auto_review: true` if quality gating is desired
- [ ] Review steps have NO `auto_review` and NO `protocols` (they ARE the gate, not gated)
- [ ] Steps without RE needs have NO `ghidra-gate` in protocols (bypass by omission)

### Bypassing Protocols: Design-Time, Not Runtime

**There is no `--skip-ghidra` flag.** There is no runtime bypass mechanism. This is intentional — runtime bypasses violate the structural guarantees that make these protocols trustworthy.

To exempt a step from a protocol, the sequence author **omits the protocol tag** from that step's `protocols` array in the JSON. The bypass happens at sequence design time, not at execution time.

**Example: Steps that don't need Ghidra Gate**

Steps GU3 and GU4 in the Grand Unification sequence touch standard application logic (air-gapped embedder, OCR unification) — no binary RE, no undocumented APIs, no hardware interaction. They simply omit `"ghidra-gate"`:

```json
{
  "label": "gu3-air-gapped-embedder",
  "auth": "work",
  "args": ["-P", ".ralph/PROMPT-gu3-air-gapped-embedder.md"]
}
```

Compare with GU1, which requires a recon step first and then references the artifact:

```json
{
  "label": "gu1-recon",
  "auth": "work",
  "args": ["-P", ".ralph/PROMPT-gu1-recon.md"],
  "protocols": ["ghidra-gate", "context-isolation"],
  "circuit_breaker": false
},
{
  "label": "gu1-virtiofs-bridge",
  "auth": "work",
  "args": ["-P", ".ralph/PROMPT-gu1-virtiofs-bridge.md"],
  "protocols": ["ghidra-gate", "context-isolation"],
  "recon_artifact": "docs/ghidra-analysis/gu1-virtiofs-recon.md",
  "auto_review": true
}
```

**Decision criteria for including `"ghidra-gate"`:**
- The step touches undocumented APIs, private Apple frameworks, or hardware state → include (recon + impl)
- The step uses information from binary RE (struct layouts, function addresses) → include (recon + impl)
- The step is pure application logic, UI, tests, or standard library usage → omit

**Decision criteria for including `"context-isolation"`:**
- The step processes large datasets, many files, or bulk search results → include
- The step spawns sub-agents for research or synthesis → include
- The step is focused implementation on known files → omit

### Usage Examples

**Full RE triplet (recon → impl → review):**
```json
{
  "label": "gu2-recon",
  "auth": "work",
  "args": ["-P", ".ralph/PROMPT-gu2-recon.md"],
  "protocols": ["ghidra-gate", "context-isolation"],
  "circuit_breaker": false
},
{
  "label": "gu2-ane-socket",
  "auth": "work",
  "args": ["-P", ".ralph/PROMPT-gu2-ane-socket.md"],
  "protocols": ["ghidra-gate", "context-isolation"],
  "recon_artifact": "docs/ghidra-analysis/gu2-ane-recon.md",
  "auto_review": true
},
{
  "label": "gu2-review",
  "auth": "work",
  "args": ["-P", ".ralph/PROMPT-gu2-review.md"]
}
```

**Application logic step — no protocols needed:**
```json
{
  "label": "gu4-ocr-unification",
  "auth": "work",
  "args": ["-P", ".ralph/PROMPT-gu4-ocr-unification.md"]
}
```

**Recon step — context isolation only (ghidra tools allowed because label contains "recon"):**
```json
{
  "label": "gu0-integration-recon",
  "auth": "work",
  "args": ["-P", ".ralph/PROMPT-gu0-integration-recon.md"],
  "protocols": ["context-isolation"]
}
```

**Review step with auto-review gate:**
```json
{
  "label": "gu1-review",
  "auth": "work",
  "args": ["-P", ".ralph/PROMPT-gu1-review.md"],
  "auto_review": true
}
```

---

## Mentu Instrumentation

ralph-seq automatically creates Mentu commitments at sequence/step lifecycle boundaries. All mentu calls are guarded with `command -v mentu &>/dev/null` and `|| true` — if mentu is missing or fails, the sequence continues normally.

### Lifecycle Boundaries

| Boundary | When | Mentu Operations | Env Vars Set |
|----------|------|-----------------|--------------|
| **Sequence start** | After lock acquired, before step loop (fresh runs only, not `--from`) | `capture` → `commit` → `claim` | `RALPH_SEQ_PARENT_CMT`, `RALPH_SEQ_DEFINITION_MEM` |
| **Step start** | Before launching agent | `commit` → `link` to parent → `claim` | `RALPH_WORKFLOW_STEP_CMT` |
| **Step end (success)** | After exit code 0 | `capture` evidence → `close` step commitment | — |
| **Step end (failure)** | After non-zero exit | `annotate` failure message on step commitment | — |
| **PROMPT capture** | After step commitment, before agent launch | `capture` PROMPT title → `link` to step commitment | — |
| **Sequence end** | After all steps complete | `capture` summary → `close` parent commitment | — |
| **CONTEXT generation** | After step loop completes | Generate `docs/CONTEXT-{name}.md` → `capture` as context memory | — |

### Environment Variables

These are exported so hooks and agent sessions within each step can read them:

| Variable | Set At | Value |
|----------|--------|-------|
| `RALPH_SEQ_PARENT_CMT` | Sequence start | `cmt_xxx` — parent commitment for the entire sequence |
| `RALPH_SEQ_DEFINITION_MEM` | Sequence start | `mem_xxx` — captured memory describing the sequence |
| `RALPH_WORKFLOW_STEP_CMT` | Step start | `cmt_xxx` — commitment for the current step |

### Resume Behavior (`--from N`)

When resuming with `--from N`, the sequence start instrumentation is **skipped** — no parent commitment is created. Individual steps still get their own commitments. To track a resumed sequence under the original parent, set `RALPH_SEQ_PARENT_CMT` manually before launching.

### Commitment Topology

```
cmt_parent (sequence: "my-feature")
  ├── cmt_step1 (step: "feature-recon") — linked via mentu link
  ├── cmt_step2 (step: "feature-impl") — linked via mentu link
  └── cmt_step3 (step: "feature-review") — linked via mentu link
```

Each step commitment is linked to the parent via `mentu link cmt_step cmt_parent --kind related`. The `capture.ts` auto-link hook reads `RALPH_WORKFLOW_STEP_CMT` to link file-change evidence to the active step.

### Accountability Chain

The full traceability chain from instruction to outcome:

```
PROMPT (mem, kind=note) ──→ step commitment (cmt) ──→ step evidence (mem, kind=step_result) ──→ CONTEXT (mem, kind=context) ──→ parent commitment (cmt)
```

| Artifact | Mentu Type | Created By | Linked To |
|----------|-----------|------------|-----------|
| PROMPT file | `mem` (kind=note) | ralph-seq PROMPT capture | step commitment |
| Step commitment | `cmt` | ralph-seq step start | parent commitment |
| Step evidence | `mem` (kind=step_result) | ralph-seq step end | step commitment |
| CONTEXT doc | `mem` (kind=context) | ralph-seq CONTEXT generation | — (registered standalone) |
| Parent commitment | `cmt` | ralph-seq sequence start | — (top-level) |

This closes the accountability loop: what we told the agent (PROMPT) → what it promised (commitment) → what it did (evidence) → what we learned (CONTEXT).

---

## ralph-seq.zsh Internals

### File Locations

| File | Purpose |
|------|---------|
| `~/.ralph/ralph-seq.zsh` | Function definition (sourced from `~/.zshrc`) |
| `~/.ralph/lib/seq-utils.sh` | Shared utility functions (sourced by ralph-seq) |
| `.ralph/sequences/<name>.json` | Sequence definitions (per-project) |
| `.ralph/sequences/.current` | Lock file with PID + current step |
| `.ralph/sequences/logs/<name>-<timestamp>.log` | Execution logs |
| `.ralph/sequences/step-status/<label>.json` | Step status (circuit breaker input) |
| `.ralph/sequences/step-results/<label>-<timestamp>.md` | Captured step output |
| `.claude/protocol-state.json` | Protocol state (written before step, cleared after) |

### Execution Flow

```
ralph-seq <name> [--from N]
  1. Validate: sequence file exists, --from in range
  2. Concurrency guard: check .current lock (auto-clean stale PIDs)
  3. Source ~/.ralph/lib/seq-utils.sh
  4. Clean step-status/ on fresh runs (not --from)
  4b. Mentu: capture sequence definition → commit → claim (fresh runs only)
  5. Create log file: logs/<name>-YYYYMMDD-HHMMSS.log
  6. For each step (from start_from to total):
     a. Read step config from JSON (label, dir, auth, args, protocols, auto_review, recon_artifact)
     b. Write .current tracking file
     c. Log step start
     c2. Mentu: commit step → link to parent → claim → export RALPH_WORKFLOW_STEP_CMT
     d. Write .claude/protocol-state.json (if protocols or auto_review present)
     e. Execute: (cd "$step_dir" && ralph-${auth} --no-tui "${step_args[@]}")
     f. Clear .claude/protocol-state.json
     g. Capture exit code, log step end
     g2. Mentu: on success → capture evidence → close; on failure → annotate
     h. Write step status JSON (for circuit breaker)
     i. Evaluate circuit breaker — halt if tripped
  7. Mentu: capture sequence summary → close parent commitment
  8. Log footer (total steps, ok count, warn count)
  9. Clean up .current
  10. macOS notification (Glass for all-ok, Purr for warnings, Sosumi for breaker trip)
```

### Exit Codes

| Exit Code | Meaning | ralph-seq Action |
|-----------|---------|------------------|
| 0 | Step completed successfully | Count as OK |
| 1 | Agent error or failure | Count as WARN, continue |
| 2 | CLI argument error | Count as WARN, continue |
| Non-zero | Max iterations reached | Count as WARN, continue |

ralph-seq continues to the next step on non-zero exit. The circuit breaker halts the sequence only when failure patterns emerge (consecutive failures or high failure ratio).

### Concurrency

Only one sequence can run per project at a time. The `.current` file contains:
```json
{"sequence":"name","pid":12345,"step":2,"step_label":"review","started":"2026-02-20T21:29:03"}
```

If the PID is dead, the lock is auto-cleaned on next `ralph-seq` invocation or `ralph-seq status`.

---

## Review Gate

The review gate is a Stop hook (`review_gate.py`) that blocks agent exit when structural checks fail. It only activates when `auto_review: true` in the step's protocol state.

### Checks

1. **Build command passes** — extracted from CLAUDE.md `## Commands` section
2. **LOOP_COMPLETE present** — in the agent's final message
3. **Git has changes** — working tree is not clean (agent didn't no-op). **Skipped for recon steps** (label contains `recon`) because recon may only produce files in `.claude/summaries/` or untracked docs.

### Infinite Loop Prevention

The hook respects `stop_hook_active` — if the agent is already in a Stop hook retry cycle, it always allows exit on the second attempt.

### When to Use

- Implementation steps where build verification is critical (`auto_review: true`)
- Steps that should never be allowed to no-op

### When NOT to Use

- **Recon steps** — git-changes check is skipped but build/LOOP_COMPLETE still run; prefer `circuit_breaker: false` instead
- **Review steps** — they ARE the quality gate; don't gate the gate
- **Exploratory steps** that may legitimately produce no changes

---

## Circuit Breaker

The circuit breaker lives in `ralph-seq.zsh` (not hooks — it needs cross-step visibility). It halts a sequence when failure patterns indicate systemic problems.

### Triggers

| Trigger | Threshold | Env Override |
|---------|-----------|-------------|
| Consecutive failures | 3 steps | `RALPH_CB_MAX_CONSECUTIVE` |
| Failure ratio | >50% (after 4+ steps) | `RALPH_CB_MAX_RATIO` |

### How It Works

1. After each step, `ralph-seq` reads step status from `.ralph/sequences/step-status/<label>.json`
2. The status file is written by both:
   - `ralph-seq` itself (from exit code + duration)
   - `ralph_post_step.sh` Stop hook (from LOOP_COMPLETE detection)
3. Circuit breaker evaluates consecutive failures (reading step status in reverse order) and overall failure ratio
4. If either threshold is exceeded, the sequence halts with a macOS notification (Sosumi sound)

### Per-Step Opt-Out

Set `"circuit_breaker": false` on steps that are expected to exit non-zero:

```json
{
  "label": "exploratory-recon",
  "auth": "work",
  "args": ["-P", ".ralph/PROMPT-recon.md"],
  "circuit_breaker": false
}
```

### Status File Format

`.ralph/sequences/step-status/<label>.json`:
```json
{
  "label": "gu1-virtiofs-bridge",
  "exit_code": 0,
  "duration": 794,
  "success": true,
  "loop_complete": true,
  "timestamp": "2026-03-03T12:00:00Z"
}
```

A step is considered successful if `exit_code == 0` OR `loop_complete == true`.

### Cleanup

Step status files are automatically cleaned on fresh sequence runs (not `--from` resumes).

---

## Compaction Resilience

Protocol state survives context window compression via two hooks:

| Hook | Event | Purpose |
|------|-------|---------|
| `compaction_preserver.py` | PreCompact | Snapshots protocol state + human-readable reminders to `.claude/pre-compact-state.json` |
| `compaction_reinjector.py` | SessionStart(compact) | Reads the snapshot and outputs protocol reminders into Claude's context |

This ensures the agent knows which protocols are active, what recon artifacts exist, and what step it's on — even after the context window is compressed.

---

## WorktreeCreate Hook

The `WorktreeCreate` hook (`.claude/hooks/ralph_worktree_setup.sh`) fires when Claude Code creates a subagent worktree (via `isolation: "worktree"` in the Task tool). It does **not** fire for ralph-seq steps — those run in normal directories.

When it fires, it copies non-tracked Ralph files into the worktree for reference:
1. Copies sequence JSON files into the worktree's `.ralph/sequences/`
2. Copies step-results into `.ralph/sequences/step-results/`

`ralph.yml` is git-tracked and already present in git worktrees — no copy needed.

---

## Step Results Chain

The Stop hook (`.claude/hooks/ralph_post_step.sh`) captures the final assistant message from each step into `.ralph/sequences/step-results/{label}-{timestamp}.md`.

### How It Works

1. When a Ralph step completes, the Stop hook fires
2. The hook reads JSON from stdin (Claude Code Stop hook API) and extracts `last_assistant_message`
3. The hook reads `.ralph/sequences/.current` to get the current `step_label`
4. It writes the message to `.ralph/sequences/step-results/{step-label}-{timestamp}.md`
5. It also writes step status JSON to `.ralph/sequences/step-status/{step-label}.json` (for circuit breaker)

The hook only writes when both a message exists and a known step label is present (not every session exit triggers output).

### Using Step Results in PROMPTs

Subsequent step PROMPTs can reference previous results:

```markdown
## Context from Previous Steps
Read `.ralph/sequences/step-results/ah-1-*.md` for RE findings from Phase 1.
```

This is useful for:
- Passing RE findings summaries forward without re-decompiling
- Sharing build results or test outcomes
- Forwarding review verdicts to subsequent impl steps

**Note:** Step results supplement — not replace — the phase tracker and committed code. PROMPTs should still be mostly self-contained.

---

## ralph.yml Configuration

ralph-seq steps inherit from the project's `ralph.yml`. Key fields:

```yaml
event_loop:
  prompt_file: ".ralph/PROMPT.md"         # Default prompt (overridden by -P)
  completion_keyword: "LOOP_COMPLETE"     # Agent outputs this to signal done
  max_iterations: 12                      # Max loops per step
  max_runtime_seconds: 14400              # 4-hour timeout per step
  checkpoint_interval: 5                  # Checkpoint every N iterations

cli:
  backend: "claude"
  args: ["--model", "claude-opus-4-6"]    # Model selection

backpressure:
  - name: "swift_build"
    command: "swift build 2>&1"           # Must pass between iterations
    on_fail: "reject"                     # Block iteration if build fails
```

### Completion Keyword

The agent must output this exact string for ralph to consider the step complete. Convention:
- `LOOP_COMPLETE` — universal (recommended for sequences)
- `MENTU_RUNTIME_{FEATURE}_COMPLETE` — feature-specific (for single-step ralph-deploy)

If the agent never outputs the keyword, ralph runs until `max_iterations` and exits non-zero.

---

## PROMPT File Template

### Implementation Step

```markdown
# PROMPT -- {Feature}: {Phase Title} (Phase {N})

## Objective

{One paragraph: what to build and measurable outcome}

**Mentu commitment**: Use `mentu submit` when complete.

## Reference Materials (READ FIRST)

- `docs/handoffs/HANDOFF-{Feature}.md` -- full specs for this phase
- `CLAUDE.md` -- code conventions
- {Other relevant files}

## Phase Tracking

Read `docs/handoffs/current-phase.txt` at iteration start.
Write `{PHASE_KEYWORD}` when done.

## Execution Protocol

### Step A: Ghidra Pre-Bake

Use `ToolSearch` to discover and load `mcp__ghidra__*` tools (search `+ghidra`).

**Required decompilations:**
1. `decompile_function(address="0x...", program="SiteSucker_arm64")` -- {description}

**Parallelize** all independent decompile calls. Write findings to `.ralph/agent/scratchpad.md`.

If Ghidra MCP is unavailable, proceed without it.

### Step B: Read Existing Code

{List files to read}

### Step C: Check If Already Implemented

{What to look for to avoid duplicate work}

### Step D: Implement Code Changes

{Detailed implementation instructions — copy from HANDOFF}

### Step E: Build & Test

    swift build 2>&1
    swift test 2>&1

### Step F: Commit & Advance

    git add -A && git commit -m "[{Feature} {Phase}] {description}"

## Completion

When all changes are committed and tests pass:
Output: LOOP_COMPLETE
```

### Review Step

```markdown
# PROMPT -- {Feature}: {Phase Title} Review (Phase {N})

## Objective

Review work from Phase {N}. Verify against reference binary behavior.

## Ghidra Verification (DO NOT SKIP)

Use `ToolSearch` to load `mcp__ghidra__*` tools (search `+ghidra`).

**Required decompilations:**
1. `decompile_function(address="0x...", program="SiteSucker_arm64")` -- verify {what}

Write comparison findings to `.ralph/agent/scratchpad.md`.

## Review Checklist

1. **Build verification**: `swift build && swift test`
2. **Code review**: Read each modified file, check for:
   - Correct clamping ranges
   - No force unwraps or as! casts
   - Actor isolation correctness
   - Error handling completeness
3. **Test coverage**: Verify edge cases are tested
4. **Behavioral parity**: Flag divergences from reference binary
5. **Fix any issues found** -- commit with `[{Feature} {Phase} Review Fix] {description}`

## Completion

When review is complete and all issues are resolved:
Output: LOOP_COMPLETE
```

---

## Hook Execution Order (Full Session Lifecycle)

When a step runs within ralph-seq, hooks fire in this order:

```
1. ralph-seq writes .claude/protocol-state.json
2. ralph-seq launches: ralph-work --no-tui -P .ralph/PROMPT-xxx.md

3. SessionStart:
   a. mentu_session_start.py — commitment lifecycle
   b. compaction_reinjector.py — (compact only) restore protocol state

4. Agent works:
   a. PreToolUse (Write|Edit|mcp__ghidra__|mcp__spectre__):
      → ghidra_gate_guard.py — blocks Ghidra in downstream, blocks source without recon
   b. PostToolUse (Edit|Write):
      → mentu_post_tool.py — evidence capture
   c. SubagentStop:
      → context_isolation_gate.py — blocks raw data returns

5. PreCompact:
   → compaction_preserver.py — snapshot state

6. TaskCompleted:
   → build_gate.sh — blocks if build fails

7. Stop hook chain:
   a. review_gate.py — blocks exit if auto_review checks fail
   b. ralph_post_step.sh — captures step result + step status JSON

8. ralph-seq reads step status → circuit breaker evaluation
```

---

## CLI Reference

```bash
# Run a sequence from step 1
ralph-seq <name>

# Resume from step N
ralph-seq <name> --from <N>

# List available sequences
ralph-seq list

# Check if a sequence is running
ralph-seq status
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RALPH_CB_MAX_CONSECUTIVE` | `3` | Circuit breaker: max consecutive failures before halt |
| `RALPH_CB_MAX_RATIO` | `50` | Circuit breaker: max failure percentage before halt (after 4+ steps) |

---

## Scheduling Integration

Claude Code's session-scoped scheduling tools and the Mentu temporal primitives enable both in-session monitoring and scheduled launches with dashboard visibility.

### Architecture

```
CronCreate (session-scoped)          Mentu Protocol
─────────────────────────            ──────────────
Fires at scheduled time      ──→    ralph-seq claims parent commitment
                                    Dashboard shows "Running"
Polls .current every N min   ──→    Step commitments update
                                    Dashboard shows progress
```

### Session-Scoped Monitoring

```
Terminal 1:                    Claude Code session:
  ralph-seq my-feature         /loop 5m check sequence progress
       |                            |
       +--> writes .current          +--> reads .current every 5m
       +--> writes step-status/      +--> reads step-status/*.json
       +--> writes logs/             +--> reports to user
       +--> macOS notification       +--> CronDelete when done
```

### Monitorable State Files

| File | What It Tells You | Update Frequency |
|------|-------------------|------------------|
| `.ralph/sequences/.current` | Running sequence name, current step, PID, start time | Every step transition |
| `.ralph/sequences/step-status/<label>.json` | Per-step exit code, duration, success, loop_complete | After each step |
| `.ralph/sequences/logs/<name>-<ts>.log` | Full execution log | Continuous |

### Stall Detection Logic

A step is potentially stalled if:
1. `.current` exists (sequence is running)
2. The PID in `.current` is alive (`kill -0 <pid>`)
3. The `started` timestamp in `.current` is older than `RALPH_STEP_TIMEOUT` (default: 1800s)

### Scheduled Launches + Dashboard Visibility

The Mentu Commitment type already has temporal primitives (defined in `mentu-web/src/lib/mentu/types.ts`):

| Field | Type | Purpose |
|-------|------|---------|
| `scheduled_start_at` | ISO datetime | When the sequence should begin |
| `execution_window` | `{start, end, days?}` | Allowed execution window |
| `late_policy` | `skip \| execute_immediately \| reschedule` | What to do if missed |
| `trigger_source` | `manual \| template \| calendar \| api` | How it was triggered |

To schedule a sequence with dashboard visibility:
1. `mentu workflow run <name>` — creates pending commitment tree + workflow_instance cache row
2. Set `scheduled_start_at` on parent commitment
3. `CronCreate` with the launch time — fires `ralph-seq <name>` which claims the parent
4. Dashboard Panorama shows the sequence under "Scheduled" until the cron fires

### Future: Durable Scheduling via Bridge

Session-scoped cron dies with Claude Code. For durable scheduling:
- Create a `bridge_command` with `scheduled_at` field
- The bridge daemon on the target machine picks it up at the right time
- Status: `pending` → `claimed` → `running` → `completed`
- Full dashboard visibility through `bridge_commands` table

### Limitations

- **Session-scoped cron**: monitoring dies when Claude Code exits
- **3-day auto-expiry**: recurring monitors self-cancel after 72 hours
- **No catch-up**: if Claude is busy when a poll is due, it fires once when idle
- **1-minute minimum**: can't poll more frequently than every 60 seconds
