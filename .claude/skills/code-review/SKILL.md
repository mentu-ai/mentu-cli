---
name: code-review
description: Deep code review with security, performance, and style analysis. Use to review agent-delivered code or process Mentu in_review commitments. Integrates with mentu approve/reopen. (project)
integration: pr_review_workflow.py  # Auto-triggers on mentu submit
---

# Code Review Skill

Automated code review using **parallel agents** with **confidence-based scoring** to filter false positives.

## Quick Start

```
# Review current PR/branch
/code-review

# Review and post comments to PR
/code-review --comment

# Review specific commitment from Mentu queue
/code-review cmt_xxx
```

---

## Automatic Integration

**The code review skill auto-triggers when `mentu submit` is executed.**

When a commitment enters `in_review` state, the `pr_review_workflow.py` hook:

1. Detects the submit command
2. Creates a PR if code changes exist
3. Runs 4 parallel review agents
4. Auto-approves if all pass, reopens if any fail
5. Generates `RESULT-Review-{cmt_id}.md` with evidence

This means you don't need to manually invoke `/code-review` for Mentu commitments - it happens automatically on submit.

See `docs/PRD-IntegratedPRReview-v1.0.md` for full details.

---

## Architecture

### Parallel Agent Model

The skill spawns **4 specialized review agents** that run concurrently:

| Agent | Focus | Confidence Threshold |
|-------|-------|---------------------|
| **Guidelines** | CLAUDE.md compliance, project patterns | 80 |
| **Security** | Injection, auth, secrets, OWASP top 10 | 80 |
| **Bugs** | Logic errors, edge cases, race conditions | 80 |
| **Context** | Git history, blame analysis, regression risk | 70 |

Each agent scores findings on a **0-100 confidence scale**. Only findings above threshold are reported.

### Why Parallel Agents?

1. **Speed** - All 4 agents run simultaneously
2. **Specialization** - Each agent focuses on one domain
3. **Confidence** - Scoring filters false positives
4. **Coverage** - Multiple perspectives catch more issues

---

## Activation Modes

### Mode 1: PR Review (GitHub)

When on a branch with PR:

```bash
/code-review --comment
```

This will:
1. Validate PR eligibility (skip closed, draft, trivial)
2. Gather changed files from PR diff
3. Load CLAUDE.md guidelines
4. Launch 4 parallel agents
5. Filter findings by confidence threshold
6. Post comments to PR (if `--comment`)

### Mode 2: Agent Delivery Review

After a coding agent completes work:

```
Review what was just delivered
```

This will:
1. Identify recently changed files (git diff or completion.json)
2. Run all 4 review agents in parallel
3. Report findings with severity and confidence
4. Output structured report

### Mode 3: Mentu Queue Review

Process commitments awaiting review:

```
/code-review --queue
```

This will:
1. Run `mentu review-queue` to get pending items
2. For each commitment in `in_review`:
   - Fetch evidence and changed files
   - Run full review protocol
   - Issue `mentu approve` or `mentu reopen`

---

## Review Protocol

### Phase 1: Gather Context

```bash
# For PR review
gh pr view --json files,additions,deletions,body
git diff origin/main...HEAD --name-only

# For agent delivery
git diff --name-only HEAD~1

# For Mentu queue
mentu review-queue --json
```

### Phase 2: Load Guidelines

Collect all CLAUDE.md files that apply:
- Root CLAUDE.md
- Directory-specific CLAUDE.md files
- .mentu/manifest.yaml patterns

### Phase 3: Launch Parallel Agents

All 4 agents run concurrently via Task tool:

```
[Agent 1: Guidelines] - CLAUDE.md compliance
[Agent 2: Security]   - Vulnerability scan
[Agent 3: Bugs]       - Logic/correctness
[Agent 4: Context]    - Git history analysis
```

### Phase 4: Aggregate Findings

Merge results, filter by confidence, deduplicate:

