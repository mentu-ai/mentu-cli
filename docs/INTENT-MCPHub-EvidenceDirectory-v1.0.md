---
id: INTENT-MCPHub-EvidenceDirectory-v1.0
path: docs/INTENT-MCPHub-EvidenceDirectory-v1.0.md
type: intent
intent: architect
version: "1.0"
created: 2026-01-15
tier: T3

author_type: architect
parent: null
related:
  - INTENT-SimpleBugSpawnv2-Architecture
  - AUDIT-LedgerFirstMigration-v1.0
  - Genesis-Key-Canonical-Schema

status: draft
visibility: architect-only
---

# Architectural Intent: MCP Hub + Evidence Directory

> **From**: Architect
>
> **To**: Auditor (for validation) → Executor (for implementation)
>
> **Core Insight**: "The response is not chat text, it's an artifact directory"

---

## Problem Statement

### Current Pain Points

1. **MCP Locality Coupling**
   - MCP servers must be installed where they run
   - Each workspace has its own MCP config
   - Credentials scattered across machines
   - Environment drift between Mac, VPS, CI

2. **Evidence is Ad-Hoc**
   - Screenshots captured manually
   - Tool outputs lost in chat context
   - No standard format for proof
   - Hard to audit what tools were called

3. **Context Bloat**
   - Tool outputs bloat agent context
   - Large responses waste tokens
   - Agent carries state it doesn't need
   - No separation between execution and orchestration

4. **Reproducibility Gap**
   - Can't replay what an executor did
   - No provenance chain for tool calls
   - "It worked on my machine" problems
   - Audit trail incomplete

### The Core Problem

> "MCP servers have locality and configuration coupling: they must be installed and authenticated where they run, which makes multi-workspace setups fragile."

---

## Proposed Solution

### One-Liner

**"A VPS-hosted MCP Hub that centralizes all MCP servers and credentials, plus ephemeral executors that produce evidence directories instead of chat responses."**

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           VPS: MCP HUB                                  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    MCP Server Registry                            │  │
│  │                                                                   │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │  │
│  │  │ Supabase │ │ Kapture  │ │Perplexity│ │  GitHub  │  ...        │  │
│  │  │   MCP    │ │   MCP    │ │   MCP    │ │   MCP    │             │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘             │  │
│  │                                                                   │  │
│  │  Credentials: ~/.mcp/credentials.yaml (encrypted, centralized)   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                    │                                    │
│                                    ▼                                    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Job Submission API                             │  │
│  │                                                                   │  │
│  │  POST /jobs                                                       │  │
│  │  {                                                                │  │
│  │    "commitment_id": "cmt_abc123",                                 │  │
│  │    "instruction": "Fix the login bug",                            │  │
│  │    "workspace_id": "inline-substitute",                           │  │
│  │    "tools_allowed": ["supabase", "kapture", "bash"]               │  │
│  │  }                                                                │  │
│  │                                                                   │  │
│  │  Response: { "job_id": "job_xyz", "status": "queued" }            │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                    │                                    │
│                                    ▼                                    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Ephemeral Executor                             │  │
│  │                                                                   │  │
│  │  - Spawned per job (isolated)                                     │  │
│  │  - Runs in worktree: ./work/{commitment_id}/                      │  │
│  │  - Full MCP access via hub                                        │  │
│  │  - Evidence hooks capture ALL tool calls                          │  │
│  │  - Writes to: /evidence/{commitment_id}/                          │  │
│  │  - Dies after completion (context discarded)                      │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                    │                                    │
│                                    ▼                                    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Evidence Directory                             │  │
│  │                                                                   │  │
│  │  /home/mentu/evidence/{commitment_id}/                            │  │
│  │  ├── manifest.json      (provenance, hashes, timestamps)          │  │
│  │  ├── result.md          (human-readable summary)                  │  │
│  │  ├── evidence/                                                    │  │
│  │  │   ├── tool_calls.jsonl   (every MCP call logged)               │  │
│  │  │   ├── screenshots/                                             │  │
│  │  │   ├── database_results/                                        │  │
│  │  │   └── git_diffs/                                               │  │
│  │  └── logs/                                                        │  │
│  │      └── executor.log                                             │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Mentu Ledger                                    │
│                                                                         │
│  { "op": "close",                                                       │
│    "commitment": "cmt_abc123",                                          │
│    "evidence_dir": "/home/mentu/evidence/cmt_abc123",                   │
│    "manifest_hash": "sha256:abc123..." }                                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### 1. MCP Hub (Centralized Tool Access)

