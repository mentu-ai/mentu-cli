// mentu sync - Synchronize local ledger with cloud

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { CloudClient } from '../cloud/client.js';
import { fullSync, getStatus } from '../cloud/sync.js';
import { loadSyncState, saveSyncState, countPendingOperations } from '../core/sync-state.js';
import { findWorkspace, readConfig, getMentuDir } from '../core/config.js';
import { getLedgerPath } from '../core/ledger.js';

export function registerSyncCommand(program: Command): void {
  program
    .command('sync')
    .description('Synchronize local ledger with cloud')
    .option('--push', 'Push local operations only')
    .option('--pull', 'Pull remote operations only')
    .option('--status', 'Show sync status without syncing')
    .option('--watch', 'Continuous sync mode')
    .option('--force', 'Sync even with warnings')
    .option('--dry-run', 'Show what would sync without doing it')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const workspacePath = findWorkspace(process.cwd());
        const config = readConfig(workspacePath);
        const cloudConfig = (config as any)?.cloud;

        if (!cloudConfig?.enabled || !cloudConfig?.workspace_id) {
          if (options.json) {
            console.log(JSON.stringify({ error: 'Workspace not connected to cloud' }));
          } else {
            console.error('Workspace not connected to cloud.');
            console.log('\nTo connect, run: mentu workspace connect <name>');
          }
          process.exit(1);
        }

        // Status mode
        if (options.status) {
          const status = await getStatus(workspacePath);

          if (options.json) {
            console.log(JSON.stringify(status));
          } else {
            console.log(`Workspace: ${cloudConfig.workspace_id}`);
            console.log(`Status: ${status.status}`);
            console.log(`Pending push: ${status.pendingOperations}`);
            console.log(`Last sync: ${status.lastSyncAt || 'never'}`);
            console.log(`Client ID: ${status.clientId}`);
          }
          return;
        }

        // Watch mode
        if (options.watch) {
          await watchAndSync(workspacePath, cloudConfig.workspace_id, options);
          return;
        }

        // Normal sync
        const client = await CloudClient.create(cloudConfig.workspace_id);

        if (!options.json) {
          console.log('Syncing...');
        }

        const result = await fullSync(client, workspacePath, {
          pushOnly: options.push,
          pullOnly: options.pull,
          dryRun: options.dryRun,
        });

        const syncState = loadSyncState(workspacePath);

        if (options.json) {
          console.log(JSON.stringify({
            success: true,
            pushed: result.pushResult?.pushed || 0,
            pulled: result.pullResult?.pulled || 0,
            warnings: result.pushResult?.warnings || [],
            syncState: {
              status: syncState.status,
              lastSyncAt: syncState.lastSyncAt,
              pendingOperations: syncState.pendingOperations,
            },
          }));
        } else {
          if (options.dryRun) {
            console.log('\nDRY RUN - no changes made\n');
          }

          if (result.pushResult && result.pushResult.pushed > 0) {
            console.log(`  ↑ ${options.dryRun ? 'Would push' : 'Pushed'} ${result.pushResult.pushed} operations`);
          }

          for (const warning of result.pushResult?.warnings || []) {
            console.log(`  ⚠ ${warning}`);
          }

          if (result.pullResult && result.pullResult.pulled > 0) {
            console.log(`  ↓ ${options.dryRun ? 'Would pull' : 'Pulled'} ${result.pullResult.pulled} operations`);
          }

          if (!result.pushResult?.pushed && !result.pullResult?.pulled) {
            console.log('  Already up to date');
          }

          if (!options.dryRun) {
            console.log(`  ✓ ${result.pushResult?.warnings?.length ? 'Synced with warnings' : 'Synced successfully'}`);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Sync failed';
        if (options.json) {
          console.log(JSON.stringify({ error: message }));
        } else {
          console.error(`Error: ${message}`);
        }
        process.exit(1);
      }
    });
}

/**
 * Watch mode - continuous sync.
 */
async function watchAndSync(
  workspacePath: string,
  workspaceId: string,
  options: { json?: boolean; force?: boolean }
): Promise<void> {
  const interval = 30000; // 30 seconds
  let isRunning = true;
  let isSyncing = false;

  if (!options.json) {
    console.log('Watching for changes... (Ctrl+C to stop)');
    console.log(`Sync interval: ${interval / 1000} seconds\n`);
  }

  const sync = async () => {
    if (isSyncing) return;
    isSyncing = true;

    try {
      const client = await CloudClient.create(workspaceId);
      const result = await fullSync(client, workspacePath);

      if (!options.json) {
        const now = new Date().toLocaleTimeString();
        if (result.pushResult?.pushed || result.pullResult?.pulled) {
          const pushed = result.pushResult?.pushed || 0;
          const pulled = result.pullResult?.pulled || 0;
          console.log(`[${now}] ↑${pushed} ↓${pulled}`);
        }
      }
    } catch (err) {
      if (!options.json) {
        const now = new Date().toLocaleTimeString();
        console.error(`[${now}] Sync error:`, err instanceof Error ? err.message : err);
      }
    } finally {
      isSyncing = false;
    }
  };

  // Initial sync
  await sync();

  // Periodic sync
  const intervalId = setInterval(sync, interval);

  // Watch for local ledger changes
  const ledgerPath = getLedgerPath(workspacePath);
  let watcher: fs.FSWatcher | null = null;
  let debounceTimer: NodeJS.Timeout | null = null;

  try {
    watcher = fs.watch(ledgerPath, () => {
      // Debounce to avoid multiple syncs for rapid changes
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        if (!options.json) {
          console.log('[File changed] Syncing...');
        }
        sync();
      }, 1000);
    });
  } catch {
    // Ledger file might not exist yet, that's okay
  }

  // Handle SIGINT gracefully
  process.on('SIGINT', () => {
    isRunning = false;
    clearInterval(intervalId);
    if (watcher) {
      watcher.close();
    }
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    if (!options.json) {
      console.log('\nStopped watching.');
    }
    process.exit(0);
  });

  // Keep process alive
  await new Promise(() => {});
}
