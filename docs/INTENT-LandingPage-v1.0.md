---
id: INTENT-LandingPage-v1.0
type: intent
origin: architect
created: 2026-01-03
architect:
  actor: agent:claude-architect
  session: workspaces-hub
  context: Strategic landing page for mentu-ai project
---

# Strategic Intent: Mentu Landing Page

## What

Build a sophisticated, minimalist landing page for Mentu that communicates the core value proposition of traceable work through commitment ledgers. The page should feel premium, technical yet approachable, and convey trust through visual restraint.

## Why

Mentu needs a public-facing presence that:
- Establishes credibility with developers and technical audiences
- Explains the commitment ledger concept clearly
- Differentiates from typical task/project management tools
- Creates a pathway to adoption (protocol documentation, getting started)

The landing page is the first impression. It must communicate sophistication without complexity, power without clutter.

## Visual Direction

The aesthetic should evoke:
- **Precision**: Clean lines, deliberate spacing, nothing superfluous
- **Trust**: White space, legibility, professional restraint
- **Technical depth**: Code snippets, architectural hints, protocol language
- **Timelessness**: Avoid trends, favor classic typography and composition

Reference characteristics (from provided examples):
- Predominantly white/light background with dark typography
- Large, confident headlines (serif or weighted sans-serif)
- Subtle rounded cards for feature groupings
- Code blocks with tasteful syntax highlighting
- ASCII-style diagrams for architecture visualization
- Generous padding and breathing room
- Single accent color used sparingly

## Content Structure

### Hero Section
**Headline**: "Intelligence that moves across time, devices, and contexts."

**Subtext**: "Mentu keeps work traceable with a simple protocol and an append-only commitment ledger, so every promise has an origin and every closure has proof."

### Definition Section
**What is a commitment ledger?**

"A commitment ledger is an append-only record that links observations (memories) to commitments, and commitments to evidence, so accountability is reconstructable."

### Pillars Section (3 cards)

1. **Carry context**
   Move across devices and threads without losing continuity

2. **Make intent explicit**
   Commitments are named, owned, and reviewable

3. **Close with proof**
   Done means evidence, not a checkbox

### Tagline
"Traceable work for humans and agents."

### Call to Action
- Primary: "Start now" (prominent button)
- Secondary: "Read the protocol" (text link)

## Constraints

- Must NOT require JavaScript for core content visibility
- Must NOT use heavy animations that distract from content
- Must NOT include pricing, sign-up forms, or marketing fluff in v1.0
- Must remain accessible (WCAG AA minimum)
- Must be responsive (mobile-first is acceptable)
- Must load fast (no heavy frameworks, no large images)

## Expected Outcome

A single-page landing that:
- Loads in under 2 seconds on 3G
- Scores 90+ on Lighthouse performance
- Communicates what Mentu is within 10 seconds of viewing
- Provides clear next steps for interested visitors
- Can be deployed as static HTML or within the existing mentu-ai documentation

## Open Questions

1. Should the "Start now" CTA link to documentation, a CLI install command, or a demo?
2. Should there be a live code example showing the ledger in action?
3. Is this a standalone page or integrated into existing mentu-ai docs site?
4. What domain will this live on? (mentu.dev, mentu-ai.github.io, etc.)

---

*This intent was crafted at the Workspaces hub level for execution within mentu-ai.*