**What**: Single VPS location where ALL MCP servers run.

**Why**:
- No more per-workspace MCP setup
- Credentials in one secure location
- Consistent tool access from any client
- Easy to add/update/audit MCP servers

**How**:
```yaml
# ~/.mcp/hub-config.yaml (on VPS)
hub:
  port: 3100
  host: 0.0.0.0

servers:
  supabase:
    command: npx
    args: ["-y", "@anthropic/mcp-supabase"]
    env:
      SUPABASE_URL: ${SUPABASE_URL}
      SUPABASE_KEY: ${SUPABASE_KEY}

  kapture:
    command: npx
    args: ["-y", "@anthropic/mcp-kapture"]

  perplexity:
    command: npx
    args: ["-y", "@anthropic/mcp-perplexity"]
    env:
      PERPLEXITY_API_KEY: ${PERPLEXITY_API_KEY}

  github:
    command: npx
    args: ["-y", "@anthropic/mcp-github"]
    env:
      GITHUB_TOKEN: ${GITHUB_TOKEN}

credentials:
  path: ~/.mcp/credentials.enc
  encryption: age
```

### 2. Ephemeral Executor (Job-Based Execution)

**What**: Short-lived Claude instance spawned per job.

**Why**:
- Context isolation (no state bleed between jobs)
- Reproducible (same input → same output)
- Auditable (full trace of what happened)
- Cost-effective (context discarded after job)

**How**:
```bash
# Spawned by hub for each job
claude \
  --max-turns 50 \
  --mcp-hub "localhost:3100" \
  --evidence-dir "/home/mentu/evidence/${COMMITMENT_ID}" \
  "${INSTRUCTION}"
```

### 3. Evidence Directory (Artifact Bundle)

**What**: Structured directory containing ALL outputs from a job.

**Why**:
- Evidence, not assertion
- Reproducible audit trail
- Thin controller (orchestrator gets path, not content)
- Immutable (hashed, timestamped)

