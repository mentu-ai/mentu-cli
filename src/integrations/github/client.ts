import { Octokit } from '@octokit/rest';
import type { GitHubConfig, GitHubSyncPullConfig, CommitmentState } from '../../types.js';
import { MentuError } from '../../types.js';
import type { GitHubIssue, CreateIssueParams, UpdateIssueParams, GitHubSyncResult } from './types.js';
import { GitHubProjectsClient } from './projects.js';

/**
 * Default sync configuration for GitHub integration.
 */
export function getDefaultGitHubConfig(): Omit<GitHubConfig, 'owner' | 'repo'> {
  return {
    enabled: false,
    token_env: 'GITHUB_TOKEN',
    sync: {
      push: {
        on_commit: false,
        on_claim: true,
        on_release: true,
        on_close: true,
        on_annotate: false,
      },
      pull: {
        on_issue_closed: 'warn',
        on_issue_commented: 'ignore',
        on_pr_merged: 'ignore',
      },
    },
  };
}

/**
 * Build GitHub config from environment variables and config file.
 */
export function buildGitHubConfig(configFromFile?: Partial<GitHubConfig>): GitHubConfig | null {
  const enabled = process.env.GITHUB_ENABLED === 'true';
  if (!enabled) {
    return null;
  }

  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (!owner || !repo) {
    return null;
  }

  const defaults = getDefaultGitHubConfig();

  return {
    enabled: true,
    owner,
    repo,
    token_env: configFromFile?.token_env ?? defaults.token_env,
    project: configFromFile?.project,
    sync: {
      push: {
        ...defaults.sync.push,
        ...configFromFile?.sync?.push,
      },
      pull: {
        ...defaults.sync.pull,
        ...configFromFile?.sync?.pull,
      },
    },
  };
}

/**
 * GitHubClient wraps Octokit for Mentu-specific operations.
 */
export class GitHubClient {
  private octokit: Octokit;
  private owner: string;
  private repo: string;
  private config: GitHubConfig;

  constructor(config: GitHubConfig) {
    const token = process.env[config.token_env];
    if (!token) {
      throw new MentuError(
        'E_GITHUB_NOT_CONFIGURED',
        `GitHub token not found in environment variable ${config.token_env}`
      );
    }

    this.octokit = new Octokit({ auth: token });
    this.owner = config.owner;
    this.repo = config.repo;
    this.config = config;
  }

  /**
   * Get the sync configuration.
   */
  get syncConfig(): GitHubConfig['sync'] {
    return this.config.sync;
  }

  /**
   * Get the pull config for on_unauthorized_close behavior.
   */
  get pullConfig(): GitHubSyncPullConfig {
    return this.config.sync.pull;
  }

  /**
   * Create a new issue.
   */
  async createIssue(params: CreateIssueParams): Promise<GitHubIssue> {
    try {
      const response = await this.octokit.issues.create({
        owner: this.owner,
        repo: this.repo,
        title: params.title,
        body: params.body,
        labels: params.labels,
        assignee: params.assignee,
      });

      return {
        number: response.data.number,
        node_id: response.data.node_id,
        title: response.data.title,
        body: response.data.body ?? null,
        state: response.data.state as 'open' | 'closed',
        html_url: response.data.html_url,
        assignee: response.data.assignee,
        assignees: response.data.assignees ?? [],
        labels: response.data.labels.map((l) => ({
          name: typeof l === 'string' ? l : l.name ?? '',
        })),
      };
    } catch (err) {
      this.handleApiError(err);
      throw err; // TypeScript needs this
    }
  }

  /**
   * Get an issue by number.
   */
  async getIssue(number: number): Promise<GitHubIssue> {
    try {
      const response = await this.octokit.issues.get({
        owner: this.owner,
        repo: this.repo,
        issue_number: number,
      });

      return {
        number: response.data.number,
        node_id: response.data.node_id,
        title: response.data.title,
        body: response.data.body ?? null,
        state: response.data.state as 'open' | 'closed',
        html_url: response.data.html_url,
        assignee: response.data.assignee,
        assignees: response.data.assignees ?? [],
        labels: response.data.labels.map((l) => ({
          name: typeof l === 'string' ? l : l.name ?? '',
        })),
      };
    } catch (err) {
      this.handleApiError(err, number);
      throw err;
    }
  }

