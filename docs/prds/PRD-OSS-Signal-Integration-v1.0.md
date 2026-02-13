---
# ============================================================
# CANONICAL YAML FRONT MATTER
# ============================================================

# IDENTITY
id: PRD-OSS-Signal-Integration-v1.0
path: docs/prds/PRD-OSS-Signal-Integration-v1.0.md
type: prd
intent: reference

# VERSIONING
version: "1.0"
created: 2026-01-01
last_updated: 2026-01-01

# TIER
tier: T3

# RELATIONSHIPS
children:
  - HANDOFF-OSS-Signal-Integration-v1.0
dependencies:
  - PRD-Signal-Ingestion-v1.0
  - PRD-Temporal-Primitives-v1.0
  - PRD-Workspace-Meta-Layer-v1.0

# MENTU INTEGRATION
mentu:
  commitment: pending
  status: pending

# ROADMAP
roadmap: ROADMAP-OSS-Signal-Integration.md
---

# PRD: OSS Project Signal Integration v1.0

## Mission

Enable autonomous maintenance of open source projects by integrating signals from GitHub (Security, Issues), NPM (security advisories, stats), and Smithery (install metrics) into the Work Ledger. The Bridge daemon receives signals, claims work, executes fixes locally, pushes to GitHub, verifies CI passes, and submits for review.

**Target Project**: `airtable-mcp` — MCP server for Airtable, published on NPM and Smithery.

---

## Problem Statement

### Current State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│   TODAY: OSS maintenance is reactive and manual                             │
│                                                                              │
│   GitHub Security Alert → Email notification → Human reads email             │
│   → Human opens laptop → Human runs npm audit → Human fixes                  │
│   → Human tests → Human commits → Human pushes → Human monitors CI           │
│   → Human publishes to NPM → Human updates Smithery                          │
│                                                                              │
│   Problems:                                                                  │
│   • Alerts may sit unread for days                                          │
│   • Manual steps are error-prone                                            │
│   • No audit trail of what was done                                         │
│   • No visibility into package health metrics                               │
│   • External contributions (PRs) require manual testing                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Desired State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│   AFTER: OSS maintenance is proactive and autonomous                        │
│                                                                              │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                       │
│   │   GitHub    │   │    NPM      │   │  Smithery   │                       │
│   │  Security   │   │  Advisory   │   │   Metrics   │                       │
│   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘                       │
│          │                 │                 │                               │
│          ▼                 ▼                 ▼                               │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                        mentu-proxy                                   │   │
│   │   /signals/github  /signals/npm  /signals/smithery                  │   │
│   │   Verify signature, transform, capture                               │   │
│   └────────────────────────────┬────────────────────────────────────────┘   │
│                                │                                             │
│                                ▼                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                        Work Ledger                                   │   │
│   │   Memory: "Security alert: lodash < 4.17.21"                        │   │
│   │   Commitment: "Fix lodash vulnerability"                            │   │
│   │   Affinity: bridge, project: airtable-mcp                           │   │
│   └────────────────────────────┬────────────────────────────────────────┘   │
│                                │                                             │
│                                ▼                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                        Bridge Daemon                                 │   │
│   │   1. Claim commitment                                                │   │
│   │   2. cd /projects/airtable-mcp                                       │   │
│   │   3. npm audit fix                                                   │   │
│   │   4. npm test                                                        │   │
│   │   5. git commit -m "fix: update lodash"                             │   │
│   │   6. git push                                                        │   │
│   │   7. Wait for GitHub Actions CI                                      │   │
│   │   8. Capture evidence (test results, CI status)                     │   │
│   │   9. Submit for review                                               │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   Human reviews. Approves or requests changes. Agent iterates.              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Architecture

