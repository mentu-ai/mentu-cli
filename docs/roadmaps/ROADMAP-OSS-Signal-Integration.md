---
# ============================================================
# CANONICAL YAML FRONT MATTER
# ============================================================

# IDENTITY
id: ROADMAP-OSS-Signal-Integration
path: docs/roadmaps/ROADMAP-OSS-Signal-Integration.md
type: roadmap
intent: reference

# VERSIONING
version: "1.0"
created: 2026-01-01
last_updated: 2026-01-01

# RELATIONSHIPS
covers:
  - PRD-OSS-Signal-Integration-v1.0
  - PRD-OSS-Signal-Integration-v1.1 (future)
  - PRD-OSS-Signal-Integration-v1.2 (future)
---

# ROADMAP: OSS Signal Integration

## Overview

OSS Signal Integration enables autonomous maintenance of open source projects (starting with `airtable-mcp`) by integrating external signals into the Work Ledger and executing maintenance workflows via the Bridge daemon.

**Design principle**: Security first. Human approval for risky actions. Automate the boring parts, escalate the important ones.

---

## Versioned Pathway

| Version | Name | Scope | Trigger to Start |
|---------|------|-------|------------------|
| **v1.0** | Security Automation | GitHub security → auto-fix → PR → CI wait → submit | Now |
| **v1.1** | PR Review Automation | External PRs → local test → comment → submit | After v1.0 stable |
| **v1.2** | NPM/Smithery Signals | Poll NPM audit + Smithery stats → memories | After v1.1 stable |
| **v1.3** | Multi-Project Support | Multiple OSS projects with unified management | After patterns proven |
| **v2.0** | Autonomous Release | Auto-publish to NPM after human approval | After trust established |

---

## v1.0: Security Automation

**Status**: Active development

**Scope**: GitHub security advisory arrives → Bridge fixes → creates PR → waits for CI → submits for human review.

**Signal Flow**:
```
GitHub Dependabot Alert
        ↓
  /signals/github (mentu-proxy)
        ↓
  Memory: kind=github_security
        ↓
  Triage Rule: severity=critical|high → auto-commit
        ↓
  Commitment: affinity=bridge, project=airtable-mcp
        ↓
  Bridge wakes (Realtime)
        ↓
  Claims → npm audit fix → npm test → git push → gh pr create
        ↓
  Waits for GitHub Actions CI
        ↓
  Captures evidence (test results, CI status)
        ↓
  Submits for review (Tier 2)
        ↓
  Human approves → merge → closed
```

**Deliverables**:
- Extend mentu-proxy `/signals/github` for security advisories
- Add triage rules for security signals in genesis.key
- Implement security-fix workflow in Bridge
- Add GitHub Actions integration for CI monitoring

**What you get**:
- Security vulnerabilities auto-fixed within minutes
- Full audit trail of what was done
- Human approval before merge
- CI verification before submission

**What you don't get**:
- Auto-merge (human approval required)
- Auto-publish to NPM (too risky)
- Multi-project support

---

## v1.1: PR Review Automation

**Status**: Planned (trigger: v1.0 stable for 2 weeks)

**Scope**: External PRs → Bridge tests locally → comments results → submits review.

**Signal Flow**:
```
External PR Opened
        ↓
  /signals/github (mentu-proxy)
        ↓
  Memory: kind=github_pr
        ↓
  Triage Rule: action=opened → auto-commit
        ↓
  Commitment: "Review PR #123"
        ↓
  Bridge:
    git fetch origin pull/123/head:pr-123
    git checkout pr-123
    npm install && npm test && npm run lint && npm run build
        ↓
  Captures test results as evidence
        ↓
  Comments on PR with results (gh pr comment)
        ↓
  Submits for human review
```

**Features**:
- Automated local testing of PRs
- Automated comments with test results
- Human decides to merge or request changes

---

## v1.2: NPM/Smithery Signals

**Status**: Planned (trigger: v1.1 stable)

**Scope**: Scheduled polling of NPM and Smithery for security and metrics.

**New Signal Sources**:

| Source | Endpoint | Schedule | Data |
|--------|----------|----------|------|
| NPM Audit | npm audit --json | Daily | Vulnerability findings |
| NPM Stats | npm API | Weekly | Download counts |
| Smithery | Smithery API | Daily | Install stats, reviews |

**Implementation**:
- Add scheduler job for NPM/Smithery polling
- Transform poll results into memories
- Apply same triage rules as webhooks

---

## v1.3: Multi-Project Support

**Status**: Planned (trigger: patterns proven on airtable-mcp)

