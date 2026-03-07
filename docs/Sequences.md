# Sequences: Multi-Step Workflow Orchestration

## What Sequences Are

A **sequence** is an ordered list of Claude Code agent sessions that run one after another. Each step is an independent agent invocation — with its own prompt, working directory, auth profile, and timeout. When one step finishes, the next begins.

Sequences solve a specific problem: running complex multi-step workflows across one or more repositories without human intervention between steps. A developer defines the work upfront (as a JSON file), then walks away. The runner executes every step, tracks results, and halts if too many fail.

```
Developer defines sequence JSON
        |
        v
  ralph-seq <name>
        |
        v
  Step 1: claude agent session --> exit code
  Step 2: claude agent session --> exit code
  Step 3: claude agent session --> exit code
  ...
  Step N: claude agent session --> exit code
        |
        v
  Summary: N steps (M ok, K warned)
```

---

## Architecture

Sequences have two layers:

| Layer | Component | Location |
|-------|-----------|----------|
| **Runner** | `ralph-seq` (zsh function) | `~/.ralph/ralph-seq.zsh` |
| **Protocol** | Mentu commitment ledger | `mentu workflow` CLI, `.mentu/ledger.jsonl` |

The Supabase schema (`workflow_instances`) is a **materialized cache** — not a layer. The commitment ledger is the source of truth. The dashboard reads from the cache.

```
Runner (ralph-seq)        Protocol (mentu ledger)        Cache (Supabase)
─────────────────         ─────────────────────          ────────────────
Executes steps locally    Records commitments            workflow_instances
Reads sequence JSON       Links steps to parent          (materialized view)
Tracks exit codes         Requires evidence to close     Dashboard reads this
                          Computes state from commits
```

---

## The Runner: ralph-seq

### Installation

`ralph-seq.zsh` is sourced from `~/.zshrc`:

```bash
source ~/.ralph/ralph-seq.zsh
```

Utilities live in `~/.ralph/lib/seq-utils.sh` (auto-sourced by the runner).

### Commands

```bash
ralph-seq list                # List available sequences in current project
ralph-seq status              # Check if a sequence is running
ralph-seq <name>              # Run a named sequence from step 1
ralph-seq <name> --from 3     # Resume from step 3
```

### How It Works

1. Reads `.ralph/sequences/<name>.json` from the current project
2. Iterates through each step in order
3. For each step:
   - Resolves `auth` profile (e.g., `ralph-work`, `ralph-rashid`)
   - Changes to step's `dir` (default: `.`)
   - Passes `args` array to the ralph invocation (typically `-P <prompt-file>`)
   - Writes protocol state if protocols are configured
   - Runs `ralph-<auth> --no-tui <args>` in a background subshell
   - Enforces per-step timeout (default: 30 minutes, configurable via `RALPH_STEP_TIMEOUT`)
   - Records exit code, duration, and status
4. Evaluates circuit breaker after each step
5. Logs everything to `.ralph/sequences/logs/<name>-<timestamp>.log`
6. Sends macOS notification on completion

### Concurrency Guard

Only one sequence can run at a time per project. A `.ralph/sequences/.current` file tracks the running sequence with PID, step number, and label. If the PID is dead, the lock is cleaned up automatically.

---

## Sequence JSON Format

Sequences are defined as JSON files in `.ralph/sequences/`:

```json
{
  "name": "my-sequence",
  "description": "What this sequence does",
  "steps": [
    {
      "label": "step-1-implement",
      "auth": "work",
      "dir": ".",
      "args": ["-P", ".ralph/PROMPT-step1.md"],
      "protocols": [],
      "circuit_breaker": true
    },
    {
      "label": "step-1-review",
      "auth": "rashid",
      "args": ["-P", ".ralph/PROMPT-step1-review.md"]
    }
  ]
}
```

### Step Fields

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `label` | Yes | — | Unique identifier for the step (used in logs and circuit breaker) |
| `auth` | No | `"work"` | Ralph profile to use: `ralph-work`, `ralph-rashid`, etc. |
| `dir` | No | `"."` | Working directory relative to project root |
| `args` | No | `[]` | Arguments passed to the ralph invocation |
| `protocols` | No | `[]` | Array of protocol names to activate (e.g., `"ghidra-gate"`, `"context-isolation"`) |
| `circuit_breaker` | No | `true` | Whether this step counts toward circuit breaker evaluation |
| `auto_review` | No | `false` | Enable auto-review protocol for this step |
| `recon_artifact` | No | `""` | Path to recon artifact (used with `ghidra-gate` protocol) |

### Prompt Files

Steps typically reference prompt files via `-P` in their args. These are markdown files in `.ralph/` that contain the full instructions for that agent session:

```
.ralph/
  sequences/
    my-sequence.json
  PROMPT-step1.md
  PROMPT-step1-review.md
```

### Common Patterns

**Implement + Review pairs**: The most common pattern alternates between implementation and review steps. This provides built-in quality gates:

