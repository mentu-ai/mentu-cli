# Async Visual Evidence Capture

**Date**: 2026-01-11
**Status**: Implemented
**Purpose**: Enable coding agents to delegate screenshot capture without blocking

---

## Overview

Async visual evidence capture allows coding agents to "fire and forget" screenshot tasks. Instead of waiting for Puppeteer execution, the parent agent spawns work to mentu-bridge and continues coding. Evidence is captured asynchronously and appears in the ledger when complete.

## Why Async?

| Sync (Blocking) | Async (Non-Blocking) |
|-----------------|----------------------|
| Parent waits ~17s/screenshot | Parent continues immediately |
| 5 screenshots = 89s blocked | 5 screenshots = ~0s blocked |
| Parent must stay alive | Work survives parent exit |
| Good for: immediate results | Good for: fire-and-forget |

## Usage

### CLI

```bash
# Fire-and-forget visual evidence capture
mentu visual-test cmt_xxx --async

# With options
mentu visual-test cmt_xxx --async --base-url https://staging.myapp.com

# Check status later
mentu spawn --status <command_id>

# Check if evidence exists
grep "visual-evidence" .mentu/ledger.jsonl | grep "cmt_xxx"
```

### From Parent Agent

```typescript
// Parent agent code
import { exec } from 'child_process';

// Fire and forget
exec('mentu visual-test cmt_abc123 --async', (error, stdout) => {
  if (!error) {
    console.log('Visual evidence spawned');
    // Continue with other work - don't wait
  }
});

// OR via API
await fetch(`${process.env.MENTU_API_URL}/bridge/spawn`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Proxy-Token': process.env.MENTU_PROXY_TOKEN
  },
  body: JSON.stringify({
    commitment_id: 'cmt_abc123',
    prompt: 'Execute visual evidence capture...',
    working_directory: '/path/to/repo',
    timeout_seconds: 600
  })
});
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          ASYNC FLOW                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Parent Agent                       VPS Infrastructure              │
│   ────────────                       ──────────────────              │
│                                                                      │
│   mentu visual-test --async                                          │
│        │                                                             │
│        ├─── POST /bridge/spawn ──►  mentu-proxy (Cloudflare)         │
│        │                                   │                         │
│        │                                   ▼                         │
│   [Returns immediately]             Supabase bridge_commands         │
│        │                                   │                         │
│   [Continue coding...]              ┌──────┴──────┐                 │
│        │                            │             │                  │
│        │                            ▼             ▼                  │
│   [Can exit safely]            ┌────────┐   ┌────────┐              │
│        ╳                       │ Beacon │   │ Bridge │              │
│                                │ (Rust) │   │ (Node) │              │
│                                └───┬────┘   └────────┘              │
│                                    │   Whichever claims first       │
│                                    ▼                                 │
│                              VPS Puppeteer MCP                       │
│                              Docker exec → Screenshot                │
│                                    │                                 │
│                                    ▼                                 │
│                              Supabase Storage                        │
│                              visual-evidence bucket                  │
│                                    │                                 │
│                                    ▼                                 │
│   ◄────────────────────────  mentu capture + annotate               │
│   (Evidence in ledger)                                               │
│                                                                      │
│   Current: Bridge (Node) running on VPS                             │
│   Future: Beacon (Rust/Tauri) native executor                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Performance

Based on testing with rashidazarang.com:

| Metric | Value |
|--------|-------|
| Per-screenshot average | ~17 seconds |
| 5 viewport captures | ~89 seconds total |
| Parent blocking time | ~0 seconds (async returns immediately) |
| File sizes | 1-8 MB per screenshot |

### Time Comparison

| Scenario | Sync Blocking | Async Non-Blocking |
|----------|---------------|-------------------|
| 1 screenshot | 17s wait | 0s wait |
| 3 screenshots | 51s wait | 0s wait |
| 5 screenshots | 85s wait | 0s wait |
| 10 screenshots | 170s wait | 0s wait |

## Files

### Agent Definition

`.claude/agents/visual-evidence-async.md` - Async agent specification

### Command

`src/commands/visual-test.ts` - Added `--async` flag for bridge spawning

### Technical Validator

`.claude/validators/technical.sh` - Detects visual evidence in ledger (no change needed - already checks ledger)

## Workflow Integration

### Standard Dual Triad Flow

```
1. Architect creates visual test spec
   /visual-test-spec "Dashboard feature"
   → Creates: docs/visual-tests/cmt_xxx-spec.yaml

