// mentu workspace - Manage cloud workspaces

import { Command } from 'commander';
import { CloudClient } from '../cloud/client.js';
import { findWorkspace, readConfig, writeConfig, getWorkspaceName } from '../core/config.js';
import { initSyncState, loadSyncState } from '../core/sync-state.js';
import { selectFromList, isInteractive } from '../utils/prompt.js';
import type { Config } from '../types.js';

export function registerWorkspaceCommand(program: Command): void {
  const workspace = program
    .command('workspace')
    .description('Manage cloud workspaces');

  // mentu workspace create <name>
  workspace
    .command('create <name>')
    .description('Create a new cloud workspace')
    .option('--display-name <name>', 'Display name for the workspace')
    .option('--json', 'Output as JSON')
    .action(async (name: string, options) => {
      try {
        const client = await CloudClient.create();
        const result = await client.createWorkspace(name, options.displayName);

        if (result.error) {
          if (options.json) {
            console.log(JSON.stringify({ error: result.error }));
          } else {
            console.error(`Error: ${result.error}`);
          }
          process.exit(1);
        }

        const ws = result.workspace!;

        // Update local config with workspace ID
        try {
          const workspacePath = findWorkspace(process.cwd());
          const config = readConfig(workspacePath) || { workspace: name, created: new Date().toISOString() };

          const updatedConfig: Config = {
            ...config,
            cloud: {
              enabled: true,
              endpoint: process.env.SUPABASE_URL || '',
              workspace_id: ws.id,
            },
          };

          writeConfig(workspacePath, updatedConfig);
          initSyncState(workspacePath, ws.id);
        } catch {
          // Not in a workspace directory, that's okay
        }

        if (options.json) {
          console.log(JSON.stringify(ws));
        } else {
          console.log(`Created workspace: ${name}`);
          console.log(`Workspace ID: ${ws.id}`);
          console.log(`\nRun "mentu sync" to sync your local ledger to the cloud.`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create workspace';
        if (options.json) {
          console.log(JSON.stringify({ error: message }));
        } else {
          console.error(`Error: ${message}`);
        }
        process.exit(1);
      }
    });

  // mentu workspace connect [name]
  workspace
    .command('connect [name]')
    .description('Connect local workspace to existing cloud workspace')
    .option('--json', 'Output as JSON')
    .action(async (name: string | undefined, options) => {
      try {
        const workspacePath = findWorkspace(process.cwd());
        const client = await CloudClient.create();

        // If no name provided, show interactive picker or error
        let resolvedName = name;
        if (!resolvedName) {
          if (!isInteractive(options)) {
            const msg = 'Workspace name required in non-interactive mode.';
            if (options.json) {
              console.log(JSON.stringify({ error: msg }));
            } else {
              console.error(`Error: ${msg}`);
              console.log('Usage: mentu workspace connect <name>');
            }
            process.exit(1);
          }

          // Interactive picker
          const workspaces = await client.listWorkspaces();
          if (workspaces.length === 0) {
            if (options.json) {
              console.log(JSON.stringify({ error: 'No workspaces found' }));
            } else {
              console.log('No workspaces found.');
              console.log('\nTo create one, run: mentu workspace create <name>');
            }
            process.exit(1);
          }

          const items = workspaces.map(w => `${w.name} [${w.role}]`);
          const idx = await selectFromList(items, 'Connect to workspace');
          if (idx < 0) {
            console.log('Cancelled.');
            return;
          }
          resolvedName = workspaces[idx].name;
        }

        const result = await client.getWorkspaceByName(resolvedName);

        if (result.error) {
          if (options.json) {
            console.log(JSON.stringify({ error: result.error }));
          } else {
            console.error(`Error: ${result.error}`);
            console.log(`\nTo create a new workspace, run: mentu workspace create ${resolvedName}`);
          }
          process.exit(1);
        }

        const ws = result.workspace!;

        // Update local config
        const config = readConfig(workspacePath) || { workspace: resolvedName, created: new Date().toISOString() };

        const updatedConfig: Config = {
          ...config,
          cloud: {
            enabled: true,
            endpoint: process.env.SUPABASE_URL || '',
            workspace_id: ws.id,
          },
        };

        writeConfig(workspacePath, updatedConfig);
        initSyncState(workspacePath, ws.id);

        if (options.json) {
          console.log(JSON.stringify({ connected: true, workspace: ws }));
        } else {
          console.log(`Connected to workspace: ${resolvedName}`);
          console.log(`Workspace ID: ${ws.id}`);
          console.log(`Role: ${ws.role}`);
          console.log(`\nRun "mentu sync" to sync with the cloud.`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to connect workspace';
        if (options.json) {
          console.log(JSON.stringify({ error: message }));
        } else {
          console.error(`Error: ${message}`);
        }
        process.exit(1);
      }
    });

  // mentu workspace list
  workspace
    .command('list')
    .description('List your workspaces')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const client = await CloudClient.create();
        const workspaces = await client.listWorkspaces();

        // Get current workspace ID if in a mentu workspace
        let currentWorkspaceId: string | null = null;
        try {
          const workspacePath = findWorkspace(process.cwd());
          const config = readConfig(workspacePath);
          currentWorkspaceId = (config as any)?.cloud?.workspace_id || null;
        } catch {
          // Not in a workspace
        }

        if (options.json) {
          console.log(JSON.stringify({ workspaces, current: currentWorkspaceId }));
        } else {
          if (workspaces.length === 0) {
            console.log('No workspaces found.');
            console.log('\nTo create a new workspace, run: mentu workspace create <name>');
          } else {
            console.log('Workspaces:\n');
            for (const ws of workspaces) {
              const current = ws.id === currentWorkspaceId ? ' (current)' : '';
              const displayName = ws.displayName ? ` - ${ws.displayName}` : '';
              console.log(`  ${ws.name}${displayName} [${ws.role}]${current}`);
            }
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to list workspaces';
        if (options.json) {
          console.log(JSON.stringify({ error: message }));
        } else {
          console.error(`Error: ${message}`);
        }
        process.exit(1);
      }
    });

  // mentu workspace info
  workspace
    .command('info')
    .description('Show current workspace details')
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
            console.log('Workspace not connected to cloud.');
            console.log('\nTo connect, run: mentu workspace connect <name>');
          }
          process.exit(1);
        }

        const client = await CloudClient.create(cloudConfig.workspace_id);
        const syncState = loadSyncState(workspacePath);
        const workspaces = await client.listWorkspaces();
        const currentWs = workspaces.find(w => w.id === cloudConfig.workspace_id);

        if (options.json) {
          console.log(JSON.stringify({
            workspace: currentWs,
            syncState: {
              status: syncState.status,
              lastSyncAt: syncState.lastSyncAt,
              clientId: syncState.clientId,
              pendingOperations: syncState.pendingOperations,
            },
          }));
        } else {
          console.log(`Workspace: ${currentWs?.name || 'Unknown'}`);
          if (currentWs?.displayName) {
            console.log(`Display Name: ${currentWs.displayName}`);
          }
          console.log(`Workspace ID: ${cloudConfig.workspace_id}`);
          console.log(`Role: ${currentWs?.role || 'Unknown'}`);
          console.log(`Cloud: ${cloudConfig.endpoint}`);
          console.log(`\nSync Status:`);
          console.log(`  Status: ${syncState.status}`);
          console.log(`  Client ID: ${syncState.clientId}`);
          console.log(`  Last Sync: ${syncState.lastSyncAt || 'never'}`);
          console.log(`  Pending: ${syncState.pendingOperations} operations`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get workspace info';
        if (options.json) {
          console.log(JSON.stringify({ error: message }));
        } else {
          console.error(`Error: ${message}`);
        }
        process.exit(1);
      }
    });

  // mentu workspace invite [email]
  workspace
    .command('invite [email]')
    .description('Invite someone to the workspace')
    .option('--role <role>', 'Role: member or admin', 'member')
    .option('--link', 'Generate invite link instead of email')
    .option('--expires <days>', 'Link expiry in days', '7')
    .option('--json', 'Output as JSON')
    .action(async (email: string | undefined, options) => {
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

        const client = await CloudClient.create(cloudConfig.workspace_id);
        const role = options.role === 'admin' ? 'admin' : 'member';

        if (options.link) {
          // Generate invite link
          const result = await client.createInviteLink(role, parseInt(options.expires));

          if (result.error) {
            if (options.json) {
              console.log(JSON.stringify({ error: result.error }));
            } else {
              console.error(`Error: ${result.error}`);
            }
            process.exit(1);
          }

          const invite = result.invite!;

          if (options.json) {
            console.log(JSON.stringify(invite));
          } else {
            console.log(`Invite link (expires in ${options.expires} days):`);
            console.log(`\n  https://mentu.ai/join/${invite.token}\n`);
            console.log(`Role: ${role}`);
          }
        } else {
          // Email invite
          if (!email) {
            if (options.json) {
              console.log(JSON.stringify({ error: 'Email required (or use --link)' }));
            } else {
              console.error('Email required (or use --link to generate invite link)');
            }
            process.exit(1);
          }

          const result = await client.inviteByEmail(email, role);

          if (result.error) {
            if (options.json) {
              console.log(JSON.stringify({ error: result.error }));
            } else {
              console.error(`Error: ${result.error}`);
            }
            process.exit(1);
          }

          if (options.json) {
            console.log(JSON.stringify({ invited: email, role }));
          } else {
            console.log(`Invited ${email} as ${role}`);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to invite';
        if (options.json) {
          console.log(JSON.stringify({ error: message }));
        } else {
          console.error(`Error: ${message}`);
        }
        process.exit(1);
      }
    });

  // mentu workspace disconnect
  workspace
    .command('disconnect')
    .description('Disconnect local workspace from cloud')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const workspacePath = findWorkspace(process.cwd());
        const config = readConfig(workspacePath);

        if (!config) {
          if (options.json) {
            console.log(JSON.stringify({ error: 'No workspace configuration found' }));
          } else {
            console.error('No workspace configuration found.');
          }
          process.exit(1);
        }

        // Remove cloud config
        delete (config as any).cloud;
        writeConfig(workspacePath, config);

        if (options.json) {
          console.log(JSON.stringify({ disconnected: true }));
        } else {
          console.log('Disconnected from cloud.');
          console.log('Local ledger is preserved.');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to disconnect';
        if (options.json) {
          console.log(JSON.stringify({ error: message }));
        } else {
          console.error(`Error: ${message}`);
        }
        process.exit(1);
      }
    });
}