  /**
   * Update an issue.
   */
  async updateIssue(number: number, params: UpdateIssueParams): Promise<GitHubIssue> {
    try {
      const response = await this.octokit.issues.update({
        owner: this.owner,
        repo: this.repo,
        issue_number: number,
        title: params.title,
        body: params.body,
        labels: params.labels,
        assignee: params.assignee ?? undefined,
        state: params.state,
      });

      return {
        number: response.data.number,
        node_id: response.data.node_id,
        title: response.data.title,
        body: response.data.body ?? null,
        state: response.data.state as 'open' | 'closed',
        html_url: response.data.html_url,
        assignee: response.data.assignee,
        assignees: response.data.assignees ?? [],
        labels: response.data.labels.map((l) => ({
          name: typeof l === 'string' ? l : l.name ?? '',
        })),
      };
    } catch (err) {
      this.handleApiError(err, number);
      throw err;
    }
  }

  /**
   * Close an issue with an evidence comment.
   */
  async closeIssueWithEvidence(
    number: number,
    evidenceComment: string
  ): Promise<GitHubSyncResult> {
    // Add evidence comment first
    await this.addComment(number, evidenceComment);

    // Then close the issue
    await this.updateIssue(number, { state: 'closed' });

    return {
      action: 'closed',
      issue_number: number,
      url: `https://github.com/${this.owner}/${this.repo}/issues/${number}`,
    };
  }

  /**
   * Reopen an issue.
   */
  async reopenIssue(number: number): Promise<GitHubSyncResult> {
    await this.updateIssue(number, { state: 'open' });

    return {
      action: 'reopened',
      issue_number: number,
      url: `https://github.com/${this.owner}/${this.repo}/issues/${number}`,
    };
  }

  /**
   * Assign an issue to a user.
   */
  async assignIssue(number: number, assignee: string): Promise<GitHubSyncResult> {
    try {
      await this.octokit.issues.addAssignees({
        owner: this.owner,
        repo: this.repo,
        issue_number: number,
        assignees: [assignee],
      });

      return {
        action: 'assigned',
        issue_number: number,
        url: `https://github.com/${this.owner}/${this.repo}/issues/${number}`,
      };
    } catch (err) {
      // Assignment can fail if user doesn't have access - log warning but don't fail
      console.error(`Warning: Cannot assign GitHub issue #${number} to '${assignee}' - user not found or lacks access.`);
      return {
        action: 'assigned',
        issue_number: number,
        url: `https://github.com/${this.owner}/${this.repo}/issues/${number}`,
      };
    }
  }

  /**
   * Unassign all users from an issue.
   */
  async unassignIssue(number: number): Promise<GitHubSyncResult> {
    try {
      // Get current assignees first
      const issue = await this.getIssue(number);
      const assignees = issue.assignees?.map((a) => a.login) ?? [];

      if (assignees.length > 0) {
        await this.octokit.issues.removeAssignees({
          owner: this.owner,
          repo: this.repo,
          issue_number: number,
          assignees,
        });
      }

      return {
        action: 'unassigned',
        issue_number: number,
        url: `https://github.com/${this.owner}/${this.repo}/issues/${number}`,
      };
    } catch (err) {
      this.handleApiError(err, number);
      throw err;
    }
  }

  /**
   * Add a comment to an issue.
   */
  async addComment(number: number, body: string): Promise<void> {
    try {
      await this.octokit.issues.createComment({
        owner: this.owner,
        repo: this.repo,
        issue_number: number,
        body,
      });
    } catch (err) {
      this.handleApiError(err, number);
      throw err;
    }
  }

  /**
   * Handle unauthorized close based on config.
   * This is called when a GitHub issue is found closed but the Mentu commitment is still open.
   */
  async handleUnauthorizedClose(
    issueNumber: number,
    commitmentId: string
  ): Promise<{ action: 'warn' | 'reopen' | 'ignore'; message?: string }> {
    const behavior = this.config.sync.pull.on_issue_closed;

    switch (behavior) {
      case 'ignore':
        return { action: 'ignore' };

      case 'warn':
        await this.addWarningComment(issueNumber, commitmentId);
        return {
          action: 'warn',
          message: `Added warning comment to issue #${issueNumber}`,
        };

      case 'reopen':
        await this.reopenWithExplanation(issueNumber, commitmentId);
        return {
          action: 'reopen',
          message: `Reopened issue #${issueNumber}`,
        };

      default:
        return { action: 'ignore' };
    }
  }

