---
# ============================================================
# CANONICAL YAML FRONT MATTER
# ============================================================
id: Execution-Modes
path: docs/Execution-Modes.md
type: specification
intent: reference
version: "1.0"
created: 2026-01-03
last_updated: 2026-01-03
---

# Agent Execution Modes

This document defines the two execution modes available to agents in the Mentu ecosystem: **Session-Bound** (Task tool) and **Persistent** (mentu-bridge). Understanding when to use each is critical for reliable autonomous operation.

---

## The Core Problem: Process Lifecycle

When an agent spawns work, that work runs as a **process**. Processes have lifecycles tied to their parent. The key question is: **What happens when the parent terminal session ends?**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  UNIX PROCESS TREE                                                          │
│                                                                              │
│  Terminal Session (TTY)                                                     │
│       │                                                                      │
│       ├── Claude Agent (parent)                                             │
│       │       │                                                             │
│       │       └── Task Tool Agent (child)  ← Dies when parent exits        │
│       │                                                                      │
│       └── [Session ends] → ALL children terminated                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Two Execution Modes

### Mode 1: Session-Bound (Task Tool)

**Mechanism**: Task tool spawns a child process within the same terminal session.

**Lifecycle**: Child process dies when parent agent exits or terminal closes.

**Use when**:
- Work completes within the parent agent's session
- No terminal timeout concerns
- Synchronous result needed (agent waits for Task tool to return)
- Parallel exploration/research tasks

