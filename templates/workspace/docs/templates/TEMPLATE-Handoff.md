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
# type: Document classification. Fixed as "handoff" for this template.
# intent: Fixed as "execute" - HANDOFFs are meant to be executed by agents.
id: HANDOFF-{Name}-v{X.Y}
path: docs/HANDOFF-{Name}-v{X.Y}.md
type: handoff
intent: execute

# VERSIONING
# version: Semantic version. Start at "1.0", increment on changes.
# created: ISO 8601 date when document was created. Never modify.
# last_updated: ISO 8601 date of last edit. Update on every change.
version: "1.0"
created: YYYY-MM-DD
last_updated: YYYY-MM-DD

# TIER
# tier: Task complexity. T1=simple, T2=feature, T3=multi-part, T4=orchestrated.
tier: T2

# AUTHOR TYPE
# author_type: The role expected for the executing agent.
# Agents inherit their actor from repository manifest, but adopt this role.
# Values: executor (builds), auditor (validates), architect (designs)
author_type: executor

# RELATIONSHIPS
# parent: ID of parent PRD document this HANDOFF implements.
# children: IDs of PROMPT documents that launch this HANDOFF.
parent: PRD-{Name}-v{X.Y}
children:
  - PROMPT-{Name}-v{X.Y}

# MENTU INTEGRATION
# Required for T2+ HANDOFFs. Tracks commitment lifecycle.
# commitment: Set to "pending" initially, then update to cmt_XXXXXXXX after mentu commit.
# status: Current state. pending -> claimed -> in_review -> closed/reopened.
mentu:
  commitment: pending
  status: pending

# VALIDATION
# required: Whether SubAgent validation is required before submit.
# tier: Validation tier. T1=auto-approve, T2=async review, T3=sync gate.
validation:
  required: true
  tier: T2
---

# HANDOFF: {Name} v{X.Y}

## For the Coding Agent

{One sentence describing what this HANDOFF delivers.}

**Read the full PRD**: `docs/PRD-{Name}-v{X.Y}.md`

---

## Your Identity

