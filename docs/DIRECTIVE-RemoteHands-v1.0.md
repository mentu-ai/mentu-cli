---
document_type: directive
title: "Remote Hands: Decoupling Intent from Presence"
version: "1.0"
status: strategic-intent
origin: conversation
date: 2026-01-02

# MODE: ARCHITECT
# You lack local filesystem access. Produce strategic intent only.
# State what and why. Do not specify file paths, schemas, or code.
# A local agent will audit and implement.

lineage:
  source: "Claude conversation with Rashid"
  context: "Multi-hour discussion on mobile -> cloud -> desktop execution"
  key_insight: "Decoupling intent from presence"

execution:
  pattern: "directive -> audit -> interpret -> /craft -> execute"
  next_action: "Local agent audits mentu-bridge, mentu-proxy, Supabase schema, then runs /craft RemoteHands-v1.0"
---

# DIRECTIVE: Remote Hands v1.0

## Classification

**This is a DIRECTIVE, not a PRD.**

Mode: Architect. No local access. Strategic intent only.

The receiving agent must:
1. **Audit** existing infrastructure (bridge, proxy, Supabase)
2. **Interpret** this directive against ground truth
3. **Execute** `/craft RemoteHands-v1.0` with local knowledge
4. **Reference** this directive as origin

---

## The Unlock

**Today:**
```
I have Claude Code on my laptop.
I have to be at my laptop to use it.
```

**With Remote Hands:**
```
I'm on my phone at a coffee shop.
I tell Mentu "fix the failing tests in mentu-proxy."
My laptop at home spins up Claude Code.
It runs the fix.
It captures evidence.
I approve from my phone.
It ships.
```

**You've decoupled intent from presence.**

---

## Strategic Intent

### The Problem

Claude Code is powerful but tethered. You must be physically present at the machine to use it.

The bridge daemon exists. It polls for commands. It can execute bash. But it cannot:
- Spawn Claude Code with a prompt
- Capture Claude's output as evidence
- Wait for human approval before destructive actions
- Report results back to a mobile interface

### The Solution

Three components working together:

```
MOBILE              CLOUD                 DESKTOP
------              -----                 -------

Human intent   ->    Command queue    ->    Daemon execution
(anywhere)          (mentu-proxy)         (your machine)

"Fix the bug"  ->    cmd_xxx queued   ->    Claude runs
                         |
                         |
Approval UI    <-    Status update    <-    Evidence captured
[Approve]           "ready for review"
    |
    v
                    Approval signal   ->    Post-approval action
                                          (git push, deploy)
```

### The Outcome

Your laptop becomes a server you command from anywhere.

Work happens while you're away. Evidence accumulates. Approval gates protect destructive actions. Everything is accountable.

---

## Architectural Decisions

### 1. The Daemon Spawns Claude Code

**Decision:** Enhance mentu-bridge to spawn Claude Code as a subprocess, not just bash commands.

**Rationale:** Claude Code is the execution engine. The daemon is the trigger mechanism. Combining them creates "remote hands."

**What this means:**
- Daemon receives command with `type: agent_task`
- Daemon spawns: `claude --print --max-turns N "prompt"`
- Daemon captures stdout/stderr as evidence
- Daemon reports completion status

### 2. Approval Gates Are First-Class

**Decision:** Commands can require approval before final action.

**Rationale:** "Fix the bug" is safe. "Deploy to production" needs human confirmation. The system must distinguish.

**What this means:**
- Commands have `approval_required: boolean`
- Commands have `on_approve: string` (action after approval)
- Daemon pauses after Claude completes if approval required
- Human approves via mobile -> cloud -> daemon continues

### 3. Mobile Is a Thin Client

**Decision:** The mobile app is intent capture + approval UI. Nothing more.

**Rationale:** Keep complexity on desktop and cloud. Mobile is the remote control, not the brain.

**What this means:**
- Mobile captures natural language intent
- Cloud (Claude API) interprets into structured command
- Mobile displays status and approval requests
- Mobile sends approve/reject signals

### 4. Cloud Is the Router

**Decision:** mentu-proxy routes commands, stores state, pushes notifications.

**Rationale:** The proxy already handles signals and bridge commands. Extend, don't replace.

**What this means:**
- `bridge_commands` table gains new fields
- Real-time subscriptions for mobile updates
- Push notification integration for approval alerts

### 5. Evidence Is Automatic

**Decision:** Every Claude execution produces a memory as evidence.

**Rationale:** The Mentu protocol requires evidence for closure. Remote execution must capture it automatically.

**What this means:**
- Daemon runs Claude
- Daemon captures output: `mentu capture "Claude output: ..." --kind agent_output`
- Daemon links evidence to command
- Evidence available for commitment closure

---

## The Three Layers

### Layer 1: Transport (The Pipe)

```
Phone -> Cloud Queue -> Desktop Daemon
```

Intent travels from anywhere to your machine. This is infrastructure.

