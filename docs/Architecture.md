---
id: Architecture-v1.0
path: docs/Architecture.md
type: reference
intent: reference
version: "1.0"
created: 2025-12-30
last_updated: 2025-12-30
---

# Mentu Orchestration Architecture

## Overview

Mentu provides accountability infrastructure for autonomous agents. The system exposes three distinct execution paths, all feeding into the same append-only ledger.

```
+------------------------------------------------------------------+
|                    MENTU ORCHESTRATION SYSTEM                     |
+------------------------------------------------------------------+
|                                                                   |
|   +------------------+                                            |
|   |   Phone/Cloud    |   "Run tests on my Mac"                    |
|   |   Claude App     |                                            |
|   +--------+---------+                                            |
|            |                                                      |
|            v                                                      |
|   +------------------+                                            |
|   |   Mentu Proxy    |   Routes intent to capability              |
|   | (Cloudflare)     |                                            |
|   +--------+---------+                                            |
|            |                                                      |
|            v                                                      |
|   +------------------+     +------------------+                   |
|   |   Supabase       |<--->|   Bridge Daemon  |                   |
|   | (Queue + State)  |     |   (Local Mac)    |                   |
|   +------------------+     +--------+---------+                   |
|                                     |                             |
|                                     v                             |
|                            +------------------+                   |
|                            |   Local Mentu    |                   |
|                            |   Workspace      |                   |
|                            +--------+---------+                   |
|                                     |                             |
|                                     v                             |
|                            +------------------+                   |
|                            |   Ledger         |                   |
|                            |  (ledger.jsonl)  |                   |
|                            +------------------+                   |
|                                                                   |
+------------------------------------------------------------------+
```

---

## The Three Execution Paths

Mentu exposes three mechanisms for Claude to interact with the accountability system:

| Path | Mechanism | Timing | Scope | Example |
|------|-----------|--------|-------|---------|
| **MCP** | Tool calls via Model Context Protocol | Synchronous | In-session | Query Airtable, read ledger |
| **Plugin** | Hooks (Pre/Post/Stop events) | Event-driven | Claude Code | Auto-capture evidence |
| **Bridge** | Async queue via Supabase Realtime | Asynchronous | Cross-device | "Run tests on Mac" |

---

## Path 1: MCP Server

The Model Context Protocol server exposes Mentu operations as tools that Claude can invoke directly during a session.

```
+------------------------------------------------------------------+
|                         MCP EXECUTION PATH                        |
+------------------------------------------------------------------+
|                                                                   |
|   Claude Session                                                  |
|   +----------------------------------------------------------+   |
|   |                                                          |   |
|   |   Claude: "I'll capture this observation"                |   |
|   |                                                          |   |
|   |   +------------------+    +------------------+           |   |
|   |   |  MCP Client      |--->|  Mentu MCP       |           |   |
|   |   |  (in Claude)     |    |  Server          |           |   |
|   |   +------------------+    +--------+---------+           |   |
|   |                                    |                     |   |
|   |                                    v                     |   |
|   |                           +------------------+           |   |
|   |                           |   mentu capture  |           |   |
|   |                           |   mentu commit   |           |   |
|   |                           |   mentu status   |           |   |
|   |                           +--------+---------+           |   |
|   |                                    |                     |   |
|   |                                    v                     |   |
|   |                           +------------------+           |   |
|   |                           |   Ledger         |           |   |
|   |                           +------------------+           |   |
|   |                                                          |   |
|   +----------------------------------------------------------+   |
|                                                                   |
+------------------------------------------------------------------+
```

### MCP Tools Available

| Tool | Operation | Description |
|------|-----------|-------------|
| `mentu_capture` | capture | Record an observation |
| `mentu_commit` | commit | Create a commitment |
| `mentu_claim` | claim | Take responsibility |
| `mentu_close` | close | Resolve with evidence |
| `mentu_status` | status | Query current state |
| `mentu_submit` | submit | Request closure review |

### When to Use MCP

- Need immediate response within the same session
- Tool-like behavior (query, create, update)
- Claude is already running in an MCP-enabled environment
- Synchronous operations that complete quickly

---

## Path 2: Plugin Hooks

