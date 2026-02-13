---
# ============================================================
# CANONICAL YAML FRONT MATTER
# ============================================================

# IDENTITY
id: ROADMAP-Signal-Ingestion
path: docs/ROADMAP-Signal-Ingestion.md
type: roadmap
intent: reference

# VERSIONING
version: "1.0"
created: 2026-01-01
last_updated: 2026-01-01

# RELATIONSHIPS
covers:
  - PRD-Signal-Ingestion-v1.0
  - PRD-Signal-Ingestion-v1.1 (future)
  - PRD-Signal-Ingestion-v1.2 (future)
  - PRD-Signal-Ingestion-v1.3 (future)
---

# ROADMAP: Signal Ingestion

## Overview

Signal Ingestion enables external events to become memories in the Mentu ledger. This roadmap traces the versioned pathway from simple webhook capture to reliable autonomous execution.

**Design principle**: Start with capture. Let patterns emerge from manual triage. Automate only what proves repetitive.

---

## Versioned Pathway

| Version | Name | Scope | Trigger to Start |
|---------|------|-------|------------------|
| **v1.0** | Signal Capture | Webhook → Memory | Now |
| **v1.1** | Triage Rules | Memory → Commitment via Genesis Key rules | After manual triage patterns emerge |
| **v1.2** | Reactive Execution | Commitment → Claude via Realtime event (not polling) | After triage rules prove stable |
| **v1.3** | Reliability | Claim timeouts, retry backoff, metrics, alerting | After production incidents reveal gaps |

---

## v1.0: Signal Capture

**Status**: Active development

**Scope**: GitHub webhook arrives at proxy, HMAC verified, transformed to memory, captured to ledger with idempotent source_key.

**Deliverables**:
- `mentu-proxy/src/signals.ts` — HMAC verification, event transforms
- `mentu-proxy/src/index.ts` — `/signals/github` route

**What you get**:
- External events become permanent records
- Query by kind: `mentu list memories --kind github_push`
- Manual triage: `mentu commit "Run CI" --source mem_xxx`

**What you don't get**:
- Automatic commitment creation
- Automatic execution
- Triage rules

**Documents**:
- `PRD-Signal-Ingestion-v1.0.md`
- `HANDOFF-Signal-Ingestion-v1.0.md`
- `PROMPT-Signal-Ingestion-v1.0.md`

---

## v1.1: Triage Rules

**Status**: Future (trigger: manual triage becomes repetitive)

**Scope**: Define rules in Genesis Key that automatically create commitments from signal memories.

**Trigger to start**: When you've manually triaged the same signal type into the same commitment template 10+ times.

**Architecture decision**: Rules live in Genesis Key (`.mentu/genesis.key`). Triage rules are governance—they answer "what signals become obligations." Governance belongs with the constitution, not scattered in operational config.

**Example** (not yet implemented):

```yaml
# .mentu/genesis.key
triage:
  auto_commit:
    - match:
        kind: github_push
        "meta.ref": refs/heads/main
      action:
        op: commit
        body: "Run CI for push: ${body}"
        meta:
          affinity: bridge
```

**Open questions**:
- Where does the rule engine execute? (Proxy? Edge function? Bridge?)
- Pattern matching syntax (JSONPath? Simple key matching?)
- Rule ordering and conflict resolution
- Testing/dry-run mode for rules

---

## v1.2: Reactive Execution

**Status**: Future (trigger: triage rules prove stable)

**Scope**: Bridge daemon wakes on Supabase Realtime event when commitment with `affinity: bridge` is created. Claims, builds rich prompt, spawns Claude, monitors completion.

**Architecture decision**: Reactive (push), not polling (pull). Bridge subscribes to commitment creation events. No wasted cycles. No polling interval. Wake on signal, execute, sleep.

```
Commitment Created (affinity=bridge)
        ↓
   Supabase Realtime
        ↓
   Bridge wakes
        ↓
   Claims → Executes → Closes
        ↓
   Bridge sleeps
```

**Key components** (not yet built):
- `mentu-bridge/src/reactive-executor.ts` — Realtime subscription handler
- `mentu-bridge/src/prompt-builder.ts` — Rich context prompt construction
- Failure handling: capture → annotate → release

**Cost consideration**: Every execution spawns Claude. At ~$0.50-3.00 per session, this is expensive at scale. Acceptable at 100-200/day. Revisit if volume grows.

---

## v1.3: Reliability

**Status**: Future (trigger: production incidents reveal gaps)

**Scope**: Hardening for production operation.

**Features**:

| Feature | Description |
|---------|-------------|
| Claim timeouts | If claimed commitment not closed within N minutes, auto-release |
| Retry with backoff | Exponential backoff for failed executions (max 3 retries) |
| Circuit breaker | If same signal type fails repeatedly, pause triage rule |
| Metrics | Execution count, success rate, latency percentiles |
| Alerting | Webhook to Slack/email when things break |
| Health endpoint | `/health` on Bridge for monitoring |

**When to start**: After a production incident where:
- Commitment orphaned due to crash
- Infinite retry loop burned credits
- Silent failure went unnoticed for hours

Document the incident. Build the fix.

---

## Known Gaps

Issues identified during design that are explicitly deferred:

### 1. Triage Rules Need Specification

The v1.1 triage rules are described by example YAML, but no specification exists for:
- Rule engine location (proxy/edge/bridge)
- Pattern matching syntax
- Variable interpolation (`${body}`, `${meta.repo}`)
- Rule validation and testing

**Action**: Create `PRD-Triage-Rules-Engine-v1.0.md` before implementing v1.1.

### 2. "Always Spawn Claude" Has Cost Implications

