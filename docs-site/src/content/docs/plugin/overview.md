---
title: "Plugin Overview"
description: "What mentu-autopilot adds to Claude Code: autonomous bug-fix pipelines, wave automation, and evidence-tracked fixes on top of the Mentu ledger."
---

## What is mentu-autopilot?

**mentu-autopilot** is a Claude Code plugin that adds an autonomous bug-fix pipeline on top of Mentu. It turns Claude Code from a general-purpose coding assistant into a self-directed bug-fixing agent that can triage, investigate, fix, verify, and ship patches — all while recording an immutable evidence chain in the Mentu commitment ledger.

## What it adds over raw MCP

Using the Mentu MCP server directly gives you tools to create and manage commitments. The plugin layers a complete automation framework on top:

| Capability | Raw MCP | With Plugin |
|---|---|---|
| Read/write commitments | Yes | Yes |
| Slash commands (`/triage`, `/fix`, `/run`) | No | Yes |
| Autonomous agents (planner, reviewer) | No | Yes |
| Wave-based batch automation | No | Yes |
| Git hook integration (stop hook for continuity) | No | Yes |
| 5-gate garbage filter | No | Yes |
| Tier-based complexity estimation | No | Yes |
| Evidence chain capture (builds, PRs, screenshots) | No | Yes |

## The Pipeline

Every bug fix follows the same six-stage pipeline, from raw report to merged PR:

```
Triage → Investigate → Fix → Build → Push + PR → Submit
```

### 1. Triage

Fetch open bug memories from the workspace and run them through a 5-gate garbage filter. Score survivors by severity, actionability, and domain match. Produce a ranked list of fixable tickets.

### 2. Investigate

For each triaged ticket, read the codebase to understand the root cause. Identify affected files, estimate complexity tier (T1/T2/T3), and produce a HANDOFF document describing the fix strategy.

### 3. Fix

Create a branch, apply the fix, and run the build to verify the change compiles. If the build fails, attempt a retry. Every mutation is captured as evidence on the Mentu commitment.

### 4. Build

Run the project's build command (`npm run build`, `cargo build`, etc.) and capture the result. A passing build is required evidence before proceeding.

### 5. Push + PR

Push the branch to the remote and open a pull request via `gh pr create`. The PR URL is captured as evidence on the commitment.

### 6. Submit

Close the Mentu commitment with a `pass` status and attach all collected evidence: commit hashes, build output, PR URL, and any validation screenshots.

## Evidence Chains

Everything is tracked. Each fix produces a commitment in the Mentu ledger with a full evidence chain:

```
commit → claim → evidence(progress) → evidence(build) → evidence(PR) → submit(pass|fail)
```

This means any agent or human can query Mentu and reconstruct the full history of a fix — what was attempted, what succeeded, what failed, and why — without needing access to local state files.

## Prerequisites

Before installing the plugin, make sure you have:

- **Claude Code** — the Anthropic CLI for Claude ([claude.ai/code](https://claude.ai/code))
- **Mentu workspace** — a workspace ID and API token (sign up at [mentu.ai](https://mentu.ai))
- **Node.js 18+** — required for the plugin runtime
- **git** — for branch creation and push operations
- **gh** (GitHub CLI) — for creating pull requests (`gh auth login` must be complete)

The plugin bundles `@mentu/mcp` automatically, so you do not need to install the MCP server separately.
