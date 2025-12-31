// mentu logout - Clear Mentu Cloud credentials

import { Command } from 'commander';
import { clearCredentials, getCredentials } from '../cloud/auth.js';

export function registerLogoutCommand(program: Command): void {
  program
    .command('logout')
    .description('Log out from Mentu Cloud')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const existing = await getCredentials();

        if (!existing) {
          if (options.json) {
            console.log(JSON.stringify({ success: true, message: 'Not logged in' }));
          } else {
            console.log('Not logged in.');
          }
          return;
        }

        const email = existing.email;
        await clearCredentials();

        if (options.json) {
          console.log(JSON.stringify({ success: true, email }));
        } else {
          console.log(`Logged out from ${email}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Logout failed';
        if (options.json) {
          console.log(JSON.stringify({ error: message }));
        } else {
          console.error(`Error: ${message}`);
        }
        process.exit(1);
      }
    });
}
