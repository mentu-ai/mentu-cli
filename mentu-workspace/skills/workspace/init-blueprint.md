# Workspace Init Blueprint (Plugin Edition)

Complete file tree with parameterized contents. Replace all `{PLACEHOLDERS}` with actual values.

This blueprint is designed for the `mentu-workspace` Claude Code plugin. It uses `${CLAUDE_PLUGIN_ROOT}` to reference plugin-bundled templates instead of personal `~/.claude/` paths.

## Parameters to Resolve

```
{PROJECT_PATH}   = absolute path (e.g., /Users/me/Desktop/my-project)
{PROJECT_NAME}   = PascalCase (e.g., MyProject)
{PROJECT_SLUG}   = kebab-case (e.g., my-project) — derived from directory basename
{ACTOR_NAME}     = agent:claude-{lowercase-first-word} (e.g., agent:claude-myproject)
{PROJECT_DESC}   = ask user or derive from context
{PROJECT_TYPE}   = auto-detected: swift | node | python | rust | go | generic
{BUILD_CMD}      = from project type detection (see Step 0)
{TEST_CMD}       = from project type detection (see Step 0)
{MENTU_WORKSPACE_ID} = from Mentu workspace creation (see Step 3)
{MENTU_API_TOKEN}    = from Mentu login (see Step 3)
```

---

## Step 0: Detect Project Type

Inspect the project directory to determine the project type. Check in order:

| Signal | Type | `{BUILD_CMD}` | `{TEST_CMD}` |
|--------|------|---------------|--------------|
| `Package.swift` exists | `swift` | `swift build` | `swift test` |
| `package.json` exists | `node` | `npm run build` | `npm test` |
| `Cargo.toml` exists | `rust` | `cargo build` | `cargo test` |
| `go.mod` exists | `go` | `go build ./...` | `go test ./...` |
| `pyproject.toml` or `setup.py` exists | `python` | `python -m build` | `pytest` |
| None of the above | `generic` | `echo "no build configured"` | `echo "no tests configured"` |

For `node` projects, also check:
- If `package.json` has `scripts.build` -> use `npm run build`; otherwise `echo "no build configured"`
- If `package.json` has `scripts.test` -> use `npm test`; otherwise `echo "no tests configured"`
- If `bun.lockb` exists -> substitute `bun` for `npm` in all commands

Store the detected type in `{PROJECT_TYPE}` for use in subsequent steps.

---

## Step 1: Scaffold with Mentu CLI

Run the Mentu CLI scaffolding command first. This creates the base directory structure and config files:

```bash
cd {PROJECT_PATH}
mentu workspace-init --name {PROJECT_SLUG} --build-cmd "{BUILD_CMD}" --force
```

This creates the base `.mentu/`, `.claude/`, `.ralph/` directories and starter files. If the CLI is not available, fall back to manual directory creation:

```bash
mkdir -p {PROJECT_PATH}/{.claude/{agents,commands,skills/{deslop,mentu,review}},.mentu/feature_lists,.ralph/{agent,diagnostics/logs,logs},docs/{templates,handoffs},scripts}
```

## Step 2: Initialize Git (if needed)

```bash
cd {PROJECT_PATH} && [ -d .git ] || git init
```

## Step 3: Set Up Mentu Workspace

This step creates a new Mentu cloud workspace for the project and extracts credentials.

### 3a. Check if Mentu CLI is available

```bash
npx mentu-mcp --version 2>/dev/null || echo "mentu-mcp not found"
```

> **Note**: The npm package is `mentu-mcp` (NOT `@mentu/mcp`).

### 3b. Initialize local Mentu directory

```bash
cd {PROJECT_PATH} && npx mentu-mcp init
```

This creates `.mentu/config.yaml` and `.mentu/ledger.jsonl`.

### 3c. Login to Mentu (if not already authenticated)

```bash
npx mentu-mcp login
```

This opens a browser for GitHub OAuth. After auth, the CLI stores credentials locally. If already logged in, it will skip.

### 3d. Create a cloud workspace

```bash
npx mentu-mcp workspace create {PROJECT_SLUG}
```

This returns the workspace ID. Capture it:

```bash
WORKSPACE_ID=$(npx mentu-mcp workspace info --json 2>/dev/null | jq -r '.id')
```

### 3e. Extract credentials

After workspace creation, read the workspace ID and token from the local Mentu config:

```bash
# Workspace ID
WORKSPACE_ID=$(grep 'workspace_id' {PROJECT_PATH}/.mentu/config.yaml | awk '{print $2}' | tr -d '"')

# API token — check ~/.mentu/auth.yaml or the CLI config
API_TOKEN=$(grep 'token' ~/.mentu/auth.yaml 2>/dev/null | awk '{print $2}' | tr -d '"')
```

If the CLI doesn't expose credentials directly, use the Mentu proxy token from the user's environment:

```bash
# Fallback: use proxy token from existing env
API_TOKEN="${MENTU_API_TOKEN:-$(grep MENTU_API_TOKEN ~/.env 2>/dev/null | cut -d= -f2 | tr -d '\"')}"
```

### 3f. Store in parameters

Set `{MENTU_WORKSPACE_ID}` and `{MENTU_API_TOKEN}` for use in config file generation.

### Fallback: Manual setup

If the Mentu CLI is not available or login fails, output instructions:

```
Mentu CLI not available. To set up manually:
1. Install: npm install -g mentu-mcp
2. Login: mentu-mcp login
3. Create workspace: mentu-mcp workspace create {PROJECT_SLUG}
4. Add credentials to .env:
   MENTU_API_TOKEN="<your-token>"
   MENTU_WORKSPACE_ID="<your-workspace-id>"
   MENTU_PROXY_URL="https://mentu-proxy.affihub.workers.dev"
```