**Schema**:
```
/home/mentu/evidence/{commitment_id}/
│
├── manifest.json
│   {
│     "schema_version": "1.0",
│     "commitment_id": "cmt_abc123",
│     "job_id": "job_xyz789",
│     "workspace_id": "inline-substitute",
│
│     "execution": {
│       "started": "2026-01-15T10:00:00Z",
│       "completed": "2026-01-15T10:15:32Z",
│       "duration_seconds": 932,
│       "exit_code": 0,
│       "model": "claude-opus-4-5-20251101",
│       "max_turns": 50,
│       "turns_used": 23
│     },
│
│     "tools_called": [
│       {
│         "server": "supabase",
│         "tool": "execute_sql",
│         "ts": "2026-01-15T10:02:15Z",
│         "input_hash": "sha256:abc...",
│         "output_hash": "sha256:def...",
│         "artifact": "evidence/database_results/query_001.json"
│       },
│       {
│         "server": "kapture",
│         "tool": "screenshot",
│         "ts": "2026-01-15T10:05:30Z",
│         "artifact": "evidence/screenshots/login_page.png"
│       }
│     ],
│
│     "git": {
│       "start_ref": "abc123",
│       "end_ref": "def456",
│       "commits": ["def456"],
│       "files_changed": ["src/auth.ts"],
│       "diff_artifact": "evidence/git_diffs/changes.patch"
│     },
│
│     "integrity": {
│       "manifest_hash": "sha256:...",
│       "evidence_tree_hash": "sha256:...",
│       "signed_by": "agent:mcp-hub"
│     }
│   }
│
├── result.md
│   # Bug Fix: Login fails on Safari
│
│   ## Summary
│   Fixed Safari-specific localStorage timing issue in auth.ts
│
│   ## Changes
│   - Modified `src/auth.ts:234` to add Safari detection
│   - Added 100ms delay for Safari localStorage sync
│
│   ## Verification
│   - Screenshot shows successful login on Safari
│   - All tests pass
│   - Deployed to production
│
│   ## Artifacts
│   - Before screenshot: `evidence/screenshots/before.png`
│   - After screenshot: `evidence/screenshots/after.png`
│   - Git diff: `evidence/git_diffs/changes.patch`
│
├── evidence/
│   ├── tool_calls.jsonl          # Every MCP call (JSONL format)
│   │   {"ts":"...","server":"supabase","tool":"execute_sql","input":{...},"output":{...}}
│   │   {"ts":"...","server":"kapture","tool":"screenshot","input":{...},"output":{...}}
│   │
│   ├── screenshots/
│   │   ├── before.png
│   │   ├── after.png
│   │   └── verification.png
│   │
│   ├── database_results/
│   │   ├── query_001.json
│   │   └── query_002.json
│   │
│   └── git_diffs/
│       └── changes.patch
│
└── logs/
    ├── executor.log              # Claude's execution log
    ├── mcp_hub.log               # Hub-side logs
    └── hooks.log                 # Evidence hook activity
```

### 4. Evidence Hooks (Automatic Capture)

**What**: Intercepts all MCP tool calls and captures artifacts.

**Why**:
- No manual evidence collection
- Complete audit trail
- Reproducible (can replay tool calls)
- Tamper-evident (hashed)

**How**:
```typescript
// Evidence hook (runs in MCP Hub)
interface EvidenceHook {
  onToolCall(call: MCPToolCall): void {
    // 1. Log to tool_calls.jsonl
    appendToFile(`${evidenceDir}/evidence/tool_calls.jsonl`, {
      ts: new Date().toISOString(),
      server: call.server,
      tool: call.tool,
      input: call.input,
      input_hash: sha256(JSON.stringify(call.input)),
    });

    // 2. Capture artifacts based on tool type
    if (call.tool === 'screenshot') {
      saveArtifact(`screenshots/${call.id}.png`, call.output);
    }
    if (call.tool === 'execute_sql') {
      saveArtifact(`database_results/${call.id}.json`, call.output);
    }
  }

  onToolResult(call: MCPToolCall, result: MCPToolResult): void {
    // Update tool_calls.jsonl with output
    appendToFile(`${evidenceDir}/evidence/tool_calls.jsonl`, {
      ts: new Date().toISOString(),
      server: call.server,
      tool: call.tool,
      output: result.output,
      output_hash: sha256(JSON.stringify(result.output)),
      artifact: savedArtifactPath,
    });
  }
}
```

---

## CLI Interface

### Job Submission

```bash
# From any machine (Mac, CI, another VPS)
mentu execute cmt_abc123 \
  --hub vps-01 \
  --instruction "Fix the login bug described in this commitment" \
  --tools supabase,kapture,bash \
  --max-turns 50 \
  --timeout 3600

# Returns immediately:
# { "job_id": "job_xyz789", "status": "queued" }
```

### Job Status

```bash
mentu job status job_xyz789

# Returns:
# {
#   "job_id": "job_xyz789",
#   "status": "running",      # queued | running | completed | failed
#   "progress": "turn 15/50",
#   "started": "2026-01-15T10:00:00Z"
# }
```

### Job Completion

```bash
mentu job result job_xyz789

# Returns:
# {
#   "job_id": "job_xyz789",
#   "status": "completed",
#   "evidence_dir": "/home/mentu/evidence/cmt_abc123",
#   "manifest_hash": "sha256:abc123...",
#   "result_summary": "Fixed Safari login issue. 1 file changed. Tests pass."
# }
```

