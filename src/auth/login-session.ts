/**
 * Login Session
 *
 * Opens an interactive browser session for user authentication.
 * Captures cookies when user signals completion.
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import * as readline from 'readline';
import type {
  LoginSessionOptions,
  LoginSessionResult,
  LoginSessionState,
  StoredCookie,
  StoredLocalStorageItem,
} from './types.js';
import { CookieManager } from './cookie-manager.js';

const DEFAULT_OPTIONS: Required<Omit<LoginSessionOptions, 'cookiesDir'>> = {
  target: 'https://mentu.ai',
  timeout: 300000, // 5 minutes
  autoSaveDelay: 0, // Auto-save after this many ms (0 = wait for ENTER)
  loadExisting: true,
};

export class LoginSession {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private state: LoginSessionState = 'idle';
  private options: Required<Omit<LoginSessionOptions, 'cookiesDir'>> & { cookiesDir?: string };
  private cookieManager: CookieManager;
  private timeoutHandle: NodeJS.Timeout | null = null;
  private autoSaveInterval: NodeJS.Timeout | null = null;
  private lastCapturedCookies: StoredCookie[] = [];
  private lastCapturedLocalStorage: StoredLocalStorageItem[] = [];
  private browserDisconnected = false;

  constructor(options: LoginSessionOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.cookieManager = new CookieManager(options.cookiesDir);
  }

  /**
   * Start the login session
   */
  async start(): Promise<void> {
    if (this.state !== 'idle') {
      throw new Error(`Cannot start session in state: ${this.state}`);
    }

    const domain = new URL(this.options.target).hostname;

    console.log('\n========================================');
    console.log('REMOTE LOGIN SESSION');
    console.log('========================================\n');
    console.log(`Target: ${this.options.target}`);
    console.log(`Domain: ${domain}`);
    console.log(`Timeout: ${this.options.timeout / 1000}s\n`);

    // Check existing cookies
    const existingStatus = this.cookieManager.getStatus(this.options.target);
    if (existingStatus.exists) {
      console.log(`Existing cookies: ${existingStatus.cookieCount} cookies`);
      if (existingStatus.isExpired) {
        console.log('Status: EXPIRED - re-authentication needed\n');
      } else {
        console.log(`Status: Valid for ${existingStatus.timeUntilExpiry}\n`);
      }
    }

    this.state = 'waiting';

    // Launch browser
    console.log('Launching browser...\n');
    this.browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: ['--start-maximized', '--no-sandbox'],
    });

    this.page = await this.browser.newPage();

    // Load existing cookies if enabled
    if (this.options.loadExisting) {
      const cookies = this.cookieManager.loadCookies(this.options.target);
      if (cookies && cookies.length > 0) {
        await this.page.setCookie(...cookies);
        console.log(`Loaded ${cookies.length} existing cookies\n`);
      }
    }

    // Set up timeout
    this.timeoutHandle = setTimeout(() => {
      this.handleTimeout();
    }, this.options.timeout);

    // Navigate to target
    this.state = 'authenticating';
    await this.page.goto(this.options.target, { waitUntil: 'networkidle2' });

    console.log('========================================');
    console.log('INSTRUCTIONS');
    console.log('========================================');
    console.log('1. Log in to your account in the browser');
    console.log('2. Wait for the page to fully load');
    console.log('3. Navigate to any authenticated page');
    console.log('4. Return here and press ENTER to save');
    console.log('========================================\n');
  }

  /**
   * Wait for user to signal completion and capture cookies
   * Supports: browser close detection, auto-save timer, or manual ENTER
   */
  async waitAndCapture(): Promise<LoginSessionResult> {
    if (!this.page || !this.browser) {
      return {
        success: false,
        domain: '',
        cookieCount: 0,
        cookiePath: '',
        error: 'Session not started',
      };
    }

    const domain = new URL(this.options.target).hostname;

    // Start background auto-save (captures every second)
    this.startAutoSave();

    // Set up browser disconnect handler
    const browserClosePromise = new Promise<'browser_closed'>((resolve) => {
      this.browser!.on('disconnected', () => {
        this.browserDisconnected = true;
        resolve('browser_closed');
      });
    });

    // Auto-save mode with timer
    if (this.options.autoSaveDelay > 0) {
      console.log(`Auto-saving every second. Will also capture on browser close.`);
      console.log(`Fallback timer: ${this.options.autoSaveDelay / 1000} seconds.`);
      console.log('Log in now. Close browser when done.\n');

      const timerPromise = new Promise<'timer'>((resolve) => {
        setTimeout(() => resolve('timer'), this.options.autoSaveDelay);
      });

      // Wait for either browser close or timer
      const trigger = await Promise.race([browserClosePromise, timerPromise]);

      return this.finishCapture(domain, trigger);
    }

    // Default mode: wait for browser close OR ENTER
    console.log('Auto-saving every second. Close browser when done.');
    console.log('Or press ENTER here to save manually.\n');

    const enterPromise = new Promise<'enter'>((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question('', () => {
        rl.close();
        resolve('enter');
      });
    });

    // Wait for either browser close or ENTER
    const trigger = await Promise.race([browserClosePromise, enterPromise]);

    return this.finishCapture(domain, trigger);
  }

  /**
   * Finish capture and return result
   */
  private async finishCapture(
    domain: string,
    trigger: 'browser_closed' | 'timer' | 'enter'
  ): Promise<LoginSessionResult> {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
    }

    this.stopAutoSave();
    this.state = 'capturing';

    // Use last captured data (from auto-save)
    const cookies = this.lastCapturedCookies;
    const localStorage = this.lastCapturedLocalStorage;

    // Ensure final save
    const cookiePath = this.cookieManager.saveCookies(this.options.target, cookies);
    let localStoragePath = '';
    if (localStorage.length > 0) {
      localStoragePath = this.cookieManager.saveLocalStorage(this.options.target, localStorage);
    }

    const status = this.cookieManager.getAuthStatus(this.options.target);

    await this.cleanup();
    this.state = 'success';

    const triggerLabel = trigger === 'browser_closed' ? 'BROWSER CLOSED' :
                         trigger === 'timer' ? 'AUTO-CAPTURE' : 'MANUAL CAPTURE';

    console.log('\n========================================');
    console.log(`${triggerLabel} - AUTH SAVED`);
    console.log('========================================');
    console.log(`Cookies: ${cookies.length} saved to:`);
    console.log(`  ${cookiePath}`);
    if (localStorage.length > 0) {
      console.log(`localStorage: ${localStorage.length} items saved to:`);
      console.log(`  ${localStoragePath}`);
    }
    console.log(`Auth method: ${status.authMethod}`);
    if (status.expiresAt) {
      console.log(`Expires: ${status.timeUntilExpiry}`);
    }
    console.log('\nAuth data will sync to VPS via SyncThing.');
    console.log('========================================\n');

    return {
      success: cookies.length > 0 || localStorage.length > 0,
      domain,
      cookieCount: cookies.length,
      cookiePath,
      expiresAt: status.expiresAt,
      localStorageCount: localStorage.length,
      localStoragePath: localStoragePath || undefined,
      authMethod: status.authMethod,
    } as any;
  }

  private async handleTimeout(): Promise<void> {
    console.log('\nSession timed out!');
    this.state = 'timeout';
    await this.cleanup();
  }

  /**
   * Capture localStorage from the page
   */
  private async captureLocalStorage(): Promise<StoredLocalStorageItem[]> {
    if (!this.page) return [];

    try {
      const items = await this.page.evaluate(() => {
        const result: { key: string; value: string }[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            const value = localStorage.getItem(key);
            if (value) {
              result.push({ key, value });
            }
          }
        }
        return result;
      });
      return items;
    } catch (error) {
      // Silently fail - browser may be closing
      return [];
    }
  }

  /**
   * Start background auto-save (captures every second)
   */
  private startAutoSave(): void {
    this.autoSaveInterval = setInterval(async () => {
      if (!this.page || this.browserDisconnected) return;

      try {
        // Capture current state
        const cookies = await this.page.cookies() as StoredCookie[];
        const localStorage = await this.captureLocalStorage();

        // Store for use on browser close
        this.lastCapturedCookies = cookies;
        this.lastCapturedLocalStorage = localStorage;

        // Save to disk
        this.cookieManager.saveCookies(this.options.target, cookies);
        if (localStorage.length > 0) {
          this.cookieManager.saveLocalStorage(this.options.target, localStorage);
        }
      } catch {
        // Browser may be closing, ignore errors
      }
    }, 1000);
  }

  /**
   * Stop background auto-save
   */
  private stopAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  private async cleanup(): Promise<void> {
    this.stopAutoSave();

    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }

    if (this.browser && !this.browserDisconnected) {
      try {
        await this.browser.close();
      } catch {
        // Browser already closed
      }
      this.browser = null;
      this.page = null;
    }
  }

  getState(): LoginSessionState {
    return this.state;
  }
}

/**
 * Convenience function to run a login session
 */
export async function runLoginSession(
  target: string,
  options?: Partial<Omit<LoginSessionOptions, 'target'>>
): Promise<LoginSessionResult> {
  const session = new LoginSession({ target, ...options });
  await session.start();
  return session.waitAndCapture();
}
