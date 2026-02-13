---
title: "Commands"
description: "Reference for all mentu-autopilot slash commands: /triage, /fix, /run, /setup, and /status."
---

The mentu-autopilot plugin registers five slash commands in Claude Code. Each command is designed for a specific stage of the bug-fix workflow.

## /triage

**Read-only dashboard.** Fetches open bug memories from your Mentu workspace, scores them, and displays an actionable table. Does not create or modify any commitments.

### Syntax

```
/triage
```

### What It Does

1. **Fetch** — Pulls all open bug memories from the workspace.
2. **5-Gate Garbage Filter** — Each bug passes through five sequential gates. A failure at any gate eliminates the bug from the pipeline:
   - **Body Coherence** — Does the report contain a meaningful description?
   - **Test Detection** — Is there a reproduction path or test case?
   - **Project Match** — Does the bug belong to this project's domain?
   - **Duplicate Collapse** — Is this a duplicate of an already-triaged bug?
   - **Actionability** — Can this be fixed with the available codebase?
3. **Score** — Survivors are scored by severity, clarity, and estimated effort.
4. **Display** — Results are shown in a ranked table.

### Example Output

```
Triage Results (12 fetched → 7 survived → 5 actionable)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 #  Score  ID              Title                          Tier  Gate Failures
 1  9.2    mem_a8f3c21...  Login form rejects valid email  T1   —
 2  8.7    mem_b4d9e10...  Dashboard chart renders blank   T2   —
 3  7.4    mem_c1a2f33...  Export CSV missing headers       T1   —
 4  6.8    mem_d7e5b44...  Sidebar collapses on mobile     T2   —
 5  5.1    mem_e9c0a55...  Slow query on clients page      T3   —

Filtered (5):
  - mem_f1... "asdf" — failed Body Coherence
  - mem_f2... "test bug" — failed Actionability
  - mem_f3... duplicate of mem_a8f3c21
  - mem_f4... unrelated project domain
  - mem_f5... "colors look wrong" — failed Test Detection
```

No data is mutated. Run `/fix <mem_id>` on any survivor to begin the fix pipeline.

---

## /fix

**End-to-end single ticket fix.** Takes a memory ID and drives it through the full pipeline: fetch, investigate, branch, fix, build, push, PR, and submit.

### Syntax

```
/fix <mem_id>
```

### Parameters

| Parameter | Required | Description |
|---|---|---|
| `mem_id` | Yes | The Mentu memory ID (e.g., `mem_a8f3c21...`) |

### The 10 Phases

1. **Fetch** — Pull the full bug memory from Mentu, including body, meta, and any attachments.
2. **Investigate** — Read relevant source files, trace the bug to its root cause, and identify the files that need to change.
3. **Estimate Complexity** — Classify the fix into a tier:
   - **T1** — Simple: CSS, text, config, or single-line logic changes.
   - **T2** — Moderate: multi-line logic, component refactors, or state changes.
   - **T3** — Complex: multi-file changes, schema migrations, or cross-cutting concerns.
4. **Branch** — Create a git branch named `fix/<mem_id_short>-<slug>` from the current HEAD.
5. **HANDOFF** — Write a `HANDOFF.md` document in the branch describing the diagnosis, fix plan, and affected files. This serves as a breadcrumb if the agent is interrupted.
6. **Commit + Claim** — Create a Mentu commitment (`commit` op) and immediately claim it (`claim` op). This signals to other agents that the ticket is being worked on.
7. **Fix** — Apply the code changes. Record progress evidence on each significant step.
8. **Verify** — Run the build command and capture the result. If the build fails, attempt one retry. A passing build is required to proceed.
9. **Push + PR** — Push the branch and create a pull request via `gh pr create`. Capture the PR URL as evidence.
10. **Submit** — Close the commitment with `pass` status and the full evidence array.

### Example

```
/fix mem_a8f3c21d

Fetching memory mem_a8f3c21d...
  Title: Login form rejects valid email
  Severity: high

Investigating...
  Root cause: email regex in src/lib/validators.ts rejects "+" in local part
  Files: src/lib/validators.ts, src/components/LoginForm.tsx
  Tier: T1 (single regex fix)

Creating branch fix/a8f3c21d-login-email-regex...
Writing HANDOFF.md...
Committing to Mentu (mem → commitment)...
Claiming commitment...

Fixing...
  ✓ Updated EMAIL_REGEX in src/lib/validators.ts
  ✓ Added test case for "user+tag@example.com"

Verifying...
  ✓ Build passed (3.2s)

Pushing & creating PR...
  ✓ PR #142: "fix: accept + in email local part"
    https://github.com/org/repo/pull/142

Submitting to Mentu...
  ✓ Commitment closed (pass)
  Evidence: 4 items (commit, build, PR, validation)

Done. Fix shipped in 47s.
```