### Commitment Closure

```bash
# Close commitment with evidence directory
mentu close cmt_abc123 \
  --evidence-dir /home/mentu/evidence/cmt_abc123

# Mentu:
# 1. Verifies manifest.json integrity
# 2. Hashes evidence directory
# 3. Records close operation with evidence_dir reference
# 4. Links manifest to ledger
```

---

## Mentu Integration

### Ledger Operations

```json
// 1. Job started (execution_start)
{
  "id": "mem_exec_001",
  "op": "capture",
  "actor": "agent:mcp-hub",
  "payload": {
    "kind": "execution_start",
    "body": "Job job_xyz789 started for cmt_abc123",
    "meta": {
      "job_id": "job_xyz789",
      "commitment_id": "cmt_abc123",
      "hub": "vps-01",
      "evidence_dir": "/home/mentu/evidence/cmt_abc123",
      "state": "running"
    }
  }
}

// 2. Job completed (annotate)
{
  "id": "mem_exec_002",
  "op": "annotate",
  "actor": "agent:mcp-hub",
  "refs": ["mem_exec_001"],
  "payload": {
    "body": "Job completed successfully",
    "meta": {
      "state": "completed",
      "duration_seconds": 932,
      "turns_used": 23,
      "tools_called": 15,
      "files_changed": ["src/auth.ts"],
      "manifest_hash": "sha256:abc123..."
    }
  }
}

// 3. Commitment closed (close)
{
  "id": "op_close_001",
  "op": "close",
  "actor": "agent:mcp-hub",
  "payload": {
    "commitment": "cmt_abc123",
    "evidence_dir": "/home/mentu/evidence/cmt_abc123",
    "manifest_hash": "sha256:abc123..."
  }
}
```

### Evidence Directory as Evidence

Instead of:
```bash
mentu close cmt_xxx --evidence mem_yyy  # Single memory reference
```

We get:
```bash
mentu close cmt_xxx --evidence-dir /path/to/bundle  # Full artifact bundle
```

The ledger records:
- `evidence_dir`: Path to bundle
- `manifest_hash`: Hash of manifest.json
- `evidence_tree_hash`: Merkle root of all artifacts

---

## Genesis Key Extension

```yaml
# genesis.key (per workspace)
genesis:
  version: "1.2"

identity:
  workspace: "inline-substitute"
  # ... existing fields ...

# NEW: MCP Hub configuration
mcp_hub:
  enabled: true
  primary: "vps-01"
  fallback: null

  # Hub connection
  connection:
    host: "208.167.255.71"
    port: 3100
    auth: "token"
    token_env: "MCP_HUB_TOKEN"

  # Which tools this workspace can use
  tools_allowed:
    - supabase
    - kapture
    - bash
    - github

  # Evidence configuration
  evidence:
    base_path: /home/mentu/evidence
    retention_days: 90
    require_manifest: true
    require_hash: true

  # Executor configuration
  executor:
    model: claude-opus-4-5-20251101
    max_turns: 50
    timeout_seconds: 3600
    worktree_base: ./work

# Permissions for hub actors
permissions:
  actors:
    "agent:mcp-hub":
      role: "executor"
      operations: [capture, annotate, claim, close, submit]
      description: "MCP Hub executing jobs"
```

---

## Implementation Phases

### Phase 1: Evidence Directory Specification

**Deliverables**:
- Evidence directory schema (manifest.json format)
- Evidence hook specification
- `mentu close --evidence-dir` CLI support

**No MCP Hub yet** - just standardize evidence format.

### Phase 2: Local Evidence Hooks

**Deliverables**:
- Evidence hooks for local Claude Code
- Automatic tool call logging
- Artifact capture for common tools

**Still local execution** - but with proper evidence capture.

### Phase 3: MCP Hub Server