2. Executor implements feature
   [coding work...]

3. Executor spawns async visual evidence
   mentu visual-test cmt_xxx --async
   → Returns immediately
   → Background: VPS captures screenshots

4. Executor continues other work
   [more coding...]

5. Later: Check evidence exists
   mentu show cmt_xxx --annotations
   # Should show: "Visual evidence captured: 3 screenshots"

6. Submit commitment
   mentu submit cmt_xxx --summary "Feature complete"
   # Technical validator checks visual evidence: PASS
```

### Parent Agent Example

```markdown
## Example: Parent Agent Delegation

I'm implementing a dashboard feature. The spec has 5 visual checkpoints.

Instead of blocking for ~85 seconds, I'll delegate:

1. Spawn async visual evidence:
   `mentu visual-test cmt_abc123 --async`

2. Continue implementing other parts of the feature...

3. Before submitting, verify evidence:
   `grep "visual-evidence" .mentu/ledger.jsonl | wc -l`
   # Should show: 5

4. Submit:
   `mentu submit cmt_abc123 --summary "Dashboard complete"`
```

## Evidence Detection

The Technical Validator detects visual evidence automatically:

```bash
# In .claude/validators/technical.sh

# Check if visual test spec exists
if [ -f "docs/visual-tests/${CMT_ID}-spec.yaml" ]; then
  # Search ledger for visual-evidence memories
  EVIDENCE_COUNT=$(grep "\"kind\":\"visual-evidence\"" .mentu/ledger.jsonl | \
    grep "nwhtjzgcbjuewuhapjua.supabase.co" | wc -l)

  if [ $EVIDENCE_COUNT -gt 0 ]; then
    visual_evidence=true  # PASS
  else
    visual_evidence=false # FAIL - spec exists but no evidence
  fi
fi
```

## Requirements

### Environment Variables

```bash
# Required for async spawn
export MENTU_API_URL="https://mentu-proxy.affihub.workers.dev"
export MENTU_PROXY_TOKEN="<token>"
```

### Infrastructure

- mentu-proxy (Cloudflare Worker) - API gateway
- Supabase `bridge_commands` table - Command queue
- Executor daemon (VPS):
  - **mentu-beacon** (Rust/Tauri) - Future, native
  - **mentu-bridge** (Node.js) - Current service
- Puppeteer MCP (Docker on VPS) - Screenshot capture
- Supabase visual-evidence bucket - Storage

## Error Handling

### Proxy Not Configured

```
Error: MENTU_API_URL and MENTU_PROXY_TOKEN required for async spawn
```

**Fix**: Set environment variables

### Spec Not Found

```
Error: Visual test spec not found at: docs/visual-tests/cmt_xxx-spec.yaml
```

**Fix**: Create spec first: `/visual-test-spec "Feature description"`

### Bridge Unreachable

```
Error: Async spawn failed: Connection refused
```

**Fix**: Check mentu-proxy and mentu-bridge status

## Best Practices

1. **Spawn early, check late** - Start async capture early, verify before submit
2. **Use staging URLs** - VPS cannot access localhost
3. **Set appropriate timeout** - Default 600s covers most cases
4. **Check evidence before submit** - Don't assume success
5. **Use annotations** - Commitment will be annotated when complete

## Comparison: Sync vs Async

| Feature | `mentu visual-test cmt_xxx` | `mentu visual-test cmt_xxx --async` |
|---------|----------------------------|-------------------------------------|
| Execution | Task tool subagent | mentu-bridge daemon |
| Blocking | Yes - parent waits | No - returns immediately |
| Survives exit | No - dies with parent | Yes - persistent |
| Result delivery | Immediate in output | Ledger + annotation |
| Use case | Need result now | Fire and forget |
| Cost | +1 session | +1 session |

## Conclusion

Async visual evidence capture enables efficient workflow where coding agents:
1. Delegate screenshot work to background execution
2. Continue coding without waiting
3. Verify evidence exists before submitting
4. Technical validator confirms visual proof

**Key benefit**: 5 screenshots take 85s to capture but 0s of blocking time.