  /**
   * Add a warning comment about the evidence requirement.
   */
  private async addWarningComment(issueNumber: number, commitmentId: string): Promise<void> {
    const body = `\u26A0\uFE0F **Commitment Still Open**

This issue was closed in GitHub, but commitment \`${commitmentId}\` remains open in Mentu.

Commitments require evidence to close:
\`\`\`bash
mentu capture "Work completed" --kind evidence
mentu close ${commitmentId} --evidence <mem_id>
\`\`\`

---
*Posted by Mentu CLI*`;

    await this.addComment(issueNumber, body);
  }

  /**
   * Reopen an issue with an explanation comment.
   */
  private async reopenWithExplanation(issueNumber: number, commitmentId: string): Promise<void> {
    await this.reopenIssue(issueNumber);

    const body = `\uD83D\uDD04 **Issue Reopened by Mentu**

This issue was reopened because commitment \`${commitmentId}\` cannot be closed without evidence.

To close properly:
1. Complete the work
2. Capture evidence: \`mentu capture "Done" --kind evidence\`
3. Close with evidence: \`mentu close ${commitmentId} --evidence <mem_id>\`

The issue will close automatically when the commitment is resolved.

---
*Posted by Mentu CLI*`;

    await this.addComment(issueNumber, body);
  }

  /**
   * Sync issue status in GitHub Projects based on Mentu commitment state.
   * Maps: open -> Backlog, claimed -> In Progress, closed -> Done
   */
  async syncProjectStatus(
    issueNumber: number,
    issueNodeId: string,
    state: CommitmentState
  ): Promise<boolean> {
    // Only sync if project is configured
    if (!this.config.project) {
      return false;
    }

    try {
      const projectsClient = new GitHubProjectsClient(
        this.octokit,
        this.owner,
        this.repo
      );

      // Find the project
      const project = await projectsClient.findProject(this.config.project);
      if (!project) {
        console.error(`Warning: GitHub Project "${this.config.project}" not found`);
        return false;
      }

      // Add issue to project if not already there
      const itemId = await projectsClient.addIssueToProject(project.id, issueNodeId);
      if (!itemId) {
        console.error(`Warning: Could not add issue to project`);
        return false;
      }

      // Get status field
      const statusField = await projectsClient.getStatusField(project.id);
      if (!statusField) {
        console.error(`Warning: No Status field found in project`);
        return false;
      }

      // Map state to column name
      const columnName = projectsClient.mapStateToColumn(state);
      const option = statusField.options.find(
        (o) => o.name.toLowerCase() === columnName.toLowerCase()
      );

      if (!option) {
        console.error(`Warning: No "${columnName}" column found in project`);
        return false;
      }

      // Update status
      return await projectsClient.updateItemStatus(
        project.id,
        itemId,
        statusField.fieldId,
        option.id
      );
    } catch (err) {
      console.error(`Warning: Failed to sync project status: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Handle API errors and convert to MentuError.
   */
  private handleApiError(err: unknown, issueNumber?: number): never {
    if (err && typeof err === 'object' && 'status' in err) {
      const status = (err as { status: number }).status;

      if (status === 401) {
        throw new MentuError(
          'E_GITHUB_AUTH_FAILED',
          'GitHub authentication failed. Check your token.'
        );
      }

      if (status === 403) {
        const headers = (err as { response?: { headers?: Record<string, string> } }).response?.headers;
        const remaining = headers?.['x-ratelimit-remaining'];
        const reset = headers?.['x-ratelimit-reset'];

        if (remaining === '0' && reset) {
          const resetDate = new Date(parseInt(reset) * 1000).toISOString();
          throw new MentuError(
            'E_GITHUB_RATE_LIMITED',
            'GitHub API rate limit exceeded',
            { reset_at: resetDate, remaining: 0 }
          );
        }

        throw new MentuError(
          'E_GITHUB_PERMISSION_DENIED',
          'GitHub permission denied. Check token permissions.'
        );
      }

      if (status === 404 && issueNumber !== undefined) {
        throw new MentuError(
          'E_GITHUB_ISSUE_NOT_FOUND',
          `GitHub issue #${issueNumber} not found`,
          { issue: issueNumber }
        );
      }
    }

    throw new MentuError(
      'E_INVALID_OP',
      err instanceof Error ? err.message : 'Unknown GitHub API error'
    );
  }
}
