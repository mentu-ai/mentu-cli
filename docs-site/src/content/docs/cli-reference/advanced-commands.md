---
title: Advanced Commands
description: Review and advanced CLI operations
order: 4
---

## Review Commands

### mentu submit

Submit a commitment for review.

```bash
mentu submit <cmt_id> --summary "<summary>" [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--summary <text>` | Summary of work done |
| `--include-files` | Auto-generate file evidence |
| `--tier <tier>` | Tier level (tier_1 auto-approves) |

### Example

```bash
mentu submit cmt_abc123 \
  --summary "Implemented auth with tests" \
  --include-files
```

### mentu approve

Approve a submitted commitment.

```bash
mentu approve <cmt_id> [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--comment <text>` | Approval comment |

### Example

```bash
mentu approve cmt_abc123 --comment "Looks good, merging"
```

### mentu reopen

Reject a submission or dispute a closure.

```bash
mentu reopen <cmt_id> --reason "<reason>" [options]
```

### Example

```bash
mentu reopen cmt_abc123 --reason "Tests failing on CI"
```

### mentu review-queue

List commitments awaiting review.

```bash
mentu review-queue [options]
```

## Task Lifecycle Commands

### mentu task start

Quick workflow: capture + commit + claim.

```bash
mentu task start "<description>"
```

### mentu task complete

Quick workflow: capture evidence + close.

```bash
mentu task complete "<evidence>"
```

### mentu task fail

Quick workflow: annotate + release.

```bash
mentu task fail "<reason>"
```

## GitHub Integration

### mentu push

Push commitment to GitHub issue.

```bash
mentu push <cmt_id> --to github
```

### mentu pull

Sync from GitHub.

```bash
mentu pull --github
```

### mentu github-link

Link to existing GitHub issue.

```bash
mentu github-link <cmt_id> --issue <number>
```

## Configuration

### mentu config

Manage configuration.

```bash
mentu config get <key>
mentu config set <key> <value>
mentu config list
```

### Example

```bash
mentu config set github.repo "owner/repo"
mentu config get github.repo
```