**Examples**:
- Code search and exploration
- File reading and analysis
- Quick validation checks
- Research that informs the current task

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SESSION-BOUND EXECUTION                                                     │
│                                                                              │
│  Parent Agent                                                               │
│       │                                                                      │
│       ├── Task tool: "Search for auth patterns"                             │
│       │       │                                                             │
│       │       └── Child agent searches, returns results                     │
│       │                                                                      │
│       ├── [Parent receives results, continues]                              │
│       │                                                                      │
│       └── [Parent exits] → Child already completed, no issue                │
│                                                                              │
│  ✅ Works: Child completes before parent exits                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Anti-pattern** (what breaks):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SESSION-BOUND ANTI-PATTERN                                                  │
│                                                                              │
│  Parent Agent                                                               │
│       │                                                                      │
│       ├── Task tool: "Capture screenshots in background"                    │
│       │       │                                                             │
│       │       └── Child agent starts long-running capture...               │
│       │                                                                      │
│       ├── [Parent continues, doesn't wait]                                  │
│       │                                                                      │
│       └── [Parent exits] → ❌ Child KILLED mid-capture                      │
│                                                                              │
│  ❌ Broken: Child still running when parent exits                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Mode 2: Persistent (mentu-bridge)

**Mechanism**: HTTP request queues work to Supabase; separate daemon process executes.

**Lifecycle**: Daemon runs 24/7 via launchd (Mac) or systemd (Linux). Completely independent of any terminal session.

**Use when**:
- Work must survive terminal closure
- Long-running tasks (screenshots, builds, deployments)
- Fire-and-forget pattern needed
- Async evidence collection
- CI/CD-style execution

**Examples**:
- Screenshot capture for visual verification
- Long-running test suites
- Deployment tasks
- Scheduled/recurring work
- Any task that might exceed terminal timeout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PERSISTENT EXECUTION                                                        │
│                                                                              │
│  Parent Agent (Terminal)           mentu-bridge Daemon (launchd)            │
│       │                                   │                                  │
│       ├── POST /bridge/spawn              │                                  │
│       │       │                           │                                  │
│       │       └── [Supabase Queue] ──────>│                                  │
│       │                                   │                                  │
│       ├── [Returns immediately]           ├── Claims command                │
│       │                                   │                                  │
│       ├── [Parent continues work]         ├── Spawns Claude agent           │
│       │                                   │                                  │
│       └── [Parent exits] ✅               ├── Captures screenshots          │
│                                           │                                  │
│           Terminal closed, doesn't matter ├── Creates evidence              │
│                                           │                                  │
│                                           └── Annotates commitment          │
│                                                                              │
│  ✅ Works: Daemon is independent process tree                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Decision Matrix

| Criterion | Session-Bound (Task) | Persistent (Bridge) |
|-----------|---------------------|---------------------|
| **Survives terminal close** | No | Yes |
| **Latency** | Low (in-process) | Higher (HTTP + queue) |
| **Result delivery** | Synchronous (returns to parent) | Async (poll or annotations) |
| **Failure visibility** | Silent (process dies) | Observable (status endpoint) |
| **Use case** | Research, exploration, validation | Long-running, evidence capture |
| **Infrastructure** | None | mentu-bridge daemon required |

---

## Quick Reference

### When to Use Task Tool

```
✅ "Search the codebase for X"
✅ "Read these files and summarize"
✅ "Validate this implementation"
✅ "Explore how Y works"
✅ "Run quick checks in parallel"
```

### When to Use Bridge

```
✅ "Capture screenshots after I exit"
✅ "Run this test suite (may take 10+ minutes)"
✅ "Deploy and verify"
✅ "Collect evidence asynchronously"
✅ "Execute at scheduled time"
✅ "Work must complete even if terminal closes"
```

---

## API Reference

### Task Tool (Session-Bound)

```
Use the Task tool with:
  - subagent_type: "Explore" | "general-purpose" | etc.
  - prompt: "Your instructions"
  - model: "sonnet" | "opus" | "haiku" (optional)
```

**Returns**: Result directly to parent agent.

### Bridge Spawn (Persistent)

```bash
curl -X POST "https://mentu-proxy.affihub.workers.dev/bridge/spawn" \
  -H "X-Proxy-Token: $MENTU_PROXY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "commitment_id": "cmt_XXXXXXXX",
    "working_directory": "/path/to/workspace",
    "timeout_seconds": 300,
    "prompt": "Your instructions"
  }'
```

**Returns**: `{"command_id": "uuid", "status": "pending"}` immediately.

**Check status**:
```bash
curl "https://mentu-proxy.affihub.workers.dev/bridge/spawn/{command_id}" \
  -H "X-Proxy-Token: $MENTU_PROXY_TOKEN"
```

---

## Infrastructure Requirements

### Session-Bound (Task Tool)

- None. Works anywhere Claude Code runs.

### Persistent (Bridge)

| Component | Location | Purpose |
|-----------|----------|---------|
| mentu-proxy | Cloudflare Worker | API gateway, job queuing |
| mentu-bridge | Mac (launchd) or VPS (systemd) | Persistent executor daemon |
| Supabase | Cloud | Async communication queue |
| MCP servers | Bridge machine | For screenshot capture, etc. |

**Verify bridge is running**:
```bash
# Mac
launchctl list | grep mentu

# VPS
systemctl status mentu-bridge
```

---

## Evidence Linking

### Session-Bound

Task tool results are available to parent agent directly. Parent captures evidence:

```bash
# Parent agent does this after Task tool returns
mentu capture "Validation complete: all checks passed" --kind evidence
```

### Persistent

Bridge agent captures evidence and links to commitment via annotations:

```bash
# Bridge agent does this (in spawn prompt)
mentu capture "Screenshot captured: login-form" --kind screenshot-evidence
mentu annotate cmt_XXXXXXXX "Visual evidence: login-form"
```

Parent can verify:
```bash
mentu show cmt_XXXXXXXX --annotations
```

---

## Common Patterns

### Pattern 1: Research then Build (Session-Bound)

```
Parent Agent:
  1. Task tool: "Explore how auth works" → Returns context
  2. Task tool: "Find similar patterns" → Returns examples
  3. Build implementation using context
  4. Submit with evidence
```

### Pattern 2: Build then Verify Async (Persistent)

```
Parent Agent:
  1. Build feature
  2. POST /bridge/spawn: "Capture screenshots"
  3. Create RESULT (status: pending)
  4. Submit commitment
  5. Exit

Bridge Daemon:
  1. Claim command
  2. Start dev server
  3. Capture screenshots
  4. Create evidence memories
  5. Annotate commitment
```

### Pattern 3: Hybrid (Both)

```
Parent Agent:
  1. Task tool: "Search for test patterns" (session-bound)
  2. Build feature using patterns
  3. POST /bridge/spawn: "Run full test suite" (persistent)
  4. Continue with other work
  5. Poll bridge status before submit
```

---

## Cross-References

| Document | Location | Purpose |
|----------|----------|---------|
| mentu-bridge CLAUDE.md | `mentu-bridge/CLAUDE.md` | Daemon architecture |
| mentu-proxy CLAUDE.md | `mentu-proxy/CLAUDE.md` | API endpoints |
| Visual Verification | `docs/templates/TEMPLATE-Handoff.md` | Screenshot capture pattern |
| Bridge Spawn API | `claude-code/registry/modules/proxy-api.yaml` | Full API spec |

---

## Summary

| Mode | Process Tree | Survives Exit | Best For |
|------|--------------|---------------|----------|
| **Session-Bound** | Child of terminal | No | Research, exploration, quick tasks |
| **Persistent** | Separate daemon | Yes | Long-running, evidence capture, fire-and-forget |

**The Rule**: If work must complete after you exit, use bridge. Otherwise, Task tool is simpler.

---

*Understanding execution modes is fundamental to reliable autonomous agent operation.*