```json
{
  "steps": [
    { "label": "feature-implement", "auth": "work", "args": ["-P", ".ralph/PROMPT-feature.md"] },
    { "label": "feature-review", "auth": "rashid", "args": ["-P", ".ralph/PROMPT-feature-review.md"] },
    { "label": "tests-implement", "auth": "work", "args": ["-P", ".ralph/PROMPT-tests.md"] },
    { "label": "tests-review", "auth": "rashid", "args": ["-P", ".ralph/PROMPT-tests-review.md"] }
  ]
}
```

**Multi-phase hardening**: Group related changes into phases, each with its own review:

```json
{
  "name": "hardening",
  "description": "Connection -> State -> Parser -> Download -> Export -> Resilience",
  "steps": [
    { "label": "connection-hardening", "auth": "work", "args": ["-P", ".ralph/PROMPT-connection.md"] },
    { "label": "connection-review", "auth": "work", "args": ["-P", ".ralph/PROMPT-connection-review.md"] },
    { "label": "state-persistence", "auth": "work", "args": ["-P", ".ralph/PROMPT-state.md"] },
    { "label": "state-review", "auth": "work", "args": ["-P", ".ralph/PROMPT-state-review.md"] }
  ]
}
```

**Single-auth sequences**: When all steps use the same profile, omit `auth` (defaults to `work`):

```json
{
  "steps": [
    { "label": "phase-1", "args": ["-P", ".ralph/PROMPT-phase1.md"] },
    { "label": "phase-2", "args": ["-P", ".ralph/PROMPT-phase2.md"] }
  ]
}
```

**Recon-Implement-Review triplet** (protocol-enforced): For steps requiring binary reverse engineering, the ghidra-gate protocol enforces a strict ordering:

```json
{
  "steps": [
    {
      "label": "feature-recon",
      "protocols": ["ghidra-gate", "context-isolation"],
      "circuit_breaker": false,
      "args": ["-P", ".ralph/PROMPT-feature-recon.md"]
    },
    {
      "label": "feature-impl",
      "protocols": ["ghidra-gate"],
      "recon_artifact": ".ralph/findings/feature-recon.md",
      "auto_review": true,
      "args": ["-P", ".ralph/PROMPT-feature-impl.md"]
    },
    {
      "label": "feature-review",
      "args": ["-P", ".ralph/PROMPT-feature-review.md"]
    }
  ]
}
```

The recon step produces a findings file. The impl step is **blocked** by ghidra-gate unless the findings file exists. The impl step auto-triggers the review.

**Auto-review cascading**: Chain steps with `auto_review: true` to run automatically without human intervention:

```json
{
  "steps": [
    { "label": "parser-impl", "auto_review": true, "args": [...] },
    { "label": "netstack-impl", "auto_review": true, "args": [...] },
    { "label": "ffi-impl", "auto_review": true, "args": [...] },
    { "label": "final-review", "args": [...] }
  ]
}
```

Each step auto-triggers the next on success. The final step has no `auto_review`, requiring manual decision.

---

## Protocol System

Protocols provide **structural enforcement** — they prevent steps from using tools or producing output they shouldn't. Protocols are enforced by Claude Code hooks that read `.claude/protocol-state.json`, which ralph-seq writes before each step.

### Available Protocols

| Protocol | Hook | What It Enforces |
|----------|------|------------------|
| `ghidra-gate` | `ghidra_gate_guard.py` (PreToolUse) | Only recon steps can call Ghidra/Spectre MCP tools. Implementation steps are **blocked** from source writes if `recon_artifact` file doesn't exist. |
| `context-isolation` | `context_isolation_gate.py` (SubagentStop) | Sub-agent returns are blocked if they contain >200 lines, hex dumps, large JSON arrays, or raw addresses. Prevents orchestrator context pollution. |

### Artifact Gating

The `recon_artifact` field creates a hard dependency between steps:

```
Step 1: "feature-recon"     →  Produces .ralph/findings/feature-recon.md
Step 2: "feature-impl"      →  BLOCKED until .ralph/findings/feature-recon.md exists
                                (ghidra_gate_guard.py checks this on every Write/Edit)
```

This ensures implementation always uses fresh reverse engineering findings rather than running its own analysis.

### Auto-Review Gate

When `auto_review: true` is set, the `review_gate.py` Stop hook blocks the agent from exiting unless:
1. Build passes
2. `LOOP_COMPLETE` appears in the final message
3. Git has uncommitted changes (skipped for recon steps)

---

## Circuit Breaker

The circuit breaker halts a sequence early when too many steps fail, preventing wasted compute.

### Configuration

Environment variables control thresholds:

| Variable | Default | Description |
|----------|---------|-------------|
| `RALPH_CB_MAX_CONSECUTIVE` | `3` | Max consecutive failures before halt |
| `RALPH_CB_MAX_RATIO` | `50` | Max failure percentage (after 4+ steps) |

