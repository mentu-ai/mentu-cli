# Mentu Autopilot

A Claude Code plugin that adds an autonomous bug-fix pipeline on top of the [Mentu](https://mentu.ai) commitment ledger. Triage bugs, investigate codebases, fix issues, and push PRs -- all tracked with full evidence chains via Mentu MCP tools.

## What It Does

Mentu Autopilot turns Mentu bug reports into fixed PRs through an opinionated, evidence-tracked workflow:

```
Triage  -->  Investigate  -->  Fix  -->  Build  -->  Push + PR  -->  Submit
```

Every state transition is captured as evidence in the Mentu ledger, making the entire pipeline auditable and resumable by any agent or human.

## Prerequisites

- [Claude Code](https://claude.ai/code) installed and configured
- [@mentu/mcp](https://www.npmjs.com/package/@mentu/mcp) (bundled -- installed automatically via the plugin's `.mcp.json`)
- A Mentu workspace with API credentials
- Node.js 18+ and npm
- Git and [GitHub CLI](https://cli.github.com/) (`gh`) for PR creation

## Installation

```bash
claude plugin install mentu-ai/mentu-autopilot
```

## Configuration

The plugin needs three environment variables to connect to your Mentu workspace:

```bash
export MENTU_API_URL="https://mentu-proxy.affihub.workers.dev"
export MENTU_API_TOKEN="your-token"
export MENTU_WORKSPACE_ID="your-workspace-id"
```

Alternatively, run `/setup` inside Claude Code to create a `.mentu.json` config file interactively (the API token should still be set as an env var to avoid committing secrets).

### `.mentu.json` (optional)

```json
{
  "apiUrl": "https://mentu-proxy.affihub.workers.dev",
  "workspaceId": "your-workspace-id",
  "projectDomains": ["your-app.vercel.app", "localhost"]
}
```

## Commands

| Command | Description |
|---------|-------------|
| `/triage` | Read-only triage dashboard. Fetches all Mentu bugs, applies a 5-gate garbage filter, scores survivors, and presents an actionable table. |
| `/fix <mem_id>` | Investigate and fix a single bug ticket end-to-end. Creates branch, HANDOFF doc, Mentu commitment, applies fix, verifies build, pushes PR, and submits evidence. |
| `/run` | Full autopilot pipeline. Runs triage, then fixes bugs in waves (default: 5 waves, 5 tickets/wave). Supports `--dry-run`, `--max-waves N`, `--batch-size N`. |
| `/setup` | Interactive onboarding. Creates `.mentu.json`, tests Mentu connection, verifies MCP server availability. |
| `/status` | Quick pipeline overview. Shows commitment counts by state, recent activity, and throughput metrics. |

## Agents

| Agent | Description |
|-------|-------------|
| **ticket-planner** | Autonomous triage and planning agent. Fetches bugs, applies garbage filter, investigates survivors, creates branches + HANDOFF docs + Mentu commitments. |
| **ticket-reviewer** | Smart review agent. Classifies fix type (CSS, UI, data, auth, multi-file) and selects appropriate review passes. Captures review findings to Mentu. |

## Workflow

### Single Ticket Fix

```
/triage                  # See what bugs need fixing
/fix mem_6534dx1x        # Fix a specific ticket
```

The `/fix` command runs the full lifecycle:

1. Fetch the ticket from Mentu
2. Investigate the codebase (stack-aware search)
3. Estimate complexity tier (T1/T2/T3)
4. Create a `fix/ticket-{id}` branch
5. Write a HANDOFF doc with concrete fix steps
6. Create a Mentu commitment and claim it
7. Apply the fix (build after every step, one commit per step)
8. Push branch and create a PR via `gh`
9. Submit the commitment with full evidence chain

### Autopilot Pipeline

```
/run                     # Full pipeline (5 waves x 5 tickets)
/run --dry-run           # Triage only, no fixes
/run --max-waves 2       # Limit to 2 waves
/run --batch-size 3      # 3 tickets per wave
```

The `/run` command executes waves of triage-fix cycles with automatic continuation via the Stop hook (Ralph-Wiggum pattern). Circuit breakers halt the pipeline after 2 consecutive empty waves or when max waves are reached.

### Evidence Chain

Every fix produces a complete evidence chain in the Mentu ledger:

1. Commitment created (`mentu_commit`)
2. Commitment claimed (`mentu_claim`)
3. Per-step progress captured (`mentu_capture`, kind: `execution-progress`)
4. Build verification captured (`mentu_capture`, kind: `validation`)
5. PR link captured (`mentu_capture`, kind: `document`)
6. Commitment submitted (`mentu_submit`)

### 5-Gate Garbage Filter

Triage applies five sequential gates to filter out noise:

| Gate | What It Catches |
|------|----------------|
| Body Coherence | < 20 chars of real content, gibberish |
| Test Detection | Test submissions, "prueba", "E2E", localhost test keywords |
| Project Match | Wrong domain in `page_url` |
| Duplicate Collapse | Same/near-identical title on the same day |
| Actionability | Title-only tickets with no meaningful description |

## MCP Tools

The plugin bundles `@mentu/mcp`, which provides 12 tools:

| Tool | Type | Description |
|------|------|-------------|
| `mentu_get_status` | Read | Pipeline health summary |
| `mentu_list_memories` | Read | List bug tickets with filters |
| `mentu_list_commitments` | Read | List commitments with filters |
| `mentu_commit` | Write | Create a new commitment |
| `mentu_claim` | Write | Claim a commitment for execution |
| `mentu_capture` | Write | Attach evidence to a commitment |
| `mentu_submit` | Write | Submit commitment with evidence |
| `mentu_approve` | Write | Approve a submitted commitment |
| `mentu_close` | Write | Close a commitment directly |
| `mentu_annotate` | Write | Add a note to a memory or commitment |
| `mentu_dismiss` | Write | Dismiss a junk memory |
| `mentu_triage` | Write | Record a triage session |

## Project Structure

```
mentu-autopilot/
  .claude-plugin/
    plugin.json          # Plugin manifest
  .mcp.json              # Bundles @mentu/mcp server
  CLAUDE.md              # Methodology reference (loaded into Claude context)
  commands/
    triage.md            # /triage command
    fix.md               # /fix command
    run.md               # /run command (autopilot pipeline)
    setup.md             # /setup command
    status.md            # /status command
  agents/
    ticket-planner.md    # Autonomous triage + planning agent
    ticket-reviewer.md   # Smart review agent
  hooks/
    hooks.json           # Hook configuration
    autopilot_stop.sh    # Wave continuation logic (Stop hook)
  skills/
    pipeline-knowledge/
      SKILL.md           # Background knowledge auto-loaded by commands
  README.md
  LICENSE
```

## License

MIT -- see [LICENSE](LICENSE).