**Scope**: Extend to multiple OSS projects with unified management.

**Changes**:
- Project discovery via manifest.yaml
- Per-project triage rules
- Unified dashboard view in mentu-web
- Cross-project priority queue

**Projects to Add**:
- Future MCP servers
- Other OSS libraries

---

## v2.0: Autonomous Release

**Status**: Future (trigger: trust established over 3+ months)

**Scope**: Auto-publish to NPM after human approval of PR.

**Workflow**:
```
PR merged (by human)
        ↓
  Memory: kind=github_push, ref=main
        ↓
  Commitment: "Release ${version}"
        ↓
  Bridge:
    npm version patch
    npm publish
    gh release create
        ↓
  Submits evidence (published version, changelog)
```

**Safeguards**:
- Version bump is automatic (patch only)
- Human must approve release commit
- Rollback procedure documented

---

## Known Gaps

### 1. No GitHub Actions Workflow Yet

airtable-mcp has no `.github/workflows/` directory. Need to add:
- `ci.yml` for test/lint/build
- `release.yml` for NPM publish

**Action**: Create workflows before v1.0 goes live.

### 2. Smithery API Availability Unknown

Smithery may not have a public API for stats/reviews.

**Mitigation**: Start with NPM only. Add Smithery when API confirmed.

### 3. No Rollback Automation

If a fix breaks production, there's no automated rollback.

**Action**: Document manual rollback steps. Add automation in v1.3.

### 4. Single Machine Execution

Bridge runs on one machine. If machine is off, no execution.

**Mitigation**: Machine should be on during working hours. Add alerting for missed claims.

---

## Decisions Log

### Security First

**Decision**: Start with security automation, not convenience features.

**Rationale**: Security vulnerabilities have real-world impact. Fixing them quickly matters. Convenience features (dependency updates, formatting) can wait.

### Human Approval for Merge

**Decision**: Bridge creates PRs but cannot merge them.

**Rationale**: Even with CI passing, human review catches issues automation misses. Build trust over time. Maybe allow auto-merge for tier 1 (trivial) fixes later.

### Local Execution Only

**Decision**: Bridge executes locally, not via GitHub Actions.

**Rationale**: Local execution is faster (no queue), cheaper (no Actions minutes), and more flexible (can spawn Claude). GitHub Actions is for CI verification, not execution.

### Project-Specific Manifests

**Decision**: Each OSS project has its own `.mentu/manifest.yaml`.

**Rationale**: Projects have different structures, commands, and constraints. Manifest captures project-specific context that Bridge needs.

---

## No Decisions

| Feature | Status | Reason |
|---------|--------|--------|
| Auto-merge for any tier | Not in v1.0-v1.3 | Trust not established |
| Auto-publish to NPM | Not until v2.0 | High risk, needs human approval |
| Issue auto-response | Not planned | Low value, potential spam |
| Dependency update PRs | Deferred | Focus on security first |
| Performance benchmarking | Deferred | Metrics first |

---

## airtable-mcp Specific Notes

### Required Setup

1. **GitHub Webhook**: Configure webhook in repo settings
   - URL: `https://mentu-proxy.affihub.workers.dev/signals/github`
   - Events: Security advisories, Issues, Pull requests
   - Secret: Match `GITHUB_WEBHOOK_SECRET`

2. **Branch Protection**: Enable on `main`
   - Require PR reviews
   - Require status checks
   - No direct pushes

3. **GitHub Actions**: Create CI workflow
   ```yaml
   # .github/workflows/ci.yml
   name: CI
   on: [push, pull_request]
   jobs:
     test:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: '18'
         - run: npm install
         - run: npm test
         - run: npm run lint
         - run: npm run build
   ```

4. **Manifest**: Already created at `.mentu/manifest.yaml`

5. **Environment**: Bridge needs:
   - `GH_TOKEN` with repo access
   - `NPM_TOKEN` with publish access

### Execution Context

```yaml
# Captured in manifest.yaml
execution:
  working_directory: /Users/rashid/Desktop/Workspaces/projects/airtable-mcp
  github_actions: true
  can_push: true
  can_release: true
```

---

## Migration Notes

### Enabling for Existing Project

1. Create `.mentu/manifest.yaml` with project details
2. Add `.mentu/` to `.gitignore`
3. Configure GitHub webhook
4. Add triage rules to genesis.key
5. Test with low-severity signal first

### Adding New Projects

Same steps as above, plus:
- Update Workspaces CLAUDE.md with new project
- Add project to monitoring dashboard

---

*Security signals arrive. Fixes flow automatically. Humans review. OSS stays healthy.*