### Trip Conditions

1. **Consecutive failures**: If N consecutive steps fail (default: 3), the sequence halts
2. **Failure ratio**: After 4+ steps, if more than N% have failed (default: 50%), the sequence halts

### Disabling Per-Step

Set `"circuit_breaker": false` on steps that are expected to sometimes fail (e.g., exploratory steps):

```json
{ "label": "try-optimization", "args": [...], "circuit_breaker": false }
```

### Notification

When the circuit breaker trips, a macOS notification is sent with the reason. The sequence log records the exact threshold that was exceeded.

---

## Step Status Tracking

After each step completes, the runner writes a status JSON to `.ralph/sequences/step-status/<label>.json`:

```json
{
  "label": "feature-implement",
  "exit_code": 0,
  "duration": 342,
  "success": true,
  "loop_complete": false,
  "timestamp": "2026-03-06T14:30:00Z"
}
```

- `success` is true if exit_code is 0 OR if `LOOP_COMPLETE` was found in the step result
- The circuit breaker reads these files to evaluate trip conditions
- Fresh runs (`--from 1`) clear the step-status directory

---

## Log Files

All output is logged to `.ralph/sequences/logs/<name>-<timestamp>.log`:

```
=== SEQUENCE: crawlio-hardening ===
=== STARTED: 2026-03-06T14:00:00 ===

--- step 1/8: connection-hardening ---
dir: .
auth: work
args: -P .ralph/PROMPT-connection.md
started: 2026-03-06T14:00:00
ended: 2026-03-06T14:05:42
exit_code: 0
duration: 342s
status: OK

--- step 2/8: connection-review ---
...

=== FINISHED: 2026-03-06T15:30:00 ===
=== RESULT: 8 steps run (7 ok, 1 warned) ===
```

---

## Hook Integration

Ralph-seq works with Claude Code hooks that are deployed by the workspace factory. These hooks provide build gates, evidence capture, and protocol enforcement.

### Hooks Deployed Per Workspace

| Hook | Event | Purpose |
|------|-------|---------|
| `ralph_post_step.sh` | Stop | Captures step's final assistant message to `.ralph/sequences/step-results/{label}-{timestamp}.md` and writes step status JSON |
| `review_gate.py` | Stop | Blocks exit if build fails, `LOOP_COMPLETE` missing, or no git changes (when `auto_review: true`) |
| `build_gate.sh` | TaskCompleted | Verifies build passes between agent iterations |
| `ghidra_gate_guard.py` | PreToolUse | Blocks Ghidra tools in non-recon steps; blocks writes without recon artifact |
| `context_isolation_gate.py` | SubagentStop | Blocks raw data leakage from sub-agents |
| `compaction_preserver.py` | PreCompact | Snapshots protocol state before context compression |
| `compaction_reinjector.py` | SessionStart(compact) | Restores protocol state after context compression |

### Step Results Chain

The `ralph_post_step.sh` hook captures each step's output, creating a filesystem-based memory between steps:

```
Step 1 completes → ralph_post_step.sh writes:
  .ralph/sequences/step-results/connection-hardening-20260306T140542.md

Step 2's PROMPT can reference:
  "Read .ralph/sequences/step-results/connection-hardening-*.md for prior findings"
```

This is how Ralph steps pass context forward — each step is independent (no shared memory), but can read artifacts from previous steps.

---

## How Sequences Respect the Protocol

A sequence is a **composition of commitments**, not a separate state machine. Every sequence concept maps to an existing Protocol primitive:

| Sequence Concept | Protocol Primitive | Operation |
|------------------|--------------------|-----------|
| Sequence definition | Memory | `capture` with `kind: "sequence"` |
| Sequence instance | Commitment (parent) | `commit` referencing the definition memory |
| Step definition | Part of definition memory | Data inside the captured memory |
| Step execution start | Child commitment claimed | `commit` + `link` to parent + `claim` |
| Step completed | Child commitment closed | `close` with evidence memory |
| Step failed | Child commitment annotated | `annotate` with failure details |
| Sequence progress | Computed | Count child commitment states |
| Sequence completed | Parent commitment closed | `close` with summary evidence |
| Approval gate | Commitment in `in_review` | `submit` + `approve` |

### State Model

Sequence state is **never stored** — it is computed from child commitment states:

```
Sequence state = f(child commitment states)

  If any child is claimed/in_review/reopened  → "running"
  If all children are closed                  → "completed"
  If no children are claimed and none closed  → "pending"
```

Step state maps directly to commitment state (via `mapCommitmentStateToStepState()`):

```
  open       → pending   (not yet started)
  claimed    → running   (step running)
  in_review  → running   (submitted, awaiting review)
  closed     → completed (with evidence)
  reopened   → running   (needs rework)
  (unknown)  → pending   (fallback)
```

### The Sacred Invariant

