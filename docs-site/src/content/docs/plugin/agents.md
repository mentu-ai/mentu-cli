---
title: "Agents"
description: "Reference for the mentu-autopilot autonomous agents: ticket-planner for triage and planning, and ticket-reviewer for intelligent code review."
---

The mentu-autopilot plugin ships two autonomous agents that Claude Code can delegate work to. Agents run as sub-conversations with their own context and tools, reporting results back to the main session.

## ticket-planner

**Autonomous triage and planning agent.** Fetches bugs from the workspace, filters and scores them, investigates survivors in the codebase, and creates branches with HANDOFF documents and Mentu commitments.

### When It Runs

The ticket-planner is invoked automatically by the `/run` command at the start of each wave, or you can invoke it manually:

```
Run the ticket-planner agent
```

### What It Does

The agent operates in four phases:

#### Phase 1: Fetch and Filter

1. Pulls all open bug memories from the Mentu workspace.
2. Runs each memory through the 5-gate garbage filter (see [Autopilot](/plugin/autopilot/) for gate details).
3. Produces a ranked list of actionable tickets, sorted by score.

#### Phase 2: Investigate

For each surviving ticket (up to 5 per run):

1. Reads the bug description, reproduction steps, and any attached metadata (screenshots, console errors, URLs).
2. Searches the codebase for relevant files using the symptoms described in the report.
3. Traces the root cause by reading source code, following imports, and checking recent git history.
4. Classifies the fix complexity:
   - **T1** — Simple: CSS, text, config, single-line logic.
   - **T2** — Moderate: multi-line logic, component-level changes, state management.
   - **T3** — Complex: multi-file, schema changes, cross-cutting concerns.

#### Phase 3: Plan

For each investigated ticket:

1. Creates a git branch: `fix/<mem_id_short>-<descriptive-slug>`.
2. Writes a `HANDOFF.md` file in the branch root containing:
   - Bug summary and reproduction steps.
   - Root cause analysis with file paths and line numbers.
   - Proposed fix strategy.
   - Affected files list.
   - Estimated tier and reasoning.
3. Commits the HANDOFF document to the branch.

#### Phase 4: Register

1. Creates a Mentu commitment for each planned fix (`commit` op).
2. Records the branch name, tier, and HANDOFF path as initial evidence.
3. Returns the list of planned commitments to the calling context.

### Output

The agent returns a structured summary:

```
ticket-planner completed
━━━━━━━━━━━━━━━━━━━━━━━━

Fetched:      14 memories
Filtered:     9 (5 eliminated)
Investigated: 5
Planned:      5

Tickets:
  1. mem_a8f3c21d — "Login email regex" — T1 — fix/a8f3-login-email
  2. mem_b4d9e10a — "Blank dashboard chart" — T2 — fix/b4d9-chart-blank
  3. mem_c1a2f33b — "CSV missing headers" — T1 — fix/c1a2-csv-headers
  4. mem_d7e5b44c — "Mobile sidebar collapse" — T2 — fix/d7e5-sidebar-mobile
  5. mem_e9c0a55d — "Slow clients query" — T3 — fix/e9c0-clients-perf
```

### Limits

- Processes a maximum of **5 tickets per run** to keep context manageable and avoid overwhelming the git history.
- If fewer than 5 tickets survive the garbage filter, the agent processes all survivors.
- Tickets that fail investigation (e.g., root cause cannot be determined) are logged but not planned.

---

## ticket-reviewer

**Smart review agent.** Reviews completed fixes by classifying the change type and running an appropriate number of targeted review passes. Captures findings as evidence on the Mentu commitment.

### When It Runs

The ticket-reviewer is invoked automatically after a fix is applied (during the `/fix` pipeline), or you can invoke it manually on any branch:

```
Run the ticket-reviewer agent on the current branch
```

### What It Does

#### Step 1: Classify Fix Type

The agent reads the diff and classifies the fix into one of five categories:

| Type | Description | Review Passes |
|---|---|---|
| **CSS** | Style-only changes (colors, layout, spacing) | 2 |
| **UI** | Component structure, JSX, props, rendering | 3 |
| **Data** | Queries, mutations, API calls, data transforms | 4 |
| **Auth** | Authentication, authorization, permissions, RLS | 5 |
| **Multi-file** | Changes spanning 3+ files across domains | 4-5 |

#### Step 2: Run Review Passes

Each pass focuses on a different aspect of the change:

**Pass 1: Correctness** (all types)
- Does the fix address the reported bug?
- Are there off-by-one errors, null checks, or edge cases?
- Does the logic match the HANDOFF plan?

**Pass 2: Regression Risk** (all types)
- Could this change break existing functionality?
- Are there callers of modified functions that might be affected?
- Does the change respect existing API contracts?

**Pass 3: Style and Consistency** (UI, Data, Auth, Multi-file)
- Does the code follow project conventions?
- Are variable names, imports, and patterns consistent with surrounding code?
- Is there dead code or unnecessary duplication?

**Pass 4: Security** (Data, Auth, Multi-file)
- Are inputs validated and sanitized?
- Are there SQL injection, XSS, or CSRF risks?
- Do RLS policies remain intact?
- Are secrets or credentials exposed?

**Pass 5: Integration** (Auth, some Multi-file)
- Do permissions cascade correctly?
- Are there race conditions in multi-step flows?
- Does the change work across all roles (admin, client, supplier)?

#### Step 3: Capture Findings

After all passes complete, the agent:

1. Produces a structured review summary with findings by pass.
2. Assigns an overall verdict: **approve**, **request-changes**, or **flag-for-human**.
3. Records the review as evidence on the Mentu commitment, including:
   - Fix type classification.
   - Number of passes run.
   - Findings per pass (if any).
   - Overall verdict.

### Output

```
ticket-reviewer completed
━━━━━━━━━━━━━━━━━━━━━━━━━

Fix:     mem_a8f3c21d — "Login email regex"
Type:    UI (3 passes)
Verdict: approve

Pass 1 (Correctness): ✓ No issues
  Regex now correctly accepts "+" in email local part.

Pass 2 (Regression Risk): ✓ No issues
  Only one caller (LoginForm). Existing valid emails unaffected.

Pass 3 (Style): ✓ No issues
  Pattern matches project conventions. Test added.

Evidence recorded on commitment cmt_x9y8z7.
```

### Verdicts

- **approve** — The fix is clean and ready to ship. The `/fix` pipeline continues to push and PR.
- **request-changes** — Issues found that should be addressed before shipping. The pipeline pauses and reports findings.
- **flag-for-human** — The change is too risky or ambiguous for automated approval. A human should review the PR.
