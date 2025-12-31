// mentu login - Authenticate with Mentu Cloud

import { Command } from 'commander';
import http from 'http';
import { createClient } from '@supabase/supabase-js';
import { saveCredentials, getCredentials, getSupabaseUrl, getSupabaseAnonKey } from '../cloud/auth.js';
import type { AuthTokens } from '../cloud/types.js';

export function registerLoginCommand(program: Command): void {
  program
    .command('login')
    .description('Authenticate with Mentu Cloud')
    .option('--token <token>', 'Use existing access token (for CI/CD)')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        // Check if already logged in
        const existing = await getCredentials();
        if (existing && !options.token) {
          if (options.json) {
            console.log(JSON.stringify({
              success: true,
              email: existing.email,
              message: 'Already logged in'
            }));
          } else {
            console.log(`Already logged in as ${existing.email}`);
            console.log('Run "mentu logout" first to switch accounts.');
          }
          return;
        }

        if (options.token) {
          await loginWithToken(options.token, options.json);
        } else {
          await loginWithBrowser(options.json);
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
