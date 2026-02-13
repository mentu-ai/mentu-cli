// mentu login - Authenticate with Mentu Cloud

import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import http from 'http';
import { createClient } from '@supabase/supabase-js';
import { saveCredentials, getCredentials, getSupabaseUrl, getSupabaseAnonKey, checkCredentialState } from '../cloud/auth.js';
import { CloudClient } from '../cloud/client.js';
import { findWorkspace, readConfig, writeConfig, getMentuDir } from '../core/config.js';
import { initSyncState } from '../core/sync-state.js';
import { getLedgerPath } from '../core/ledger.js';
import { timestamp } from '../utils/time.js';
import { confirm, selectFromList, isInteractive } from '../utils/prompt.js';
import type { AuthTokens, Workspace } from '../cloud/types.js';
import type { Config } from '../types.js';

export function registerLoginCommand(program: Command): void {
  program
    .command('login')
    .description('Authenticate with Mentu Cloud')
    .option('--token <token>', 'Use existing access token (for CI/CD)')
    .option('--json', 'Output as JSON')
    .option('--no-interactive', 'Skip all interactive prompts')
    .action(async (options) => {
      try {
        // --- Token login (CI/CD) bypasses the state machine ---
        if (options.token) {
          await loginWithToken(options.token, options.json);
          return;
        }

        // --- Step 1: Credential state check ---
        const { state, credentials } = await checkCredentialState();
        let email: string | undefined;

        if (state === 'valid' && credentials) {
          email = credentials.email;
          if (!options.json) {
            console.log(`Logged in as ${email}`);
          }
        } else if (state === 'expired_unrecoverable' && credentials) {
          if (!options.json) {
            console.log(`Session expired for ${credentials.email}. Re-authenticating...`);
          }
          await loginWithBrowser(options.json);
          const fresh = await getCredentials();
          email = fresh?.email;
        } else {
          // state === 'none'
          await loginWithBrowser(options.json);
          const fresh = await getCredentials();
          email = fresh?.email;
        }

        // --- Step 2: Post-auth context (workspace list) ---
        let workspaces: Workspace[] = [];
        try {
          const client = await CloudClient.create();
          workspaces = await client.listWorkspaces();
        } catch {
          // Cloud unreachable — skip workspace list gracefully
        }

        if (options.json) {
          console.log(JSON.stringify({
            success: true,
            email,
            workspaces: workspaces.map(w => ({ name: w.name, role: w.role })),
          }));
          return;
        }

        if (workspaces.length > 0) {
          console.log('\nWorkspaces:');
          for (const ws of workspaces) {
            console.log(`  ${ws.name} [${ws.role}]`);
          }
        } else if (workspaces.length === 0) {
          console.log('\nNo cloud workspaces yet.');
        }

        // Non-interactive: stop here
        if (!isInteractive(options)) {
          return;
        }

        // --- Step 3: Project detection ---
        const cwd = process.cwd();
        if (!isInProject(cwd)) {
          console.log('\nNot in a project directory. cd into a project and run mentu init.');
          return;
        }

        // --- Step 4: Local init (if needed) ---
        const projectName = path.basename(cwd);
        let workspacePath: string | null = null;

        try {
          workspacePath = findWorkspace(cwd);
        } catch {
          // No .mentu/ found
        }

        if (!workspacePath) {
          const shouldInit = await confirm(`\nInitialize Mentu in ./${projectName}?`);
          if (shouldInit) {
            doLocalInit(cwd);
            workspacePath = cwd;
            console.log('Created .mentu/ with config.yaml and ledger.jsonl');
          } else {
            console.log('\nRun "mentu init" when ready.');
            return;
          }
        }

        // --- Step 5: Workspace connection (if needed) ---
        const config = readConfig(workspacePath);
        const cloudConfig = (config as any)?.cloud;

        if (cloudConfig?.enabled && cloudConfig?.workspace_id) {
          // Already connected — find workspace name
          const connectedWs = workspaces.find(w => w.id === cloudConfig.workspace_id);
          console.log(`\nConnected to workspace: ${connectedWs?.name || cloudConfig.workspace_id}`);
          return;
        }

        // Need to connect
        if (workspaces.length === 0) {
          // Offer to create one
          const shouldCreate = await confirm(`\nCreate cloud workspace "${projectName}"?`);
          if (shouldCreate) {
            try {
              const client = await CloudClient.create();
              const result = await client.createWorkspace(projectName);
              if (result.workspace) {
                connectWorkspaceLocally(workspacePath, config, result.workspace);
                console.log(`Created and connected to workspace: ${projectName}`);
              } else {
                console.error(`Error creating workspace: ${result.error}`);
              }
            } catch (err) {
              console.error(`Error: ${err instanceof Error ? err.message : 'Failed to create workspace'}`);
            }
          } else {
            console.log('\nRun "mentu workspace create <name>" when ready.');
          }
        } else if (workspaces.length === 1) {
          const ws = workspaces[0];
          const shouldConnect = await confirm(`\nConnect to "${ws.name}"?`);
          if (shouldConnect) {
            connectWorkspaceLocally(workspacePath, config, ws);
            console.log(`Connected to workspace: ${ws.name}`);
          } else {
            console.log('\nRun "mentu workspace connect <name>" when ready.');
          }
        } else {
          // Multiple workspaces — picker
          console.log('');
          const items = workspaces.map(w => `${w.name} [${w.role}]`);
          const idx = await selectFromList(items, 'Connect to workspace');
          if (idx >= 0) {
            const ws = workspaces[idx];
            connectWorkspaceLocally(workspacePath, config, ws);
            console.log(`Connected to workspace: ${ws.name}`);
          } else {
            console.log('\nRun "mentu workspace connect <name>" when ready.');
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Login failed';
        if (options.json) {
          console.log(JSON.stringify({ error: message }));
        } else {
          console.error(`Error: ${message}`);
        }
        process.exit(1);
      }
    });
}

// ============================================
// Helper functions
// ============================================

/**
 * Check if the current directory looks like a project.
 */
function isInProject(dir: string): boolean {
  return (
    fs.existsSync(path.join(dir, '.git')) ||
    fs.existsSync(path.join(dir, 'package.json'))
  );
}

/**
 * Initialize .mentu/ in the given directory (extracted from init.ts logic).
 */
function doLocalInit(projectRoot: string): void {
  const mentuDir = getMentuDir(projectRoot);
  fs.mkdirSync(mentuDir, { recursive: true });

  // Create empty ledger
  const ledgerPath = getLedgerPath(projectRoot);
  fs.writeFileSync(ledgerPath, '', 'utf-8');

  // Create config
  const workspaceName = path.basename(projectRoot);
  const config: Config = {
    workspace: workspaceName,
    created: timestamp(),
  };
  writeConfig(projectRoot, config);

  // Update .gitignore
  const gitignorePath = path.join(projectRoot, '.gitignore');
  const mentuEntry = '.mentu/';
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    if (!content.includes(mentuEntry)) {
      fs.appendFileSync(gitignorePath, `\n# Mentu workspace\n${mentuEntry}\n`, 'utf-8');
    }
  } else {
    fs.writeFileSync(gitignorePath, `# Mentu workspace\n${mentuEntry}\n`, 'utf-8');
  }
}

/**
 * Write cloud config to .mentu/config.yaml and initialize sync state.
 */
function connectWorkspaceLocally(workspacePath: string, config: Config | null, workspace: Workspace): void {
  const updatedConfig: Config = {
    ...(config || { workspace: path.basename(workspacePath), created: timestamp() }),
    cloud: {
      enabled: true,
      endpoint: process.env.SUPABASE_URL || '',
      workspace_id: workspace.id,
    },
  };
  writeConfig(workspacePath, updatedConfig);
  initSyncState(workspacePath, workspace.id);
}

// ============================================
// Auth methods (unchanged)
// ============================================

/**
 * Login using a direct access token (for CI/CD).
 */
async function loginWithToken(token: string, json: boolean): Promise<void> {
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Invalid token');
  }

  // For token login, we don't have a refresh token
  // The token should be a service token or long-lived token
  const tokens: AuthTokens = {
    accessToken: token,
    refreshToken: '', // No refresh token for direct token login
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // Assume 1 year
    userId: user.id,
    email: user.email!,
  };

  await saveCredentials(tokens);

  if (json) {
    console.log(JSON.stringify({ success: true, email: user.email }));
  } else {
    console.log(`Logged in as ${user.email}`);
  }
}