### Signal Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│   SIGNAL SOURCES                                                             │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                          GitHub                                      │   │
│   │   • security_advisory (Dependabot alerts)                           │   │
│   │   • issues (opened, labeled, commented)                              │   │
│   │   • pull_request (opened, synchronize, merged)                       │   │
│   │   • push (main branch, for release tracking)                        │   │
│   │   • release (published, for downstream awareness)                    │   │
│   │   • check_run (CI status changes)                                    │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                           NPM                                        │   │
│   │   • security_advisory (npm audit findings, polled)                   │   │
│   │   • download_stats (weekly, for popularity tracking)                 │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         Smithery                                     │   │
│   │   • install_stats (MCP installation count, polled)                   │   │
│   │   • review (user feedback, if API available)                         │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Execution Context

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│   BRIDGE EXECUTION CONTEXT FOR airtable-mcp                                 │
│                                                                              │
│   Local Directory: /Users/rashid/Desktop/Workspaces/projects/airtable-mcp  │
│                                                                              │
│   Available Tools:                                                          │
│   ├─ git (clone, checkout, commit, push, pr)                               │
│   ├─ npm (install, audit, test, build, publish)                            │
│   ├─ gh (GitHub CLI for PR creation, issue commenting)                     │
│   └─ claude (spawn sub-agents for complex tasks)                            │
│                                                                              │
│   GitHub Integration:                                                        │
│   ├─ Can push to origin (authenticated via gh)                             │
│   ├─ Can create PRs (gh pr create)                                          │
│   ├─ Can comment on issues (gh issue comment)                               │
│   ├─ Can trigger workflows (gh workflow run)                                │
│   └─ Can read workflow status (gh run view)                                 │
│                                                                              │
│   Constraints:                                                               │
│   ├─ Cannot push directly to main (branch protection)                       │
│   ├─ Must create PR for any changes                                         │
│   ├─ Must wait for CI to pass before merge                                  │
│   └─ Cannot publish to NPM without human approval (tier 3)                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Specification

### Signal Endpoints

Extend `mentu-proxy` with new signal handlers:

| Endpoint | Source | Trigger |
|----------|--------|---------|
| `POST /signals/github` | GitHub webhook | Push, PR, Issue, Security |
| `GET /signals/npm/audit` | NPM registry | Scheduled poll (daily) |
| `GET /signals/npm/stats` | NPM registry | Scheduled poll (weekly) |
| `GET /signals/smithery/stats` | Smithery API | Scheduled poll (daily) |

### Signal Types

```typescript
// Extended signal types for OSS project maintenance
interface OSSSignal {
  source: 'github' | 'npm' | 'smithery';
  type: string;
  project: string;           // e.g., "airtable-mcp"
  payload: unknown;
  source_key: string;        // Idempotency key
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
}

// GitHub Security Advisory
interface GitHubSecuritySignal extends OSSSignal {
  source: 'github';
  type: 'security_advisory';
  payload: {
    advisory_id: string;
    package: string;
    severity: string;
    vulnerable_versions: string;
    patched_versions: string;
    recommendation: string;
  };
}

// NPM Audit Finding
interface NPMAuditSignal extends OSSSignal {
  source: 'npm';
  type: 'security_advisory';
  payload: {
    advisory_id: number;
    module_name: string;
    severity: string;
    vulnerable_versions: string;
    recommendation: string;
  };
}

// Smithery Install Stats
interface SmitheryStatsSignal extends OSSSignal {
  source: 'smithery';
  type: 'install_stats';
  payload: {
    total_installs: number;
    weekly_installs: number;
    trend: 'up' | 'down' | 'stable';
  };
}
```

### Triage Rules

Rules in `.mentu/genesis.key` for automatic commitment creation:

```yaml
# In .mentu/genesis.key
triage:
  auto_commit:
    # Critical security: auto-commit and auto-claim
    - match:
        kind: github_security
        "meta.severity": [critical, high]
      action:
        op: commit
        body: "FIX SECURITY: ${body}"
        meta:
          affinity: bridge
          project: "${meta.project}"
          tier: tier_2
          auto_claim: true

    # Medium/low security: auto-commit, manual claim
    - match:
        kind: github_security
        "meta.severity": [medium, low]
      action:
        op: commit
        body: "Security: ${body}"
        meta:
          affinity: bridge
          project: "${meta.project}"
          tier: tier_2

    # PRs from external contributors: auto-commit for review
    - match:
        kind: github_pr
        "meta.action": opened
      action:
        op: commit
        body: "Review PR #${meta.pr_number}: ${body}"
        meta:
          affinity: bridge
          project: "${meta.project}"
          tier: tier_2

    # Issues with bug label: auto-commit
    - match:
        kind: github_issue
        "meta.labels": contains "bug"
      action:
        op: commit
        body: "Investigate bug: ${body}"
        meta:
          affinity: bridge
          project: "${meta.project}"
          tier: tier_2

    # NPM audit findings: auto-commit
    - match:
        kind: npm_audit
      action:
        op: commit
        body: "Fix npm vulnerability: ${body}"
        meta:
          affinity: bridge
          project: "${meta.project}"
          tier: tier_2
```

