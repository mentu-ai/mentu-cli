# src/core/ - Kernel Boundary

Files in this directory are **foundational primitives** that other modules depend on.

## Rules for Kernel Code

1. **No dependencies on application code** - Core cannot import from `commands/` or `integrations/`
2. **Stable interfaces** - Breaking changes require major version bump
3. **State is computed** - No stored state, replay from ledger
4. **Idempotent** - Same inputs produce same outputs
5. **Pure where possible** - Side effects only through ledger operations

## What Belongs Here

- Ledger read/write operations
- Validation logic
- State computation from operations
- Temporal evaluation
- ID generation
- Type definitions

## What Does NOT Belong Here

- CLI argument parsing
- Output formatting
- External API calls
- Business logic
- Product-specific features

## Directory Structure

```
src/core/
├── README.md           # This file
├── ledger.ts           # Append-only ledger operations
├── validation.ts       # Core validation
├── state.ts            # State computation
├── utils.ts            # ID generation, helpers
├── temporal.ts         # Temporal state computation (NEW)
└── scheduler.ts        # Scheduler tick logic (NEW)
```
