# Spawning Claude Agents via Beacon

A practical guide to running Claude agents remotely via the Mentu beacon (mentu-bridge daemon).

---

## What is Agent Spawning?

Agent spawning lets you run a Claude Code agent on a remote machine (VPS, Mac, etc.) that executes autonomously and persists results to Supabase. The agent runs independently of your terminal session.

```
Your Terminal                    Remote Beacon (VPS/Mac)
     |                                  |
     |-- spawn command --------------->|
     |                                  |-- claims from queue
     |   (you can exit)                 |-- runs Claude agent
     |                                  |-- captures output
     |                                  |-- stores result
     |                                  |
     +----- poll result <--------------|
```

---

## Prerequisites

1. **Beacon running** - `mentu-bridge` daemon active on target machine
2. **Supabase connected** - Beacon registered in `bridge_machines` table
3. **Claude Code authenticated** - `CLAUDE_CODE_OAUTH_TOKEN` set on beacon machine

Check beacon status:
```sql
SELECT id, name, status, last_seen_at
FROM bridge_machines
WHERE status = 'online';
```

---

## Method 1: Mentu CLI (Recommended)

### Basic Spawn

```bash
cd /Users/rashid/Desktop/Workspaces/mentu-ai

# Spawn to any available beacon
./bin/mentu spawn "List all TypeScript files and count lines of code" \
  --directory /home/mentu/Workspaces/mentu-web

# Target a specific machine
./bin/mentu spawn "Run the test suite" \
  --directory /home/mentu/Workspaces/mentu-ai \
  --machine vps-mentu-01
```

### With Commitment Reference

```bash
# Link spawn to a commitment for tracking
./bin/mentu spawn cmt_abc12345 \
  --directory /home/mentu/Workspaces/mentu-web
```

### Check Status

```bash
./bin/mentu bridge status <command-id>
```

---

## Method 2: HTTP API via mentu-proxy

### Spawn a Bash Command

```bash
curl -X POST "https://mentu-proxy.affihub.workers.dev/bridge/spawn" \
  -H "Content-Type: application/json" \
  -H "X-Proxy-Token: $MENTU_PROXY_TOKEN" \
  -d '{
    "prompt": "echo Hello from beacon && hostname && date",
    "working_directory": "/tmp",
    "target_machine_id": "vps-mentu-01",
    "agent": "bash"
  }'
```

### Spawn a Claude Agent

```bash
curl -X POST "https://mentu-proxy.affihub.workers.dev/bridge/spawn" \
  -H "Content-Type: application/json" \
  -H "X-Proxy-Token: $MENTU_PROXY_TOKEN" \
  -d '{
    "prompt": "Read the README.md and summarize the project architecture",
    "working_directory": "/home/mentu/Workspaces/mentu-web",
    "target_machine_id": "vps-mentu-01",
    "agent": "claude",
    "timeout_seconds": 300
  }'
```

### Check Result

```bash
curl "https://mentu-proxy.affihub.workers.dev/bridge/spawn/<command-id>" \
  -H "X-Proxy-Token: $MENTU_PROXY_TOKEN"
```

---

## Method 3: Direct Supabase Insert

For programmatic access or debugging:

```sql
INSERT INTO bridge_commands (
  workspace_id,
  target_machine_id,
  prompt,
  working_directory,
  agent,
  status
)
SELECT
  workspace_id,
  'vps-mentu-01',
  'Your prompt here',
  '/home/mentu/Workspaces/your-project',
  'claude',  -- or 'bash'
  'pending'
FROM bridge_machines
WHERE id = 'vps-mentu-01'
RETURNING id;
```

Query result:

```sql
SELECT
  bc.status,
  bc.completed_at,
  br.stdout,
  br.stderr,
  br.exit_code
FROM bridge_commands bc
LEFT JOIN bridge_results br ON br.command_id = bc.id
WHERE bc.id = '<command-id>';
```

---

## Agent Types

| Agent | Purpose | Use Case |
|-------|---------|----------|
| `bash` | Direct shell execution | Simple commands, scripts, system checks |
| `claude` | Full Claude Code agent | Code exploration, file edits, complex reasoning |

### Bash Agent

Fast, direct execution. Good for:
- System diagnostics (`uptime`, `df -h`, `docker ps`)
- Running scripts
- Quick file operations

### Claude Agent

Spawns a full Claude Code session. Good for:
- Code analysis and exploration
- Multi-file operations
- Complex tasks requiring reasoning
- Evidence gathering with tool usage

---

## Practical Examples

### Example 1: System Health Check