You are operating as **executor** (from this HANDOFF's `author_type` field).

Your actor identity comes from the repository manifest (`.mentu/manifest.yaml`).

| Dimension | Source | Value |
|-----------|--------|-------|
| **Actor** | Repository manifest | (auto-resolved) |
| **Author Type** | This HANDOFF | executor |
| **Context** | Working directory | {repository name} |

**Your domain**: technical

**The Rule**:
- Failure in YOUR domain -> Own it. Fix it. Don't explain.
- Failure in ANOTHER domain -> You drifted. Re-read this HANDOFF.

**Quick reference**: `mentu stance executor` or `mentu stance executor --failure technical`

---

## Completion Contract

**First action**: Create the feature list at the commitment-scoped path:

```bash
mkdir -p .mentu/feature_lists
# Create: .mentu/feature_lists/cmt_XXXXXXXX.json
```

**Path**: `.mentu/feature_lists/cmt_XXXXXXXX.json`

> **Legacy fallback**: If `MENTU_COMMITMENT` is not set, the hook reads from `feature_list.json` at the repository root.

```json
{
  "$schema": "feature-list-v1",
  "instruction_id": "HANDOFF-{Name}-v{X.Y}",
  "created": "{ISO-timestamp}",
  "status": "in_progress",
  "tier": "{T1|T2|T3|T4}",
  "mentu": {
    "commitment": "cmt_XXXXXXXX",
    "source": "mem_XXXXXXXX"
  },
  "features": [
    {
      "id": "F001",
      "description": "{First acceptance criterion}",
      "passes": false,
      "evidence": null
    },
    {
      "id": "F002",
      "description": "{Second acceptance criterion}",
      "passes": false,
      "evidence": null
    }
  ],
  "checks": {
    "tsc": true,
    "build": true,
    "test": "{true|false}"
  }
}
```

The stop hook (`feature_enforcer.py`) will block until all features pass.

---

## Mentu Protocol

### Identity Resolution

```
+-----------------------------------------------------------------------+
|  ACTOR (WHO)              AUTHOR TYPE (ROLE)          CONTEXT (WHERE)  |
|  -----------              ------------------          ---------------  |
|  From manifest            From this HANDOFF           From working dir |
|  .mentu/manifest.yaml     author_type: executor       repository name  |
|                                                                        |
|  Actor is auto-resolved. Author type declares your role. Context tracks.|
+-----------------------------------------------------------------------+
```

### Operations

```bash
cd {/path/to/workspace}

# Check your actor identity (auto-resolved from manifest)
cat .mentu/manifest.yaml | grep actor

# Claim commitment (actor auto-resolved)
mentu claim cmt_XXXXXXXX --author-type executor

# Capture progress (actor auto-resolved, role declared)
mentu capture "{Progress}" --kind execution-progress --author-type executor
```

Save the commitment ID. You will close it with evidence.

---

## Visual Verification (UI Features Only)

> **Skip this section if the feature has NO user interface components.**

### Overview

Visual verification uses **background agents** to capture screenshots asynchronously. The working agent spawns a screenshot collector, continues working, and the collector links evidence as annotations to the commitment.

**Key principle**: Never block on screenshot capture. Fire and continue.

---

### MCP Server Options

Configure **exactly one** of these servers. Do not mix.

#### Option A: Playwright MCP (Recommended)

**Source**: [github.com/microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp)

**Package**: `@playwright/mcp@latest`

**Requirements**:
- Node.js 18 or newer
- No browser installation required (Playwright manages browsers)

**Configuration** (add to `.claude/settings.json` or MCP client config):

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

**Headless mode** (for background capture):

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest", "--headless"]
    }
  }
}
```

**Available screenshot tools**:
| Tool | Purpose |
|------|---------|
| `browser_navigate` | Navigate to URL |
| `browser_snapshot` | Capture accessibility snapshot (LLM-friendly) |
| `browser_take_screenshot` | Capture PNG screenshot |
| `browser_click` | Click element |
| `browser_type` | Type into input |
| `browser_wait` | Wait for selector/network idle |

**Key flags**:
- `--headless` - Run without UI (required for background agents)
- `--isolated` - Use temporary profile (auto-cleaned)
- `--timeout-navigation=60000` - Navigation timeout in ms
- `--viewport=1280x720` - Set viewport size

---

#### Option B: Chrome DevTools MCP

**Source**: [github.com/ChromeDevTools/chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp)

**Package**: `chrome-devtools-mcp@latest`

**Requirements**:
- Node.js v20.19 or newer (LTS)
- Chrome stable version or newer

**Configuration**:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"]
    }
  }
}
```