**Exists partially:** bridge_commands table, WebSocket notifications, polling daemon.

**Needs:** Mobile client, enhanced command schema, approval flow.

### Layer 2: Execution (The Hands)

```
Daemon -> Claude Code -> Filesystem/Terminal -> Evidence
```

The daemon spawns Claude, Claude does work, evidence is captured.

**Exists partially:** Daemon can execute bash.

**Needs:** Claude Code spawning, output capture, evidence creation.

### Layer 3: Accountability (The Ledger)

```
Command -> Commitment -> Evidence -> Closure
```

Every remote action is tracked in the Mentu protocol.

**Exists:** Full protocol implementation.

**Needs:** Integration between command queue and commitment lifecycle.

---

## Success Criteria

### The Demo

1. You're on your phone, away from your laptop
2. You type: "Fix the failing tests in mentu-proxy"
3. Your laptop (running daemon) receives the command
4. Claude Code runs, examines tests, produces fix
5. Daemon captures evidence (diff, test output)
6. Your phone shows: "Tests fixed. Approve to push?"
7. You tap [Approve]
8. Daemon runs: `git commit && git push`
9. Your phone shows: "Pushed. Commitment closed."

### Functional Requirements

- [ ] Daemon can spawn Claude Code with arbitrary prompt
- [ ] Daemon captures Claude output as evidence
- [ ] Commands can require approval before post-action
- [ ] Mobile can send commands to cloud queue
- [ ] Mobile can receive status updates in real-time
- [ ] Mobile can approve/reject pending commands
- [ ] Full lineage from phone intent to git commit

### Non-Functional Requirements

- Latency: Command reaches daemon within 10 seconds
- Reliability: Commands survive daemon restart (persisted in cloud)
- Security: Only authenticated user can send commands to their machines

---

## What This Directive Does NOT Specify

The local agent must determine through audit:

1. **Current bridge_commands schema** - What fields exist? What needs adding?
2. **Daemon architecture** - How does mentu-bridge currently work? What's the poll loop?
3. **Claude Code CLI flags** - What's the exact invocation? `--print`? `--dangerously-skip-permissions`?
4. **Supabase real-time** - How are subscriptions configured? What channels exist?
5. **Push notification service** - Firebase? APNs? Expo? What's the mobile stack?
6. **Mobile app framework** - React Native? Flutter? Expo? What exists?

**Do not assume. Audit.**

---

## Phasing Guidance

### Phase 1: Enhanced Daemon (The Unlock)

The atomic capability: daemon can spawn Claude Code and capture output.

**Delivers:**
- `type: agent_task` command handling
- Claude Code subprocess spawning
- Output capture as evidence
- Status reporting to cloud

**Test:** Send command via Supabase UI -> Daemon runs Claude -> Evidence appears in ledger.

### Phase 2: Approval Flow

Commands can pause for approval.

**Delivers:**
- `approval_required` field in commands
- `on_approve` action field
- Daemon pauses after Claude completes
- Approval signal triggers continuation

**Test:** Command with `approval_required: true` -> Claude runs -> Pauses -> Manual approval in Supabase -> Post-action runs.

### Phase 3: Mobile MVP

Phone can send commands and approve.

**Delivers:**
- Simple mobile app (text input + status list + approve buttons)
- Real-time status updates
- Push notifications for approval requests

**Test:** Full demo scenario from success criteria.

### Phase 4: Intent Interpretation

Natural language -> structured command.

**Delivers:**
- Claude API call to interpret intent
- Constraint extraction (what's allowed, what's not)
- Workspace/project detection

**Test:** "Fix the tests" -> `{ type: agent_task, workspace: "mentu-proxy", prompt: "Fix failing tests..." }`

---

## Existing Infrastructure

The local agent should audit these:

| Component | Location | Relevance |
|-----------|----------|-----------|
| mentu-bridge | mentu-bridge/ | The daemon to enhance |
| bridge_commands | Supabase table | Command queue schema |
| mentu-proxy | mentu-proxy/ | Cloud API, may need endpoints |
| Real-time config | Supabase dashboard | Subscription channels |

---

## Open Questions for Local Agent

1. What's the current bridge polling interval? Is WebSocket available?
2. Does bridge_commands have `type` field or is everything bash?
3. How does the daemon authenticate with Supabase?
4. Is there existing mobile code anywhere, or starting fresh?
5. What's the permission model for Claude Code on the daemon machine?
6. How should the daemon handle Claude Code crashes or timeouts?

---

## The Vision

One human. Infinite agents. Everywhere.

You set direction from anywhere. Your machines execute. Evidence accumulates. You approve what matters. Work ships while you sleep.

The laptop becomes infrastructure. The phone becomes the cockpit. The ledger becomes the audit trail.

**Remote Hands is the unlock.**

---

*Origin: Conversation between Claude and Rashid, 2026-01-02*
*Mode: Architect (strategic intent, no implementation details)*
*Next: Local agent audits and runs `/craft RemoteHands-v1.0`*
