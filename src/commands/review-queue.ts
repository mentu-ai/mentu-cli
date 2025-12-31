import type { Command } from 'commander';
import { findWorkspace, readConfig } from '../core/config.js';
import { readLedger } from '../core/ledger.js';
import { computeCommitmentState, getCommitment } from '../core/state.js';
import { resolveActor } from '../utils/actor.js';
import type { ApproveOperation, Operation, SubmitOperation } from '../types.js';

interface ReviewQueueOptions {
  mine?: boolean;
  tier?: string;
  all?: boolean;
  actor?: string;
}

interface QueueItem {
  id: string;
  body: string;
  actor: string;
  tier: string;
  state: 'in_review' | 'closed';
  submittedAt?: string;
  evidence: string[];
}

function getLatestSubmitOps(ledger: Operation[]): Map<string, SubmitOperation> {
  const latest = new Map<string, SubmitOperation>();
  for (const op of ledger) {
    if (op.op === 'submit') {
      latest.set(op.payload.commitment, op as SubmitOperation);
    }
  }
  return latest;
}

function getLatestApproveOps(ledger: Operation[]): Map<string, ApproveOperation> {
  const latest = new Map<string, ApproveOperation>();
  for (const op of ledger) {
    if (op.op === 'approve') {
      latest.set(op.payload.commitment, op as ApproveOperation);
    }
  }
  return latest;
}

function determineTier(submitOp: SubmitOperation, commitmentTags: string[] | undefined): string {
  const tier = submitOp.payload.tier;
  if (typeof tier === 'string' && tier.length > 0) return tier;

  const tags = commitmentTags ?? [];
  for (const candidate of ['tier_1', 'tier_2', 'tier_3']) {
    if (tags.includes(candidate)) return candidate;
  }

  return 'tier_2';
}

function outputResult(items: QueueItem[], json: boolean): void {
  if (json) {
    console.log(JSON.stringify(items));
  } else {
    if (items.length === 0) {
      console.log('Review queue is empty');
      return;
    }

    console.log(`Review Queue (${items.length} items)\n`);

    // Group by tier
    const tier1 = items.filter((i) => i.tier === 'tier_1');
    const tier2 = items.filter((i) => i.tier === 'tier_2');
    const tier3 = items.filter((i) => i.tier === 'tier_3');
    const other = items.filter((i) => !['tier_1', 'tier_2', 'tier_3'].includes(i.tier));

    if (tier1.length > 0) {
      console.log('TIER 1 (auto-approved):');
      for (const item of tier1) {
        const preview = item.body.length > 40 ? `${item.body.slice(0, 40)}...` : item.body;
        console.log(`  ${item.id}  "${preview}"  [${item.actor}]`);
      }
      console.log();
    }

    if (tier2.length > 0) {
      console.log('TIER 2 (async review):');
      for (const item of tier2) {
        const preview = item.body.length > 40 ? `${item.body.slice(0, 40)}...` : item.body;
        console.log(`  ${item.id}  "${preview}"  [${item.actor}]`);
      }
      console.log();
    }

    if (tier3.length > 0) {
      console.log('TIER 3 (requires approval):');
      for (const item of tier3) {
        const preview = item.body.length > 40 ? `${item.body.slice(0, 40)}...` : item.body;
        console.log(`  ${item.id}  "${preview}"  [${item.actor}]`);
      }
      console.log();
    }

    if (other.length > 0) {
      console.log('OTHER:');
      for (const item of other) {
        const preview = item.body.length > 40 ? `${item.body.slice(0, 40)}...` : item.body;
        console.log(`  ${item.id}  "${preview}"  [${item.actor}]`);
      }
    }
  }
}

export function registerReviewQueueCommand(program: Command): void {
  program
    .command('review-queue')
    .description('List commitments awaiting review')
    .option('-m, --mine', 'Only show commitments I submitted')
    .option('-t, --tier <tier>', 'Filter by tier (tier_1, tier_2, tier_3)')
    .option('-a, --all', 'Show all, including auto-approved')
    .option('--actor <id>', 'Override actor identity')
    .action(async (options: ReviewQueueOptions) => {
      const json = program.opts().json || false;

      try {
        const workspacePath = findWorkspace(process.cwd());
        const ledger = readLedger(workspacePath);
        const config = readConfig(workspacePath);
        const currentActor = resolveActor(options.actor, config ?? undefined);

        const latestSubmitOps = getLatestSubmitOps(ledger);
        const latestApproveOps = getLatestApproveOps(ledger);
        const queueItems: QueueItem[] = [];

        for (const [commitmentId, submitOp] of latestSubmitOps.entries()) {
          const state = computeCommitmentState(ledger, commitmentId);

          const isAutoApproved =
            state.state === 'closed' && latestApproveOps.get(commitmentId)?.payload.auto === true;

          if (state.state !== 'in_review' && !(options.all && isAutoApproved)) continue;

          // Mine filter is based on submitter (not committer)
          if (options.mine && submitOp.actor !== currentActor) continue;

          const commitment = getCommitment(ledger, commitmentId);
          if (!commitment) continue;

          const tier = determineTier(submitOp, commitment.tags);

          if (options.tier && tier !== options.tier) continue;

          queueItems.push({
            id: commitmentId,
            body: commitment.body,
            actor: submitOp.actor,
            tier,
            state: state.state === 'in_review' ? 'in_review' : 'closed',
            submittedAt: submitOp.ts,
            evidence: submitOp.payload.evidence ?? [],
          });
        }

        outputResult(queueItems, json);
      } catch (err) {
        if (json) {
          console.log(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }));
        } else {
          console.error(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
        process.exit(1);
      }
    });
}
