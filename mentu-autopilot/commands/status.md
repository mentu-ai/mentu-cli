---
description: "Quick pipeline overview — commitment counts, memory stats, recent activity"
allowed-tools: ["mcp__mentu__mentu_get_status", "mcp__mentu__mentu_list_commitments", "mcp__mentu__mentu_list_memories"]
---

# Mentu Status

Quick pipeline overview. Shows commitment counts by state, recent activity, and throughput metrics.

## Instructions

### Step 1: Fetch Status

Use **mentu_get_status** to get the pipeline summary.

### Step 2: Fetch Recent Activity

In parallel:
1. **mentu_list_commitments** with limit=5 to show recent commitments
2. **mentu_list_memories** with limit=5 to show recent memories

### Step 3: Present Overview

```markdown
# Mentu Pipeline Status

## Commitments
| State | Count |
|-------|-------|
| Open | {n} |
| Claimed | {n} |
| In Review | {n} |
| Reopened | {n} |
| Closed | {n} |
| **Total** | **{n}** |

Throughput: {closed/total * 100}%

## Recent Commitments
| ID | Title | State | Owner |
|----|-------|-------|-------|

## Recent Memories
| ID | Kind | Title (truncated) |
|----|------|-------------------|

## Ledger
Operations: {n}
Last activity: {timestamp}
```

## Rules

1. **Read-only.** No mutations.
2. **Fast.** 2-3 API calls max.
3. **All via MCP tools.**
