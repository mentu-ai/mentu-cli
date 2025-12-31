import type { Command } from 'commander';
import type { Operation } from '../types.js';
import { MentuError } from '../types.js';
import { findWorkspace } from '../core/config.js';
import { readLedger } from '../core/ledger.js';
import { formatTimestamp } from '../utils/time.js';

interface LogOptions {
  limit?: string;
  op?: string;
}

function getOpDescription(op: Operation): string {
  switch (op.op) {
    case 'capture':
      return `Captured: "${op.payload.body.slice(0, 50)}${op.payload.body.length > 50 ? '...' : ''}"`;
    case 'commit':
      return `Committed: "${op.payload.body.slice(0, 50)}${op.payload.body.length > 50 ? '...' : ''}" (source: ${op.payload.source})`;
    case 'claim':
      return `Claimed: ${op.payload.commitment}`;
    case 'release':
      return `Released: ${op.payload.commitment}${op.payload.reason ? ` (${op.payload.reason})` : ''}`;
    case 'close':
      return `Closed: ${op.payload.commitment} (evidence: ${op.payload.evidence})`;
    case 'annotate':
      return `Annotated ${op.payload.target}: "${op.payload.body.slice(0, 50)}${op.payload.body.length > 50 ? '...' : ''}"`;
    default:
      return 'Unknown operation';
  }
}

function outputError(error: MentuError, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ ...error.toJSON(), op: 'log' }));
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
}

export function registerLogCommand(program: Command): void {
  program
    .command('log')
    .description('Show operation history')
    .option('-n, --limit <count>', 'Number of operations to show')
    .option('-o, --op <type>', 'Filter by operation type')
    .action((options: LogOptions) => {
      const json = program.opts().json || false;

      try {
        const workspacePath = findWorkspace(process.cwd());
        let ledger = readLedger(workspacePath);

        // Filter by operation type
        if (options.op) {
          ledger = ledger.filter((op) => op.op === options.op);
        }

        // Reverse to show newest first
        ledger = ledger.reverse();

        // Limit
        const limit = options.limit ? parseInt(options.limit, 10) : undefined;
        if (limit && limit > 0) {
          ledger = ledger.slice(0, limit);
        }

        if (json) {
          console.log(JSON.stringify(ledger));
        } else {
          if (ledger.length === 0) {
            console.log('No operations found.');
            return;
          }

          for (const op of ledger) {
            const time = formatTimestamp(op.ts);
            const desc = getOpDescription(op);
            console.log(`${op.id} [${op.op}] ${time}`);
            console.log(`  ${op.actor}: ${desc}`);
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
