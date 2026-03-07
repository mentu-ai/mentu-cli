---
title: Claude Code Integration
description: Using Mentu with Claude Code
order: 2
---

## Overview

Mentu integrates with Claude Code to provide:
- Automatic commitment tracking
- Evidence capture for code changes
- Enforcement hooks for accountability

## Quick Start

### Initialize in Any Project

```bash
mentu init-claude
```

Creates hooks in `.claude/hooks/`.

### Check Status

```bash
mentu claude-status
```

## Environment Variables

```bash
export MENTU_API_URL="https://mentu-proxy.affihub.workers.dev"
export MENTU_PROXY_TOKEN="<token>"
export MENTU_WORKSPACE_ID="<workspace-id>"
export MENTU_ACTOR="agent:claude-code"
```

## Invocation Flags

### Basic

```bash
~/claude-code-app/run-claude.sh --dangerously-skip-permissions
```

### With Enforcement

```bash
~/claude-code-app/run-claude.sh \
  --dangerously-skip-permissions \
  --mentu-enforcer
```

### With Feature Development Workflow

```bash
~/claude-code-app/run-claude.sh \
  --dangerously-skip-permissions \
  --feature-dev
```

### Full Stack

```bash
~/claude-code-app/run-claude.sh \
  --dangerously-skip-permissions \
  --max-turns 100 \
  --mentu-enforcer \
  --feature-dev \
  "Read docs/HANDOFF-xxx.md and execute."
```

## Flags Reference

| Flag | Effect |
|------|--------|
| `--mentu-enforcer` | Blocks stop until commitments closed |
| `--feature-dev` | 7-phase structured workflow |

## Agent Workflow

When Claude runs with Mentu:

```bash
# 1. Capture task
mentu capture "Task: implement feature" \
  --kind task \
  --actor agent:claude-code

# 2. Create commitment
mentu commit "Deliver: working implementation" \
  --source mem_xxx \
  --actor agent:claude-code

# 3. Claim it
mentu claim cmt_xxx --actor agent:claude-code

# 4. Do the work...

# 5. Submit
mentu submit cmt_xxx \
  --summary "Implemented feature with tests" \
  --include-files \
  --actor agent:claude-code
```

## Hooks

### Session Start

Captures session beginning as observation.

### Post-Tool

Captures significant tool outputs as evidence.

### Enforcer

Prevents session stop until commitments resolved.

## Completion Contract

Define what "done" means in `.claude/completion.json`:

```json
{
  "required_files": ["src/feature.ts"],
  "checks": {
    "tsc": true,
    "build": true
  },
  "mentu": {
    "commitments": {
      "ids": ["cmt_xxx"],
      "require_closed": true
    }
  }
}
```

## Best Practices

1. **Always use actor** - Include `--actor agent:claude-code`
2. **Capture progress** - Log significant steps
3. **Submit with evidence** - Use `--include-files`
4. **Follow HANDOFF** - Read task document first