The Protocol's Sacred Invariant says: *"State is computed by replaying operations. Never stored."*

`workflow_instances.step_states` is a **cache** — computed from commitment states by `refreshWorkflowCache()`, not mutated directly. The `workflow_audit_log` table is **deprecated** — all events are ledger operations.

---

## Mentu Workflow CLI

The `mentu workflow` CLI operates through the commitment ledger (Protocol-native):

```bash
mentu workflow register <file.yaml>              # Register workflow definition
mentu workflow list [--all]                       # List active workflows
mentu workflow run <name> [-p key=value]          # Create commitments in ledger
mentu workflow status <instance_id>               # Compute state from commitments
mentu workflow approve <instance_id> <step_id>    # Approve via ledger operation
mentu workflow cancel <instance_id>               # Release commitments via ledger
```

### What `workflow run` Does

```
mentu workflow run <name>
  1. capture: "Sequence: <name> (N steps)"  --kind sequence
     → produces mem_definition
  2. commit: "Execute <name>"  --source mem_definition --tags sequence
     → produces cmt_parent
  3. claim cmt_parent
  4. For each step in definition:
     a. commit: "Step: <label>"  --source mem_definition --tags step,sequence:<name>
        → produces cmt_step_N
     b. link cmt_step_N cmt_parent --kind related
  5. INSERT workflow_instances cache row with parent_commitment_id, definition_memory_id
  6. refreshWorkflowCache() — compute step_states from commitment states
```

Steps 1-4 are **ledger operations**. Step 5-6 are cache writes for the dashboard. The ledger is the source of truth.

### What `workflow status` Does

Queries commitments by `workflow_instance_id`, computes state from commitment states (not from `step_states` cache). Shows commitment IDs alongside each step.

### What `workflow approve` Does

Finds the step's commitment, creates an `approve` operation in the ledger, refreshes the cache.

### What `workflow cancel` Does

1. Annotates parent commitment with cancellation reason
2. Releases parent commitment
3. Releases all claimed step commitments
4. Calls `refreshWorkflowCache()` to compute correct `step_states` from current commitment states
5. Overrides `state` to `'cancelled'` — this is a sequence-level concept not derivable from commitment states (released commitments go to `'open'`, not `'cancelled'`)

---

## Supabase Schema

### workflows (template registry)

Reusable workflow definitions. This is a template registry, not runtime state — equivalent to storing PROMPT templates.

```sql
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  description TEXT,
  definition JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN DEFAULT true,
  UNIQUE(workspace_id, name, version)
);
```

### workflow_instances (materialized cache)

**This table is a cache, not the source of truth.** State is computed from commitment states by `refreshWorkflowCache()`.