Claude Code plugins inject behavior at specific lifecycle points. Hooks fire before/after tool calls and can block or augment operations.

```
+------------------------------------------------------------------+
|                       PLUGIN EXECUTION PATH                       |
+------------------------------------------------------------------+
|                                                                   |
|   Claude Code Session                                             |
|   +----------------------------------------------------------+   |
|   |                                                          |   |
|   |   +------------------+                                   |   |
|   |   |  User Request    |                                   |   |
|   |   +--------+---------+                                   |   |
|   |            |                                             |   |
|   |            v                                             |   |
|   |   +------------------+                                   |   |
|   |   |  PRE-TOOL HOOK   |  "Should I allow this?"           |   |
|   |   |  (session_start) |                                   |   |
|   |   +--------+---------+                                   |   |
|   |            |                                             |   |
|   |            v                                             |   |
|   |   +------------------+                                   |   |
|   |   |  Tool Execution  |  Bash, Edit, Read, etc.           |   |
|   |   +--------+---------+                                   |   |
|   |            |                                             |   |
|   |            v                                             |   |
|   |   +------------------+                                   |   |
|   |   |  POST-TOOL HOOK  |  "Capture as evidence"            |   |
|   |   |  (evidence)      |                                   |   |
|   |   +--------+---------+                                   |   |
|   |            |                                             |   |
|   |            v                                             |   |
|   |   +------------------+                                   |   |
|   |   |  STOP HOOK       |  "Are commitments closed?"        |   |
|   |   |  (enforcer)      |                                   |   |
|   |   +------------------+                                   |   |
|   |                                                          |   |
|   +----------------------------------------------------------+   |
|                                                                   |
+------------------------------------------------------------------+
```

### Hook Types

| Hook | Fires When | Can Block | Example Use |
|------|------------|-----------|-------------|
| `PreToolUse` | Before any tool | Yes | Validate permissions |
| `PostToolUse` | After any tool | No | Capture evidence |
| `Stop` | Before agent stops | Yes | Enforce commitments |
| `SessionStart` | Session begins | No | Load context |

### Hook Configuration

Hooks are defined in `.claude/hooks/hooks.json`:

```json
{
  "hooks": [
    {
      "event": "PostToolUse",
      "script": ".claude/hooks/post_tool_evidence.py",
      "tools": ["Bash", "Edit", "Write"]
    },
    {
      "event": "Stop",
      "script": ".claude/hooks/mentu_enforcer.py"
    }
  ]
}
```

### When to Use Plugins

- Automate accountability around agent actions
- Enforce rules (commitment closure before stopping)
- Capture evidence automatically
- Inject context at session start

---

## Path 3: Bridge Daemon

The Bridge enables cross-device execution. Claude on your phone can trigger work on your Mac.

```
+------------------------------------------------------------------+
|                       BRIDGE EXECUTION PATH                       |
+------------------------------------------------------------------+
|                                                                   |
|   Phone (Claude App)              Mac (Bridge Daemon)             |
|   +-------------------------+    +-------------------------+      |
|   |                         |    |                         |      |
|   |   "Run tests on Mac"    |    |   Bridge Daemon         |      |
|   |                         |    |   (Listening)           |      |
|   +-----------+-------------+    +-----------+-------------+      |
|               |                              ^                    |
|               v                              |                    |
|   +-------------------------+    +-------------------------+      |
|   |   Mentu Proxy           |    |   Supabase Realtime     |      |
|   |   (Cloudflare Worker)   |--->|   (Queue)               |      |
|   +-------------------------+    +-----------+-------------+      |
|                                              |                    |
|                                              v                    |
|                                  +-------------------------+      |
|                                  |   Execute Command       |      |
|                                  |   npm test              |      |
|                                  +-----------+-------------+      |
|                                              |                    |
|                                              v                    |
|                                  +-------------------------+      |
|                                  |   Ledger + Response     |      |
|                                  +-------------------------+      |
|                                                                   |
+------------------------------------------------------------------+
```

### Bridge Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Proxy | Cloudflare Worker | Route requests, auth |
| Queue | Supabase | Store pending commands |
| Daemon | Local machine | Execute, report back |
| Ledger | Local `.mentu/` | Record accountability |