/**
 * Find an available port starting from the given port.
 */
async function findAvailablePort(startPort: number): Promise<number> {
  const net = await import('net');

  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(startPort, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : startPort;
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      // Port in use, try next
      resolve(findAvailablePort(startPort + 1));
    });
  });
}

/**
 * Login using browser-based OAuth flow.
 */
async function loginWithBrowser(json: boolean): Promise<void> {
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();
  const port = await findAvailablePort(54321);
  const redirectUri = `http://localhost:${port}/callback`;

  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  return new Promise((resolve, reject) => {
    // Create temporary server to receive OAuth callback
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${port}`);

      if (url.pathname === '/callback') {
        // Parse hash fragments from URL (Supabase returns tokens in hash)
        const hashParams = url.hash ? new URLSearchParams(url.hash.slice(1)) : null;
        const accessToken = url.searchParams.get('access_token') || hashParams?.get('access_token');
        const refreshToken = url.searchParams.get('refresh_token') || hashParams?.get('refresh_token');

        // If tokens not in URL, show a page that extracts them from hash
        if (!accessToken) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head><title>Mentu Login</title></head>
            <body>
              <h1>Processing login...</h1>
              <script>
                // Extract tokens from hash
                const hash = window.location.hash.substring(1);
                const params = new URLSearchParams(hash);
                const accessToken = params.get('access_token');
                const refreshToken = params.get('refresh_token');

                if (accessToken) {
                  // Redirect with tokens in query params
                  window.location.href = '/complete?access_token=' + accessToken + '&refresh_token=' + refreshToken;
                } else {
                  document.body.innerHTML = '<h1>Login failed</h1><p>No access token received.</p>';
                }
              </script>
            </body>
            </html>
          `);
          return;
        }

        // We have tokens, complete the login
        await handleTokens(accessToken, refreshToken || '', supabase, res, json, server, resolve, reject);
      } else if (url.pathname === '/complete') {
        // Handle the redirect from the hash extraction
        const accessToken = url.searchParams.get('access_token');
        const refreshToken = url.searchParams.get('refresh_token') || '';

        if (accessToken) {
          await handleTokens(accessToken, refreshToken, supabase, res, json, server, resolve, reject);
        } else {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>Login failed</h1><p>No access token received.</p>');
          server.close();
          reject(new Error('No access token received'));
        }
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(port, async () => {
      // Generate OAuth URL for GitHub (or other providers)
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
        },
      });

      if (error || !data.url) {
        server.close();
        reject(new Error('Failed to generate OAuth URL'));
        return;
      }

      if (!json) {
        console.log('Opening browser for authentication...');
        console.log('If browser does not open, visit:');
        console.log(data.url);
      }

      // Open browser
      try {
        const open = await import('open');
        await open.default(data.url);
      } catch {
        // If open fails, user can manually visit URL
        if (!json) {
          console.log('\nCould not open browser automatically.');
          console.log('Please visit the URL above to authenticate.');
        }
      }
    });

    server.on('error', (err) => {
      reject(new Error(`Failed to start auth server: ${err.message}`));
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Login timed out'));
    }, 5 * 60 * 1000);
  });
}