---

## /run

**Full autopilot mode.** Runs waves of triage + fix cycles. Each wave triages the backlog, picks the top N tickets, fixes them, pushes all results, and summarizes before continuing to the next wave.

### Syntax

```
/run [flags]
```

### Flags

| Flag | Default | Description |
|---|---|---|
| `--dry-run` | `false` | Triage and plan only. No branches, no commits, no PRs. |
| `--max-waves N` | `5` | Maximum number of waves before stopping. |
| `--batch-size N` | `5` | Number of tickets to fix per wave. |

### What It Does

1. **Wave Start** — Run `/triage` to get the current backlog.
2. **Batch Fix** — Take the top N tickets (by score) and run `/fix` on each sequentially.
3. **Push All** — Ensure all branches are pushed and PRs are open.
4. **Wave Summary** — Log a summary of what was fixed, failed, or skipped.
5. **Circuit Breaker Check**:
   - If 2 consecutive waves produce zero fixes, stop (backlog is empty or all remaining tickets are unfixable).
   - If `max-waves` is reached, stop.
6. **Continue** — If no breaker tripped, start the next wave.

### Example

```
/run --max-waves 3 --batch-size 3

Wave 1/3
  Triaged: 12 → 5 actionable
  Fixing: mem_a8f..., mem_b4d..., mem_c1a...
    ✓ mem_a8f — PR #142
    ✓ mem_b4d — PR #143
    ✗ mem_c1a — build failed (submitted as fail)
  Wave 1 complete: 2 passed, 1 failed

Wave 2/3
  Triaged: 9 → 4 actionable
  Fixing: mem_d7e..., mem_e9c..., mem_f0b...
    ✓ mem_d7e — PR #144
    ✓ mem_e9c — PR #145
    ✓ mem_f0b — PR #146
  Wave 2 complete: 3 passed, 0 failed

Wave 3/3
  Triaged: 6 → 2 actionable
  Fixing: mem_g2h..., mem_h3i...
    ✓ mem_g2h — PR #147
    ✓ mem_h3i — PR #148
  Wave 3 complete: 2 passed, 0 failed

Autopilot finished: 3 waves, 7 passed, 1 failed, 8 PRs opened.
```

### Dry Run

```
/run --dry-run

Wave 1 (dry run)
  Triaged: 12 → 5 actionable
  Would fix: mem_a8f (T1), mem_b4d (T2), mem_c1a (T1), mem_d7e (T2), mem_e9c (T3)
  Estimated effort: 3× T1, 1× T2, 1× T3

No mutations made. Run without --dry-run to execute.
```

---

## /setup

**Interactive onboarding.** Walks you through configuring the Mentu connection for the current project.

### Syntax

```
/setup
```

### What It Does

1. Prompts for the Mentu API URL (provides default: `https://mentu-proxy.affihub.workers.dev/ops`).
2. Prompts for your API token.
3. Prompts for your workspace ID.
4. Tests the connection by making a lightweight API call.
5. On success, writes `.mentu.json` to the project root with the validated config.
6. Adds `.mentu.json` to `.gitignore` if not already listed.
7. Displays a confirmation with workspace name and memory count.

### Example

```
/setup

Mentu Autopilot Setup
━━━━━━━━━━━━━━━━━━━━━

API URL [https://mentu-proxy.affihub.workers.dev/ops]: ↵
API Token: ••••••••••••••••
Workspace ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890

Testing connection...
  ✓ Connected to workspace "my-project"
  ✓ 14 open memories found

Wrote .mentu.json
Added .mentu.json to .gitignore

Setup complete. Run /triage to see your backlog.
```

---

## /status

**Quick pipeline overview.** Shows commitment counts, recent activity, and throughput metrics for the connected workspace.

### Syntax

```
/status
```

### What It Shows

- **Connection status** — whether the plugin can reach the Mentu API.
- **Commitment counts** — how many commitments are open, claimed, and closed.
- **Recent activity** — submissions and failures in the last 24 hours.
- **Throughput** — rolling 7-day average of fixes per day.

### Example Output

```
Mentu Pipeline Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Workspace:    my-project (a1b2c3d4-...)
Connection:   ✓ Connected

Commitments:
  Open:       3
  Claimed:    1
  Closed:     27

Recent Activity (last 24h):
  Submitted:  4
  Failed:     0

Throughput:   4.2 fixes/day (7-day avg)
```

If the connection fails, the output will show the error and suggest running `/setup` to reconfigure.