```sql
CREATE TABLE workflow_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id),
  workflow_version INTEGER NOT NULL,
  name TEXT,
  parameters JSONB,
  state TEXT NOT NULL DEFAULT 'pending',  -- computed from child commitment states
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  step_states JSONB NOT NULL DEFAULT '{}',  -- computed from commitment states
  parent_commitment_id TEXT,     -- ledger source of truth (added in 013)
  definition_memory_id TEXT,     -- captured definition memory (added in 013)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

The `step_states` JSONB is **computed** from commitment states:

```json
{
  "connection-hardening": {
    "state": "completed",
    "commitment_id": "cmt_abc12345",
    "commitment_state": "closed",
    "outcome": "completed",
    "activated_at": "2026-03-06T14:00:00Z",
    "completed_at": "2026-03-06T14:05:42Z"
  },
  "connection-review": {
    "state": "active",
    "commitment_id": "cmt_def67890",
    "commitment_state": "claimed",
    "activated_at": "2026-03-06T14:06:00Z"
  }
}
```

### workflow_audit_log (DEPRECATED)

**Deprecated in migration 013.** No new writes. All events that were previously logged here are now ledger operations:

| Old event_type | Protocol equivalent |
|----------------|---------------------|
| `step_activated` | `claim` on step commitment |
| `step_completed` | `close` on step commitment |
| `step_failed` | `annotate` on step commitment |
| `gate_waiting` | `submit` on step commitment |
| `gate_released` | `approve` on step commitment |
| `approval_granted` | `approve` |
| `commitment_created` | `commit` (already a ledger op) |

Table retained for historical data. Do not drop.

### workflow_step_logs (operational telemetry)

Streaming logs are operational telemetry, not state. This table is unchanged and works as before.

### Commitment Integration

Commitments are the **primary relationship** — each step is a commitment:

```sql
-- On commitments table:
workflow_instance_id UUID  -- links this commitment to a sequence instance
workflow_step_id TEXT       -- identifies which step in the sequence
step_outcome TEXT          -- outcome when used as a workflow step
```

The dashboard queries commitments via these fields to show step-level detail.

---

## Dashboard Visualization

mentu-web provides two views for sequences:

### Panorama View (`/panorama`)

The cross-workspace overview shows:
- **Active sequences panel**: Running sequences across all workspaces with progress bars
- **Workspace grid**: Cards showing commitment stats and last activity
- **Activity feed**: Recent significant operations across all workspaces

Active sequences are pulled from `workflow_instances` where `state IN ('pending', 'running')`.

### Workspace Sequences Page (`/workspace/[name]/sequences`)

Lists all workflow instances for a workspace:
- Name, state badge, progress bar, start time, duration
- Click through to sequence detail

### Sequence Detail Page (`/workspace/[name]/sequences/[id]`)

Full detail of a single sequence execution:
- Header with name, state, progress
- **Step Timeline**: Vertical timeline showing each step with status icon (pending/running/completed/failed), duration, and collapsible log viewer
- **Parameters**: JSON display of instance parameters

### Step Log Viewer

The log viewer streams `workflow_step_logs` via Supabase realtime:
- Subscribes to `postgres_changes` on `workflow_step_logs` table
- Color-coded: stdout in default, stderr in red
- Auto-scrolls to bottom as new logs arrive
- Green dot indicator when realtime connection is active

---

## Adding Sequences to a New Repository

### 1. Create the directory structure

```bash
mkdir -p .ralph/sequences
```

### 2. Write prompt files

Create markdown prompt files in `.ralph/` for each step. Each prompt should contain:
- Clear task description
- Success criteria
- Build/test verification instructions
- Scope boundaries (what NOT to touch)

### 3. Create the sequence JSON

```bash
cat > .ralph/sequences/my-feature.json << 'EOF'
{
  "name": "my-feature",
  "description": "Implement feature X with review gates",
  "steps": [
    {
      "label": "implement",
      "auth": "work",
      "args": ["-P", ".ralph/PROMPT-feature-implement.md"]
    },
    {
      "label": "review",
      "auth": "rashid",
      "args": ["-P", ".ralph/PROMPT-feature-review.md"]
    },
    {
      "label": "tests",
      "auth": "work",
      "args": ["-P", ".ralph/PROMPT-feature-tests.md"]
    }
  ]
}
EOF
```

### 4. Run it

```bash
cd /path/to/project
ralph-seq my-feature
```

### 5. Resume on failure

If step 2 fails:

```bash
# Fix the issue, then resume from step 2
ralph-seq my-feature --from 2
```

---

## Integration with Mentu Ledger

Sequences ARE ledger compositions. A sequence is a parent commitment with child commitments for each step, linked together. This is not a complementary add-on — it is how sequences work.

### The Lifecycle

```
mentu workflow run "my-sequence"
  │
  ├── capture → mem_def (kind=sequence, body="Sequence: my-sequence (5 steps)")
  ├── commit  → cmt_parent (source=mem_def, tags=[sequence])
  ├── claim   → cmt_parent claimed
  │
  ├── commit  → cmt_step1 (source=mem_def, tags=[step, sequence:my-sequence])
  ├── link    → cmt_step1 → cmt_parent (kind=related)
  ├── commit  → cmt_step2 (source=mem_def, tags=[step, sequence:my-sequence])
  ├── link    → cmt_step2 → cmt_parent (kind=related)
  │   ... (for each step)
  │
  └── workflow_instances row created (cache, with parent_commitment_id + definition_memory_id)

Step execution:
  claim cmt_step1
  ... (agent does work) ...
  capture "Step completed: connection-hardening" --kind step_result --refs cmt_step1
  close cmt_step1 --evidence mem_evidence
  refreshWorkflowCache() → updates step_states, state

Sequence completion:
  When all step commitments are closed → state = "completed"
  capture "Sequence completed: 5/5 ok" --kind sequence_result
  close cmt_parent --evidence mem_summary
```

### Auto-Linking from Inside Steps

When `RALPH_WORKFLOW_STEP_CMT` environment variable is set, `mentu capture` automatically adds the step commitment to `refs`. This means evidence created during a step is automatically linked to that step's commitment.

```bash
# Set by ralph-seq before each step:
export RALPH_WORKFLOW_STEP_CMT="cmt_abc12345"

# Inside the agent session:
mentu capture "Implemented JWT auth module"
# → automatically includes refs: ["cmt_abc12345"]
```

### Environment Variables

| Variable | Set By | Purpose |
|----------|--------|---------|
| `RALPH_WORKFLOW_STEP_CMT` | ralph-seq | Step commitment ID for auto-linking captures |
| `RALPH_WORKFLOW_INSTANCE_ID` | ralph-seq | Instance ID for step-level metadata |
| `RALPH_WORKFLOW_STEP_ID` | ralph-seq | Step label for identification |
| `RALPH_SEQ_PARENT_CMT` | ralph-seq | Parent commitment ID |
| `RALPH_SEQ_DEFINITION_MEM` | ralph-seq | Definition memory ID |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RALPH_STEP_TIMEOUT` | `1800` | Per-step timeout in seconds (30 min) |
| `RALPH_CB_MAX_CONSECUTIVE` | `3` | Circuit breaker: max consecutive failures |
| `RALPH_CB_MAX_RATIO` | `50` | Circuit breaker: max failure percentage |