/**
 * Handle received tokens and complete login.
 */
async function handleTokens(
  accessToken: string,
  refreshToken: string,
  supabase: any, // SupabaseClient with any schema
  res: http.ServerResponse,
  json: boolean,
  server: http.Server,
  resolve: () => void,
  reject: (err: Error) => void
): Promise<void> {
  try {
    // Set the session in Supabase client
    await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    // Get user info
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<h1>Login failed</h1><p>Could not get user information.</p>');
      server.close();
      reject(new Error('Could not get user information'));
      return;
    }

    // Save credentials
    const tokens: AuthTokens = {
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour default
      userId: user.id,
      email: user.email!,
    };

    await saveCredentials(tokens);

    // Send success response
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head><title>Mentu Login</title></head>
      <body style="font-family: system-ui; padding: 40px; text-align: center;">
        <h1>Logged in!</h1>
        <p>Welcome, ${user.email}</p>
        <p>You can close this window and return to your terminal.</p>
      </body>
      </html>
    `);

    if (json) {
      console.log(JSON.stringify({ success: true, email: user.email }));
    } else {
      console.log(`\nLogged in as ${user.email}`);
    }

    server.close();
    resolve();
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end('<h1>Login failed</h1><p>An error occurred.</p>');
    server.close();
    reject(err instanceof Error ? err : new Error('Unknown error'));
  }
}