### Execution Workflows

Bridge daemon workflows for OSS maintenance:

```yaml
# In manifest or genesis.key
workflows:
  security_fix:
    name: Fix Security Vulnerability
    trigger:
      commitment:
        kind: security
        affinity: bridge
    steps:
      - name: checkout
        command: git checkout -b fix/security-${id}

      - name: audit
        command: npm audit

      - name: fix
        command: npm audit fix
        on_fail: escalate  # Human reviews if auto-fix fails

      - name: test
        command: npm test
        on_fail: block  # Cannot proceed if tests fail

      - name: lint
        command: npm run lint
        on_fail: skip  # Lint failures don't block

      - name: commit
        command: |
          git add -A
          git commit -m "fix: ${commitment.body}"

      - name: push
        command: git push -u origin fix/security-${id}

      - name: create_pr
        command: |
          gh pr create \
            --title "fix: ${commitment.body}" \
            --body "Automated security fix.

            Mentu: ${commitment.id}"

      - name: wait_ci
        wait_for: github_check_run
        timeout: 600  # 10 minutes
        on_timeout: escalate

      - name: evidence
        capture: |
          Tests passed. CI status: ${ci.status}.
          PR: ${pr.url}
        kind: evidence

      - name: submit
        command: mentu submit ${commitment.id} --summary "Security fix ready for review"

  pr_review:
    name: Review External PR
    trigger:
      commitment:
        kind: pr_review
        affinity: bridge
    steps:
      - name: fetch
        command: git fetch origin pull/${meta.pr_number}/head:pr-${meta.pr_number}

      - name: checkout
        command: git checkout pr-${meta.pr_number}

      - name: install
        command: npm install

      - name: test
        command: npm test
        capture_output: true

      - name: lint
        command: npm run lint
        capture_output: true

      - name: build
        command: npm run build
        capture_output: true

      - name: evidence
        capture: |
          PR #${meta.pr_number} tested locally.
          Tests: ${test.status}
          Lint: ${lint.status}
          Build: ${build.status}
        kind: evidence

      - name: comment
        command: |
          gh pr comment ${meta.pr_number} --body "
          Automated review by Mentu:

          - Tests: ${test.status}
          - Lint: ${lint.status}
          - Build: ${build.status}

          ${test.output | truncate 500}
          "

      - name: submit
        command: mentu submit ${commitment.id} --summary "PR review complete"
```

---

## Implementation

### Deliverables

| File | Location | Purpose |
|------|----------|---------|
| `src/signals-oss.ts` | mentu-proxy | NPM/Smithery signal handlers |
| `src/index.ts` (modified) | mentu-proxy | Add new signal routes |
| `src/workflows/security-fix.ts` | mentu-bridge | Security fix workflow |
| `src/workflows/pr-review.ts` | mentu-bridge | PR review workflow |
| `src/github-actions.ts` | mentu-bridge | GitHub Actions integration |
| `.mentu/manifest.yaml` | airtable-mcp | Project manifest with signals |
| `.mentu/genesis.key` (modified) | mentu-ai | Triage rules for OSS signals |

### Build Order

1. **Signal Handlers**: Extend mentu-proxy with NPM/Smithery polling
2. **Triage Rules**: Add OSS-specific rules to genesis.key
3. **Workflow Engine**: Implement step-based execution in Bridge
4. **GitHub Integration**: Add gh CLI integration for PRs/comments
5. **CI Monitoring**: Wait for GitHub Actions and capture status
6. **Evidence Collection**: Capture test results, CI status as evidence

### Environment Variables

| Variable | Location | Purpose |
|----------|----------|---------|
| `GITHUB_WEBHOOK_SECRET` | Cloudflare secrets | Existing, for GitHub webhooks |
| `NPM_TOKEN` | Cloudflare secrets | NPM API access for audit |
| `SMITHERY_API_KEY` | Cloudflare secrets | Smithery API access (if available) |
| `GH_TOKEN` | Bridge env | GitHub CLI authentication |

---

## Completion Contract

