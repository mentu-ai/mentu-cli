---
# ============================================================
# CANONICAL YAML FRONT MATTER
# ============================================================
# All fields are machine-fetchable and deterministic.
# No narrative or prose is allowed in this block.
# Agents MUST upsert this metadata on execution or edit.
# ============================================================

# IDENTITY
# id: Unique identifier matching filename. Replace {Name} with PascalCase name.
# path: Relative path from repository root.
# type: Document classification. Fixed as "intent" for this template.
# intent: Fixed as "reference" - INTENTs are strategic guidance, not executable.
id: INTENT-{Name}-v{X.Y}
path: docs/INTENT-{Name}-v{X.Y}.md
type: intent
intent: reference

# VERSIONING
# version: Semantic version. Start at "1.0", increment on changes.
# created: ISO 8601 date when document was created. Never modify.
# last_updated: ISO 8601 date of last edit. Update on every change.
version: "1.0"
created: YYYY-MM-DD
last_updated: YYYY-MM-DD

# ARCHITECT IDENTITY
# actor: The Architect agent that created this intent.
# session: Session identifier if available (for traceability).
# context: Where/why this intent originated.
architect:
  actor: agent:claude-architect
  session: {session-id}
  context: {browser | api | webhook | ticket | conversation}

# TIER HINT
# tier_hint: Architect's estimate of complexity. Leading Agent will validate.
tier_hint: T2

# MENTU INTEGRATION
# commitment: Will be set by Leading Agent after audit approval.
# status: Current state in the architect flow.
mentu:
  commitment: pending
  status: awaiting_audit
---

# Strategic Intent: {Name}

> **Mode**: Architect
>
> You lack local filesystem access. Produce strategic intent only.
> State what and why. Do not specify file paths, schemas, or code.
> A local Leading Agent will audit and implement.

---

## What

{One to three sentences describing WHAT needs to be built or changed.}

{Focus on the outcome, not the implementation. The Leading Agent will determine HOW.}

{Be specific enough to be actionable, but abstract enough to allow implementation flexibility.}

**Good examples:**
- "Add the ability for users to export their data in CSV format"
- "Implement rate limiting on the public API endpoints"
- "Create a dashboard showing real-time system health metrics"

**Bad examples (too specific):**
- "Create a file at src/utils/csvExporter.ts that uses the csv-parser library"
- "Add a Redis-based rate limiter using the slidingWindow algorithm"
- "Build a React component using recharts with WebSocket subscriptions"

---

## Why

{The business or technical rationale. Why does this matter?}

{What problem does this solve? What pain point does it address?}

{What value does it create for users, maintainers, or the system?}

{If applicable, reference user feedback, metrics, or incidents that motivated this.}

---

## Constraints

> These are guardrails, not implementation details.

- {What this change must NOT do}
- {Boundaries that must be respected}
- {Compatibility requirements (backwards compat, API stability, etc.)}
- {Performance constraints (must not degrade X)}
- {Security requirements (must maintain Y)}

**Examples:**
- "Must not break existing API contracts"
- "Must work offline after initial load"
- "Must not require additional infrastructure"
- "Must maintain response times under 200ms"

---

## Expected Outcome

{What does success look like from a user/system perspective?}

{How would someone verify this intent was fulfilled?}

{If measurable, what metrics would change?}

**Examples:**
- "Users can click 'Export' and receive a CSV file within 5 seconds"
- "API returns 429 status when rate limit exceeded, with retry-after header"
- "Dashboard loads in under 2 seconds and updates every 10 seconds"

---

## Open Questions (Optional)

> Questions the Architect wants the Leading Agent to resolve using local context.

- {Question about technical approach}
- {Question about existing patterns}
- {Question about dependencies}
- {Question about scope boundaries}

**Examples:**
- "Is there an existing export mechanism we should extend?"
- "What rate limiting patterns are already in use?"
- "Are there existing dashboard components to reuse?"

---

## Context (Optional)

{Any additional context that helps the Leading Agent understand the intent.}

{References to conversations, tickets, or prior decisions.}

{Related features or systems to consider.}

---

## Routing Hints (Optional)

> Suggestions for how this intent should be processed.

```yaml
# Priority: normal | urgent | low
priority: normal

# Tags for routing and filtering
tags:
  - {tag1}
  - {tag2}

# Preferred target repository (if multi-repo workspace)
target_repo: {repo-name}

# CI/CD integration preference
ci_integration:
  github_actions: true
  auto_pr: false
```

---

## For the Leading Agent

When you receive this INTENT document:

1. **Establish checkpoint** (git + Claude Code)
2. **Audit** using `/craft--architect` protocol
3. **Capture evidence** of your audit findings
4. **Decide**: APPROVE / REJECT / REQUEST_CLARIFICATION
5. **If approved**: Execute `/craft {Name}-v{X.Y}` to create full chain

**You are the gatekeeper. Validate before committing.**

---

*This intent was created by an Architect agent without local filesystem access. It represents strategic direction, not implementation specification.*
