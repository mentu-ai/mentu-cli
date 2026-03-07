/**
 * Resolve Command
 *
 * Check dependencies and spawn commitments when satisfied.
 */

import type { Command } from 'commander';
import { MentuError } from '../types.js';
import { findWorkspace } from '../core/config.js';
import { tick } from '../core/dependency-resolver.js';

interface ResolveOptions {
  dryRun?: boolean;
}

export function registerResolveCommand(program: Command): void {
  program
    .command('resolve')
    .description('Check commitment dependencies and spawn when satisfied')
    .option('--dry-run', 'Show what would be spawned without executing')
    .action(async (options: ResolveOptions) => {
      const json = program.opts().json || false;

      try {
        const workspacePath = findWorkspace(process.cwd());

        const result = await tick(workspacePath, {
          dry_run: options.dryRun,
        });

        if (json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(`Dependency Resolver Tick at ${result.tick_at}`);
          console.log(`  Checked: ${result.checked} commitments`);

          if (result.spawned.length > 0) {
            console.log(`\nSpawned (${result.spawned.length}):`);
            for (const id of result.spawned) {
              console.log(`  - ${id}${options.dryRun ? ' [dry-run]' : ''}`);
            }
          }

          if (result.blocked.length > 0) {
            console.log(`\nBlocked (${result.blocked.length}):`);
            for (const item of result.blocked) {
              console.log(`  - ${item.id} waiting on: ${item.waiting_on.join(', ')}`);
            }
          }

          if (result.errors.length > 0) {
            console.log(`\nErrors (${result.errors.length}):`);
            for (const err of result.errors) {
              console.log(`  - ${err.commitment_id}: ${err.error} (${err.code})`);
            }
          }

          if (result.spawned.length === 0 && result.blocked.length === 0) {
            console.log('\nNo commitments with dependencies found.');
          }
        }
      } catch (err) {
        const error = err instanceof MentuError
          ? err
          : new MentuError('E_INTERNAL', err instanceof Error ? err.message : 'Unknown error');

        if (json) {
          console.log(JSON.stringify({ ...error.toJSON(), op: 'resolve' }));
        } else {
          console.error(`Error: ${error.message}`);
        }
        process.exit(1);
      }
    });
}
