// mentu wait command
// Query-only mode for wait conditions
// Note: Wait conditions MUST be set at commit time (not via annotation)
// This command is for QUERYING wait status, not adding wait conditions

import type { Command } from 'commander';
import { MentuError } from '../types.js';
import { findWorkspace, readConfig } from '../core/config.js';
import { readLedger } from '../core/ledger.js';
import { computeCommitments } from '../core/state.js';
import { getWaitingCommitments, computeTemporalState, getTemporalMeta } from '../core/temporal.js';

interface WaitOptions {
  list?: boolean;
  status?: boolean;
}

interface WaitStatusOutput {
  id: string;
  body: string;
  state: string;
  temporal_state: string;
  wait_conditions: {
    wait_for?: string;
    wait_for_all?: string[];
    wait_for_any?: string[];
    wait_until?: string;
  };
  is_waiting: boolean;
  is_claimable: boolean;
}

interface WaitListItem {
  id: string;
  body: string;
  temporal_state: string;
  wait_for?: string;
  wait_for_all?: string[];
  wait_for_any?: string[];
  wait_until?: string;
}

function outputStatus(status: WaitStatusOutput, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(status));
  } else {
    console.log(`Wait status for ${status.id}:`);
    console.log(`  Body: ${status.body}`);
    console.log(`  State: ${status.state}`);
    console.log(`  Temporal: ${status.temporal_state}`);
    if (status.wait_conditions.wait_until) console.log(`  Wait until: ${status.wait_conditions.wait_until}`);
    if (status.wait_conditions.wait_for) console.log(`  Wait for: ${status.wait_conditions.wait_for}`);
    if (status.wait_conditions.wait_for_all) console.log(`  Wait for all: ${status.wait_conditions.wait_for_all.join(', ')}`);
    if (status.wait_conditions.wait_for_any) console.log(`  Wait for any: ${status.wait_conditions.wait_for_any.join(', ')}`);
    console.log(`  Claimable: ${status.is_claimable ? 'yes' : 'no'}`);
  }
}

function outputList(items: WaitListItem[], json: boolean): void {
  if (json) {
    console.log(JSON.stringify(items));
  } else {
    if (items.length === 0) {
      console.log('No waiting commitments.');
    } else {
      console.log('Waiting commitments:');
      for (const item of items) {
        console.log(`  ${item.id}: ${item.body}`);
        if (item.wait_until) console.log(`    Until: ${item.wait_until}`);
        if (item.wait_for) console.log(`    For: ${item.wait_for}`);
        if (item.wait_for_all) console.log(`    For all: ${item.wait_for_all.join(', ')}`);
        if (item.wait_for_any) console.log(`    For any: ${item.wait_for_any.join(', ')}`);
      }
    }
  }
}

function outputHelp(): void {
  console.log('Usage:');
  console.log('  mentu wait --list              List all waiting commitments');
  console.log('  mentu wait <commitment>        Show wait status for commitment');
  console.log('');
  console.log('Note: Wait conditions must be set at commit time:');
  console.log('  mentu commit "Task" --source mem_x --meta \'{"wait_for": "cmt_y"}\'');
}

function outputError(error: MentuError, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ ...error.toJSON(), op: 'wait' }));
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
}

export function registerWaitCommand(program: Command): void {
  program
    .command('wait [commitment]')
    .description('Query wait conditions on commitments')
    .option('--list', 'List all waiting commitments')
    .option('--status', 'Show detailed wait status for a commitment')
    .action((commitment: string | undefined, options: WaitOptions) => {
      const json = program.opts().json || false;

      try {
        const workspacePath = findWorkspace(process.cwd());
        const operations = readLedger(workspacePath);
        const commitments = computeCommitments(operations);
        const commitmentMap = new Map(commitments.map(c => [c.id, c]));
        const now = new Date();

        // List mode: show all waiting commitments
        if (options.list) {
          const waiting = getWaitingCommitments(commitments, now, commitmentMap);

          const items: WaitListItem[] = waiting.map(c => {
            const meta = c.meta as Record<string, unknown> | undefined;
            return {
              id: c.id,
              body: c.body,
              temporal_state: computeTemporalState(c, now, commitmentMap),
              wait_for: meta?.wait_for as string | undefined,
              wait_for_all: meta?.wait_for_all as string[] | undefined,
              wait_for_any: meta?.wait_for_any as string[] | undefined,
              wait_until: meta?.wait_until as string | undefined,
            };
          });

          outputList(items, json);
          return;
        }

        // Status mode: show wait status for specific commitment
        if (commitment) {
          const cmt = commitments.find(c => c.id === commitment);
          if (!cmt) {
            throw new MentuError('E_REF_NOT_FOUND', `Commitment not found: ${commitment}`, {
              field: 'commitment',
              value: commitment,
            });
          }

          const temporal = getTemporalMeta(cmt);
          const temporalState = computeTemporalState(cmt, now, commitmentMap);

          const status: WaitStatusOutput = {
            id: cmt.id,
            body: cmt.body,
            state: cmt.state,
            temporal_state: temporalState,
            wait_conditions: {
              wait_for: temporal?.wait_for,
              wait_for_all: temporal?.wait_for_all,
              wait_for_any: temporal?.wait_for_any,
              wait_until: temporal?.wait_until,
            },
            is_waiting: temporalState === 'waiting',
            is_claimable: temporalState !== 'waiting' && cmt.state === 'open',
          };

          outputStatus(status, json);
          return;
        }

        // No arguments: show help
        if (!json) {
          outputHelp();
        } else {
          console.log(JSON.stringify({ help: 'Use --list or provide a commitment ID' }));
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