**Deliverables**:
- Hub server (runs all MCP servers)
- Job submission API
- Ephemeral executor spawning
- Evidence directory creation

### Phase 4: CLI Integration

**Deliverables**:
- `mentu execute` command
- `mentu job status/result` commands
- Remote job submission from any machine

### Phase 5: Mentu Ledger Integration

**Deliverables**:
- Ledger operations for job lifecycle
- Evidence directory verification
- Manifest hash recording
- Dashboard visualization

---

## Success Criteria

### Must Have (v1.0)

- [ ] Evidence directory schema finalized
- [ ] Evidence hooks capture all MCP tool calls
- [ ] `tool_calls.jsonl` logs every interaction
- [ ] `manifest.json` provides provenance
- [ ] `mentu close --evidence-dir` works
- [ ] Ledger records evidence_dir + manifest_hash

### Should Have (v1.1)

- [ ] MCP Hub server running on VPS
- [ ] Remote job submission via CLI
- [ ] Ephemeral executor isolation
- [ ] Worktree per job

### Nice to Have (v2.0)

- [ ] Job queuing and prioritization
- [ ] Parallel job execution
- [ ] Evidence directory deduplication
- [ ] Real-time job monitoring in dashboard
- [ ] Evidence directory browsing in mentu-web

---

## Open Questions

### Q1: How do we handle large artifacts (videos, large files)?

**Options**:
- A) Store in evidence directory, reference by path
- B) Store in Supabase storage, reference by URL
- C) Hybrid: small inline, large in storage

**Recommendation**: B for artifacts > 10MB, A otherwise.

### Q2: How long do we retain evidence directories?

**Options**:
- A) Forever (append-only philosophy)
- B) Configurable per workspace (genesis.key)
- C) Archive to cold storage after N days

**Recommendation**: B with default 90 days, archive to S3-compatible after.

### Q3: How do we authenticate to the MCP Hub?

**Options**:
- A) Shared token (simple)
- B) Per-workspace tokens (better isolation)
- C) mTLS (most secure)

**Recommendation**: B for v1.0, C for production.

### Q4: What happens if the hub is unavailable?

**Options**:
- A) Fail immediately
- B) Queue job for retry
- C) Fall back to local execution

**Recommendation**: B with configurable timeout, C as manual override.

---

## Dependencies

### Blocking

- [ ] Evidence directory schema (must define before implementing)
- [ ] MCP Hub authentication design (must decide before shipping)

### Required Infrastructure

- [x] VPS with stable network (already have vps-01)
- [x] Supabase for ledger storage (already have)
- [ ] MCP Hub server (to build)
- [ ] Evidence storage (VPS filesystem initially)

### Related Work

- INTENT-SimpleBugSpawnv2-Architecture (worktree isolation)
- AUDIT-LedgerFirstMigration (ledger-based dispatch)
- mentu-bridge (current executor)

---

## The Philosophy

> **"The response is not chat text, it's an artifact directory."**

This architecture embodies:

1. **Evidence, not assertion** - Every claim has artifacts
2. **Append-only history** - Evidence directories are immutable
3. **Thin controller, thick runtime** - Orchestrator stays light
4. **Centralized tools, distributed work** - MCP Hub serves everyone
5. **Reproducible execution** - Same input → same artifacts
6. **Auditable by default** - Every tool call logged

---

## Summary

**What we're building**:
- MCP Hub: Centralized tool access on VPS
- Ephemeral Executors: Job-based, isolated, discardable
- Evidence Directories: Artifact bundles, not chat responses
- Mentu Integration: Evidence paths in ledger, not memory IDs

**Why it matters**:
- No more MCP setup drift
- Complete audit trail
- Reproducible execution
- Thin controllers (agents stay context-light)
- Evidence-first closure

**Next step**: Auditor review, then Phase 1 (Evidence Directory Specification)

---

*Authored by: Architect*
*For audition by: Auditor*
*Ready for validation*
