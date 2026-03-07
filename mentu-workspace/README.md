# mentu-workspace

Full workspace bootstrap, document chain, multi-agent review, and Ralph autopilot for Mentu-tracked projects.

## What It Does

The `mentu-workspace` plugin provides a complete toolkit for managing software projects with Mentu accountability tracking:

- **Workspace Initialization** -- Scaffolds a fully-configured project workspace with `.claude/`, `.mentu/`, `.ralph/`, agents, skills, commands, document templates, and configuration files. Detects project type (Node, Swift, Python, Rust, Go) and customizes conventions accordingly.

- **Document Chain** -- Creates PRD, HANDOFF, PROMPT, and RESULT documents following the Mentu commitment lifecycle. Documents use YAML front matter for ledger tracking with write-once semantics.

- **Multi-Agent Review** -- Runs 5 specialized review agents in parallel (bugs, guidelines, intent, security, visual) with confidence scoring and JSON verdict output.

- **Ralph Autopilot** -- Configures sequential multi-phase execution via Ralph loops, with phase tracking, build verification, and Mentu progress reporting.

- **Bug Pipeline** -- Triage, investigate, plan, and fix bug tickets from Mentu with automated branch management and commitment lifecycle tracking.

## Installation

### From the Marketplace

```bash
claude plugin install mentu-workspace
```

### Local Development

Clone and link the plugin:

```bash
git clone https://github.com/mentu-ai/mentu-marketplace.git
cd mentu-marketplace/mentu-workspace
claude plugin link .
```

## Available Commands

| Command | Description |
|---------|-------------|
| `/mentu-workspace:craft <FeatureName>` | Create PRD -> HANDOFF -> PROMPT -> RESULT document chain |
| `/mentu-workspace:craft-ralph <FeatureName>` | Create PRD -> HANDOFF -> Ralph PROMPT with commitment tracking |
| `/mentu-workspace:triage` | Daily ticket triage dashboard with 5-gate garbage filter |
| `/mentu-workspace:fix <mem_id>` | Investigate a bug ticket and create HANDOFF + Ralph PROMPT |
| `/mentu-workspace:batch` | Batch triage + fix: multiple tickets in one Ralph session |
| `/mentu-workspace:autopilot [--max-waves N]` | Autonomous bug-fix pipeline via Ralph loop |

## Skills

| Skill | Description |
|-------|-------------|
| `workspace init <path> <name>` | Bootstrap a complete project workspace |
| `workspace autopilot [dir]` | Configure multi-HANDOFF Ralph execution |

## Agents

All agents are language-agnostic and read `CLAUDE.md` at runtime to adapt their checks.

| Agent | Model | Purpose |
|-------|-------|---------|
| `review-bugs` | Haiku | Logic and correctness: null handling, async, boundaries, resource leaks |
| `review-guidelines` | Haiku | CLAUDE.md compliance, conventions, git history regression risk |
| `review-intent` | Haiku | PRD/HANDOFF scope alignment, step completion, over-engineering |
| `review-security` | Haiku | OWASP Top 10, secrets, injection, auth issues with CWE references |
| `review-visual` | Sonnet | Functional testing via Playwright: screenshots, responsive, console errors |

## Configuration

### Project Manifest

The plugin reads runtime configuration from `.mentu/manifest.yaml`:

```yaml
actor: agent:claude-myproject
workspace: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
repository: my-project
domain: technical
build_cmd: "npm run build"
test_cmd: "npm test"
token_env_var: "MENTU_API_TOKEN"
workspace_env_var: "MENTU_WORKSPACE_ID"
dev_port: 8080
created: 2025-01-01
```

### Environment Variables

Credentials are stored in `.env` (gitignored):

```
MENTU_API_TOKEN="your-token-here"
MENTU_WORKSPACE_ID="your-workspace-id"
MENTU_PROXY_URL="https://mentu-proxy.affihub.workers.dev"
```

The env var names are configurable via `token_env_var` and `workspace_env_var` in the manifest, allowing different projects to use different variable names (e.g., `VITE_MENTU_API_TOKEN` for Vite projects).

### Hooks

The plugin includes two hooks:

- **SessionStart** -- Injects Mentu commitment context into new sessions so agents start with awareness of active work.
- **PostToolUse** (Edit/Write) -- Silently captures tool operations as evidence memories for audit trail.

## How It Integrates with Mentu CLI

The plugin complements the `mentu-mcp` CLI:

1. **Workspace init** calls `mentu workspace-init` for scaffolding, then enriches the generated files
2. **Commands** use curl to the Mentu proxy API (`https://mentu-proxy.affihub.workers.dev/ops`) for commitment operations (capture, commit, claim, submit, close)
3. **Hooks** use the `mentu` CLI for session context and evidence capture
4. **All commands are self-configuring** -- they read from `.mentu/manifest.yaml` instead of hardcoded values, making them portable across projects

### Mentu Commitment Lifecycle

```
capture (memory) -> commit (commitment) -> claim -> evidence(progress) -> submit -> close(pass|fail)
```

Documents track commitments via YAML front matter with write-once semantics:
```yaml
mentu:
  commitment: cmt_XXXXXXXX  # Written once, never edited
  status: pending            # Never changed manually
```

State changes happen through the ledger API, not document edits.

## Document Templates

The plugin bundles 7 document templates in `templates/`:

| Template | Purpose |
|----------|---------|
| TEMPLATE-PRD.md | Product Requirements Document |
| TEMPLATE-Handoff.md | Build instructions with staged steps |
| TEMPLATE-Prompt.md | Agent launch prompt |
| TEMPLATE-Result.md | Execution results and evidence |
| TEMPLATE-Context.md | Session context snapshot |
| TEMPLATE-Intent.md | Feature intent declaration |
| TEMPLATE-Audit.md | Review audit trail |

These are copied to each project's `docs/templates/` directory during workspace initialization.

## Project Type Detection

During workspace init, the plugin detects the project type and customizes:

| Signal | Type | Build | Test |
|--------|------|-------|------|
| Package.swift | Swift | `swift build` | `swift test` |
| package.json | Node | `npm run build` | `npm test` |
| Cargo.toml | Rust | `cargo build` | `cargo test` |
| go.mod | Go | `go build ./...` | `go test ./...` |
| pyproject.toml | Python | `python -m build` | `pytest` |
| (none) | Generic | (manual) | (manual) |

Customizations include: `.gitignore` entries, `.claude/settings.local.json` permissions, `CLAUDE.md` coding conventions, and review agent behavior.

## License

MIT