```json
{
  "findings": [
    {
      "file": "src/auth.ts",
      "line": 45,
      "severity": "high",
      "confidence": 92,
      "agent": "security",
      "message": "SQL injection: user input concatenated in query",
      "suggestion": "Use parameterized query"
    }
  ],
  "verdict": "FAIL",
  "stats": {
    "files_reviewed": 12,
    "agents_passed": 3,
    "agents_failed": 1,
    "issues_found": 5,
    "issues_filtered": 12
  }
}
```

### Phase 5: Record Decision

```bash
# If all agents PASS
mentu approve <cmt> --comment "Review passed: 4/4 agents clear"

# If any agent FAIL
mentu reopen <cmt> --reason "Security: SQL injection in auth.ts:45"
```

---

## Agent Definitions

### Agent 1: Guidelines (CLAUDE.md Compliance)

**Focus**: Project conventions, patterns, architecture rules

**Checks**:
- [ ] Follows naming conventions from CLAUDE.md
- [ ] Uses project's preferred libraries/patterns
- [ ] Respects architectural boundaries
- [ ] Matches existing code style
- [ ] Implements error handling per project standards

**Checklist**: [STYLE.md](./STYLE.md)

### Agent 2: Security

**Focus**: OWASP top 10, injection, auth, secrets

**Checks**:
- [ ] No SQL/command/XSS injection
- [ ] Proper authentication checks
- [ ] No hardcoded secrets
- [ ] Input validation at boundaries
- [ ] Proper error information disclosure

**Checklist**: [SECURITY.md](./SECURITY.md)

### Agent 3: Bugs (Correctness)

**Focus**: Logic errors, edge cases, async issues

**Checks**:
- [ ] Null/undefined handling
- [ ] Off-by-one errors
- [ ] Race conditions
- [ ] Promise handling
- [ ] Boundary conditions

**Checklist**: [CORRECTNESS.md](./CORRECTNESS.md)

### Agent 4: Context (History)

**Focus**: Git blame, regression risk, ownership

**Checks**:
- [ ] Changes to frequently-buggy code
- [ ] Modifications to critical paths
- [ ] Breaking changes to stable code
- [ ] Changes outside PR scope
- [ ] Ownership/author concerns

**Source**: Git blame, git log, commit history

---

## Confidence Scoring

Each finding is scored 0-100:

| Score | Meaning | Action |
|-------|---------|--------|
| 90-100 | Certain issue | Must fix |
| 80-89 | Very likely issue | Should fix |
| 70-79 | Probable issue | Review carefully |
| 50-69 | Possible issue | Consider |
| 0-49 | Low confidence | Filtered out |

**Default thresholds**:
- Security: 80 (strict)
- Bugs: 80 (strict)
- Guidelines: 80 (strict)
- Context: 70 (allow history insights)

### Confidence Factors

Agents consider:
- Pattern clarity (exact match vs fuzzy)
- Context quality (full function vs snippet)
- Precedent (known vulnerability pattern)
- False positive likelihood

---

## PR Integration

### Posting Comments

```bash
/code-review --comment
```

Comments are posted as:
- **PR review comments** at specific lines
- **PR body comment** with summary

### Comment Format

```markdown
## Code Review

**Verdict**: FAIL (1 blocking issue)

### Security (Confidence: 92%)

**[HIGH]** `src/auth.ts:45`
SQL injection vulnerability. User input concatenated directly in query.

\`\`\`suggestion
const result = await db.query('SELECT * FROM users WHERE id = ?', [userId])
\`\`\`

---

*Reviewed by 4 parallel agents. 17 findings filtered (below confidence threshold).*
```

### Skipped PRs

The review automatically skips:
- Closed PRs
- Draft PRs
- PRs with only trivial changes (docs, comments)
- Previously reviewed PRs (unless `--force`)

---

## Severity Levels

| Level | Meaning | Blocks Approval |
|-------|---------|-----------------|
| **Critical** | Security hole, data loss | Yes |
| **High** | Bug, logic error | Yes |
| **Medium** | Code smell, maintainability | No |
| **Low** | Style, suggestions | No |

Verdict logic:
- Any Critical/High finding → FAIL
- Medium only → PASS with notes
- Low only → PASS

---

## Output Formats

### Terminal (Default)

