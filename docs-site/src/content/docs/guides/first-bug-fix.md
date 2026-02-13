---
title: "Your First Bug Fix"
description: "End-to-end tutorial: from bug report to closed commitment with a full evidence trail"
---

This guide walks through the complete lifecycle of fixing a bug using Mentu — from the moment a bug is reported to the commitment closing with a full evidence chain.

## The Flow

```
Bug reported → /triage → /fix → Branch + PR → Submit → Approve → Closed
```

Every step is recorded in the Mentu ledger. At the end, you have a complete, auditable trail of what happened, who did it, and what evidence supports the fix.

## Step 1: Bug Is Reported

A bug is captured via the BugReporter SDK embedded in your application. When a user (or QA tester) reports an issue, the SDK fires a `capture` operation to Mentu:

```json
{
  "op": "capture",
  "actor": "sdk:bug-reporter",
  "payload": {
    "kind": "bug",
    "title": "Invoice total shows NaN when discount is empty",
    "body": "Steps to reproduce: create invoice, leave discount blank, click calculate...",
    "meta": {
      "url": "/invoices/new",
      "browser": "Chrome 125",
      "screenshot": "https://..."
    }
  }
}
```

This creates a **memory** in the ledger (e.g., `mem_a1b2c3d4`). The bug now exists as a first-class object in Mentu.

## Step 2: Triage

The developer runs the `/triage` command in their editor (via the Mentu MCP plugin):

```
/triage
```

This queries Mentu for all unresolved memories of kind `bug` and displays them in an actionable table:

```
ID           | Title                                      | Reported   | Severity
-------------|--------------------------------------------|-----------|---------
mem_a1b2c3d4 | Invoice total shows NaN when discount...   | 2 hrs ago  | medium
mem_e5f6g7h8 | Login page crash on Safari 17              | 1 day ago  | high
```

The developer reviews the list and decides which bug to fix.

## Step 3: Fix

The developer runs `/fix` with the memory ID:

```
/fix mem_a1b2c3d4
```

The Mentu plugin orchestrates the entire fix workflow:

### 3a. Fetch Bug Details

The plugin retrieves the full memory from Mentu, including the bug title, description, reproduction steps, and any attached metadata (screenshots, browser info, URL).

### 3b. Investigate the Codebase

Using the bug details as context, the plugin (powered by the AI agent) searches the codebase for the relevant code. It reads files, traces the logic, and identifies the root cause.

### 3c. Estimate Complexity

Based on the investigation, the plugin classifies the fix into a complexity tier:

| Tier | Description | Review Required |
|------|-------------|-----------------|
| **T1** | Trivial — typo, config change, one-line fix | Auto-close, no review |
| **T2** | Standard — localized bug fix, 1-3 files | Auto-close + 24h review window |
| **T3** | Complex — multi-file change, architectural impact | Human approval required |

### 3d. Create Branch

The plugin creates a git branch following the naming convention:

```
fix/mem_a1b2c3d4
```

### 3e. Create and Claim Commitment

The plugin fires two operations to Mentu:

1. **`commit`** — creates a new commitment (`cmt_x9y8z7w6`) referencing the memory
2. **`claim`** — claims the commitment for the current actor

The commitment is now `claimed` in the ledger.

### 3f. Apply the Fix

The agent applies the code fix. After each significant change, it runs the build to verify nothing is broken:

```
Fix applied → npm run build → PASS
Tests run → npm test → PASS
```

Each build result is captured as evidence.

### 3g. Push and Create PR

The plugin pushes the branch and creates a pull request via `gh`:

```bash
git push -u origin fix/mem_a1b2c3d4
gh pr create --title "fix: handle empty discount in invoice total" \
  --body "Fixes mem_a1b2c3d4 — Invoice total shows NaN when discount is empty"
```

### 3h. Submit Commitment

The plugin fires a `submit` operation with the full evidence chain:

```json
{
  "op": "submit",
  "actor": "agent:claude",
  "payload": {
    "commitment_id": "cmt_x9y8z7w6",
    "evidence": [
      { "kind": "pr", "url": "https://github.com/org/repo/pull/42" },
      { "kind": "build", "status": "pass", "log": "..." },
      { "kind": "test", "status": "pass", "summary": "24 passed, 0 failed" }
    ]
  }
}
```

The commitment moves from `claimed` to `in_review`.

## Step 4: Dashboard Shows Progress

Throughout this process, the Mentu dashboard updates in real time:

1. **`open`** — commitment appears in the Commitments view
2. **`claimed`** — badge changes to yellow, actor shown
3. **`in_review`** — badge changes to purple, evidence chain visible on the detail page

The team lead (or any reviewer) can see the full timeline: when the commitment was created, who claimed it, what evidence was submitted, and the PR link.

## Step 5: Approve

The team lead reviews the PR and the evidence chain. Satisfied that the fix is correct, they approve from the dashboard (or the Companion app):

- Click the commitment in the Commitments view
- Review the evidence (PR, build logs, test results)
- Click **Approve**

This fires a `close` operation:

```json
{
  "op": "close",
  "actor": "human:rashid",
  "payload": {
    "commitment_id": "cmt_x9y8z7w6",
    "verdict": "pass",
    "evidence": [
      { "kind": "review", "note": "Fix verified, PR approved" }
    ]
  }
}
```

## Step 6: Commitment Closes

The commitment is now `closed` with a complete evidence trail:

```
mem_a1b2c3d4 (bug report)
  → cmt_x9y8z7w6 (commitment)
    → claimed by agent:claude
    → evidence: PR #42, build pass, 24 tests pass
    → submitted for review
    → approved by human:rashid
    → closed (pass)
```

Every step is in the ledger. Anyone can replay the operations to reconstruct exactly what happened, when, and by whom.
