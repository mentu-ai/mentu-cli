import type { Command } from 'commander';
import type { Memory, Commitment } from '../types.js';
import { MentuError } from '../types.js';
import { findWorkspace } from '../core/config.js';
import { readLedger } from '../core/ledger.js';
import {
  computeMemories,
  computeCommitments,
  computeMemoryState,
  computeCommitmentState,
} from '../core/state.js';

interface ListMemoriesOptions {
  untriaged?: boolean;
  linked?: boolean;
  dismissed?: boolean;
  committed?: boolean;
  kind?: string;
}

interface ListCommitmentsOptions {
  state?: string;
  duplicates?: boolean;
}

function outputError(error: MentuError, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ ...error.toJSON(), op: 'list' }));
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
}

export function registerListCommand(program: Command): void {
  const listCmd = program
    .command('list')
    .description('List memories or commitments with filters');

  // mentu list memories [options]
  listCmd
    .command('memories')
    .description('List memories with triage state filters')
    .option('--untriaged', 'Show only untriaged memories')
    .option('--linked', 'Show only linked memories')
    .option('--dismissed', 'Show only dismissed memories')
    .option('--committed', 'Show only memories that are sources of commitments')
    .option('-k, --kind <kind>', 'Filter by kind')
    .action((options: ListMemoriesOptions) => {
      const json = program.opts().json || false;

      try {
        const workspacePath = findWorkspace(process.cwd());
        const ledger = readLedger(workspacePath);
        let memories = computeMemories(ledger);

        // Apply triage state filters
        if (options.untriaged || options.linked || options.dismissed || options.committed) {
          memories = memories.filter(mem => {
            const state = computeMemoryState(ledger, mem.id);
            if (options.untriaged && state === 'untriaged') return true;
            if (options.linked && state === 'linked') return true;
            if (options.dismissed && state === 'dismissed') return true;
            if (options.committed && state === 'committed') return true;
            return false;
          });
        }

        // Apply kind filter
        if (options.kind) {
          memories = memories.filter(mem => mem.kind === options.kind);
        }

        if (json) {
          // Add triage state to JSON output
          const memoriesWithState = memories.map(mem => ({
            ...mem,
            triage_state: computeMemoryState(ledger, mem.id),
          }));
          console.log(JSON.stringify(memoriesWithState));
        } else {
          if (memories.length === 0) {
            console.log('No memories found.');
            return;
          }

          for (const mem of memories) {
            const state = computeMemoryState(ledger, mem.id);
            const stateLabel = state === 'untriaged' ? '[UNTRIAGED]' :
                             state === 'linked' ? '[LINKED]' :
                             state === 'dismissed' ? '[DISMISSED]' :
                             '[COMMITTED]';

            console.log(`${mem.id} ${stateLabel}`);
            console.log(`  ${mem.body.slice(0, 60)}${mem.body.length > 60 ? '...' : ''}`);
            if (mem.kind) console.log(`  Kind: ${mem.kind}`);
            console.log('');
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

  // mentu list commitments [options]
  listCmd
    .command('commitments')
    .description('List commitments with state filters')
    .option('-s, --state <state>', 'Filter by state: open|claimed|in_review|reopened|closed')
    .option('--duplicates', 'Show only commitments closed as duplicates')
    .action((options: ListCommitmentsOptions) => {
      const json = program.opts().json || false;

      try {
        const workspacePath = findWorkspace(process.cwd());
        const ledger = readLedger(workspacePath);
        let commitments = computeCommitments(ledger);

        // Apply state filter
        if (options.state) {
          commitments = commitments.filter(cmt => cmt.state === options.state);
        }

        // Apply duplicates filter
        if (options.duplicates) {
          commitments = commitments.filter(cmt => {
            const state = computeCommitmentState(ledger, cmt.id);
            return state.state === 'duplicate';
          });
        }

        if (json) {
          // Add duplicate_of to JSON output where applicable
          const commitmentsWithDuplicate = commitments.map(cmt => {
            const state = computeCommitmentState(ledger, cmt.id);
            return {
              ...cmt,
              ...(state.duplicate_of && { duplicate_of: state.duplicate_of }),
            };
          });
          console.log(JSON.stringify(commitmentsWithDuplicate));
        } else {
          if (commitments.length === 0) {
            console.log('No commitments found.');
            return;
          }

          for (const cmt of commitments) {
            const fullState = computeCommitmentState(ledger, cmt.id);
            const stateLabel = fullState.state === 'duplicate' ?
              `[DUPLICATE of ${fullState.duplicate_of}]` :
              `[${cmt.state.toUpperCase()}]`;

            console.log(`${cmt.id} ${stateLabel}`);
            console.log(`  ${cmt.body.slice(0, 60)}${cmt.body.length > 60 ? '...' : ''}`);
            if (cmt.owner) console.log(`  Owner: ${cmt.owner}`);
            console.log('');
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
