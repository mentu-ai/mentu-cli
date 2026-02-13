---
id: AUDIT-DocsPlatform-v1.0
type: audit
intent_ref: INTENT-DocsPlatform-v1.0
created: 2026-01-03
auditor: agent:claude-code
author_type: auditor
mentu:
  evidence: pending
---

# Audit: DocsPlatform

## Intent Summary

Build a documentation platform for Mentu that extends the existing landing page into a full documentation site with hierarchical navigation, search, and structured content. The platform should serve as the primary resource for users and developers to understand and adopt the commitment ledger protocol.

## Philosophy Alignment

| Dimension | Assessment | Rationale |
|-----------|------------|-----------|
| **Project Purpose** | ALIGNED | Documentation directly supports Mentu's mission of making commitments visible. A docs platform makes the protocol accessible, enabling adoption. |
| **Governance** | COMPLIANT | No governance violations. Platform is static content - no ledger modifications, no trust boundary crossings. |
| **Maintainer Approval** | LIKELY | Follows established pattern (landing page). Previous RESULT-LandingPage was approved. Natural next step in user journey. |

### Principle Alignment Check

| Genesis Principle | Status |
|-------------------|--------|
| `evidence-required` | N/A (docs platform doesn't modify commitments) |
| `lineage-preserved` | N/A (informational platform) |
| `append-only` | N/A (documentation is additive) |

## Technical Feasibility

### Architecture Support: YES

**Existing Foundation:**
- Landing page at `landing/` proves static HTML/CSS pattern works
- GitHub Pages workflow (`pages.yml`) already configured and functional
- 3,000+ lines of documentation content exists (API.md, CLI.md, Architecture.md, QUICKSTART.md)
- Minimalist CSS established as design system baseline

**Can Extend:**
- Same `landing/` deployment approach (or unified `docs/` output)
- CSS variables and grid system from landing page
- System font stack and color palette already defined

### Affected Components

| Component | Impact | Changes Required |
|-----------|--------|------------------|
| `landing/` | LOW | May become subdirectory or remain separate entry point |
| `.github/workflows/pages.yml` | MEDIUM | Extend to build/deploy docs platform |
| `docs/` | HIGH | Content reorganization for navigation hierarchy |
| `package.json` | MEDIUM | Add build scripts for docs (if SSG chosen) |

### Existing Patterns to Follow

1. **Minimalist static deployment** - No server, no database, GitHub Pages
2. **System fonts only** - No external font requests
3. **CSS Grid responsive layout** - Auto-fit columns pattern
4. **Semantic HTML5** - Proper heading hierarchy, accessibility
5. **GitHub Actions** - Modern pages deployment workflow

### Dependencies

**Required:**
- Markdown parser (if using generator)
- Syntax highlighter (Shiki or Prism) for code blocks
- CSS extension for sidebar/navigation layout

**Optional (based on scope decisions):**
- Static site generator (Astro, VitePress, or hand-crafted)
- Client-side search (Pagefind, Lunr)
- Dark mode toggle

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| **Scope Creep** | MEDIUM | Define v1.0 as navigation + core docs only. Search/dark mode can be v1.1. |
| **Breaking Changes** | LOW | Pure additive - landing page remains functional. |
| **Security** | LOW | Static site, no user input, no backend. |
| **Technical Debt** | MEDIUM | Choice of SSG affects long-term maintenance. Recommend Astro for balance. |
| **Reversibility** | HIGH | Static output can be regenerated from markdown sources. |

### Scope Containment Strategy

**In Scope for v1.0:**
- Left sidebar with hierarchical navigation
- Main content area with markdown rendering
- Right sidebar "On this page" TOC
- Syntax highlighting for code blocks
- Responsive design (mobile-friendly)
- GitHub Pages deployment

**Deferred to v1.1:**
- Search (Cmd+K)
- Dark mode toggle
- "Edit on GitHub" links
- Mermaid diagram rendering
- Version switching

## Effort Estimate

**Tier: T3**

**Rationale:**
- Multi-file implementation (navigation component, layout, build config)
- Content organization required (261 files → ~6 navigation sections)
- Build system configuration (SSG or HTML templates)
- Not T4 because single agent can complete in one session
- Not T2 because more complex than simple feature addition

**Breakdown:**
- Build system setup: ~20% effort
- Layout/CSS (sidebar, content area): ~25% effort
- Navigation structure: ~15% effort
- Content organization: ~25% effort
- Deployment & testing: ~15% effort

## Open Questions Resolution

The INTENT posed several questions. Here are audit recommendations:

| Question | Recommendation | Rationale |
|----------|----------------|-----------|
| SSG vs hand-crafted? | **Astro** | Minimal output, markdown-native, growing ecosystem. Matches minimalist philosophy while avoiding manual HTML maintenance. |
| Existing docs structure? | **Yes, reorganize** | CLI.md, API.md, Architecture.md, QUICKSTART.md form natural hierarchy. Process docs (INTENT, PRD, etc.) should be excluded from v1.0 public docs. |
| Search approach? | **Pagefind (deferred)** | Client-side, no backend required, excellent for static sites. Defer to v1.1. |
| Version handling? | **Single version for v1.0** | Protocol is at v1.0. Version switching adds complexity. Defer. |
| Community features? | **"Edit on GitHub" only** | Minimal community feature for v1.0. Feedback buttons deferred. |

## Verdict

**APPROVE**

## Rationale

1. **Clear alignment** - Documentation platform is natural extension of landing page, directly serves adoption goals
2. **Proven foundation** - Landing page implementation provides CSS/design baseline and deployment infrastructure
3. **Content exists** - 3,000+ lines of user-facing documentation ready to organize
4. **Bounded scope** - T3 effort with clear v1.0/v1.1 separation
5. **Low risk** - Static site, no backend, reversible, additive
6. **Technical feasibility** - All required technologies are standard and well-documented

## Conditions

Implementation MUST:

1. **Maintain landing page functionality** - Landing page remains accessible (as homepage or separate route)
2. **Use static deployment** - No server required, GitHub Pages compatible
3. **Follow established design language** - System fonts, minimalist palette, responsive grid
4. **Organize public-facing docs only** - Exclude process docs (INTENT, PRD, HANDOFF, RESULT) from navigation
5. **Support no-JavaScript reading** - Core content readable without JS (search can require JS)
6. **Define clear navigation hierarchy** - 5-6 top-level sections maximum

## Recommended Navigation Structure

Based on documentation audit:

```
Getting Started/
  - Quickstart (from QUICKSTART.md)
  - Installation
  - First Commitment

Core Concepts/
  - The Commitment Ledger (from Mentu-Spec-v0.md)
  - Memories & Commitments
  - The Three Rules
  - Glossary (from Glossary.md)

CLI Reference/
  - Overview
  - Core Commands (from CLI.md sections)
  - Triage Commands
  - Advanced Commands

API Reference/
  - Overview (from API.md)
  - Endpoints
  - Authentication
  - Error Codes

Architecture/
  - System Overview (from Architecture.md)
  - Ledger Format
  - Genesis Keys
  - Agent Protocol

Guides/
  - GitHub Integration
  - Claude Code Integration
  - Publishing Protocol
```

## Checkpoint Reference

- **Git SHA:** `1f62a3343ba36430907878add2a5d8fd21451b4b`
- **Audit Date:** 2026-01-03
- **Auditor:** agent:claude-code (author-type: auditor)

---

*This audit was performed using the /craft--architect protocol. The intent has been validated against project philosophy, technical feasibility, and risk profile.*