```json
{
  "version": "3.0",
  "schema": "single-agent",
  "agent": {
    "name": "OSS Signal Integration v1.0",
    "tier": "T3",
    "required_files": [
      "mentu-proxy/src/signals-oss.ts",
      "mentu-bridge/src/workflows/security-fix.ts",
      "mentu-bridge/src/workflows/pr-review.ts",
      "mentu-bridge/src/github-actions.ts",
      "projects/airtable-mcp/.mentu/manifest.yaml"
    ],
    "checks": {
      "tsc": true,
      "build": true
    },
    "prerequisites": {
      "secrets": ["NPM_TOKEN", "GH_TOKEN"],
      "verify": "gh auth status && npm whoami"
    },
    "deployment": {
      "command": "npx wrangler deploy",
      "verify": "curl -s https://mentu-proxy.affihub.workers.dev/health"
    },
    "mentu": {
      "enabled": true,
      "actor": "agent:claude-oss-integration"
    },
    "max_iterations": 100
  }
}
```

---

## Success Criteria

### Functional

- [ ] GitHub security alerts create memories with `kind: github_security`
- [ ] NPM audit findings create memories with `kind: npm_audit`
- [ ] Triage rules auto-create commitments for security issues
- [ ] Bridge claims security commitments and executes fix workflow
- [ ] Fixes are committed and pushed as PRs
- [ ] CI status is monitored and captured as evidence
- [ ] Human can approve or request changes on submitted fixes

### Quality

- [ ] All workflows are idempotent (can re-run safely)
- [ ] Failures are captured and escalated appropriately
- [ ] No hardcoded paths (project paths from manifest)
- [ ] Secrets are not logged

### Integration

- [ ] Works with existing Signal Ingestion v1.0 infrastructure
- [ ] Works with existing Bridge daemon
- [ ] Works with existing Temporal Primitives (for scheduling)
- [ ] Works with Workspace Meta-Layer (project discovery)

---

## Security Considerations

### Permissions

| Permission | Required For | Granted To |
|------------|--------------|------------|
| Push to repo | Creating fix PRs | Bridge daemon (via GH_TOKEN) |
| Create PRs | Submitting fixes | Bridge daemon (via GH_TOKEN) |
| Comment on issues | Automated reviews | Bridge daemon (via GH_TOKEN) |
| Read security alerts | Signal ingestion | GitHub webhook (via secret) |
| npm audit | Vulnerability scanning | Bridge daemon (via NPM_TOKEN) |

### Constraints

- Bridge CANNOT push directly to `main` (branch protection enforced)
- Bridge CANNOT merge PRs (human approval required)
- Bridge CANNOT publish to NPM without human approval (tier 3 protection)
- All changes go through PR workflow

---

## Not In Scope (v1.0)

| Feature | Deferred To | Reason |
|---------|-------------|--------|
| Automatic NPM publish | v1.1 | Too risky without human review |
| Smithery auto-update | v1.1 | API availability unclear |
| Multi-project coordination | v1.2 | Start with single project |
| Dependency update PRs | v1.2 | Focus on security first |
| Performance monitoring | v1.3 | Metrics before optimization |

---

## Verification Commands

```bash
# 1. Configure GitHub webhook for airtable-mcp
# Repository settings → Webhooks → Add webhook
# Payload URL: https://mentu-proxy.affihub.workers.dev/signals/github
# Content type: application/json
# Secret: $GITHUB_WEBHOOK_SECRET
# Events: Security advisories, Issues, Pull requests, Pushes

# 2. Verify signal arrives
mentu list memories --kind github_security

# 3. Verify commitment created
mentu list commitments --state open --affinity bridge

# 4. Check Bridge execution
mentu show cmt_xxx --with-annotations

# 5. Verify PR created
gh pr list --repo rashidazarang/airtable-mcp

# 6. Check CI status
gh run list --repo rashidazarang/airtable-mcp

# 7. Approve and merge
mentu approve cmt_xxx
```

---

## References

- `PRD-Signal-Ingestion-v1.0.md`: Base signal infrastructure
- `ROADMAP-Signal-Ingestion.md`: Signal ingestion evolution
- `PRD-Temporal-Primitives-v1.0.md`: Scheduling and wait conditions
- `PRD-Workspace-Meta-Layer-v1.0.md`: Project manifest structure
- `projects/airtable-mcp/.mentu/manifest.yaml`: Target project manifest

---

*Signals arrive. Commitments form. Fixes flow. OSS thrives.*
