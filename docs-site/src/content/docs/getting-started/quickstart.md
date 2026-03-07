---
title: Quickstart
description: Get started with Mentu in 5 minutes
order: 1
---

## Install

```bash
npm install -g mentu
```

## Initialize

```bash
cd your-project
mentu init
```

This creates a `.mentu/` directory with:
- `ledger.jsonl` - Your append-only commitment ledger
- `config.yaml` - Local configuration

## Your First Commitment

```bash
# 1. Capture an observation
mentu capture "Need to implement user authentication"

# 2. Create a commitment from it
mentu commit "Implement JWT-based authentication" --source mem_XXXXXXXX

# 3. Claim the work
mentu claim cmt_XXXXXXXX

# 4. Do the work...

# 5. Close with evidence
mentu capture "Auth tests passing, 12 endpoints secured" --kind evidence
mentu close cmt_XXXXXXXX --evidence mem_YYYYYYYY
```

## Core Concepts

- **Memory**: Something observed (`capture`)
- **Commitment**: Something owed (`commit`)
- **Evidence**: Proof of completion (used with `close`)

Every commitment traces to its origin. Closure requires proof. Nothing is deleted.

## Next Steps

- [Core Concepts](/knowledge-base/core-concepts/overview/) - Understand the protocol
- [CLI Reference](/knowledge-base/cli-reference/overview/) - All commands
- [API Reference](/knowledge-base/api-reference/overview/) - HTTP API