**Headless + isolated mode** (for background capture):

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": [
        "chrome-devtools-mcp@latest",
        "--headless=true",
        "--isolated=true"
      ]
    }
  }
}
```

**Available screenshot tools**:
| Tool | Purpose |
|------|---------|
| `navigate_page` | Navigate to URL |
| `take_screenshot` | Capture PNG screenshot |
| `take_snapshot` | Capture accessibility snapshot |
| `click` | Click element |
| `fill` | Fill input field |
| `wait_for` | Wait for selector/condition |

**Key flags**:
- `--headless=true` - Run without UI
- `--isolated=true` - Use temporary profile (auto-cleaned)
- `--viewport=1280x720` - Set viewport size
- `--accept-insecure-certs=true` - Accept self-signed certs (localhost)

---

### Capture Points

Define screenshots required as evidence:

| Name | URL | Selector | Description |
|------|-----|----------|-------------|
| `{capture-name-1}` | `{http://localhost:PORT/path}` | `{optional-selector}` | {What this screenshot proves} |
| `{capture-name-2}` | `{http://localhost:PORT/path}` | `{optional-selector}` | {What this screenshot proves} |

### Evidence Path

```
docs/evidence/{feature-name}/screenshots/
```

**Naming**: `{YYYYMMDD-HHMMSS}-{capture-name}.png`

---

### Persistent Capture via Bridge

**Critical**: Do NOT use Task tool for screenshot capture. Task tool spawns child processes that die when the terminal closes. Use mentu-bridge for persistent execution.

```
Executor                         Bridge Daemon (24/7 via launchd)
--------                         --------------------------------
Build feature
Start persistent dev server
POST /bridge/spawn -----------> Queue receives command
Continue to submit                      |
Create RESULT                     Claim command
Submit commitment                 Spawn Claude agent
Exit                              Navigate & capture screenshots
                                  mentu capture (evidence)
                                  mentu annotate (link to commitment)
                                  Store results
```

### Dev Server Lifecycle

The spawn prompt should start the dev server itself (self-contained):

```bash
# BAD: Dev server started by executor (may die)
npm run dev &  # Fragile

# GOOD: Dev server started within spawn prompt
# (Spawn prompt includes: "npm run dev, wait for ready, capture, kill server")
```

### Bridge Spawn Command

Queue screenshot capture via mentu-proxy:

```bash
curl -X POST "https://mentu-proxy.affihub.workers.dev/bridge/spawn" \
  -H "X-Proxy-Token: $MENTU_PROXY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "commitment_id": "cmt_XXXXXXXX",
    "working_directory": "{/path/to/workspace}",
    "timeout_seconds": 300,
    "prompt": "You are a screenshot capture agent for commitment cmt_XXXXXXXX.

## Setup
1. cd {working_directory}
2. npm run dev &
3. Wait for http://localhost:{PORT} to respond (max 30 seconds)

## Capture Points
{capture-point-table-from-handoff}

## For Each Capture Point
1. Use Playwright MCP: browser_navigate to URL
2. Use Playwright MCP: browser_wait for networkidle
3. Use Playwright MCP: browser_take_screenshot to docs/evidence/{feature}/screenshots/{timestamp}-{name}.png
4. Run: mentu capture \"Screenshot: {name} at {URL}\" --kind screenshot-evidence --path {filepath}
5. Run: mentu annotate cmt_XXXXXXXX \"Visual evidence captured: {name}\"

## Cleanup
1. Kill dev server
2. Exit

## MCP Configuration Required on Bridge Machine
Playwright MCP must be configured in ~/.claude/settings.json on the machine running mentu-bridge."
  }'
```

**Response** (immediate, does not wait):

```json
{
  "command_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending"
}
```

### Check Capture Status

```bash
# Get command status
curl "https://mentu-proxy.affihub.workers.dev/bridge/spawn/{command_id}" \
  -H "X-Proxy-Token: $MENTU_PROXY_TOKEN"

# Check annotations on commitment
mentu show cmt_XXXXXXXX --annotations
```

### Infrastructure Requirements

| Component | Location | Purpose |
|-----------|----------|---------|
| mentu-proxy | Cloudflare Worker | API gateway, job queuing |
| mentu-bridge | Mac (launchd) or VPS (systemd) | Persistent executor |
| Supabase | Cloud | Async communication queue |
| Playwright MCP | Bridge machine | Screenshot capture |

### MCP Configuration (On Bridge Machine)

The bridge daemon needs MCP servers configured on its machine:

```json
// ~/.claude/settings.json (on bridge machine, NOT executor's machine)
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest", "--headless", "--isolated"]
    }
  }
}
```

### Local vs Remote Execution

| Mode | Bridge Location | Dev Server Access |
|------|-----------------|-------------------|
| Local | Mac (launchd) | `localhost:PORT` works directly |
| Remote | VPS (systemd) | Need tunnel, public URL, or staging |

For VPS execution, use staging/preview URLs instead of localhost.

### Failure Visibility

Unlike Task tool (silent death), bridge provides observable failures:

```bash
curl ".../bridge/spawn/{command_id}" -H "X-Proxy-Token: ..."

# Response shows failure:
{
  "status": "failed",
  "error": "browser_navigate failed: ECONNREFUSED localhost:3000"
}
```

### Graceful Degradation

If MCP servers are unavailable:
1. Skip visual verification (don't block)
2. Document in RESULT: "Visual verification skipped - MCP unavailable"
3. Provide alternative evidence (test output, manual verification notes)

---

## Build Order

### Stage 1: {Stage Name}

{Brief description of what this stage accomplishes.}

**File**: `{path/to/file.ts}`

```typescript
// Code snippet - copy-paste ready
{code}
```

**Verification**:
```bash
{verification command}
```

---

### Stage 2: {Stage Name}

{Brief description of what this stage accomplishes.}

**File**: `{path/to/file.ts}`

```typescript
// Code snippet - copy-paste ready
{code}
```

**Verification**:
```bash
{verification command}
```

---

### Stage N: {Final Stage Name}

{Brief description of final stage.}

**File**: `{path/to/file.ts}`

```typescript
// Code snippet - copy-paste ready
{code}
```

**Verification**:
```bash
{verification command}
```

---

## Before Submitting

Before running `mentu submit`, spawn validators:

1. Use Task tool with `subagent_type="technical-validator"`
2. Use Task tool with `subagent_type="intent-validator"`
3. Use Task tool with `subagent_type="safety-validator"`

All must return verdict: PASS before submitting.

---

## Completion Phase (REQUIRED)

**BEFORE calling `mentu submit`, you MUST create a RESULT document:**

### Step 1: Create RESULT Document

Read the template and create the RESULT document:

```bash
# Read the template structure
cat docs/templates/TEMPLATE-Result.md

# Create: docs/RESULT-{Name}-v{X.Y}.md
```

The RESULT document MUST include:
- Valid YAML front matter with all required fields
- Summary of what was built
- Files created and modified
- Test results (tsc, tests, build)
- Design decisions with rationale

### Step 2: Capture RESULT as Evidence

```bash
# Actor auto-resolved from manifest, author-type declares role
mentu capture "Created RESULT-{Name}: {one-line summary}" \
  --kind result-document \
  --path docs/RESULT-{Name}-v{X.Y}.md \
  --refs cmt_XXXXXXXX \
  --author-type executor
```

### Step 3: Update RESULT Front Matter

Update the YAML front matter with the evidence ID:

```yaml
mentu:
  commitment: cmt_XXXXXXXX
  evidence: mem_YYYYYYYY  # <- The ID from Step 2
  status: in_review
```

### Step 4: Submit with Evidence

```bash
# Actor auto-resolved from manifest (same as claim)
mentu submit cmt_XXXXXXXX \
  --summary "{Summary of what was done}" \
  --include-files
```

**The RESULT document IS the closure proof. Do not submit without it.**

---

## Verification Checklist

### Files
- [ ] `{path/to/file1.ts}` exists
- [ ] `{path/to/file2.ts}` exists
- [ ] `{path/to/file3.ts}` exists

### Checks
- [ ] `npm run build` passes
- [ ] `npm test` passes (if applicable)
- [ ] `tsc --noEmit` passes

### Mentu
- [ ] Commitment created with `mentu commit`
- [ ] Commitment claimed with `mentu claim`
- [ ] Validators passed (technical, intent, safety)
- [ ] If validation failed: checked stance (`mentu stance executor --failure technical`), fixed without arguing
- [ ] **RESULT document created** (`docs/RESULT-{Name}-v{X.Y}.md`)
- [ ] **RESULT captured as evidence** with `mentu capture`
- [ ] **RESULT front matter updated** with evidence ID
- [ ] Commitment submitted with `mentu submit`
- [ ] `mentu list commitments --state open` returns []

### Functionality
- [ ] {Specific functionality check 1}
- [ ] {Specific functionality check 2}
- [ ] {Specific functionality check 3}

---

*{Closing statement relevant to the task}*
