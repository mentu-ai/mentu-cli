import type { Command } from 'commander';
import type { Memory, Commitment, Operation } from '../types.js';
import { MentuError } from '../types.js';
import { findWorkspace } from '../core/config.js';
import { readLedger } from '../core/ledger.js';
import {
  getMemory,
  getCommitment,
  getLinkedMemories,
  getLinkedCommitments,
  getDuplicates,
  computeCommitmentState,
} from '../core/state.js';
import { formatTimestamp } from '../utils/time.js';
import { getIdPrefix } from '../utils/id.js';

interface ShowOptions {
  links?: boolean;
  duplicates?: boolean;
}

function outputError(error: MentuError, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ ...error.toJSON(), op: 'show' }));
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
}

function formatMemory(memory: Memory): void {
  console.log(`Memory: ${memory.id}`);
  console.log(`  Body: ${memory.body}`);
  console.log(`  Actor: ${memory.actor}`);
  console.log(`  Time: ${formatTimestamp(memory.ts)}`);

  if (memory.kind) {
    console.log(`  Kind: ${memory.kind}`);
  }

  if (memory.refs && memory.refs.length > 0) {
    console.log(`  Refs: ${memory.refs.join(', ')}`);
  }

  if (memory.annotations.length > 0) {
    console.log('  Annotations:');
    for (const ann of memory.annotations) {
      console.log(`    - ${ann.id} (${ann.actor}): ${ann.body}`);
    }
  }
}

function formatCommitment(commitment: Commitment, ledger: Operation[], showLinks: boolean, showDuplicates: boolean): void {
  const fullState = computeCommitmentState(ledger, commitment.id);

  console.log(`Commitment: ${commitment.id}`);
  console.log(`  Body: ${commitment.body}`);
  console.log(`  Source: ${commitment.source}`);
  console.log(`  Actor: ${commitment.actor}`);
  console.log(`  Time: ${formatTimestamp(commitment.ts)}`);

  if (fullState.state === 'duplicate') {
    console.log(`  State: duplicate`);
    console.log(`  Duplicate of: ${fullState.duplicate_of}`);
  } else {
    console.log(`  State: ${commitment.state}`);
  }

  if (commitment.owner) {
    console.log(`  Owner: ${commitment.owner}`);
  }

  if (commitment.evidence) {
    console.log(`  Evidence: ${commitment.evidence}`);
  }

  if (commitment.closed_by) {
    console.log(`  Closed by: ${commitment.closed_by}`);
  }

  if (commitment.tags && commitment.tags.length > 0) {
    console.log(`  Tags: ${commitment.tags.join(', ')}`);
  }

  if (commitment.annotations.length > 0) {
    console.log('  Annotations:');
    for (const ann of commitment.annotations) {
      console.log(`    - ${ann.id} (${ann.actor}): ${ann.body}`);
    }
  }

  if (showLinks) {
    const linkedMemories = getLinkedMemories(ledger, commitment.id);
    const linkedCommitments = getLinkedCommitments(ledger, commitment.id);

    if (linkedMemories.length > 0 || linkedCommitments.length > 0) {
      console.log('  Linked:');
      for (const memId of linkedMemories) {
        console.log(`    - ${memId} (memory)`);
      }
      for (const cmtId of linkedCommitments) {
        console.log(`    - ${cmtId} (commitment)`);
      }
    } else {
      console.log('  Linked: (none)');
    }
  }

  if (showDuplicates) {
    const duplicates = getDuplicates(ledger, commitment.id);

    if (duplicates.length > 0) {
      console.log('  Duplicates:');
      for (const dupId of duplicates) {
        console.log(`    - ${dupId}`);
      }
    } else {
      console.log('  Duplicates: (none)');
    }
  }
}

export function registerShowCommand(program: Command): void {
  program
    .command('show <id>')
    .description('Show record details')
    .option('--links', 'Show linked memories (for commitments)')
    .option('--duplicates', 'Show duplicate commitments (for commitments)')
    .action((id: string, options: ShowOptions) => {
      const json = program.opts().json || false;

      try {
        const workspacePath = findWorkspace(process.cwd());
        const ledger = readLedger(workspacePath);
        const prefix = getIdPrefix(id);

        let record: Memory | Commitment | null = null;

        if (prefix === 'mem') {
          record = getMemory(ledger, id);
        } else if (prefix === 'cmt') {
          record = getCommitment(ledger, id);
        } else {
          // Try both
          record = getMemory(ledger, id) || getCommitment(ledger, id);
        }

        if (!record) {
          throw new MentuError(
            'E_REF_NOT_FOUND',
            `Record ${id} does not exist`,
            { value: id }
          );
        }

        if (json) {
          // For JSON output, add links and duplicates if requested
          if ('source' in record) {
            const fullState = computeCommitmentState(ledger, record.id);
            const output: Record<string, unknown> = { ...record };

            if (fullState.state === 'duplicate') {
              output.duplicate_of = fullState.duplicate_of;
            }

            if (options.links) {
              output.linked_memories = getLinkedMemories(ledger, record.id);
              output.linked_commitments = getLinkedCommitments(ledger, record.id);
            }

            if (options.duplicates) {
              output.duplicates = getDuplicates(ledger, record.id);
            }

            console.log(JSON.stringify(output));
          } else {
            console.log(JSON.stringify(record));
          }
        } else {
          if ('source' in record) {
            formatCommitment(record as Commitment, ledger, options.links || false, options.duplicates || false);
          } else {
            formatMemory(record as Memory);
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
