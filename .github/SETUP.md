# Claude GitHub App + Mentu Setup

Quick setup guide for enabling Claude agents on your repository.

## Prerequisites

- [ ] GitHub repository with Actions enabled
- [ ] Anthropic API key
- [ ] Mentu CLI built (`npm run build`)

## Setup Steps

### 1. Add Repository Secret

Go to **Settings → Secrets and variables → Actions → New repository secret**

| Name | Value |
|------|-------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |

### 2. Verify Workflow

The workflow is at `.github/workflows/claude.yml`. It's already configured.

### 3. Test the Integration

Create a new issue with this content:

```markdown
# Test Claude Integration

@claude Please verify this integration works by:
1. Creating a simple test file
2. Committing it to a new branch
3. Opening a PR

This is a test issue.
```

### 4. Watch the Action

Go to **Actions** tab and watch the "Claude Code with Mentu" workflow run.

## What Happens

1. Issue triggers the workflow
2. Mentu captures the issue as a memory
3. Claude reads the issue and creates a commitment
4. Claude implements the request
5. Claude submits evidence and creates a PR
6. Mentu ledger is updated and committed

## Customization

### Modify Allowed Tools

Edit `.github/workflows/claude.yml`:

```yaml
allowed_tools: |
  Bash(./dist/cli.js:*)
  Bash(npm:*)
  Read
  Write
  # Add more as needed
```

### Add Custom Instructions

Add to the `direct_prompt` in the workflow:

```yaml
direct_prompt: |
  ## Custom Rules
  - Always use TypeScript
  - Write tests for new code
  - Follow the Mentu protocol
```

### Use MCP Config (Future)

When MCP server is built, reference:

```yaml
mcp_config_file: .github/mcp-config.json
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Workflow not triggering | Check @claude is in issue body, Actions enabled |
| Build failing | Run `npm ci && npm run build` locally to debug |
| Ledger not updating | Check `contents: write` permission in workflow |
| PR not created | Check GitHub token permissions |

## Files Created

```
.github/
├── workflows/
│   └── claude.yml          # Main workflow
├── mcp-config.json         # MCP server config (future)
└── SETUP.md                # This file

docs/
└── Claude-GitHub-Integration.md  # Full documentation
```

## Next Steps

1. Test with a simple issue
2. Review the PR that Claude creates
3. Verify Mentu ledger was updated
4. Iterate on the workflow as needed