---

## Step 4: Copy Doc Templates

Copy all 7 templates from the plugin bundle to the project:

**Source**: `${CLAUDE_PLUGIN_ROOT}/templates/`
**Destination**: `{PROJECT_PATH}/docs/templates/`

Templates to copy:
- `TEMPLATE-PRD.md`
- `TEMPLATE-Handoff.md`
- `TEMPLATE-Prompt.md`
- `TEMPLATE-Result.md`
- `TEMPLATE-Context.md`
- `TEMPLATE-Intent.md`
- `TEMPLATE-Audit.md`

```bash
cp "${CLAUDE_PLUGIN_ROOT}/templates/"*.md "{PROJECT_PATH}/docs/templates/"
```

---

## Step 5: Write Config Files

### `.env`

```
MENTU_API_TOKEN="{MENTU_API_TOKEN}"
MENTU_WORKSPACE_ID="{MENTU_WORKSPACE_ID}"
MENTU_PROXY_URL="https://mentu-proxy.affihub.workers.dev"
```

> **Note**: No hardcoded tokens. Values come from Step 3.

### `.gitignore`

Generate based on `{PROJECT_TYPE}`:

**Common (all types):**
```
.DS_Store
.env
.env.*
!.env.example
node_modules/
.ralph/logs/
.ralph/diagnostics/
.ralph/*.lock
.ralph/events-*.jsonl
.ralph/history.jsonl
.ralph/current-*
.ralph/loops.json
.ralph/agent/tasks.jsonl
.ralph/agent/tasks.jsonl.lock
.review-screenshots/
docs/evidence/
.claude/ralph-loop.local.md
*.tmp
*.tmp.*
```

**Swift additions** (if `{PROJECT_TYPE}` = `swift`):
```
.build/
DerivedData/
*.xcodeproj/
*.xcworkspace/
.swiftpm/
```

**Node additions** (if `{PROJECT_TYPE}` = `node`):
```
node_modules/
dist/
.next/
.nuxt/
.output/
coverage/
```

**Rust additions** (if `{PROJECT_TYPE}` = `rust`):
```
target/
Cargo.lock
```

**Python additions** (if `{PROJECT_TYPE}` = `python`):
```
__pycache__/
*.pyc
.venv/
venv/
dist/
*.egg-info/
.pytest_cache/
```

**Go additions** (if `{PROJECT_TYPE}` = `go`):
```
bin/
vendor/
```

### `.mcp.json`

```json
{
  "mcpServers": {
    "mentu": {
      "command": "npx",
      "args": ["-y", "mentu-mcp"],
      "env": {
        "MENTU_API_TOKEN": "{MENTU_API_TOKEN}",
        "MENTU_WORKSPACE_ID": "{MENTU_WORKSPACE_ID}",
        "MENTU_API_URL": "https://mentu-proxy.affihub.workers.dev"
      }
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

### `.mentu/config.yaml`

```yaml
workspace: {PROJECT_SLUG}
workspace_id: "{MENTU_WORKSPACE_ID}"
default_actor: {ACTOR_NAME}
created: "{ISO_DATE}"
```

### `.mentu/manifest.yaml`

```yaml
actor: {ACTOR_NAME}
workspace: "{MENTU_WORKSPACE_ID}"
repository: {PROJECT_SLUG}
domain: technical
build_cmd: "{BUILD_CMD}"
test_cmd: "{TEST_CMD}"
token_env_var: "MENTU_API_TOKEN"
workspace_env_var: "MENTU_WORKSPACE_ID"
dev_port: 8080
created: {DATE}
```

### `.claude/settings.local.json`

Generate permissions based on `{PROJECT_TYPE}` (see init-blueprint in personal skill for the full permissions list per project type).

---

## Step 6: AI-Enrich CLAUDE.md

After the CLI scaffolding creates a stub CLAUDE.md, enrich it based on `{PROJECT_TYPE}`:

- For `node`: Add TypeScript/JavaScript conventions, React patterns if applicable, import alias guidance
- For `swift`: Add Swift 6 concurrency rules, actor patterns, guard-let preferences
- For `python`: Add type hint requirements, pathlib preference, logging module usage
- For `rust`: Add `unwrap()` prohibition, clippy usage, error handling patterns
- For `go`: Add error handling requirements, context.Context usage, table-driven tests
- For `generic`: Add placeholder sections for the user to fill in

Scan the project files to detect frameworks (React, Next.js, Express, FastAPI, Actix, etc.) and add framework-specific conventions.

---

## Step 7: Write Review Agents

All 5 agents go in `.claude/agents/`. These are **language-agnostic** — they adapt their checks based on the project type detected in CLAUDE.md.

The agents are:
- `review-bugs.md` — Logic and correctness analyzer
- `review-guidelines.md` — CLAUDE.md compliance and git history risk
- `review-intent.md` — PRD/HANDOFF scope alignment
- `review-security.md` — OWASP Top 10, secrets, injection
- `review-visual.md` — Functional testing via Playwright

See the plugin's `agents/` directory for generic versions of these agents.

---

## Step 8: Write Skills and Commands

Copy the self-configuring commands from the plugin's `commands/` directory. These read from `.mentu/manifest.yaml` at runtime instead of hardcoded values.

Skills to create:
- `.claude/skills/deslop/SKILL.md` — Remove AI slop from code
- `.claude/skills/mentu/SKILL.md` — Mentu API interaction
- `.claude/skills/review/SKILL.md` — 5-agent parallel review

---

## Step 9: Report

After creating everything, output the workspace initialization summary (see SKILL.md for the report format).