### Capability Discovery

The Bridge daemon scans configured directories for manifests and reports available capabilities:

```yaml
# .mentu/manifest.yaml
name: my-project
capabilities:
  - name: test
    command: npm test
  - name: deploy
    command: ./deploy.sh {env}
```

Claude queries `/capabilities` to discover what can be executed:

```typescript
// GET /capabilities
{
  "machine_id": "mac-studio-01",
  "online": true,
  "workspaces": [
    {
      "path": "/Users/dev/my-project",
      "name": "my-project",
      "capabilities": [
        { "name": "test", "command": "npm test" },
        { "name": "deploy", "command": "./deploy.sh {env}" }
      ]
    }
  ]
}
```

### When to Use Bridge

- Remote execution from phone/cloud
- Cross-device operations
- Background/async jobs
- Operations that need local machine access

---

## Capability Discovery

Repositories declare what they can do via manifests. This enables Claude to discover and invoke capabilities dynamically.

```
+------------------------------------------------------------------+
|                     CAPABILITY DISCOVERY FLOW                     |
+------------------------------------------------------------------+
|                                                                   |
|   1. Repo declares capabilities                                   |
|   +----------------------------------------------------------+   |
|   |   .mentu/manifest.yaml                                   |   |
|   |   name: my-project                                       |   |
|   |   capabilities:                                          |   |
|   |     - name: test                                         |   |
|   |       command: npm test                                  |   |
|   +----------------------------------------------------------+   |
|                                                                   |
|   2. Bridge scans and reports                                     |
|   +----------------------------------------------------------+   |
|   |   Bridge Daemon --> Supabase                             |   |
|   |   machine_capabilities table                             |   |
|   +----------------------------------------------------------+   |
|                                                                   |
|   3. Claude queries available capabilities                        |
|   +----------------------------------------------------------+   |
|   |   Claude: "What can I run on the Mac?"                   |   |
|   |   GET /capabilities --> List of available commands       |   |
|   +----------------------------------------------------------+   |
|                                                                   |
|   4. Claude invokes capability                                    |
|   +----------------------------------------------------------+   |
|   |   POST /execute { capability: "test" }                   |   |
|   |   --> Bridge executes --> Result returned                |   |
|   +----------------------------------------------------------+   |
|                                                                   |
+------------------------------------------------------------------+
```

See [Manifest-Schema.md](Manifest-Schema.md) for the complete manifest specification.

---

## Accountability Integration

All three paths feed into the same ledger. Every operation is recorded.

```
+------------------------------------------------------------------+
|                     ACCOUNTABILITY FLOW                           |
+------------------------------------------------------------------+
|                                                                   |
|   Intent                                                          |
|   +------------------+                                            |
|   |   capture        |  "Build user auth feature"                 |
|   +--------+---------+                                            |
|            |                                                      |
|            v                                                      |
|   Commitment                                                      |
|   +------------------+                                            |
|   |   commit         |  "Deliver working auth with tests"         |
|   +--------+---------+                                            |
|            |                                                      |
|            v                                                      |
|   Work                                                            |
|   +------------------+                                            |
|   |   claim          |  "I'm working on this"                     |
|   |   (do the work)  |                                            |
|   +--------+---------+                                            |
|            |                                                      |
|            v                                                      |
|   Evidence                                                        |
|   +------------------+                                            |
|   |   capture        |  "Tests passing, PR merged"                |
|   +--------+---------+                                            |
|            |                                                      |
|            v                                                      |
|   Verification                                                    |
|   +------------------+                                            |
|   |   submit         |  "Requesting review"                       |
|   +--------+---------+                                            |
|            |                                                      |
|            v                                                      |
|   Closure                                                         |
|   +------------------+                                            |
|   |   approve        |  "Verified and accepted"                   |
|   +------------------+                                            |
|                                                                   |
+------------------------------------------------------------------+
```

### How Each Path Records to Ledger

| Path | Recording Mechanism |
|------|---------------------|
| MCP | Direct tool calls write to ledger |
| Plugin | Hooks invoke `mentu` CLI commands |
| Bridge | Daemon writes to local ledger, syncs via proxy |

---

## Complete Flow Example

Phone to local machine to ledger:

