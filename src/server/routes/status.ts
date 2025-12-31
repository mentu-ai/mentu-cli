import { Hono } from 'hono';
import { readLedger } from '../../core/ledger.js';
import { computeCommitments, computeMemories } from '../../core/state.js';
import { readGenesisKey } from '../../core/genesis.js';
import { getWorkspaceName, readConfig } from '../../core/config.js';
import { getCommitmentsWithExternalRef } from '../../core/external.js';

/**
 * Status routes - workspace summary.
 */
export function statusRoutes(workspacePath: string) {
  const router = new Hono();

  // GET /status
  router.get('/', (c) => {
    const ledger = readLedger(workspacePath);
    const memories = computeMemories(ledger);
    const commitments = computeCommitments(ledger);
    const genesis = readGenesisKey(workspacePath);
    const config = readConfig(workspacePath);

    // Count commitment states
    const openCount = commitments.filter((c) => c.state === 'open').length;
    const claimedCount = commitments.filter((c) => c.state === 'claimed').length;
    const inReviewCount = commitments.filter((c) => c.state === 'in_review').length;
    const reopenedCount = commitments.filter((c) => c.state === 'reopened').length;
    const closedCount = commitments.filter((c) => c.state === 'closed').length;

    // Get last operation timestamp
    const lastOp = ledger.length > 0 ? ledger[ledger.length - 1] : null;

    // Check GitHub integration
    const githubLinked = getCommitmentsWithExternalRef(ledger, 'github');

    const response: Record<string, unknown> = {
      workspace: getWorkspaceName(workspacePath),
      ledger: {
        operations: ledger.length,
        last_operation: lastOp?.ts ?? null,
      },
      memories: {
        total: memories.length,
      },
      commitments: {
        total: commitments.length,
        open: openCount,
        claimed: claimedCount,
        in_review: inReviewCount,
        reopened: reopenedCount,
        closed: closedCount,
      },
      genesis_key: {
        present: genesis !== null,
        version: genesis?.genesis?.version ?? null,
      },
    };

    // Add integrations info if configured
    if (config?.integrations?.github?.enabled) {
      response.integrations = {
        github: {
          enabled: true,
          linked_commitments: githubLinked.length,
        },
      };
    }

    return c.json(response);
  });

  return router;
}