---

## File Layout Reference

```
~/.ralph/
  ralph-seq.zsh              # The runner (sourced from ~/.zshrc)
  lib/
    seq-utils.sh             # Shared utilities

<project>/
  .ralph/
    sequences/
      my-sequence.json       # Sequence definition
      .current               # Lock file (auto-managed)
      logs/
        my-sequence-20260306-140000.log  # Execution logs
      step-status/
        step-1.json           # Per-step status (circuit breaker input)
      step-results/
        step-1-20260306T140542.md  # Captured output from step (ralph_post_step.sh)
    findings/
      feature-recon.md        # Ghidra RE findings (recon_artifact target)
    agent/
      scratchpad.md           # Inter-step context
    PROMPT-step1.md           # Prompt files referenced by sequence
    PROMPT-step1-review.md
  .claude/
    protocol-state.json       # Written by ralph-seq before each step (read by hooks)
    skills/ralph-seq/         # Skill docs (deployed by workspace factory)
    hooks/                    # Enforcement hooks (deployed by workspace factory)

# Supabase (server-side)
workflows                    # Reusable workflow templates (unchanged)
workflow_instances           # Materialized cache (computed from commitments)
workflow_audit_log           # DEPRECATED — use ledger operations
workflow_step_logs           # Streaming log lines (operational telemetry, unchanged)

# mentu-web (visualization)
/panorama                    # Cross-workspace overview
/workspace/[name]/sequences  # Workspace sequence list
/workspace/[name]/sequences/[id]  # Sequence detail + step timeline
```

---

## Workspace Factory Deployment

The [mentu-workspace-factory](../../../mentu-workspace-factory) automatically deploys the ralph-seq skill and enforcement hooks to every new workspace during `/create-workspace`:

1. **Skill files** copied to `.claude/skills/ralph-seq/`:
   - `SKILL.md` — Usage documentation
   - `reference.md` — JSON schema, protocol tags, hook execution order
   - `examples.md` — Real-world sequence examples

2. **Hooks** registered in `.claude/settings.json` (see Hook Integration above)

3. **Directory scaffold**: `.ralph/agent/`, `.ralph/logs/`, `.ralph/specs/`, `.ralph/diagnostics/`

4. **Registry entry**: Factory appends to `registry.jsonl` with workspace ID, path, stack, build command

Sequences themselves are NOT templated — users create them per-task within their projects.

---

## Real-World Usage

### Production Statistics

| Repository | Sequences | Total Steps | PROMPT Files | Pattern |
|-----------|-----------|-------------|--------------|---------|
| **Crawlio-app** | 27 | 294 | 298 | Implement+review pairs, worktree execution |
| **mentu-interceptor** | 5 | 25 | 25 | Recon-impl-review triplets with artifact gating |
| **mentu-runtime** | active | — | — | Standard sequences |
| **crawlio-agent** | active | — | — | Standard sequences |

### Crawlio-app (27 sequences)

The most mature sequence user. Key sequences:

| Sequence | Steps | Description |
|----------|-------|-------------|
| `crawlio-cli-shell` | 24 | CLI REPL + agent integration |
| `crawlio-css-hardening` | 24 | CSS parsing across 12 phases |
| `crawlio-site-replay` | 20 | Site replay + caching |
| `crawlio-wp-hardening` | 20 | WordPress link patterns |
| `crawlio-supremacy` | 12 | 6-phase hardening (connection → resilience) |
| `crawlio-asset-embedding` | 12 | Asset types (srcset → video) |
| `crawlio-review-hardening` | 8 | 4 implement-review pairs |

Auth profile split: ~148 steps use `rashid`, ~146 use `work`. Typical step duration: 1-10 minutes. Full 12-step sequence: ~51 minutes.

### mentu-interceptor (5 sequences)

Uses advanced features most heavily:

| Sequence | Steps | Features |
|----------|-------|----------|
| `mentu-interceptor-recon` | 4 | Ghidra RE producing findings files |
| `mentu-interceptor-impl` | 11 | Sequential phases with review gates |
| `interceptor-ffi-bridge` | 3 | `recon_artifact` gating + `auto_review` |
| `interceptor-frame-bridge` | 5 | Full cascading: recon → parser → netstack → FFI → review |
| `interceptor-engine-integration` | 2 | Simple impl + review |

The frame-bridge sequence demonstrates the full protocol system: recon produces findings → ghidra-gate blocks impl until artifact exists → auto_review chains 4 steps → manual final review.

---

## Prompt File Conventions

Each PROMPT file should be self-contained (Ralph has no cross-step memory). Template structure:

