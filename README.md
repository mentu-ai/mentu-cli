# mentu-cli

The official CLI for the [Mentu Protocol](https://github.com/mentu-ai/mentu).

**The Commitment Ledger** — Track promises with evidence.

---

## Installation

```bash
npm install -g mentu
```

---

## Quick Start

```bash
# Initialize a workspace
mentu init

# Capture an observation
mentu capture "Customer reported checkout bug"

# Create a commitment
mentu commit "Fix checkout bug" --source mem_abc123

# Claim responsibility
mentu claim cmt_def456

# Do the work...

# Capture evidence
mentu capture "Fixed null check in payment.ts:42" --kind evidence

# Close with proof
mentu close cmt_def456 --evidence mem_ghi789
```

---

## Commands

### Core Operations

```bash
mentu capture <body> [--kind <kind>]       # Record observation
mentu commit <body> --source <memory>      # Create commitment
mentu claim <commitment>                   # Take responsibility
mentu release <commitment>                 # Give up responsibility
mentu close <commitment> --evidence <mem>  # Resolve with proof
mentu annotate <target> <body>             # Attach note
```

### Review Operations

```bash
mentu submit <commitment> --summary "..."  # Submit for review
mentu approve <commitment>                 # Accept submission
mentu reopen <commitment> --reason "..."   # Reject submission
```

### Query Operations

```bash
mentu status                               # Show current state
mentu status --mine                        # Just your work
mentu log                                  # Operation history
mentu show <id>                            # Record details
```

### Workspace

```bash
mentu init                                 # Initialize workspace
mentu config get <key>                     # Get config value
mentu config set <key> <value>             # Set config value
```

---

## The Protocol

Mentu implements [The Commitment Protocol](https://github.com/mentu-ai/mentu):

1. **Commitments trace to observations** — Every `commit` references a `capture`
2. **Closure requires evidence** — Every `close` references a proof memory
3. **Append-only** — The ledger only grows

---

## File Structure

```
.mentu/
├── ledger.jsonl    # Append-only log
├── config.yaml     # Workspace config
├── genesis.key     # Constitution (optional)
└── AGENTS.md       # Agent instructions
```

---

## Ecosystem

| Component | Purpose |
|-----------|---------|
| [mentu](https://github.com/mentu-ai/mentu) | Protocol specification |
| [mentu-cli](https://github.com/mentu-ai/mentu-cli) | This CLI |
| [mentu-plugin](https://github.com/mentu-ai/mentu-plugin) | Claude Code integration |
| [mentu-proxy](https://github.com/mentu-ai/mentu-proxy) | Sync service |

---

## Development

```bash
# Clone
git clone https://github.com/mentu-ai/mentu-cli
cd mentu-cli

# Install dependencies
npm install

# Build
npm run build

# Test
npm test

# Run locally
node dist/index.js status
```

---

## License

MIT

---

*A ledger where commitments require evidence.*