```
═══════════════════════════════════════════════════════════════
                      CODE REVIEW REPORT
═══════════════════════════════════════════════════════════════

Files Reviewed: 12
Verdict: FAIL

─────────────────────────────────────────────────────────────────
CRITICAL (1)
─────────────────────────────────────────────────────────────────
[SECURITY:92] src/auth.ts:45
  SQL injection: user input in query
  Suggestion: Use parameterized statement

─────────────────────────────────────────────────────────────────
HIGH (2)
─────────────────────────────────────────────────────────────────
[BUGS:88] src/api/users.ts:112
  Unhandled null: user.profile accessed without check

[BUGS:85] src/utils/parse.ts:34
  Off-by-one: loop iterates past array bounds

─────────────────────────────────────────────────────────────────
STATS
─────────────────────────────────────────────────────────────────
Agents: Guidelines ✓ | Security ✗ | Bugs ✗ | Context ✓
Findings: 3 reported, 17 filtered
Confidence threshold: 80 (Security/Bugs/Guidelines), 70 (Context)

═══════════════════════════════════════════════════════════════
```

### JSON (--json)

```json
{
  "verdict": "FAIL",
  "files_reviewed": 12,
  "findings": [...],
  "stats": {...},
  "agents": {
    "guidelines": {"verdict": "PASS", "findings": 0},
    "security": {"verdict": "FAIL", "findings": 1},
    "bugs": {"verdict": "FAIL", "findings": 2},
    "context": {"verdict": "PASS", "findings": 0}
  }
}
```

---

## Mentu Integration

### Review Queue Workflow

```bash
# List pending reviews
mentu review-queue

# Process all pending
/code-review --queue

# Review specific commitment
/code-review cmt_xxx
```

### Recording Verdicts

```bash
# Approve
mentu approve cmt_xxx --comment "4/4 agents passed. No issues found."

# Reject
mentu reopen cmt_xxx --reason "Security: SQL injection in auth.ts:45 (confidence: 92%)"
```

### Evidence Capture

Review findings can be captured as evidence:

```bash
mentu capture "Code review: 4 agents, 3 findings fixed" --kind review
```

---

## Configuration

### Confidence Thresholds

Override defaults in `.mentu/config.yaml`:

```yaml
code_review:
  thresholds:
    security: 85      # Stricter
    bugs: 80
    guidelines: 75    # Looser
    context: 70
```

### Excluded Patterns

Skip certain files/patterns:

```yaml
code_review:
  exclude:
    - "**/*.test.ts"
    - "**/*.spec.ts"
    - "**/fixtures/**"
    - "**/__mocks__/**"
```

### Custom Agents

Add project-specific review agents:

```yaml
code_review:
  custom_agents:
    - name: "accessibility"
      prompt: "Check for WCAG 2.1 compliance"
      threshold: 75
```

---

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/run-linters.sh` | Baseline linter checks |
| `scripts/review-queue.sh` | Display Mentu review queue |

### Run Linters First

```bash
./.claude/skills/code-review/scripts/run-linters.sh
```

This catches obvious issues before agent review.

---

## Checklists

Detailed review criteria:

- [SECURITY.md](./SECURITY.md) - Injection, auth, secrets
- [PERFORMANCE.md](./PERFORMANCE.md) - Complexity, resources
- [STYLE.md](./STYLE.md) - Patterns, consistency
- [CORRECTNESS.md](./CORRECTNESS.md) - Logic, edge cases

---

## Cost Considerations

Each review spawns 4 agents:

| Plan | Cost |
|------|------|
| Claude Max | Included (unlimited) |
| API | 4 sessions per review |

For high-volume repos, consider:
- Using linters as first pass (free)
- Running full review only on non-draft PRs
- Lowering agent count for simple changes

---

## Quick Reference

```bash
# Review current PR
/code-review

# Review and comment on PR
/code-review --comment

# Review Mentu queue
/code-review --queue

# Force re-review
/code-review --force

# JSON output
/code-review --json

# Review specific commitment
/code-review cmt_xxx
```

---

*Four eyes see more than one. Parallel agents, confident verdicts.*