```markdown
# PROMPT — <Feature>: <Phase Description>

## Objective
What to build, with measurable outcome.
**Mentu commitment**: Use `mentu submit` when complete.

## Reference Materials (READ FIRST)
- docs/handoffs/HANDOFF-<Feature>.md
- CLAUDE.md

## Execution Protocol

### Step A: Read Existing Code
List files to read before changes.

### Step B: Check If Already Implemented
What to look for (Ralph may re-run steps).

### Step C: Implement
Specific implementation instructions.

### Step D: Build & Test
Build command with verification.

### Step E: Commit
git add -A && git commit -m "[Feature Phase] description"

## Completion
Output: LOOP_COMPLETE
```

Key rules:
- **Self-contained** — include all context (no cross-step memory)
- **Include HANDOFF path** — agent reads full specs
- **"Check If Already Implemented"** — Ralph may re-run steps
- **End with `LOOP_COMPLETE`** — matches ralph.yml `completion_keyword`
- **May read step results** — PROMPTs can reference `.ralph/sequences/step-results/` from prior steps

---

## Auth Profiles

Ralph-seq selects Claude Code profiles via the `auth` field. Each profile maps to a shell function and OAuth token:

| Profile | Shell Function | Token Source | Use Case |
|---------|----------------|--------------|----------|
| `work` | `ralph-work` | `~/.claude/work-token` | Org billing, systematic execution |
| `rashid` | `ralph-rashid` | `~/.claude/rashid-token` | Personal work, detailed reviews |

Additional profiles exist for multi-org setups (`talisman`, `affihub`, `ppw`, etc.). The workspace factory deploys `scripts/ralph-work.sh` which:
1. Sources the OAuth token from `~/.claude/<profile>-token`
2. Unsets `ANTHROPIC_API_KEY` (avoid per-call billing)
3. Sets `MAX_THINKING_TOKENS=63999`
4. Launches `mentu sync --watch` in background
5. On exit: auto-commits, submits commitment, syncs

---

## Cache Refresh

The `refreshWorkflowCache()` function in `src/workflows/cache.ts` keeps the dashboard view fresh:

```typescript
import { refreshWorkflowCache } from '../workflows/cache.js';

// After any ledger operation on a workflow-linked commitment:
await refreshWorkflowCache(client, instanceId);
```

It:
1. Queries all commitments where `workflow_instance_id = instanceId`
2. Maps commitment states to step states via `mapCommitmentStateToStepState()` (open→pending, claimed→running, in_review→running, closed→completed, reopened→running)
3. Computes overall instance state via `computeInstanceState()` (all closed→completed, any active→running, otherwise→pending)
4. Updates `workflow_instances.step_states` and `state`

Both `mapCommitmentStateToStepState()` and `computeInstanceState()` are exported as pure functions for unit testing.

Called automatically by:
- `mentu workflow run` (after creating step commitments)
- `mentu workflow approve` (after approving)
- `mentu workflow cancel` (before overriding state to 'cancelled')
- `WorkflowExecutor.completeStep()` (after closing)
- `WorkflowExecutor.approveGate()` (after approving)
- `WorkflowExecutor.failStep()` (after annotating)

**Cancel is special**: `refreshWorkflowCache()` is called first to compute accurate `step_states`, then `state` is overridden to `'cancelled'`. This is because 'cancelled' is a sequence-level concept — released commitments revert to 'open', which is indistinguishable from never-claimed.

---

## Future Phases

### Phase 1: Ralph-Seq Instrumentation

Add ~40 lines to `~/.ralph/ralph-seq.zsh` to create ledger operations at each lifecycle point:

- **Sequence start**: `mentu capture` (kind=sequence) → `mentu commit` (parent) → `mentu claim`
- **Step start**: `mentu commit` (step) → `mentu link` to parent → `mentu claim`
- **Step end (success)**: `mentu capture` (evidence) → `mentu close` step commitment
- **Step end (failure)**: `mentu annotate` step commitment
- **Sequence end**: `mentu capture` (summary) → `mentu close` parent commitment

All mentu calls wrapped in `2>/dev/null` with fallbacks — instrumentation is additive, not blocking. If mentu is not installed, ralph-seq still works.

### Phase 2: Workspace Factory Integration

- Auto-register workspaces in `workspace_registry` during `/create-workspace`
- Generate `.ralph/` directory structure from templates
- Include workflow registration in generated `ralph-work.sh`

### Phase 3: Cross-Repository Sequences

- Sequences that span multiple repositories
- Step-level `dir` pointing to sibling repos
- Shared evidence/memory references across workspaces

---

## For Other Agents and Repos

This section explains what changed and what every agent across the Mentu ecosystem needs to know.

### What Changed (Protocol-Native Sequences, v4.3)

The Sequences feature was realigned with the Mentu Protocol. Previously, it maintained its own mutable state system (`workflow_instances.step_states` mutated directly, `workflow_audit_log` as parallel audit trail). Now, all state changes go through the commitment ledger.

#### Migration 013

