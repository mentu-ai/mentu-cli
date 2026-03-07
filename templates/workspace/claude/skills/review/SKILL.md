---
name: review
description: Run 5-agent parallel code review (intent, security, bugs, guidelines, visual) on the current branch. Spawns parallel Task agents, collects verdicts, and reports consolidated results.
user_invocable: true
---

# Parallel Code Review

Run a 5-agent review on the current branch changes using parallel Task tool calls.

## Arguments

`$ARGUMENTS` -- Feature name (e.g., `UserAuth`, `MultiTenant`). Used to locate PRD/HANDOFF docs. Optionally append test credentials after a pipe: `FeatureName|email:pass` for visual review login.

## Prerequisites

- Dev server should be running at `http://localhost:{{DEV_PORT}}` for visual review (if not running, visual review will SKIP)
- Branch should have commits to review (compared against `main`)

## Execution

### Step 1: Gather Context

Run these bash commands to collect review context:

```bash
git diff main...HEAD --name-only
```

```bash
git log --oneline main...HEAD
```

Save the output as `CHANGED_FILES` (the file list) and `COMMIT_LOG` (the log output). These will be passed inline to every agent.

Parse `$ARGUMENTS` for optional credentials: if the format is `FeatureName|email:password`, extract the feature name and credentials separately.

### Step 2: Spawn 5 Review Agents in Parallel

Launch ALL 5 agents in a **single message** using 5 parallel Task tool calls. Each agent is independent -- they do not communicate with each other.

**Agent 1: Intent Reviewer**
```
Task(
  subagent_type = "review-intent",
  description = "Review intent alignment",
  prompt = "Review the feature '{FeatureName}' for intent alignment with PRD/HANDOFF docs.

Changed files:
{CHANGED_FILES}

Commit log:
{COMMIT_LOG}

Read docs/PRD-{FeatureName}.md and docs/HANDOFF-{FeatureName}.md if they exist. Output your verdict as JSON."
)
```

**Agent 2: Security Reviewer**
```
Task(
  subagent_type = "review-security",
  description = "Review security",
  prompt = "Review these changed files for security vulnerabilities.

Feature: {FeatureName}

Changed files:
{CHANGED_FILES}

Commit log:
{COMMIT_LOG}

Read each changed file and scan for OWASP Top 10, auth issues, injection, etc. Output your verdict as JSON."
)
```

**Agent 3: Bug Reviewer**
```
Task(
  subagent_type = "review-bugs",
  description = "Review for bugs",
  prompt = "Review these changed files for logic errors, bugs, and correctness issues.

Feature: {FeatureName}

Changed files:
{CHANGED_FILES}

Commit log:
{COMMIT_LOG}

Read each changed file and analyze for bugs, race conditions, null refs, off-by-one errors, etc. Output your verdict as JSON."
)
```

**Agent 4: Guidelines Reviewer**
```
Task(
  subagent_type = "review-guidelines",
  description = "Review guidelines compliance",
  prompt = "Review these changes for CLAUDE.md compliance and codebase conventions.

Feature: {FeatureName}

Changed files:
{CHANGED_FILES}

Commit log:
{COMMIT_LOG}

Read CLAUDE.md and check that all changes follow project conventions and code patterns. Output your verdict as JSON."
)
```

**Agent 5: Visual Reviewer**
```
Task(
  subagent_type = "review-visual",
  description = "Review visual/functional",
  prompt = "Visually and functionally test the feature '{FeatureName}' in the running app at http://localhost:{{DEV_PORT}}.

Changed files:
{CHANGED_FILES}

{If credentials available: 'Test credentials: email={email} password={password}'}
{If no credentials: 'No test credentials provided.'}

Navigate to relevant pages, take screenshots, test responsive layouts, and check console for errors. Output your verdict as JSON."
)
```

**CRITICAL:** All 5 Task calls MUST be in a single message so they run in parallel. Do NOT launch them sequentially.

### Step 3: Collect and Parse Verdicts

Each Task agent returns a text result containing its JSON verdict. Parse the JSON from each result to extract:
- `verdict`: PASS, FAIL, or SKIP
- `findings`: array of issues found
- `summary`: one-line summary

If an agent's output doesn't contain valid JSON, treat it as `SKIP` with summary "Agent did not return structured verdict".

### Step 4: Consolidated Report

Output a formatted report:

```markdown
## Code Review: {FeatureName}

**Branch:** {current branch}
**Changed files:** {count}
**Commits:** {count}

### Verdicts

| Agent | Verdict | Findings | Summary |
|-------|---------|----------|---------|
| Intent | PASS/FAIL | N | ... |
| Security | PASS/FAIL | N | ... |
| Bugs | PASS/FAIL | N | ... |
| Guidelines | PASS/FAIL | N | ... |
| Visual | PASS/FAIL/SKIP | N | ... |

### Overall: PASS / FAIL

### Critical Findings (if any)
List findings with confidence >= 90 from any agent

### High Findings (if any)
List findings with confidence >= 80 from any agent

### Recommendations
Actionable next steps if any FAIL verdicts
```

## Verdict Aggregation

- **Overall PASS**: All agents return PASS (or SKIP for visual)
- **Overall FAIL**: Any agent returns FAIL
- **Visual SKIP**: Does not count as FAIL (dev server may not be running or no credentials)

## Notes

- The review is read-only -- no files are modified
- Each agent runs independently and may read the same files
- If no PRD/HANDOFF exists for the feature name, intent review will report advisory findings
- Run `/deslop` first if you want to clean up slop before review
- Do NOT use TeamCreate/SendMessage -- agents are independent and don't need to communicate
