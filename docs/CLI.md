# Mentu CLI Reference

Complete reference for all Mentu CLI commands.

**Version:** 1.0.6

---

## Table of Contents

- [Global Options](#global-options)
- [Core Commands](#core-commands) - init, capture, commit, claim, release, close, annotate, status, log, show
- [Review Commands](#review-commands) - submit, approve, reopen, review-queue
- [Triage Commands](#triage-commands) - link, dismiss, triage, list
- [Sync Commands](#sync-commands) - login, logout, sync, workspace
- [GitHub Commands](#github-commands) - github-link, push, pull
- [Integration Commands](#integration-commands) - actor, unlink
- [API Server Commands](#api-server-commands) - serve, api-key
- [Task Commands](#task-commands) - task start, task complete, task fail
- [Claude Integration](#claude-integration) - init-claude, claude-status
- [Configuration](#configuration) - config
- [Environment Variables](#environment-variables)
- [Error Codes](#error-codes)

---

## Global Options

Available on all commands:

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |
| `--actor <id>` | Override actor identity |
| `--help` | Show help |
| `-V, --version` | Show version |

---

## Core Commands

### mentu init

Initialize a Mentu workspace.

```bash
mentu init [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `-f, --force` | Overwrite existing workspace |
| `-s, --silent` | Non-interactive mode |
| `--no-gitignore` | Skip .gitignore modification |
| `--actor <id>` | Set default actor |
| `--workspace <name>` | Set workspace name |

**Example:**
```bash
mentu init
mentu init --workspace my-project --actor alice
```

---

### mentu capture

Record an observation (creates a Memory).

```bash
mentu capture <body> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `-k, --kind <kind>` | Type of observation (e.g., `evidence`, `bug_report`) |
| `-p, --path <path>` | Document path (for kind=document) |
| `-r, --refs <refs>` | Related IDs, comma-separated (e.g., `cmt_xxx,mem_yyy`) |
| `--source-key <key>` | Idempotency key from origin system |

**Example:**
```bash
mentu capture "Customer reported login failing"
mentu capture "Fixed in PR #234" --kind evidence
```

---

### mentu commit

Create a commitment linked to a source memory.

```bash
mentu commit <body> --source <id> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `-s, --source <id>` | Source memory ID (required) |
| `-t, --tags <tags>` | Comma-separated tags |

**Example:**
```bash
mentu commit "Fix login bug" --source mem_a1b2c3d4
mentu commit "Add dark mode" --source mem_xyz --tags feature,ui
```

---

### mentu claim

Take responsibility for a commitment.

```bash
mentu claim <commitment>
```

**Example:**
```bash
mentu claim cmt_e5f6g7h8
```

**Notes:**
- Cannot claim a closed commitment
- Cannot claim if already claimed by another
- Syncs to GitHub if enabled

---

### mentu release

Give up responsibility for a commitment.

```bash
mentu release <commitment> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `-r, --reason <reason>` | Reason for releasing |

**Example:**
```bash
mentu release cmt_e5f6g7h8 --reason "Reassigning to backend team"
```

---

### mentu close

Close a commitment with evidence or as duplicate.

```bash
mentu close <commitment> --evidence <id>
mentu close <commitment> --duplicate-of <id>
```

**Options:**
| Option | Description |
|--------|-------------|
| `-e, --evidence <id>` | Evidence memory ID |
| `-d, --duplicate-of <id>` | Close as duplicate of another commitment |

**Example:**
```bash
mentu close cmt_e5f6g7h8 --evidence mem_i9j0k1l2
mentu close cmt_abc123 --duplicate-of cmt_xyz789
```

**Notes:**
- Must provide exactly one of `--evidence` or `--duplicate-of`
- Genesis Key constraints are enforced

---

### mentu annotate

Attach a note to any record.

```bash
mentu annotate <target> <body> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `-k, --kind <kind>` | Type of annotation |

**Example:**
```bash
mentu annotate cmt_e5f6g7h8 "Blocked by dependency"
mentu annotate mem_a1b2c3d4 "See ticket #123" --kind reference
```

---

### mentu status

Show current commitment state.

```bash
mentu status
```

**Output:**
```
Workspace: my-project

Open:
  cmt_abc123: Add user authentication

Claimed:
  cmt_def456: Fix login bug (by alice)

In Review:
  cmt_jkl012: Add review workflow (by alice)

Reopened:
  cmt_mno345: Edge case handling (by alice)

Closed:
  cmt_ghi789: Update documentation (by bob)
```

---

### mentu log

Show operation history.

```bash
mentu log [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `-n, --limit <count>` | Number of operations to show |
| `-o, --op <type>` | Filter by operation type |

**Example:**
```bash
mentu log --limit 10
mentu log --op close
```

---

### mentu show

Show details for a specific record.

```bash
mentu show <id> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--links` | Show linked memories (for commitments) |
| `--duplicates` | Show duplicate commitments |

**Example:**
```bash
mentu show mem_a1b2c3d4
mentu show cmt_e5f6g7h8 --links
mentu show cmt_e5f6g7h8 --duplicates
```

---

## Review Commands

### mentu submit

Submit a claimed commitment for review (enters `in_review`).

```bash
mentu submit <commitment> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `-s, --summary <text>` | Summary of work done |
| `-e, --evidence <ids>` | Evidence memory IDs (comma-separated) |
| `--include-files` | Include list of changed files in evidence |
| `--include-tests` | Include test results in evidence |
| `--tier <tier>` | Validation tier: `tier_1`, `tier_2`, `tier_3` (default: `tier_2`) |
| `--actor <id>` | Override actor identity |

**Example:**
```bash
mentu submit cmt_def456 --summary "Implemented fix" --tier tier_2
```

---

### mentu approve

Approve an `in_review` commitment (transitions to `closed`).

```bash
mentu approve <commitment> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--comment <text>` | Optional approval comment |
| `--actor <id>` | Override actor identity |

**Example:**
```bash
mentu approve cmt_def456 --comment "Looks good"
```

---

### mentu reopen

Reopen an `in_review` or `closed` commitment (transitions to `reopened`).

```bash
mentu reopen <commitment> --reason <reason> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `-r, --reason <reason>` | Reason for reopening (required) |
| `--actor <id>` | Override actor identity |

**Example:**
```bash
mentu reopen cmt_def456 --reason "Needs edge case handling"
```

---

### mentu review-queue

List commitments awaiting review.

```bash
mentu review-queue [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `-m, --mine` | Only show commitments I submitted |
| `-t, --tier <tier>` | Filter by tier (`tier_1`, `tier_2`, `tier_3`) |
| `-a, --all` | Include auto-approved submissions |
| `--actor <id>` | Override actor identity (used with `--mine`) |

**Example:**
```bash
mentu review-queue --tier tier_3
mentu review-queue --mine --actor alice
```

---

## Triage Commands

### mentu link

Link a memory or commitment to a commitment.

```bash
mentu link <source> <target> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `-k, --kind <type>` | Link type: `related`, `duplicate`, `caused_by`, `blocks`, `evidence` |
| `-r, --reason <text>` | Explanation for the link |

**Example:**
```bash
mentu link mem_abc cmt_xyz
mentu link mem_abc cmt_xyz --kind related --reason "Same issue reported"
mentu link cmt_dup cmt_main --kind duplicate
```

---

### mentu dismiss

Dismiss a memory as not actionable.

```bash
mentu dismiss <memory> --reason <text> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `-r, --reason <text>` | Reason for dismissal (required) |
| `-t, --tags <tags>` | Comma-separated tags |

**Example:**
```bash
mentu dismiss mem_abc --reason "Feature request, added to roadmap"
mentu dismiss mem_xyz --reason "Duplicate" --tags duplicate,low-priority
```

**Notes:**
- Cannot dismiss memory that is source of a commitment

---

### mentu triage

Record a triage session.

```bash
mentu triage --reviewed <ids> --summary <text>
```

**Options:**
| Option | Description |
|--------|-------------|
| `--reviewed <ids>` | Comma-separated memory IDs reviewed |
| `--summary <text>` | Summary of triage session |

**Example:**
```bash
mentu triage --reviewed mem_001,mem_002,mem_003 --summary "Consolidated auth issues"
```

---

### mentu list

List memories or commitments with filters.

#### mentu list memories

```bash
mentu list memories [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--untriaged` | Show only untriaged memories |
| `--linked` | Show only linked memories |
| `--dismissed` | Show only dismissed memories |
| `--committed` | Show only memories that are sources |
| `-k, --kind <kind>` | Filter by kind |

**Example:**
```bash
mentu list memories --untriaged
mentu list memories --dismissed
mentu list memories --kind evidence
```

#### mentu list commitments

```bash
mentu list commitments [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `-s, --state <state>` | Filter by state: `open`, `claimed`, `in_review`, `reopened`, `closed` |
| `--duplicates` | Show only duplicate commitments |

**Example:**
```bash
mentu list commitments --state open
mentu list commitments --duplicates
```

---

## Sync Commands

### mentu login

Authenticate with Mentu Cloud.

```bash
mentu login [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--token <token>` | Use access token (for CI/CD) |

**Example:**
```bash
mentu login                    # Opens browser for OAuth
mentu login --token $TOKEN     # Use token directly
```

**Notes:**
- Browser OAuth uses GitHub provider
- Credentials stored in `~/.mentu/credentials`

---

### mentu logout

Log out from Mentu Cloud.

```bash
mentu logout
```

---

### mentu sync

Synchronize local ledger with cloud.

```bash
mentu sync [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--push` | Push local operations only |
| `--pull` | Pull remote operations only |
| `--status` | Show sync status without syncing |
| `--watch` | Continuous sync mode |
| `--dry-run` | Preview what would sync |
| `--force` | Sync even with warnings |

**Example:**
```bash
mentu sync                     # Full bidirectional sync
mentu sync --push              # Push only
mentu sync --status            # Show status
mentu sync --watch             # Continuous mode (30s interval)
```

**Output:**
```
Syncing...
  ↑ Pushed 3 operations
  ↓ Pulled 5 operations
  ✓ Synced successfully
```

---

### mentu workspace

Manage cloud workspaces.

#### mentu workspace create

```bash
mentu workspace create <name> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--display-name <name>` | Display name for workspace |

**Example:**
```bash
mentu workspace create my-project
mentu workspace create my-project --display-name "My Project"
```

#### mentu workspace connect

Connect local workspace to existing cloud workspace.

```bash
mentu workspace connect <name>
```

#### mentu workspace list

List your workspaces.

```bash
mentu workspace list
```

**Output:**
```
Workspaces:

  my-project - My Project [admin] (current)
  team-work [member]
```

#### mentu workspace info

Show current workspace details.

```bash
mentu workspace info
```

**Output:**
```
Workspace: my-project
Display Name: My Project
Workspace ID: abc-123-xyz
Role: admin
Cloud: https://supabase.co

Sync Status:
  Status: synced
  Client ID: client_abc123
  Last Sync: 2025-12-29T10:00:00Z
  Pending: 0 operations
```

#### mentu workspace invite

Invite someone to the workspace.

```bash
mentu workspace invite [email] [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--role <role>` | Role: `member` or `admin` (default: member) |
| `--link` | Generate invite link instead |
| `--expires <days>` | Link expiry in days (default: 7) |

**Example:**
```bash
mentu workspace invite alice@example.com
mentu workspace invite --link --role admin
```

#### mentu workspace disconnect

Disconnect from cloud.

```bash
mentu workspace disconnect
```

---

## GitHub Commands

### mentu github-link

Link a commitment to an existing GitHub issue.

```bash
mentu github-link <commitment> --github <issue_number>
```

**Example:**
```bash
mentu github-link cmt_e5f6g7h8 --github 42
```

**Output:**
```
Linked commitment cmt_e5f6g7h8 to GitHub issue #42
URL: https://github.com/org/repo/issues/42
```

---

### mentu push

Push a commitment to GitHub.

```bash
mentu push <commitment> --to github [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--to <system>` | Target system (required, `github`) |
| `--project <name>` | Add to GitHub Project |
| `--dry-run` | Preview without making changes |

**Example:**
```bash
mentu push cmt_e5f6g7h8 --to github
mentu push cmt_e5f6g7h8 --to github --project "Sprint Board"
```

---

### mentu pull

Sync state from GitHub.

```bash
mentu pull [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--github` | Sync from GitHub (default) |
| `--dry-run` | Preview without making changes |

**Example:**
```bash
mentu pull
mentu pull --github --dry-run
```

---

## Integration Commands

### mentu actor

Manage actor mappings between external systems and Mentu.

#### mentu actor map

Map external identity to Mentu actor.

```bash
mentu actor map <external> <mentu_actor>
```

**Example:**
```bash
mentu actor map "github:alice" "alice@example.com"
```

#### mentu actor unmap

Remove actor mapping.

```bash
mentu actor unmap <external>
```

#### mentu actor list

List all actor mappings.

```bash
mentu actor list
```

---

### mentu unlink

Remove external system link from a commitment.

```bash
mentu unlink <commitment> --github <issue>
```

**Example:**
```bash
mentu unlink cmt_abc123 --github 42
```

---

## API Server Commands

### mentu serve

Start the HTTP/WebSocket API server.

```bash
mentu serve [options]
```

**Options:**
| Option | Default | Description |
|--------|---------|-------------|
| `--port <port>` | 3000 | Port to listen on |
| `--host <host>` | localhost | Host to bind to |
| `--cors` | false | Enable CORS |

**Example:**
```bash
mentu serve
mentu serve --port 8080 --host 0.0.0.0 --cors
```

---

### mentu api-key

Manage API keys.

#### mentu api-key create

```bash
mentu api-key create --actor <actor> [--name <name>]
```

**Example:**
```bash
mentu api-key create --actor alice
mentu api-key create --actor bot --name "CI/CD Key"
```

**Output:**
```
API Key created:
  ID: key_1703750400000
  Key: mentu_key_xxx...
  Actor: alice
  Warning: SAVE THIS KEY - it cannot be retrieved later
```

#### mentu api-key list

```bash
mentu api-key list
```

#### mentu api-key revoke

```bash
mentu api-key revoke <key_id>
```

---

## Task Commands

Quick task lifecycle for Claude Code integration.

### mentu task start

Start a new task (capture + commit + claim).

```bash
mentu task start <description>
```

**Example:**
```bash
mentu task start "Implement user authentication"
```

**What it does:**
1. Captures memory with description
2. Creates commitment from memory
3. Claims the commitment
4. Saves state to `.claude/mentu_state.json`

---

### mentu task complete

Complete current task (capture evidence + close).

```bash
mentu task complete <evidence>
```

**Example:**
```bash
mentu task complete "Implemented OAuth2 flow, tests passing"
```

---

### mentu task fail

Fail current task (annotate + release).

```bash
mentu task fail <reason>
```

**Example:**
```bash
mentu task fail "Blocked by missing API credentials"
```

---

## Claude Integration

### mentu init-claude

Initialize Mentu integration for Claude Code.

```bash
mentu init-claude [options]
```

**Creates:**
- `.claude/hooks/mentu_pre_task.py`
- `.claude/hooks/mentu_post_task.py`
- `.claude/hooks/mentu_pr_events.py`
- `.claude/mentu_config.yaml`

---

### mentu claude-status

Show Mentu Claude integration status.

```bash
mentu claude-status
```

---

## Configuration

### mentu config

Manage configuration values.

#### mentu config get

```bash
mentu config get <key>
```

#### mentu config set

```bash
mentu config set <key> <value>
```

#### mentu config list

```bash
mentu config list
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MENTU_ACTOR` | Default actor identity |
| `MENTU_WORKSPACE` | Default workspace path |
| `GITHUB_ENABLED` | Enable GitHub integration |
| `GITHUB_TOKEN` | GitHub Personal Access Token |
| `GITHUB_OWNER` | GitHub organization/username |
| `GITHUB_REPO` | GitHub repository name |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |

---

## Error Codes

| Code | Description |
|------|-------------|
| `E_NO_WORKSPACE` | Not in a Mentu workspace |
| `E_WORKSPACE_EXISTS` | Workspace already exists |
| `E_EMPTY_BODY` | Body cannot be empty |
| `E_REF_NOT_FOUND` | Referenced ID doesn't exist |
| `E_ALREADY_CLOSED` | Commitment already closed |
| `E_ALREADY_CLAIMED` | Commitment claimed by another |
| `E_NOT_OWNER` | Not the owner of commitment |
| `E_PERMISSION_DENIED` | Genesis Key permission denied |
| `E_CONSTRAINT_VIOLATED` | Genesis Key constraint violated |
| `E_DUPLICATE_SOURCE_KEY` | Source key already exists |
| `E_DUPLICATE_ID` | Operation ID already exists |
| `E_MISSING_FIELD` | Required field missing |
| `E_INVALID_OP` | Invalid operation |
| `E_GITHUB_NOT_CONFIGURED` | GitHub integration not configured |
| `E_GITHUB_AUTH_FAILED` | GitHub authentication failed |
| `E_EXTERNAL_REF_EXISTS` | Already linked to external system |