```sql
-- Added to workflow_instances:
parent_commitment_id TEXT   -- links to parent commitment in ledger
definition_memory_id TEXT   -- links to captured sequence definition
-- workflow_audit_log: DEPRECATED (no new writes)
```

Run this migration on your Supabase instance. It is non-breaking — adds columns, doesn't remove anything.

#### New Files

| File | Purpose |
|------|---------|
| `src/workflows/cache.ts` | Computes `step_states` from commitment states, updates `workflow_instances`. Exports `computeInstanceState()` and `mapCommitmentStateToStepState()` as pure functions for unit testing |

#### Modified Files

| File | What Changed |
|------|-------------|
| `src/commands/workflow.ts` | All subcommands now use ledger operations (capture/commit/claim/link/close/annotate/release) instead of raw Supabase INSERT/UPDATE |
| `src/workflows/executor.ts` | `completeStep()`, `approveGate()`, `failStep()` operate through ledger, then refresh cache |
| `src/workflows/types.ts` | `WorkflowInstance` has `parent_commitment_id`, `definition_memory_id`. `StepStatus` has `commitment_id` (required), `commitment_state` |
| `src/workflows/gates.ts` | Evaluates `commitment_state` instead of internal `status`. Validation gate accepts legacy aliases (`'success'`→success path, `'failure'`→failure path) alongside protocol states (`'closed'`/`'completed'`, `'failed'`/`'rejected'`) |
| `src/commands/capture.ts` | Auto-links to step commitment via `RALPH_WORKFLOW_STEP_CMT` env var |
| `src/index.ts` | `registerWorkflowCommand(program)` — workflow command now registered (was dead code) |

#### What Did NOT Change

| File/Component | Why |
|----------------|-----|
| `PROTOCOL.md` | Canonical, never modified |
| `src/workflows/dag-validator.ts` | Pure graph logic |
| `src/workflows/parser.ts` | Pure YAML parsing |
| `~/.ralph/ralph-seq.zsh` | Changed separately (Future Phase 1) |
| mentu-web components | Read from cache — work as-is if cache is refreshed |
| `workflows` table | Template registry, not runtime state |
| `workflow_step_logs` table | Operational telemetry, not state |

### Impact on mentu-web

**No code changes needed.** The dashboard reads from `workflow_instances` (the cache), which is kept fresh by `refreshWorkflowCache()`. The `step_states` JSON shape is compatible — it now includes `commitment_id` and `commitment_state` fields which the dashboard can optionally display.

If you want to enhance the dashboard:
- Show `commitment_id` next to each step in the timeline
- Link each step to `/workspace/{name}/commitments/{commitment_id}`
- Show `parent_commitment_id` on the sequence detail page

### Impact on ralph-seq

**No changes needed yet.** Ralph-seq continues to work as a local runner. Future Phase 1 will add ~40 lines of mentu CLI calls to create ledger operations at lifecycle points. All instrumentation is additive and non-blocking — if mentu fails, ralph-seq continues.

### Impact on mentu-proxy

**No changes needed.** The proxy routes (`/workflow/log`, `/panorama`) read from the same Supabase tables. The cache is still there, just refreshed differently.

### Impact on workspace-factory

**No changes needed now.** When Phase 2 (Workspace Factory Integration) is implemented, new workspaces will auto-register in `workspace_registry` and include workflow registration in generated scripts.

### Key Rules for All Agents

1. **Never write directly to `workflow_instances.step_states`** — use ledger operations, then call `refreshWorkflowCache()`
2. **Never write to `workflow_audit_log`** — it is deprecated. Use ledger operations instead.
3. **Every step completion must produce evidence** — capture a memory, then close the step commitment with `--evidence`
4. **State is computed, not stored** — query commitments by `workflow_instance_id` to get the true state
5. **The `RALPH_WORKFLOW_STEP_CMT` env var** — if set, `mentu capture` auto-links to the step commitment. Set this before launching agent sessions inside workflow steps.
6. **The only exception to rule 1 is cancellation** — `workflow cancel` calls `refreshWorkflowCache()` first, then overrides `state` to `'cancelled'` because this state cannot be derived from commitment states alone (released = open, not cancelled).

### Quick Reference: Sequence as Commitments

```
Parent commitment (cmt_parent)
  ├── source: mem_definition (kind=sequence)
  ├── tags: [sequence]
  ├── state: claimed → closed (when all steps done)
  │
  ├── Step 1 commitment (cmt_step1)
  │   ├── source: mem_definition
  │   ├── tags: [step, sequence:<name>]
  │   ├── link: → cmt_parent (kind=related)
  │   ├── workflow_instance_id: <instance UUID>
  │   ├── workflow_step_id: "step-1-label"
  │   └── state: open → claimed → closed (with evidence)
  │
  ├── Step 2 commitment (cmt_step2)
  │   └── ... same pattern ...
  │
  └── Step N commitment (cmt_stepN)
      └── ... same pattern ...
```
