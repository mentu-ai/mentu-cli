/**
 * Bug Reporter SDK
 *
 * Allows external systems to report bugs to the Mentu bug investigation workflow.
 *
 * Usage:
 *   import { BugReporter } from '@mentu/bug-reporter';
 *
 *   const reporter = new BugReporter({
 *     apiToken: process.env.MENTU_API_TOKEN,
 *     workspaceId: 'xxx',
 *     workspacePath: '/path/to/workspace',
 *     source: 'WarrantyOS',
 *     callbackUrl: 'https://myapp.com/mentu-callback'
 *   });
 *
 *   const result = await reporter.report({
 *     title: 'Login fails',
 *     description: 'Error 500 on login',
 *     severity: 'high'
 *   });
 */

import type {
  BugReporterConfig,
  BugInput,
  BugResult,
  BugStatus,
} from './types.js';

const DEFAULT_API_URL = 'https://mentu-proxy.affihub.workers.dev';

export class BugReporter {
  private config: Required<Omit<BugReporterConfig, 'callbackUrl' | 'callbackSecret'>> &
    Pick<BugReporterConfig, 'callbackUrl' | 'callbackSecret'>;

  constructor(config: BugReporterConfig) {
    this.config = {
      apiUrl: config.apiUrl || DEFAULT_API_URL,
      apiToken: config.apiToken,
      workspaceId: config.workspaceId,
      workspacePath: config.workspacePath,
      source: config.source,
      callbackUrl: config.callbackUrl,
      callbackSecret: config.callbackSecret,
    };

    if (!this.config.apiToken) {
      throw new Error('BugReporter: apiToken is required');
    }
    if (!this.config.workspaceId) {
      throw new Error('BugReporter: workspaceId is required');
    }
    if (!this.config.source) {
      throw new Error('BugReporter: source is required');
    }
  }

  /**
   * Report a bug to the Mentu bug investigation workflow.
   *
   * Creates:
   * - Memory (kind: bug_report)
   * - Commitment (source: memory)
   * - Workflow instance (bug-investigation-dual-triad)
   *
   * @param bug - Bug report details
   * @returns IDs for tracking the bug
   */
  async report(bug: BugInput): Promise<BugResult> {
    const response = await fetch(`${this.config.apiUrl}/bug-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiToken,
      },
      body: JSON.stringify({
        title: bug.title,
        description: bug.description,
        severity: bug.severity,
        tags: bug.tags,
        workspace_id: this.config.workspaceId,
        workspace_path: this.config.workspacePath,
        source: this.config.source,
        callback_url: this.config.callbackUrl,
        callback_secret: this.config.callbackSecret,
        metadata: bug.metadata,
        environment: bug.environment,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(`BugReporter.report failed: ${(error as { error?: string }).error || response.statusText}`);
    }

    const result = await response.json() as {
      status: string;
      mem_bug_id: string;
      commitment_id: string;
      workflow_instance_id: string;
    };

    if (result.status !== 'accepted') {
      throw new Error(`BugReporter.report failed: unexpected status ${result.status}`);
    }

    return {
      memoryId: result.mem_bug_id,
      commitmentId: result.commitment_id,
      workflowInstanceId: result.workflow_instance_id,
    };
  }

  /**
   * Get the current status of a reported bug.
   *
   * @param commitmentId - The commitment ID returned from report()
   * @returns Current status including workflow state
   */
  async getStatus(commitmentId: string): Promise<BugStatus> {
    const response = await fetch(
      `${this.config.apiUrl}/bug-status/${commitmentId}`,
      {
        headers: {
          'X-API-Key': this.config.apiToken,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(`BugReporter.getStatus failed: ${(error as { error?: string }).error || response.statusText}`);
    }

    return await response.json() as BugStatus;
  }

  /**
   * Poll for status changes until the bug is resolved or fails.
   *
   * @param commitmentId - The commitment ID to watch
   * @param options - Polling options
   * @returns Final status when resolved/failed
   */
  async waitForCompletion(
    commitmentId: string,
    options: {
      intervalMs?: number;
      timeoutMs?: number;
      onProgress?: (status: BugStatus) => void;
    } = {}
  ): Promise<BugStatus> {
    const intervalMs = options.intervalMs || 5000;
    const timeoutMs = options.timeoutMs || 600000; // 10 minutes default
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getStatus(commitmentId);

      if (options.onProgress) {
        options.onProgress(status);
      }

      if (status.commitmentState === 'closed' || status.workflowState === 'failed') {
        return status;
      }

      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    throw new Error(`BugReporter.waitForCompletion timed out after ${timeoutMs}ms`);
  }
}
