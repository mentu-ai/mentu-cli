# Integration Status

Last updated: 2026-01-02

## Signal Integrations

| Integration | Status | Handler Location | Notes |
|-------------|--------|------------------|-------|
| **GitHub** | ACTIVE | `mentu-proxy/src/signals.ts` | Webhooks for push, PR, issues |
| **Notion** | PARTIAL | `mentu-proxy/src/signals.ts` | Transform defined, not deployed |
| **NuTalk** | SCAFFOLDED | N/A | API docs captured, no handler |

## CI/CD Integrations

| Integration | Status | Handler Location | Notes |
|-------------|--------|------------------|-------|
| **GitHub Actions** | ACTIVE | `integrations/github-actions/` | Claude agent workflow |
| **GitLab CI** | SCAFFOLDED | `integrations/gitlab-ci/` | Template only |
| **Cloudflare** | ACTIVE | `integrations/cloudflare/` | Worker deployment |

## Status Definitions

| Status | Meaning |
|--------|---------|
| **ACTIVE** | Fully implemented and deployed |
| **PARTIAL** | Code exists but not fully deployed/tested |
| **SCAFFOLDED** | Documentation/templates only, no implementation |
| **PLANNED** | On roadmap, no work started |
| **DEPRECATED** | Was active, now retired |

---

## Active Pipeline (Include in Traces)

Only these integrations should appear in active pipeline documentation:

1. **GitHub Webhooks** → mentu-proxy → Memory → Commitment → Bridge → Closure
2. **GitHub Actions** → Claude agent → Mentu-tracked work

## Inactive (Exclude from Traces)

These are scaffolded for future implementation:

1. **NuTalk** (Voice) - API documented, webhook handler not implemented
2. **Notion** - Transform defined, not connected to triage
3. **GitLab CI** - Template exists, not tested

---

*Keep this file updated as integrations move between states.*