Every signal that becomes a commitment via triage rules, then gets bridge affinity, spawns Claude. At scale:
- 50 signals/day × $1/session = $50/day = $1,500/month

This is fine for personal use (100-200/day). Not fine for teams or high-volume repos.

**Mitigation options** (for future):
- Tier signals: some trigger Claude, some trigger bash scripts
- Cost quotas: stop processing after $X/day
- Human approval gate for expensive executions

### 3. No Retry/Backoff/Circuit-Breaker

Failure handling in v1.2 is: capture failure → annotate → release. Nothing prevents:
- Infinite retry loops
- Repeated failures burning credits
- Same bad signal causing repeated failures

**Action**: Implement in v1.3 after real failures occur.

### 4. No Observability Beyond Logs

Bridge uses `console.log`. No:
- Structured logging
- Metrics (Prometheus/CloudWatch)
- Alerting (PagerDuty/Slack)
- Health checks

**Action**: Add in v1.3 when running headlessly becomes normal.

### 5. Crash During Execution Orphans Claims

If Bridge crashes after claiming but before closing:
- Commitment stuck in `claimed` state
- No other executor can pick it up
- Manual intervention required

**Action**: Add claim timeout in v1.3. Auto-release after N minutes of no progress.

### 6. Webhook Loss During Proxy Downtime

If Cloudflare Worker is down when GitHub fires webhook:
- GitHub retries for a few hours
- If all retries exhausted, event lost

At current scale, this is theoretical. Cloudflare has excellent uptime. GitHub retries aggressively.

**Action**: Accept risk for v1.0-v1.2. Add queue (Cloudflare Queue) in v1.3 if needed.

---

## Decisions Log

Design decisions made during Signal Ingestion development:

### Polling Rejected

**Decision**: Bridge uses reactive model (Supabase Realtime events), not polling.

**Rationale**: At 100-200 signals/day, a 60-second poll loop runs 1,440 times/day to find maybe 10 commitments. Wasteful. Reactive model: Bridge sleeps until tapped.

**Trade-off**: Requires Supabase Realtime to be reliable. If Realtime has issues, Bridge doesn't wake.

### Triage Rules in Genesis Key

**Decision**: Triage rules live in `.mentu/genesis.key`, not Supabase or Bridge config.

**Rationale**: Triage rules are governance. They answer: "what signals become obligations." That's constitutional, not operational. Genesis Key already holds governance (permissions, constraints). Adding triage rules keeps governance co-located, version-controlled, auditable.

**Trade-off**: Cannot update rules without code deploy. Good for stability, bad for experimentation.

### Queue Deferred

**Decision**: No message queue between proxy and Mentu API in v1.0.

**Rationale**: Queue (SQS, Redis, Cloudflare Queue) adds infrastructure, cost, and failure modes. At current scale, webhook loss during proxy downtime is rare enough to accept.

**Trigger to revisit**: If webhook loss causes material impact.

### Execution Deferred

**Decision**: No automatic execution in v1.0. Manual triage only.

**Rationale**: Premature automation encodes wrong patterns. Manual triage for first weeks/months builds understanding of what signals actually matter. Automation follows pattern recognition.

**Trigger to revisit**: When same signal type → same commitment template happens 10+ times.

### GitHub Only

**Decision**: Only GitHub webhooks in v1.0. No Slack, Email, or other sources.

**Rationale**: GitHub is the primary signal source for development work. Start narrow, expand when needed.

**Trigger to add**: When non-GitHub events become frequent enough to warrant capture.

### Serial Execution

**Decision**: Bridge executes one commitment at a time.

**Rationale**: At 100-200/day, parallel execution adds complexity without benefit. Serial is simpler, easier to debug, and sufficient.

**Trigger to revisit**: When queue depth regularly exceeds 10 commitments.

---

## No Decisions

Things we explicitly chose NOT to do:

| Feature | Status | Reason |
|---------|--------|--------|
| Slack signals | Not in v1.0+ | GitHub is primary source. Add when needed. |
| Email signals | Not in v1.0+ | Same. |
| Custom prompt templates | Hardcoded | One template works until patterns diverge. |
| Cross-workspace federation | Not planned | Single workspace, single user. |
| Parallel execution | Not in v1.0-v1.2 | Serial sufficient for current scale. |
| Webhook replay | Not planned | GitHub retries handle transient failures. |
| Rate limiting | Not in v1.0 | Trust GitHub's rate limiting. Add if abused. |
| Multi-tenant | Not planned | Personal tool, not SaaS. |

---

## Migration Notes

When upgrading between versions:

### v1.0 → v1.1

- Add `triage` section to `.mentu/genesis.key`
- Deploy triage rule engine (location TBD)
- Existing memories unaffected
- New signals matched against rules

### v1.1 → v1.2

- Deploy updated Bridge with reactive executor
- Add `SUPABASE_REALTIME_*` config to Bridge
- Existing commitments with `affinity: bridge` will be picked up
- Test with single low-risk commitment first

### v1.2 → v1.3

- Add claim timeout config to Bridge
- Deploy health endpoint
- Configure monitoring (Prometheus/CloudWatch)
- Set up alerting (Slack webhook)
- Backfill metrics for baseline

---

## Template Note

This roadmap structure should become standard for all Mentu modules:

1. **Versioned pathway** — What's in each version, trigger to start
2. **Known gaps** — Issues identified but deferred
3. **Decisions log** — Why we chose what we chose
4. **No decisions** — What we explicitly didn't do
5. **Migration notes** — How to upgrade between versions

Copy this structure when creating roadmaps for other features.

---

*Capture first. Patterns emerge. Automation follows. Reliability hardens.*