```bash
curl -X POST "https://mentu-proxy.affihub.workers.dev/bridge/spawn" \
  -H "Content-Type: application/json" \
  -H "X-Proxy-Token: $MENTU_PROXY_TOKEN" \
  -d '{
    "prompt": "echo === SYSTEM HEALTH === && uptime && echo && echo === DISK === && df -h / && echo && echo === MEMORY === && free -h && echo && echo === DOCKER === && docker ps --format \"table {{.Names}}\t{{.Status}}\" 2>/dev/null || echo Docker not running",
    "working_directory": "/tmp",
    "target_machine_id": "vps-mentu-01",
    "agent": "bash"
  }'
```

### Example 2: Code Analysis

```bash
curl -X POST "https://mentu-proxy.affihub.workers.dev/bridge/spawn" \
  -H "Content-Type: application/json" \
  -H "X-Proxy-Token: $MENTU_PROXY_TOKEN" \
  -d '{
    "prompt": "Analyze the src/components directory. List all React components, identify any that are unused, and report on the component architecture.",
    "working_directory": "/home/mentu/Workspaces/mentu-web",
    "target_machine_id": "vps-mentu-01",
    "agent": "claude",
    "timeout_seconds": 600
  }'
```

### Example 3: Run Tests

```bash
curl -X POST "https://mentu-proxy.affihub.workers.dev/bridge/spawn" \
  -H "Content-Type: application/json" \
  -H "X-Proxy-Token: $MENTU_PROXY_TOKEN" \
  -d '{
    "prompt": "npm test 2>&1 | head -100",
    "working_directory": "/home/mentu/Workspaces/mentu-web",
    "target_machine_id": "vps-mentu-01",
    "agent": "bash",
    "timeout_seconds": 300
  }'
```

### Example 4: Git Status Across Repos

```bash
curl -X POST "https://mentu-proxy.affihub.workers.dev/bridge/spawn" \
  -H "Content-Type: application/json" \
  -H "X-Proxy-Token: $MENTU_PROXY_TOKEN" \
  -d '{
    "prompt": "for repo in mentu-ai mentu-web mentu-proxy mentu-bridge; do echo \"=== $repo ===\"; cd /home/mentu/Workspaces/$repo && git status -sb 2>/dev/null || echo \"Not a git repo\"; echo; done",
    "working_directory": "/home/mentu/Workspaces",
    "target_machine_id": "vps-mentu-01",
    "agent": "bash"
  }'
```

---

## Command Lifecycle

```
pending → claimed → running → completed/failed
```

| Status | Meaning |
|--------|---------|
| `pending` | In queue, waiting for beacon to claim |
| `claimed` | Beacon took ownership, about to execute |
| `running` | Currently executing |
| `completed` | Finished successfully |
| `failed` | Execution error (check stderr/error_message) |
| `timeout` | Exceeded timeout_seconds |

---

## Result Structure

```json
{
  "id": "uuid",
  "command_id": "uuid",
  "machine_id": "vps-mentu-01",
  "status": "success",
  "exit_code": 0,
  "stdout": "command output here",
  "stderr": "",
  "started_at": "2026-01-11T23:07:09Z",
  "completed_at": "2026-01-11T23:07:12Z"
}
```

---

## Genesis Enforcement

Beacons enforce `.mentu/genesis.key` permissions. If the beacon's actor lacks permission, you'll see:

```
Genesis enforcement denied: Actor 'agent:bridge-daemon' does not have permission to perform 'execute'
```

To fix: Update the genesis.key in the target repository to grant execute permission to the bridge actor.

---

## Troubleshooting

### Command Stays Pending

1. Check beacon is online:
   ```sql
   SELECT id, status, last_seen_at FROM bridge_machines;
   ```
2. Verify target_machine_id matches an online beacon
3. Check beacon logs on the machine

### Command Fails Immediately

1. Check `bridge_results.stderr` and `error_message`
2. Common causes:
   - Genesis permission denied
   - Working directory doesn't exist
   - Invalid command syntax

### No Output

1. Command may still be running - check status
2. Beacon may have crashed - check last_seen_at
3. Output may be in stderr instead of stdout

---

## Available Beacons

Query current beacons:

```sql
SELECT
  id,
  name,
  hostname,
  status,
  agents_available,
  last_seen_at,
  NOW() - last_seen_at as time_since_seen
FROM bridge_machines
ORDER BY last_seen_at DESC;
```

---

## See Also

- [Execution-Modes.md](./Execution-Modes.md) - Session-bound vs persistent execution
- [mentu-bridge/CLAUDE.md](../../mentu-bridge/CLAUDE.md) - Daemon architecture
- [mentu-proxy/CLAUDE.md](../../mentu-proxy/CLAUDE.md) - API gateway

---

*Last updated: 2026-01-11*
