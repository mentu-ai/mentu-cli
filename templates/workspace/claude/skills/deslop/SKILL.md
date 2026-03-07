---
name: deslop
description: Remove AI-generated code slop from the current branch. Checks diff against main and fixes unnecessary comments, defensive checks, type casts, and project-specific anti-patterns.
user_invocable: true
---

# Deslop -- AI Code Slop Remover

You are the deslop agent. Your job is to clean up AI-generated code slop from files changed on the current branch.

## What is slop?

Code patterns that AI tools add unnecessarily -- things a senior engineer would remove in review.

## Step 1: Get Changed Files

```bash
git diff main...HEAD --name-only --diff-filter=ACMR | grep -E '\.(ts|tsx|js|jsx|css|py|rs)$'
```

If no changes found, report "No changed files to deslop" and stop.

## Step 2: Read Each Changed File

For each file, identify and fix these slop patterns:

### Standard Slop Patterns

| Pattern | Example | Fix |
|---------|---------|-----|
| Obvious comments | `// Set the name` above `setName(value)` | Remove |
| Excessive comments | `// This function handles...` on self-documenting code | Remove |
| Unnecessary try/catch | try/catch that just re-throws or logs generic error | Remove wrapper, let error propagate |
| Unsafe type casts | `data as any` hiding real type issues | Fix the type properly or add proper cast |
| Unnecessary `else` after return | `if (x) return; else { ... }` | Remove `else`, dedent |
| Dead code | Commented-out code blocks, unused imports | Remove |
| Over-defensive null checks | `if (x !== null && x !== undefined && x)` | Simplify to `if (x)` |
| Redundant type annotations | `const x: string = "hello"` | Let TypeScript infer |
| Empty catch blocks | `catch (e) {}` | At minimum log, or remove try/catch |

### Project-Specific Slop Patterns

These patterns should be customized by `/mentu-workspace-init` based on your detected stack. Default patterns:

| Pattern | Example | Fix |
|---------|---------|-----|
| Commented console.log | `// console.log(data)` | Remove entirely |
| eslint-disable without justification | Bare eslint-disable-next-line | Add justification or fix the lint issue |
| Redundant obvious comments | `// Get the data` above `const data = getData()` | Remove (code is self-documenting) |

## Step 3: Apply Fixes

For each file:
1. Read the file
2. Identify all slop instances
3. Fix them using the Edit tool
4. Verify the file still compiles

## Step 4: Verify Build

```bash
{{BUILD_CMD}}
```

If build fails, revert the last change and try a more conservative fix.

## Step 5: Report

Output a summary:

```
## Deslop Report

**Files processed**: N
**Slop instances fixed**: N
**Build status**: PASS/FAIL

### Changes by category:
- Removed N unnecessary comments
- Fixed N type casts
- Removed N dead code blocks
- Fixed N project-specific patterns

### Files modified:
- `path/to/file.ts`: 3 fixes (comments, type cast, pattern)
- `path/to/other.ts`: 1 fix (unused import)
```

## Rules

- ONLY modify files on the current branch (from `git diff main...HEAD`)
- Do NOT change functionality -- only remove slop
- Do NOT add new code, comments, or features
- If unsure whether something is slop, leave it alone
- Run build verification after all changes
- Commit with message: `chore: deslop -- remove AI-generated code slop`
