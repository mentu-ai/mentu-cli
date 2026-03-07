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
# type: Document classification. Fixed as "result" for this template.
# intent: Fixed as "reference" - RESULTs document completed work for future reference.
id: RESULT-{Name}-v{X.Y}
path: docs/RESULT-{Name}-v{X.Y}.md
type: result
intent: reference

# VERSIONING
# version: Semantic version. Match the version of the work completed.
# created: ISO 8601 date when document was created (completion date).
# last_updated: ISO 8601 date of last edit. Update on any corrections.
version: "1.0"
created: YYYY-MM-DD
last_updated: YYYY-MM-DD

# ACTOR
# actor: Agent identity that produced this work. Format: agent:claude-{role}
actor: agent:claude-{role}

# RELATIONSHIPS
# parent: ID of parent PROMPT or HANDOFF document that was executed.
parent: PROMPT-{Name}-v{X.Y}

# MENTU INTEGRATION
# Required for all RESULT documents. Documents the completed commitment.
# commitment: The commitment ID that was fulfilled. Must be cmt_XXXXXXXX. Set ONCE.
# evidence: The evidence memory ID. Set ONCE after capture returns mem_XXXXXXXX.
# status: FROZEN at "pending" - NEVER edit. Query ledger for actual state.
#
# LEDGER-FIRST PATTERN: The ledger is the source of truth.
#     Do NOT manually edit these fields after initial creation.
#     Use `mentu show cmt_xxx` to check current state.
mentu:
  commitment: cmt_XXXXXXXX
  evidence: pending          # Update ONCE after capture, then FROZEN
  status: pending            # FROZEN - never edit manually
---

# RESULT: {Name} v{X.Y}

**Completed:** {YYYY-MM-DD}

---

## Summary

{One paragraph describing what was built, the key insight or principle, and the impact. Lead with impact, not implementation details.}

---

## Activation

{How to use or enable what was built. Include concrete commands or configuration.}

```bash
# Example activation commands
{command 1}
{command 2}
```

---

## How It Works

{Diagram or explanation of the mechanism. Use ASCII art for flow diagrams.}

```
{Flow diagram or architecture visualization}
```

---

## Files Created

### {path/to/file1.ts}

{Brief description of what this file does and its role in the system.}

### {path/to/file2.ts}

{Brief description of what this file does and its role in the system.}

### {path/to/file3.ts}

{Brief description of what this file does and its role in the system.}

---

## Files Modified

| File | Change |
|------|--------|
| `{path/to/existing1.ts}` | {What was changed and why} |
| `{path/to/existing2.ts}` | {What was changed and why} |
| `{path/to/existing3.md}` | {What was changed and why} |

---

## Test Results

| Test | Command | Result |
|------|---------|--------|
| TypeScript Compilation | `tsc --noEmit` | {Pass/Fail} |
| Unit Tests | `npm test` | {N tests passing} |
| Build | `npm run build` | {Pass/Fail} |
| {Custom Test} | `{command}` | {Pass/Fail} |

---

## Screenshot Evidence (UI Features Only)

> **Skip this section if the feature has NO user interface components.**

### MCP Server Used

| Server | Package | Version | Tools Used |
|--------|---------|---------|------------|
| `{playwright | chrome-devtools | none}` | `{@playwright/mcp | chrome-devtools-mcp}` | `{@latest}` | `{browser_take_screenshot | take_screenshot}` |

**References**:
- Playwright MCP: [github.com/microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp)
- Chrome DevTools MCP: [github.com/ChromeDevTools/chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp)

### Captured Screenshots

| Screenshot | Capture Point | Tool Used | Description |
|------------|---------------|-----------|-------------|
| ![{name}](../evidence/{feature-name}/screenshots/{filename}.png) | `{capture-name}` | `{browser_take_screenshot | take_screenshot}` | {What this proves} |

### Bridge Spawn Status

| Field | Value |
|-------|-------|
| Command ID | `{uuid}` |
| Status | `{pending | claimed | running | completed | failed | timeout}` |
| Spawned At | `{ISO timestamp}` |
| Completed At | `{ISO timestamp or pending}` |
| Bridge Location | `{mac-local | vps-remote}` |

**Check status**:

```bash
curl "https://mentu-proxy.affihub.workers.dev/bridge/spawn/{command_id}" \
  -H "X-Proxy-Token: $MENTU_PROXY_TOKEN"
```

### Visual Verification Status

| Check | Status |
|-------|--------|
| Bridge Spawn Queued | `{Yes | No | Skipped}` |
| MCP Server (on bridge machine) | `{playwright | chrome-devtools | none}` |
| Screenshots Captured | `{N of M | Pending | Failed}` |
| Evidence Annotations Linked | `{Yes | No | Pending}` |

### Evidence Location

```
docs/evidence/{feature-name}/screenshots/
+-- {YYYYMMDD-HHMMSS}-{capture-1}.png
+-- {YYYYMMDD-HHMMSS}-{capture-2}.png
+-- ...
```

### Linked Annotations

Screenshots captured by background agents are linked to the commitment via annotations:

```bash
# View screenshot evidence annotations
mentu show cmt_XXXXXXXX --annotations

# Expected output:
# - "Visual evidence captured: {capture-name-1}"
# - "Visual evidence captured: {capture-name-2}"
```

### Capture Protocol Compliance

| Requirement | Compliant |
|-------------|-----------|
| Used `--headless` flag | `{Yes | No | N/A}` |
| Used `--isolated` flag | `{Yes | No | N/A}` |
| Non-blocking capture | `{Yes | No}` |
| Evidence linked via annotations | `{Yes | No}` |

### Notes

{Any observations about the visual implementation, deviations from design, or issues discovered during capture. Note if visual verification was skipped and why.}

If skipped, document reason:
- [ ] MCP server not configured
- [ ] Node.js version incompatible (requires 18+ for Playwright, 20.19+ for Chrome DevTools)
- [ ] Chrome not installed (Chrome DevTools MCP only)
- [ ] Terminal timeout constraints
- [ ] Other: {specify}

---

## Design Decisions

### 1. {Decision Title}

**Rationale:** {Why this choice was made, what alternatives were considered, and why this approach is better.}

### 2. {Decision Title}

**Rationale:** {Why this choice was made, what alternatives were considered, and why this approach is better.}

### 3. {Decision Title}

**Rationale:** {Why this choice was made, what alternatives were considered, and why this approach is better.}

---

## Mentu Ledger Entry

```
Commitment: cmt_XXXXXXXX
Status: closed
Evidence: mem_XXXXXXXX
Actor: agent:claude-{role}
Body: "{Original commitment description}"
```

---

## Usage Examples

### Example 1: {Use Case Title}

{Brief description of the use case.}

```bash
# Commands demonstrating this use case
{command 1}
{command 2}
```

{Expected output or behavior.}

### Example 2: {Use Case Title}

{Brief description of the use case.}

```bash
# Commands demonstrating this use case
{command 1}
{command 2}
```

{Expected output or behavior.}

---

## Constraints and Limitations

- {Constraint 1: What this implementation does NOT do}
- {Constraint 2: Known limitations}
- {Constraint 3: Edge cases not handled}

---

## Future Considerations

1. **{Future Feature 1}**: {Brief description of potential enhancement}
2. **{Future Feature 2}**: {Brief description of potential enhancement}
3. **{Future Feature 3}**: {Brief description of potential enhancement}

---

*{Closing statement capturing the essence of what was accomplished}*