```
+------------------------------------------------------------------+
|              COMPLETE FLOW: PHONE -> MAC -> LEDGER                |
+------------------------------------------------------------------+
|                                                                   |
|   1. User on Phone                                                |
|   +----------------------------------------------------------+   |
|   |   Claude App: "Run the test suite on my Mac"             |   |
|   +----------------------------------------------------------+   |
|                            |                                      |
|                            v                                      |
|   2. Proxy Routes                                                 |
|   +----------------------------------------------------------+   |
|   |   Mentu Proxy (Cloudflare):                              |   |
|   |   - Authenticate user                                    |   |
|   |   - Find online machines                                 |   |
|   |   - Queue command to Supabase                            |   |
|   +----------------------------------------------------------+   |
|                            |                                      |
|                            v                                      |
|   3. Bridge Receives                                              |
|   +----------------------------------------------------------+   |
|   |   Bridge Daemon (Mac):                                   |   |
|   |   - Subscribes to Supabase Realtime                      |   |
|   |   - Receives command                                     |   |
|   |   - Validates against manifest                           |   |
|   +----------------------------------------------------------+   |
|                            |                                      |
|                            v                                      |
|   4. Accountability Starts                                        |
|   +----------------------------------------------------------+   |
|   |   mentu capture "Remote: run test suite" --kind task     |   |
|   |   mentu commit "Execute tests, report results"           |   |
|   |   mentu claim cmt_xxx                                    |   |
|   +----------------------------------------------------------+   |
|                            |                                      |
|                            v                                      |
|   5. Execution                                                    |
|   +----------------------------------------------------------+   |
|   |   npm test                                               |   |
|   |   (tests run, output captured)                           |   |
|   +----------------------------------------------------------+   |
|                            |                                      |
|                            v                                      |
|   6. Evidence & Closure                                           |
|   +----------------------------------------------------------+   |
|   |   mentu capture "Tests: 42 passed, 0 failed" --kind ev   |   |
|   |   mentu submit cmt_xxx --summary "All tests passing"     |   |
|   +----------------------------------------------------------+   |
|                            |                                      |
|                            v                                      |
|   7. Response                                                     |
|   +----------------------------------------------------------+   |
|   |   Result sent back via Supabase -> Proxy -> Phone        |   |
|   |   Claude: "Tests completed: 42 passed"                   |   |
|   +----------------------------------------------------------+   |
|                                                                   |
+------------------------------------------------------------------+
```

---

## Comparison Table

| Aspect | MCP | Plugin | Bridge |
|--------|-----|--------|--------|
| **Timing** | Synchronous | Event-driven | Asynchronous |
| **Scope** | In-session | Claude Code | Cross-device |
| **Latency** | Low (ms) | Low (ms) | Higher (seconds) |
| **Requires** | MCP-enabled client | Claude Code | Bridge daemon |
| **Best For** | Queries, quick ops | Automation, enforcement | Remote execution |
| **Accountability** | Direct | Via CLI | Via daemon |

---

## Cost Model

Different paths have different session costs:

| Tier | Validators | Sessions |
|------|------------|----------|
| T1 | Technical only | 2 (working + 1) |
| T2 | Technical + Safety | 3 (working + 2) |
| T3 | Technical + Safety + Intent | 4 (working + 3) |

### Cost Considerations

- **Claude Max** ($200/mo): Unlimited sessions - optimize for quality
- **API/Pro**: Session-aware - consider deterministic checks for T1/T2

### Reducing Sessions

For cost-sensitive deployments:

```bash
# Replace Claude validators with deterministic bash
# Technical: tsc && npm test && npm run build (exit codes)
# Safety: grep patterns for secrets/injection
# Intent: Keep as Claude (requires judgment)
```

---

## Related Documentation

- [Manifest-Schema.md](Manifest-Schema.md) - Capability manifest specification
- [Mentu-Spec-v0.md](Mentu-Spec-v0.md) - Protocol specification
- [Mentu-Core.md](Mentu-Core.md) - Core architecture principles
- [SubAgent-Validation-Architecture.md](SubAgent-Validation-Architecture.md) - Validator system

---

*Three paths, one ledger. Accountability everywhere.*
