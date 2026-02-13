---
title: "GitHub Integration"
description: "How Mentu integrates with GitHub for PR tracking, commit conventions, and CI automation"
---

Mentu integrates with GitHub at multiple levels — from PR creation during the `/fix` workflow to automated label management and CI pipeline hooks. This guide covers each integration point.

## PR Creation via `/fix`

When the Mentu plugin runs the `/fix` workflow, it creates pull requests using the `gh` CLI. This keeps PR creation consistent and auditable.

### How It Works

1. The plugin creates a branch (e.g., `fix/mem_a1b2c3d4`)
2. After applying the fix, it pushes the branch to the remote
3. It runs `gh pr create` with a structured title and body:

```bash
gh pr create \
  --title "fix: handle empty discount in invoice total" \
  --body "## Summary
Fixes mem_a1b2c3d4 — Invoice total shows NaN when discount field is left empty.

## Changes
- Added null check in calculateTotal() before applying discount
- Added unit test for empty discount case

## Mentu
- Commitment: cmt_x9y8z7w6
- Memory: mem_a1b2c3d4
- Tier: T2

## Evidence
- Build: PASS
- Tests: 24 passed, 0 failed"
```

The PR body includes structured sections that link back to Mentu objects, making it easy to trace from GitHub back to the ledger.

## Commit Message Conventions

Mentu follows a convention for referencing commitment and memory IDs in commit messages:

### Format

```
<type>: <description>

[mentu:cmt_x9y8z7w6]
[mentu:mem_a1b2c3d4]
```

### Types

| Type | Usage |
|------|-------|
| `fix` | Bug fix |
| `feat` | New feature |
| `refactor` | Code restructuring |
| `docs` | Documentation change |
| `test` | Test addition or modification |
| `chore` | Maintenance task |

### Example

```
fix: handle empty discount in invoice total calculation

Adds null coalescing for the discount field in calculateTotal().
When the discount input is left blank, the value is now treated as 0
instead of NaN.

[mentu:cmt_x9y8z7w6]
[mentu:mem_a1b2c3d4]
```

The `[mentu:...]` tags in commit messages allow automated tools to link commits back to their corresponding Mentu objects.

## GitHub Actions Integration

You can integrate Mentu into your CI/CD pipeline using GitHub Actions to automatically record build and test results as evidence.

### Example Workflow

```yaml
name: Mentu Evidence
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  build-and-report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install dependencies
        run: npm ci

      - name: Build
        id: build
        run: npm run build
        continue-on-error: true

      - name: Test
        id: test
        run: npm test -- --reporter=json > test-results.json
        continue-on-error: true

      - name: Report to Mentu
        if: always()
        env:
          MENTU_API_URL: ${{ secrets.MENTU_API_URL }}
          MENTU_API_TOKEN: ${{ secrets.MENTU_API_TOKEN }}
        run: |
          # Extract commitment ID from PR body
          CMT_ID=$(echo "${{ github.event.pull_request.body }}" | grep -oP 'cmt_[a-zA-Z0-9]+')

          if [ -n "$CMT_ID" ]; then
            curl -X POST "$MENTU_API_URL/ops" \
              -H "Authorization: Bearer $MENTU_API_TOKEN" \
              -H "Content-Type: application/json" \
              -d "{
                \"op\": \"evidence\",
                \"actor\": \"ci:github-actions\",
                \"payload\": {
                  \"commitment_id\": \"$CMT_ID\",
                  \"evidence\": [
                    {\"kind\": \"build\", \"status\": \"${{ steps.build.outcome }}\"},
                    {\"kind\": \"test\", \"status\": \"${{ steps.test.outcome }}\"}
                  ]
                }
              }"
          fi
```

This workflow:

1. Runs on every PR update
2. Executes the build and test steps
3. Extracts the commitment ID from the PR body
4. Reports the results as evidence to Mentu

## Labels

Mentu uses GitHub labels to mark and filter tracked pull requests:

| Label | Meaning |
|-------|---------|
| `mentu-tracked` | This PR is linked to a Mentu commitment |
| `claude` | The PR was created by the Claude agent |
| `autonomous` | The fix was applied autonomously (no human intervention before PR) |

### Automatic Labeling

The `/fix` plugin automatically applies labels when creating PRs:

- `mentu-tracked` is always applied
- `claude` is applied when the actor is `agent:claude`
- `autonomous` is applied when the full workflow (investigate, fix, test, PR) ran without human prompts

### Manual Labeling

You can also manually add the `mentu-tracked` label to any PR. If the PR body contains a `[mentu:cmt_...]` reference, the GitHub Actions integration will pick it up for evidence reporting.
