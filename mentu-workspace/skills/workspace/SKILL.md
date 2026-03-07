---
name: workspace
description: Initialize a fully-configured project workspace with Ralph, Mentu, Claude agents, skills, commands, and doc templates — or run multi-HANDOFF Ralph autopilot. Use when setting up a new project, bootstrapping tooling, or executing sequential HANDOFFs.
argument-hint: <init|autopilot> [args...]
disable-model-invocation: true
---

# Workspace — Bootstrap & Autopilot

Two modes controlled by the first argument:

| Command | Purpose |
|---------|---------|
| `/mentu-workspace:workspace init <path> <ProjectName>` | Create a fully-configured project workspace |
| `/mentu-workspace:workspace autopilot [handoff-dir]` | Run Ralph through sequential HANDOFFs |

---

## Mode: `init`

**Usage**: `/mentu-workspace:workspace init /path/to/project MyProject`

- `$ARGUMENTS[1]` = absolute path to the project directory
- `$ARGUMENTS[2]` = PascalCase project name (e.g., `MyProject`)

**What it creates**: Full `.claude/`, `.mentu/`, `.ralph/`, `docs/templates/`, `CLAUDE.md`, `.mcp.json`, `.env`, `.gitignore`, settings, agents, skills, commands — everything needed for Ralph + Mentu + 5-agent review pipeline.

**Detailed instructions**: Read the [init-blueprint.md](init-blueprint.md) file located at `${CLAUDE_PLUGIN_ROOT}/skills/workspace/init-blueprint.md` for the complete file tree with parameterized contents.

### Quick reference

1. Read `init-blueprint.md` for the complete blueprint
2. Derive parameters from the arguments:
   - `{PROJECT_PATH}` = `$ARGUMENTS[1]`
   - `{PROJECT_NAME}` = `$ARGUMENTS[2]`
   - `{PROJECT_SLUG}` = lowercase-hyphenated version of `$ARGUMENTS[2]`
   - `{ACTOR_NAME}` = `agent:claude-` + lowercase first word of project name
3. Detect project type (Step 0 in blueprint) — determines `{BUILD_CMD}`, `{TEST_CMD}`, gitignore, permissions, and CLAUDE.md conventions
4. Run `mentu workspace-init --name {PROJECT_SLUG} --build-cmd {BUILD_CMD} --force` to scaffold base files
5. Copy doc templates from `${CLAUDE_PLUGIN_ROOT}/templates/` to `{PROJECT_PATH}/docs/templates/`
6. AI-enrich CLAUDE.md based on project type detection
7. Customize generated files (triage domains, deslop patterns, review checks)
8. Set up Mentu workspace (Step 3 in blueprint) — login, create cloud workspace, extract credentials
9. Write all config files (substitute parameters including Mentu credentials)
10. Report summary of created files

### Post-init checklist

After creating the workspace, remind the user:
- [ ] Edit `CLAUDE.md` to describe their specific project architecture
- [ ] Review `.mcp.json` — remove servers they don't need, add project-specific ones
- [ ] Review `.claude/settings.local.json` — adjust permissions
- [ ] Run `{BUILD_CMD}` to verify the project builds
- [ ] Create HANDOFFs with `/craft` or `/craft-ralph`
- [ ] Or set up multi-phase autopilot with `/mentu-workspace:workspace autopilot`

---

## Mode: `autopilot`

**Usage**: `/mentu-workspace:workspace autopilot` or `/mentu-workspace:workspace autopilot docs/handoffs`

- `$ARGUMENTS[1]` = optional path to handoffs directory (default: `docs/handoffs`)

**What it does**: Discovers all `HANDOFF-Phase-*.md` files, generates `ralph.yml`, `scripts/preflight.sh`, and `.ralph/PROMPT.md` for sequential multi-phase execution via the Ralph loop.

**Detailed instructions**: Read the [autopilot-protocol.md](autopilot-protocol.md) file located at `${CLAUDE_PLUGIN_ROOT}/skills/workspace/autopilot-protocol.md` for the complete protocol.

### Quick reference

1. Read `autopilot-protocol.md` for the complete protocol
2. Discover HANDOFFs: `ls docs/handoffs/HANDOFF-Phase-*.md | sort`
3. Count phases and validate each HANDOFF has content
4. Generate `ralph.yml` with phase count baked in
5. Generate `.ralph/PROMPT.md` with multi-phase execution protocol
6. Generate `scripts/preflight.sh` validation script
7. Initialize `docs/handoffs/current-phase.txt` to `1` (or next uncompleted)
8. Run preflight check
9. Report launch command

### Launch

After autopilot setup:
```bash
# Validate
bash scripts/preflight.sh

# Launch
ralph --config ralph.yml
```

---

## Parameter Reference

| Parameter | Source | Example |
|-----------|--------|---------|
| `{PROJECT_PATH}` | `$ARGUMENTS[1]` | `/Users/me/Desktop/my-project` |
| `{PROJECT_NAME}` | `$ARGUMENTS[2]` | `MyProject` |
| `{PROJECT_SLUG}` | derived (kebab-case) | `my-project` |
| `{ACTOR_NAME}` | derived | `agent:claude-myproject` |
| `{PROJECT_TYPE}` | auto-detected | `swift`, `node`, `python`, `rust`, `go`, `generic` |
| `{BUILD_CMD}` | from project type | `npm run build`, `swift build`, `cargo build` |
| `{TEST_CMD}` | from project type | `npm test`, `swift test`, `cargo test` |
| `{MENTU_WORKSPACE_ID}` | created via `mentu workspace create` | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `{MENTU_API_TOKEN}` | extracted from Mentu login | (from `.mentu/config.yaml`) |
| `{PHASE_COUNT}` | discovered (autopilot only) | `24` |
| `{COMPLETION_PROMISE}` | derived | `{PROJECT_NAME}_COMPLETE` |
