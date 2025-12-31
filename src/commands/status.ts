import type { Command } from 'commander';
import type { StatusOutput } from '../types.js';
import { MentuError } from '../types.js';
import { findWorkspace, getWorkspaceName } from '../core/config.js';
import { readLedger } from '../core/ledger.js';
import { computeCommitments } from '../core/state.js';

function outputError(error: MentuError, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ ...error.toJSON(), op: 'status' }));
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
}

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show current commitment state')
    .action(() => {
      const json = program.opts().json || false;

      try {
        const workspacePath = findWorkspace(process.cwd());
        const workspace = getWorkspaceName(workspacePath);
        const ledger = readLedger(workspacePath);
        const commitments = computeCommitments(ledger);

        const open: StatusOutput['open'] = [];
        const claimed: StatusOutput['claimed'] = [];
        const in_review: StatusOutput['in_review'] = [];
        const reopened: StatusOutput['reopened'] = [];
        const closed: StatusOutput['closed'] = [];

        for (const cmt of commitments) {
          switch (cmt.state) {
            case 'open':
              open.push({
                id: cmt.id,
                body: cmt.body,
                owner: null,
              });
              break;
            case 'claimed':
              claimed.push({
                id: cmt.id,
                body: cmt.body,
                owner: cmt.owner!,
              });
              break;
            case 'in_review':
              in_review.push({
                id: cmt.id,
                body: cmt.body,
                owner: cmt.owner,
                evidence: cmt.evidence,
              });
              break;
            case 'reopened':
              reopened.push({
                id: cmt.id,
                body: cmt.body,
                owner: cmt.owner,
              });
              break;
            case 'closed':
              closed.push({
                id: cmt.id,
                body: cmt.body,
                closed_by: cmt.closed_by ?? 'unknown',
                evidence: cmt.evidence,
              });
              break;
          }
        }

        const result: StatusOutput = {
          workspace,
          open,
          claimed,
          in_review,
          reopened,
          closed,
        };

        if (json) {
          console.log(JSON.stringify(result));
        } else {
          console.log(`Workspace: ${workspace}`);
          console.log('');

          if (open.length > 0) {
            console.log('Open:');
            for (const cmt of open) {
              console.log(`  ${cmt.id}: ${cmt.body}`);
            }
            console.log('');
          }

          if (claimed.length > 0) {
            console.log('Claimed:');
            for (const cmt of claimed) {
              console.log(`  ${cmt.id}: ${cmt.body} (by ${cmt.owner})`);
            }
            console.log('');
          }

          if (in_review.length > 0) {
            console.log('In Review:');
            for (const cmt of in_review) {
              const ownerLabel = cmt.owner ? ` (by ${cmt.owner})` : '';
              console.log(`  ${cmt.id}: ${cmt.body}${ownerLabel}`);
            }
            console.log('');
          }

          if (reopened.length > 0) {
            console.log('Reopened:');
            for (const cmt of reopened) {
              const ownerLabel = cmt.owner ? ` (by ${cmt.owner})` : '';
              console.log(`  ${cmt.id}: ${cmt.body}${ownerLabel}`);
            }
            console.log('');
          }

          if (closed.length > 0) {
            console.log('Closed:');
            for (const cmt of closed) {
              console.log(`  ${cmt.id}: ${cmt.body} (by ${cmt.closed_by})`);
            }
            console.log('');
          }

          if (
            open.length === 0 &&
            claimed.length === 0 &&
            in_review.length === 0 &&
            reopened.length === 0 &&
            closed.length === 0
          ) {
            console.log('No commitments found.');
          }
        }
      } catch (err) {
        if (err instanceof MentuError) {
          outputError(err, json);
        } else {
          const error = new MentuError(
            'E_INVALID_OP',
            err instanceof Error ? err.message : 'Unknown error'
          );
          outputError(error, json);
        }
      }
    });
}
