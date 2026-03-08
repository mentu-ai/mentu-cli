---
name: ralph-seq
description: Create and manage multi-phase Ralph sequences. Use when setting up autonomous multi-step workflows, creating sequence JSON files, writing per-step PROMPT files, or configuring ralph-seq pipelines.
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
argument-hint: "[sequence-name] or [--info]"
---

# Ralph Sequences

Deploy multi-phase autonomous Ralph workflows where each step runs a separate Ralph session with its own prompt file and OAuth profile.

**Usage:**
- `/ralph-seq FeatureName` -- Create a new sequence (JSON + PROMPTs + launch command)
- `/ralph-seq --info` -- Show current sequences and ralph-seq status

## Arguments

`$ARGUMENTS`

If `$ARGUMENTS` is `--info`, skip to [Info Mode](#info-mode).
Otherwise, treat as the feature/task name and execute the full [Create Sequence](#create-sequence).

---

## Architecture Overview

```
ralph-seq <name>
    |
    +--> reads .ralph/sequences/<name>.json
    +--> for each step:
    |      +--> ralph-${auth} --no-tui -P .ralph/PROMPT-<step>.md
    |      |        |
    |      |        +--> ralph() zsh function
    |      |        +--> loads OAuth token from ~/.claude/${profile}-token
    |      |        +--> ralph run --no-tui -P <file> -- --dangerously-skip-permissions
    |      |        +--> reads ralph.yml (max_iterations, backpressure)
    |      |        +--> agent runs, emits LOOP_COMPLETE or hits max_iterations
    |      |
    |      +--> logs step result to .ralph/sequences/logs/<name>-<timestamp>.log
    |      +--> always continues to next step (non-zero exit = warning, not fatal)
    |
    +--> macOS notification on completion
```

### Key Design Decisions

- **`--no-tui`** is mandatory: TUI mode corrupts the parent shell state, killing the loop after step 1
- **`-P <file>` passes through natively**: ralph supports `--prompt-file` / `-P`, no need to copy files
- **Always-continue**: non-zero exit codes are warnings, not failures (ralph exits non-zero when hitting max_iterations)
- **Stale lock cleanup**: if a previous run died, the next run auto-cleans the lock file
- **Per-step OAuth profiles**: each step can use a different `auth` profile (work, rashid, uxrouter, etc.)

### Profile System

The `auth` field maps to `ralph-${auth}` aliases defined in `~/.zshrc`:

| Auth Value | Alias | Token File | Use When |
|------------|-------|------------|----------|
| `work` | `ralph-work` | `~/.claude/work-token` | Org billing (default) |
| `rashid` | `ralph-rashid` | `~/.claude/rashid-token` | Personal account |
| `uxrouter` | `ralph-uxrouter` | `~/.claude/uxrouter-token` | UXRouter project |
| `ppw` | `ralph-ppw` | `~/.claude/ppw-token` | PPW project |
| `affihub` | `ralph-affihub` | `~/.claude/affihub-token` | AffiHub project |

All profiles get: extended thinking (63999 tokens), `--dangerously-skip-permissions`, OAuth token injection.

---

## Create Sequence

### Step 1: Gather Requirements

Determine from the user or context:
1. **Feature name** (kebab-case, e.g., `crawlio-settings-wiring`)
2. **Number of phases** and what each does
3. **Review pattern**: impl + review pairs? Or standalone steps?
4. **Auth profile** to use (default: `work`)
5. **Working directory** per step (default: `.` = project root)
6. **Whether a HANDOFF exists** — if yes, derive phases from it

### Step 2: Create Sequence JSON

**Path**: `.ralph/sequences/<name>.json`

```json
{
  "name": "<name>",
  "description": "Phase 1 title -> review -> Phase 2 title -> review -> ...",
  "steps": [
    {
      "label": "<step-label>",
      "auth": "<profile>",
      "args": ["-P", ".ralph/PROMPT-<step-label>.md"]
    },
    {
      "label": "<step-label>-review",
      "auth": "<profile>",
      "args": ["-P", ".ralph/PROMPT-<step-label>-review.md"]
    }
  ]
}
```

**Schema reference** — see [reference.md](reference.md) for the full JSON schema.

**Rules:**
- Every implementation step should have a paired review step (or use inline background review — see below)
- Labels must be unique and descriptive (they appear in logs)
- The `-P` arg points to the PROMPT file for that step
- Steps with `"dir"` field run in a different directory (e.g., worktrees)

### Step 3: Write PROMPT Files

Create one PROMPT file per step at `.ralph/PROMPT-<step-label>.md`.

**Implementation PROMPT structure:**
```markdown
# PROMPT -- {Title} (Phase {N})

## Objective
{What to build, measurable outcome}

## Reference Materials (READ FIRST)
- docs/handoffs/HANDOFF-{name}.md
- CLAUDE.md

## Phase Tracking
Read `docs/handoffs/current-phase.txt` at iteration start.

## Execution Protocol
### Step A: Ghidra Pre-Bake (if RE is needed)
### Step B: Read Existing Code
### Step C: Check If Already Implemented
### Step D: Implement Code Changes
### Step E: Build & Test
### Step F: Commit & Advance

## Completion
Output: LOOP_COMPLETE
```

**Review PROMPT structure:**
```markdown
# PROMPT -- {Title} Review (Phase {N})

## Objective
Review the work from Phase {N}.

## Ghidra Verification (DO NOT SKIP)
{Compare implementation against binary RE findings}

## Review Checklist
1. Build verification (swift build, swift test)
2. Code review (each modified file)
3. Test coverage
4. Behavioral parity with reference binary

## Completion
Output: LOOP_COMPLETE
```

**Critical rules for PROMPTs:**
- Each PROMPT must be **self-contained** (Ralph has no cross-step memory)
- Include the HANDOFF path so the agent reads full specs
- Include `Check If Already Implemented` — Ralph may re-run steps
- Include build/test commands inline
- End with `LOOP_COMPLETE` (matches `ralph.yml` completion_keyword)
- PROMPTs MAY reference previous step results from `.ralph/sequences/step-results/` (see Step Results Chain below)

### Step 4: Configure ralph.yml

Ensure `ralph.yml` has:

```yaml
event_loop:
  prompt_file: ".ralph/PROMPT.md"
  completion_keyword: "LOOP_COMPLETE"
  max_iterations: 12
  max_runtime_seconds: 14400

backpressure:
  - name: "swift_build"
    command: "swift build 2>&1"
    on_fail: "reject"
```

**Note:** `prompt_file` in ralph.yml is the DEFAULT prompt. The `-P` flag in step args overrides it per-step.

### Step 4b: Add Synthesis Step

Every sequence MUST include a **synthesis step** as its final or penultimate step. This step reads all step results and produces `docs/CONTEXT-{name}.md`.

**Why:** ralph-seq generates a fallback CONTEXT doc automatically, but it's mechanical (tables + git log). A synthesis step produces a richer document with architectural insights, lessons learned, and recommendations.

**Synthesis step JSON:**
```json
{
  "label": "{name}-synthesis",
  "auth": "work",
  "args": ["-P", ".ralph/PROMPT-{name}-synthesis.md"]
}
```

**Synthesis PROMPT template:**
```markdown
# PROMPT -- {Name}: Synthesis

## Objective

Read all step results from this sequence and produce a CONTEXT document summarizing what was built, what was learned, and what remains.

## Input

Read all files in `.ralph/sequences/step-results/` matching this sequence's step labels.
Read `docs/handoffs/HANDOFF-{Name}.md` for original requirements.

## Output

Write `docs/CONTEXT-{name}.md` with:
1. **Summary** — what the sequence accomplished (1-2 paragraphs)
2. **Steps** — table of steps with status and key outcomes
3. **Architectural Decisions** — decisions made during execution and why
4. **Lessons Learned** — what worked, what didn't, what to do differently
5. **Open Items** — anything left unfinished or needing follow-up

## Completion

Output: LOOP_COMPLETE
```

**For small sequences (2-3 steps):** The synthesis step can be combined with the final review step — add a "Synthesis" section to the review PROMPT that writes the CONTEXT doc after the review checklist.

### Step 5: Output Launch Command

```
## Sequence Ready

| Component | Path | Status |
|-----------|------|--------|
| Sequence | .ralph/sequences/<name>.json | Created |
| PROMPTs | .ralph/PROMPT-<step>*.md | Created (N files) |
| Config | ralph.yml | Verified |

### Launch

    source ~/.zshrc && ralph-seq <name>

### Resume from step N

    ralph-seq <name> --from N

### Monitor

    ralph-seq status
    tail -f .ralph/sequences/logs/<name>-*.log

### Babysit (from Claude Code session)

    /loop 5m check ralph-seq status and the latest step-status files, report progress

### Schedule for Later

    schedule at <time>: run `source ~/.zshrc && ralph-seq <name>` and babysit every 10m
```

---

## Info Mode

When `$ARGUMENTS` is `--info`, read and display:

1. Run `ralph-seq list` equivalent: read all `.ralph/sequences/*.json`, show name + step count + description
2. Current `ralph.yml` config (completion_keyword, max_iterations)
3. Check `.ralph/sequences/.current` for running sequence
4. List recent logs from `.ralph/sequences/logs/`
5. Show available auth profiles

---

## Patterns & Anti-Patterns

### Pattern: Impl + Review Pairs

Every implementation step gets a paired review step. The review step:
- Re-decompiles the same Ghidra functions
- Compares implementation against RE findings
- Runs build + test
- Flags behavioral divergences

### Pattern: Worktree Steps

For work on a branch without disturbing main:
```json
{
  "label": "httrack-hardening",
  "dir": ".worktrees/chirpy-lily",
  "auth": "work",
  "args": ["-P", ".ralph/PROMPT-httrack.md"]
}
```

### Pattern: Inline Background Review

Instead of separate review steps, impl PROMPTs can spawn `ralph-reviewer` as a background agent at the end of the implementation. This halves the number of sequence steps (20 instead of 40) with the same review coverage.

Add this to the end of an implementation PROMPT:
```markdown
## Post-Implementation Review

Spawn a `ralph-reviewer` background agent to verify this step:
- Task(subagent_type="Ralph Reviewer", prompt="Review {step-label} changes against .ralph/findings/{step-label}-findings.md", run_in_background=true, isolation="worktree")
```

The `ralph-reviewer` agent (`.claude/agents/ralph-reviewer.md`) runs on haiku (10-20x cheaper than Opus) and produces a structured review summary without blocking the sequence.

### Pattern: Step Results Chain

The Stop hook (`.claude/hooks/ralph_post_step.sh`) captures each step's final output to `.ralph/sequences/step-results/{label}-{timestamp}.md`. The hook reads JSON from stdin and gets the step label from `.ralph/sequences/.current`. Subsequent PROMPTs can read previous step results for context:

```markdown
## Context from Previous Steps
Read `.ralph/sequences/step-results/{prev-step-label}-*.md` for findings from the previous phase.
```

This relaxes the "fully self-contained PROMPT" constraint — factual findings (RE summaries, build results, review verdicts) flow forward through the results chain.

### Anti-Pattern: Shared State Between Steps

Steps do NOT share memory. Each step starts fresh. If step 2 needs context from step 1:
- Step 1 commits code + writes to `docs/handoffs/current-phase.txt`
- Step 2's PROMPT reads the committed code and phase tracker
- Step 2's PROMPT can also read `.ralph/sequences/step-results/` for captured output from step 1

### Anti-Pattern: Using `-a` with `--no-tui`

Ralph's `--autonomous` and `--no-tui` flags are mutually exclusive. ralph-seq uses `--no-tui` only.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Loop stops after step 1 | TUI corrupting shell | Ensure `--no-tui` in ralph-seq.zsh |
| "Unknown preset ''" | zsh 1-based arrays | Fix `${args[0]}` to `${args[1]}` in ralph() |
| Steps skip instantly | Wrong prompt path | Verify `-P` path exists relative to step dir |
| "Already running" error | Stale lock file | `rm .ralph/sequences/.current` |
| All steps WARN | Normal for max_iterations | Non-zero exit = ralph hit iteration limit |

---

## Monitoring & Scheduling

Ralph sequences run autonomously and can take hours. Use Claude Code's session-scoped scheduling to monitor progress, detect stalls, schedule launches, and get notified of completion.

### Monitoring Patterns

#### Babysit a Running Sequence

After launching a sequence in another terminal, set up a monitor:

    /loop 5m check ralph-seq status and report which step is running

Polls `.ralph/sequences/.current` every 5 minutes and alerts you if the sequence finishes or the circuit breaker trips.

#### Stall Detection

    /loop 15m check .ralph/sequences/.current — if the step label hasn't changed in 30+ minutes, warn me about a possible stall

#### Post-Sequence Review Reminder

    remind me in 3 hours to review docs/CONTEXT-<name>.md and the step results

### Scheduling Patterns

#### Launch at a Specific Time

Schedule a sequence to run at 2am (overnight build):

    schedule at 2am: run `source ~/.zshrc && ralph-seq <name>` and set up a /loop 10m monitor

Claude creates a one-shot CronCreate for the launch, then a recurring monitor.

#### Timed Sequence Pipeline

Chain sequences across projects:

    at 9pm, run ralph-seq phase-1 in /Users/rashid/Desktop/mentu-runtime
    at 11pm, run ralph-seq phase-2 in /Users/rashid/Desktop/Crawlio-app
    at 1am, run ralph-seq phase-3 in /Users/rashid/Desktop/crawlio-agent

#### Weekend Batch

    schedule for Saturday 6am: run ralph-seq full-hardening and babysit every 15 minutes

### Scheduling + Mentu Dashboard Integration

When scheduling a sequence, register it with Mentu for dashboard visibility:

1. **Create a pending workflow instance** via `mentu workflow run <name>` — this creates the commitment tree with `state: pending`
2. **Set `scheduled_start_at`** on the parent commitment — the dashboard can show "Scheduled for 2am"
3. **Use CronCreate** to trigger the actual `ralph-seq` launch at the scheduled time
4. **When the cron fires**, `ralph-seq` claims the parent commitment and begins execution — the dashboard transitions from "Scheduled" to "Running"

This creates full visibility:
```
Mentu Dashboard (Panorama)
  ├── Scheduled
  │   └── mentu-runtime: full-hardening (2am tonight)
  ├── Running Now
  │   └── Crawlio-app: css-hardening (step 4/12)
  └── Completed Today
      └── crawlio-agent: settings-wiring (8/8 ok)
```

### Scheduling Tools Reference

| Tool | Purpose |
|------|---------|
| `/loop <interval> <prompt>` | Recurring monitor (default: 10m) |
| `CronCreate` | Schedule with cron expression (5-field) |
| `CronList` | List active scheduled tasks |
| `CronDelete` | Cancel a scheduled task by ID |

### Constraints

- **Session-scoped** — tasks die when Claude Code exits
- **3-day auto-expiry** on recurring tasks
- **1-minute minimum** granularity (seconds rounded up)
- Tasks fire between turns, not during active responses
- For durable scheduling that survives restarts, use the Mentu Bridge (`bridge_commands` with `scheduled_at`)

---

## Additional Resources

- For the full sequence JSON schema, see [reference.md](reference.md)
- For real sequence examples, see [examples.md](examples.md)
- For the ralph-deploy single-step pattern, see `~/.claude/skills/ralph-deploy/SKILL.md` (mentu-runtime project)

## Workspace Provisioning

New projects get ralph-seq (SKILL.md, reference.md, examples.md) automatically via the **Mentu Workspace Factory**.

### Creating a New Workspace

From the workspace factory project (`/Users/rashid/Desktop/mentu-workspace-factory`):

```bash
/create-workspace /path/to/project [project-name]
```

This scaffolds the full Mentu workspace including:
- `.claude/skills/ralph-seq/` — this skill + reference + examples
- `.claude/hooks/` — mentu evidence capture, review gate, protocol enforcement
- `ralph.yml` — Ralph config with completion keyword and backpressure
- `.ralph/agent/` — agent context files
- `scripts/ralph-work.sh` — Work OAuth wrapper

### Template Source

The canonical template lives at:
```
/Users/rashid/Desktop/mentu-workspace-factory/templates/skills/ralph-seq/
```

Updates to ralph-seq should be made in the source workspace (e.g., Subtrace) then synced to the factory template and all active workspaces. The factory template ensures all **future** workspaces get the latest version.

### Currently Provisioned Workspaces

| Workspace | Path |
|-----------|------|
| mentu-runtime | `/Users/rashid/Desktop/mentu-runtime` |
| ghidra-reconstructed | `/Users/rashid/Desktop/ghidra-reconstructed` |
| Crawlio-app | `/Users/rashid/Desktop/Crawlio-app` |
| crawlio-agent | `/Users/rashid/Desktop/crawlio-agent` |
| mentu-interceptor | `/Users/rashid/Desktop/mentu-interceptor` |
| mentu-ane | `/Users/rashid/Desktop/mentu-ane` |

### Verification

After provisioning, verify the workspace:
```bash
/Users/rashid/Desktop/mentu-workspace-factory/scripts/verify-workspace.sh /path/to/project
```

---

## Protocol-Aware Steps (Structural Enforcement)

Steps declare required architectural protocols via the `protocols` field. This is **not just metadata** — `ralph-seq` writes a `.claude/protocol-state.json` file before each step, and Claude Code hooks enforce these protocols at the tool-call level. Protocol violations are structurally blocked, not just discouraged.

### `"context-isolation"`

**Enforcement:** SubagentStop hook blocks sub-agent returns with >200 lines, hex dumps, large JSON arrays, or raw addresses.

The PROMPT for this step should use the **Synthesizer Pattern**:
- Spawn sub-agents for processing large files, datasets, or search results
- Sub-agents write compressed summaries to `.claude/summaries/`
- The main agent reads only the summaries, never the raw data
- See `.claude/skills/context-isolation-protocol/SKILL.md` for full protocol

### `"ghidra-gate"` — Enforcement Mechanics

The ghidra-gate protocol enforces a strict **recon → impl → review** triplet. The enforcement hook (`ghidra_gate_guard.py`) uses two signals to decide what to allow:

**Signal 1: Step label.** If the label contains the substring `recon` (case-insensitive), the hook treats it as a recon step and **allows** Ghidra/Spectre MCP tool calls. If the label does NOT contain `recon`, the hook treats it as a downstream (implementation) step and **blocks** all RE tools.

**Signal 2: Recon artifact path.** The `recon_artifact` field specifies the file that the recon step will create. In downstream steps, the hook checks if this file exists on disk. If it doesn't exist, the hook **blocks Write/Edit to source code directories** (Sources/, src/, lib/, Tests/, etc.) — the agent cannot implement without evidence.

This creates a mechanical constraint:

| Step type | Ghidra tools | Source writes | Condition |
|-----------|-------------|---------------|-----------|
| Recon (`recon` in label) | ALLOWED | ALLOWED | Always |
| Downstream (no `recon` in label) | BLOCKED | ALLOWED | recon_artifact exists on disk |
| Downstream (no `recon` in label) | BLOCKED | BLOCKED | recon_artifact missing |

### The Recon → Impl → Review Triplet

**Every feature that needs `ghidra-gate` requires THREE steps minimum:**

```json
// Step 1: Recon — label MUST contain "recon" so Ghidra tools are allowed
{
  "label": "feature-recon",
  "protocols": ["ghidra-gate", "context-isolation"],
  "circuit_breaker": false
}

// Step 2: Implementation — downstream, recon_artifact MUST point to what Step 1 creates
{
  "label": "feature-impl",
  "protocols": ["ghidra-gate", "context-isolation"],
  "recon_artifact": "docs/ghidra-analysis/feature-recon.md",
  "auto_review": true
}

// Step 3: Review
{
  "label": "feature-review"
}
```

**If you skip the recon step, the implementation step is structurally deadlocked** — Ghidra tools are blocked (not a recon step) AND source writes are blocked (recon artifact doesn't exist). The agent cannot do anything.

### `auto_review` — Enforcement Mechanics

The review gate Stop hook checks three things before allowing the agent to exit:
1. Build command passes (from CLAUDE.md `## Commands`)
2. `LOOP_COMPLETE` present in the final message
3. Git working tree has changes (skipped for recon steps — label contains `recon`)

The git-changes check is skipped for recon steps because they may only produce files in `.claude/summaries/` (untracked) or write recon artifacts that haven't been staged yet.

**Do NOT set `auto_review: true` on review steps.** Review steps already ARE the quality gate — adding auto_review on top creates needless friction.

### Bypass: Design-Time, Not Runtime

**There is no `--skip-ghidra` flag or runtime bypass.** To exempt a step from a protocol, the sequence author omits the tag from its `protocols` array. The bypass is a sequence design decision, not a runtime escape hatch.

Steps touching standard application logic (e.g., GU3 air-gapped embedder, GU4 OCR unification) simply don't include `"ghidra-gate"` — no binary RE, no Ghidra, no gate:

```json
{
  "label": "gu3-air-gapped-embedder",
  "auth": "work",
  "args": ["-P", ".ralph/PROMPT-gu3-air-gapped-embedder.md"]
}
```

**Decision criteria:**
- Step touches undocumented APIs, private frameworks, or hardware → needs `"ghidra-gate"` (recon + impl)
- Step processes bulk data, large files, or spawns sub-agents → needs `"context-isolation"`
- Step is pure application logic, UI, tests, or standard library → omit both

### Sequence Design Validation Checklist

When creating a sequence with `ghidra-gate` steps, verify:

- [ ] Every ghidra-gate impl step is preceded by a recon step whose label contains `recon`
- [ ] Every recon step's PROMPT writes to the path that the impl step's `recon_artifact` points to
- [ ] `recon_artifact` paths are relative to project root (not absolute cross-repo paths)
- [ ] Recon steps have `circuit_breaker: false` (RE is exploratory, may not produce LOOP_COMPLETE)
- [ ] Impl steps (not recon) have `auto_review: true` if quality gating is desired
- [ ] Review steps have NO `auto_review` (they are the gate, not gated)
- [ ] Steps without RE needs have NO `ghidra-gate` in protocols (bypass by omission)

### Additional Step Fields

| Field | Purpose |
|-------|---------|
| `auto_review` | Enable automated review gate (build + LOOP_COMPLETE + git changes) on exit. Skips git-changes check for recon steps. |
| `recon_artifact` | Relative path to Ghidra recon doc — ghidra-gate blocks source writes if this file is missing |
| `circuit_breaker` | Set to `false` to exclude step from circuit breaker failure tracking (recommended for recon steps) |

For the full schema and enforcement details, see [reference.md](reference.md#protocol-tags).

---

## Rules

1. **`--no-tui` is non-negotiable** — without it, the loop dies after step 1
2. **One PROMPT per step** — never share PROMPTs between steps
3. **PROMPTs must be self-contained** — no cross-step memory (step results chain is the exception for factual findings)
4. **completion_keyword must match** between PROMPT and ralph.yml
5. **Always include review** — either paired review steps OR inline background review via `ralph-reviewer`
6. **Commit from within each step** — the next step reads committed code
7. **Phase tracker is the handoff mechanism** — `docs/handoffs/current-phase.txt`
8. **Never use `-a` with `--no-tui`** — they are mutually exclusive in ralph
9. **Every sequence must include a synthesis step** that produces a `docs/CONTEXT-{name}.md` document — ralph-seq generates a fallback, but the agent-written version is always richer
10. **ralph-seq auto-captures PROMPT files as mentu memories** and generates a fallback CONTEXT doc — the full accountability chain is: PROMPT → commitment → evidence → CONTEXT
