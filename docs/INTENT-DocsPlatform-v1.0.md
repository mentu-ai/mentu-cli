---
# ============================================================
# CANONICAL YAML FRONT MATTER
# ============================================================

# IDENTITY
id: INTENT-DocsPlatform-v1.0
path: docs/INTENT-DocsPlatform-v1.0.md
type: intent
intent: reference

# VERSIONING
version: "1.0"
created: 2026-01-03
last_updated: 2026-01-03

# ARCHITECT IDENTITY
architect:
  actor: agent:claude-architect
  session: landing-page-followup
  context: conversation

# TIER HINT
tier_hint: T3

# MENTU INTEGRATION
mentu:
  commitment: pending
  status: awaiting_audit
---

# Strategic Intent: DocsPlatform

> **Mode**: Architect
>
> You lack local filesystem access. Produce strategic intent only.
> State what and why. Do not specify file paths, schemas, or code.
> A local Leading Agent will audit and implement.

---

## What

Build a documentation platform for Mentu that serves as the primary resource for users and developers to understand and adopt the commitment ledger protocol. The platform should be centered around the existing landing page, extending it into a full documentation site with navigation, search, and structured content organization.

The documentation platform should follow the design patterns of modern developer documentation sites like Vibe Kanban's docs - featuring a left sidebar for hierarchical navigation, a main content area for documentation, and a right sidebar showing the current page's table of contents.

---

## Why

The landing page communicates WHAT Mentu is, but users need a place to learn HOW to use it. Currently, documentation exists as scattered markdown files in the repository. A unified documentation platform will:

1. **Lower adoption friction** - New users can self-serve through structured guides
2. **Establish credibility** - Professional documentation signals project maturity
3. **Reduce support burden** - Comprehensive docs prevent repetitive questions
4. **Enable community growth** - Developers can contribute without extensive onboarding

The landing page creates interest; the docs platform converts interest into adoption.

---

## Constraints

- Must integrate seamlessly with the existing landing page at the same domain
- Must work as a static site deployable to GitHub Pages (no server required)
- Must maintain the same visual language as the landing page (minimalist, white background, dark typography)
- Must render markdown content without requiring a build step for content updates
- Must be fully functional without JavaScript for core content reading
- Must not require a database or external services for core functionality
- Must support dark mode toggle (matching modern documentation expectations)
- Must load quickly (under 2 seconds on 3G connection)

---

## Expected Outcome

A visitor to mentu.dev (or wherever deployed) can:

1. **Navigate** - Use the left sidebar to browse hierarchical documentation sections (Getting Started, Core Concepts, CLI Reference, API Reference, Guides)
2. **Search** - Find relevant documentation using keyboard shortcut (Cmd+K) or search icon
3. **Orient** - See their current location via breadcrumbs and sidebar highlighting
4. **Scan** - Use the right "On this page" sidebar to jump to sections within long documents
5. **Toggle** - Switch between light and dark modes with preference persistence
6. **Access** - Click through to GitHub repository and "Get Started" CTA
7. **Read** - Consume documentation with proper code syntax highlighting, tables, and diagrams

The platform should feel as polished as Stripe's docs, Tailwind's docs, or Vibe Kanban's docs.

---

## Open Questions

- Should the documentation platform use a static site generator (like Astro, Next.js static export, or VitePress) or be hand-crafted HTML/CSS/JS like the landing page?
- Is there an existing documentation structure in the repository that should inform the navigation hierarchy?
- Should the search be client-side (Pagefind, Lunr) or use a service (Algolia DocSearch)?
- How should versioning be handled if protocol versions diverge?
- Should there be community features (edit on GitHub links, feedback buttons)?

---

## Context

This intent follows the successful implementation of the Mentu landing page (RESULT-LandingPage-v1.0). The landing page established the visual identity and core messaging. This platform extends that foundation into a comprehensive documentation experience.

The target audience includes:
- **New users** exploring what Mentu can do
- **Developers** integrating Mentu into their workflows
- **Agent builders** implementing the Mentu protocol
- **Contributors** understanding the codebase

Reference implementation for visual/functional parity: Vibe Kanban documentation site (https://vibe-kanban.com/docs or similar).

---

## Routing Hints

```yaml
priority: normal

tags:
  - documentation
  - frontend
  - static-site

target_repo: mentu-ai

ci_integration:
  github_actions: true
  auto_pr: false
```

---

## For the Leading Agent

When you receive this INTENT document:

1. **Establish checkpoint** (git + Claude Code)
2. **Audit** using `/craft--architect` protocol
3. **Capture evidence** of your audit findings
4. **Decide**: APPROVE / REJECT / REQUEST_CLARIFICATION
5. **If approved**: Execute `/craft DocsPlatform-v1.0` to create full chain

**You are the gatekeeper. Validate before committing.**

---

*This intent was created by an Architect agent without local filesystem access. It represents strategic direction, not implementation specification.*
