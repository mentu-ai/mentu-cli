#!/usr/bin/env node
/**
 * Remote Login CLI
 *
 * Captures cookies AND localStorage for authentication replay.
 *
 * Usage:
 *   node tools/remote-login.js <url>           # Start login session
 *   node tools/remote-login.js <url> --auto N  # Auto-capture after N seconds
 *   node tools/remote-login.js --status <domain>  # Check auth status
 *   node tools/remote-login.js --list          # List all auth storage
 *   node tools/remote-login.js --clear <domain>   # Clear auth for domain
 *
 * Examples:
 *   node tools/remote-login.js https://mentu.ai
 *   node tools/remote-login.js https://app.warrantyos.com --auto 90
 *   node tools/remote-login.js --status warrantyos.com
 */

import { runLoginSession } from '../dist/auth/login-session.js';
import { cookieManager } from '../dist/auth/cookie-manager.js';

const args = process.argv.slice(2);

function showHelp() {
  console.log(`
Remote Login CLI - Cookie + localStorage authentication for VPS

Usage:
  node tools/remote-login.js <url>              Start login session (wait for ENTER)
  node tools/remote-login.js <url> --auto <sec> Auto-capture after N seconds
  node tools/remote-login.js --status <domain>  Check auth status
  node tools/remote-login.js --list             List all stored auth
  node tools/remote-login.js --clear <domain>   Clear auth for domain
  node tools/remote-login.js --help             Show this help

Examples:
  node tools/remote-login.js https://mentu.ai
  node tools/remote-login.js https://app.warrantyos.com --auto 90
  node tools/remote-login.js --status mentu.ai
  node tools/remote-login.js --list
  node tools/remote-login.js --clear github.com

Auth Storage:
  Cookies:      ~/.mentu/cookies/{domain}.json
  localStorage: ~/.mentu/cookies/{domain}-localStorage.json

  Both sync to VPS via SyncThing automatically.

Auth Methods:
  cookie       - HTTP cookies (most traditional sites)
  localStorage - JWT/tokens in browser storage (modern SPAs)
  both         - Uses both methods
  none         - No auth tokens detected
`);
}

async function main() {
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    process.exit(0);
  }

  // --list: List all auth files
  if (args[0] === '--list') {
    const cookies = cookieManager.listAll();

    if (cookies.length === 0) {
      console.log('No auth storage found.');
      process.exit(0);
    }

    console.log('\nStored Auth:');
    console.log('-'.repeat(70));

    for (const cookie of cookies) {
      const status = cookieManager.getAuthStatus(cookie.domain);
      const expiry = status.isExpired ? 'EXPIRED' : status.timeUntilExpiry || 'session';

      console.log(`  ${cookie.domain}`);
      console.log(`    Cookies: ${status.cookieCount} | localStorage: ${status.localStorageCount} | Method: ${status.authMethod}`);
      console.log(`    Expires: ${expiry}`);
      console.log(`    Path: ${cookie.path}`);
      if (status.localStoragePath) {
        console.log(`    localStorage: ${status.localStoragePath}`);
      }
      console.log('');
    }

    process.exit(0);
  }

  // --status: Check status for a domain
  if (args[0] === '--status') {
    const domain = args[1];

    if (!domain) {
      console.error('Error: Domain required for --status');
      console.error('Usage: node tools/remote-login.js --status <domain>');
      process.exit(1);
    }

    const status = cookieManager.getAuthStatus(domain);

    console.log('\nAuth Status:');
    console.log('-'.repeat(50));
    console.log(`  Domain: ${status.domain}`);
    console.log(`  Exists: ${status.exists || status.localStorageCount > 0 ? 'Yes' : 'No'}`);

    if (status.exists || status.localStorageCount > 0) {
      console.log(`  Cookies: ${status.cookieCount}`);
      console.log(`  localStorage: ${status.localStorageCount}`);
      console.log(`  Auth Method: ${status.authMethod}`);
      console.log(`  Auth Token Found: ${status.authTokenFound || status.localStorageCount > 0 ? 'Yes' : 'No'}`);

      if (status.captured) {
        console.log(`  Captured: ${status.captured}`);
      }
      console.log(`  Expired: ${status.isExpired ? 'Yes' : 'No'}`);

      if (!status.isExpired && status.timeUntilExpiry) {
        console.log(`  Time until expiry: ${status.timeUntilExpiry}`);
      }

      console.log(`  Cookie Path: ${status.path}`);
      if (status.localStoragePath) {
        console.log(`  localStorage Path: ${status.localStoragePath}`);
      }
    }

    const hasAuth = status.exists || status.localStorageCount > 0;
    process.exit(hasAuth && !status.isExpired ? 0 : 1);
  }

  // --clear: Clear auth for a domain
  if (args[0] === '--clear') {
    const domain = args[1];

    if (!domain) {
      console.error('Error: Domain required for --clear');
      console.error('Usage: node tools/remote-login.js --clear <domain>');
      process.exit(1);
    }

    const deletedCookies = cookieManager.deleteCookies(domain);

    // Also try to delete localStorage file
    const localStoragePath = cookieManager.getLocalStoragePath(domain);
    let deletedLocalStorage = false;
    try {
      const fs = await import('fs');
      if (fs.existsSync(localStoragePath)) {
        fs.unlinkSync(localStoragePath);
        deletedLocalStorage = true;
      }
    } catch {
      // Ignore
    }

    if (deletedCookies || deletedLocalStorage) {
      console.log(`Cleared auth for: ${domain}`);
      if (deletedCookies) console.log('  - Cookies deleted');
      if (deletedLocalStorage) console.log('  - localStorage deleted');
    } else {
      console.log(`No auth found for: ${domain}`);
    }

    process.exit(0);
  }

  // Default: Start login session
  const target = args[0];

  if (!target.startsWith('http')) {
    console.error('Error: Target must be a valid URL (http:// or https://)');
    process.exit(1);
  }

  // Check for --auto flag
  const autoIndex = args.indexOf('--auto');
  let autoSaveDelay = 0;
  if (autoIndex !== -1 && args[autoIndex + 1]) {
    const seconds = parseInt(args[autoIndex + 1], 10);
    if (isNaN(seconds) || seconds <= 0) {
      console.error('Error: --auto requires a positive number of seconds');
      process.exit(1);
    }
    autoSaveDelay = seconds * 1000; // Convert to ms
  }

  try {
    const result = await runLoginSession(target, { autoSaveDelay });

    if (result.success) {
      // Show summary with localStorage info
      if (result.localStorageCount > 0) {
        console.log(`\nAuth captured: ${result.cookieCount} cookies + ${result.localStorageCount} localStorage items`);
        console.log(`Auth method: ${result.authMethod || 'unknown'}`);
      }
      process.exit(0);
    } else {
      console.error(`Login failed: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
