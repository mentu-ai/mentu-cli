# GitLab CI/CD + Mentu Integration

Claude Code running in GitLab pipelines with Mentu accountability tracking.

## Quick Start

### 1. Add CI/CD Variable

Go to **Settings > CI/CD > Variables > Add variable**

| Key | Value | Flags |
|-----|-------|-------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key | Masked, Protected |

### 2. Copy Pipeline

The pipeline at `.gitlab-ci.yml` is pre-configured.

### 3. Test

#### Option A: Manual Run

1. Go to **CI/CD > Pipelines > Run pipeline**
2. Add variable: `AI_FLOW_INPUT` = "List the project structure"
3. Click **Run pipeline**

#### Option B: Merge Request

Create an MR - the pipeline runs automatically.

## How It Works

```
GitLab Event (MR or manual)
    |
Pipeline triggers 'claude' job
    |
Mentu captures MR as memory
    |
Claude Code CLI executes
    |
Agent creates commitment, does work
    |
Agent submits with evidence
    |
Ledger committed back to repo
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ANTHROPIC_API_KEY` | API authentication | Yes |
| `AI_FLOW_INPUT` | Prompt for Claude | Manual runs only |
| `MENTU_ACTOR` | Agent identity | Set by pipeline |
| `MENTU_WORKSPACE` | Ledger location | Set by pipeline |

### Pipeline Variables

| Variable | Value | Purpose |
|----------|-------|---------|
| `GIT_STRATEGY` | fetch | Full repo access |
| `--max-turns` | 50 | Limit iterations |

## Differences from GitHub Actions

| Aspect | GitHub | GitLab |
|--------|--------|--------|
| Action/CLI | claude-code-action@v1 | npx claude-code --print |
| Trigger | @claude mention | MR event or manual |
| Prompt source | Issue/PR body | AI_FLOW_INPUT variable |
| Actor | agent:claude-github | agent:claude-gitlab |

## Cloud Provider Support

### AWS Bedrock

```yaml
variables:
  AWS_ROLE_TO_ASSUME: "arn:aws:iam::ACCOUNT:role/bedrock-role"
  AWS_REGION: "us-west-2"
```

### Google Vertex AI

```yaml
variables:
  GCP_WORKLOAD_IDENTITY_PROVIDER: "projects/PROJECT/locations/global/workloadIdentityPools/POOL/providers/PROVIDER"
  GCP_SERVICE_ACCOUNT: "service@project.iam.gserviceaccount.com"
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Pipeline not running | Check rules match your event |
| Claude not executing | Verify ANTHROPIC_API_KEY is set (keep masked for security) |
| Ledger not committing | Ensure runner has push access |
| No response | Set AI_FLOW_INPUT for manual runs |

## References

- [Official Claude Code GitLab docs](https://code.claude.com/docs/en/gitlab-ci-cd)
- [Mentu Protocol](../../CLAUDE.md)
