# GitHub Actions + Mentu Integration

Claude Code running in GitHub Actions with Mentu accountability tracking.

## Quick Start

### 1. Add Repository Secret

Go to **Settings > Secrets and variables > Actions > New repository secret**

| Name | Value |
|------|-------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |

### 2. Verify Workflow

The workflow at `.github/workflows/claude.yml` is pre-configured.

### 3. Test

Create an issue with:

```markdown
@claude Please verify this integration works by listing the project structure.
```

## How It Works

```
GitHub Event (issue/PR with @claude)
    |
Workflow triggers
    |
Mentu captures issue as memory
    |
Claude Code Action v1 executes
    |
Agent creates commitment, does work
    |
Agent submits with evidence
    |
Ledger committed back to repo
```

## Configuration

### Action Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `anthropic_api_key` | API authentication | Required |
| `prompt` | Instructions for Claude | Auto from event |
| `claude_args` | CLI arguments | `--max-turns 50` |
| `allowed_tools` | Tool permissions | See workflow |

### Safety Controls

| Control | Value | Purpose |
|---------|-------|---------|
| `timeout-minutes` | 30 | Prevent hung jobs |
| `concurrency.group` | Issue/PR number | Prevent duplicates |
| `--max-turns` | 50 | Limit iterations |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Workflow not triggering | Check @claude in comment, Actions enabled |
| Claude not responding | Verify ANTHROPIC_API_KEY secret |
| Ledger not committing | Check `contents: write` permission |

## References

- [Official Claude Code Action docs](https://code.claude.com/docs/en/github-actions)
- [Mentu Protocol](../../CLAUDE.md)
