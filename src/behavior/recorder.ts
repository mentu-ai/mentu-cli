/**
 * Browser Behavior Recorder
 *
 * Opens a browser window for user interaction and records actions.
 * Uses Puppeteer for browser control.
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import type {
  BehaviorRecording,
  BehaviorStep,
  Cookie,
  RecorderOptions,
  RecordingState
} from './types.js';

const DEFAULT_COOKIES_DIR = path.join(
  process.env.HOME || '',
  '.mentu',
  'cookies'
);

// Sanitize name to prevent path traversal
function sanitizeName(name: string): string {
  // Remove path separators and dangerous characters
  return name.replace(/[\/\\:*?"<>|]/g, '-').replace(/\.\./g, '');
}

export class BehaviorRecorder {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private state: RecordingState = 'idle';
  private recording: BehaviorRecording;
  private options: Required<RecorderOptions>;
  private startTime: number = 0;
  private saveInterval: NodeJS.Timeout | null = null;
  private onBrowserClose: (() => void) | null = null;

  constructor(options: RecorderOptions) {
    this.options = {
      target: options.target,
      name: options.name ? sanitizeName(options.name) : this.generateName(options.target),
      cookiesPath: options.cookiesPath || this.getCookiesPath(options.target),
      outputDir: options.outputDir || process.cwd(),
      timeout: options.timeout || 300000, // 5 minutes default
      autoSaveDelay: options.autoSaveDelay || 0, // 0 = wait for ENTER
    };

    this.recording = {
      name: this.options.name,
      target: this.options.target,
      created: new Date().toISOString(),
      version: '1.0',
      steps: [],
      cookies: [],
      evidence: [],
    };
  }

  private generateName(url: string): string {
    const hostname = new URL(url).hostname.replace(/\./g, '-');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return sanitizeName(`${hostname}-${timestamp}`);
  }

  private getCookiesPath(url: string): string {
    const hostname = new URL(url).hostname.replace(/^www\./, '').replace(/\./g, '-');
    return path.join(DEFAULT_COOKIES_DIR, `${hostname}.json`);
  }

  async start(): Promise<void> {
    if (this.state !== 'idle') {
      throw new Error(`Cannot start recording in state: ${this.state}`);
    }

    console.log('\n========================================');
    console.log('BEHAVIOR RECORDER');
    console.log('========================================\n');
    console.log(`Target: ${this.options.target}`);
    console.log(`Name: ${this.options.name}`);
    console.log(`Output: ${this.options.outputDir}\n`);

    // Launch browser
    this.browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: ['--start-maximized', '--no-sandbox'],
    });

    this.page = await this.browser.newPage();

    // Load existing cookies if available
    if (fs.existsSync(this.options.cookiesPath)) {
      try {
        const cookies = JSON.parse(fs.readFileSync(this.options.cookiesPath, 'utf-8'));
        await this.page.setCookie(...cookies);
        console.log(`Loaded ${cookies.length} cookies from: ${this.options.cookiesPath}\n`);
      } catch {
        console.log('Could not load existing cookies, starting fresh\n');
      }
    }

    // Set up event listeners for recording
    this.setupEventListeners();

    // Navigate to target
    this.state = 'recording';
    this.startTime = Date.now();

    this.addStep({
      action: 'navigate',
      url: this.options.target,
      timestamp: 0,
      description: 'Initial navigation',
    });

    await this.page.goto(this.options.target, { waitUntil: 'networkidle2' });

    // Start auto-saving every second
    this.startAutoSave();

    // Detect browser close
    this.browser.on('disconnected', () => {
      console.log('\nBrowser closed - finalizing recording...');
      if (this.onBrowserClose) {
        this.onBrowserClose();
      }
    });

    console.log('========================================');
    console.log('RECORDING ACTIVE (Auto-saving every 1s)');
    console.log('========================================');
    console.log('Perform your actions in the browser.');
    console.log('All interactions are being captured.\n');
    console.log('Close the browser when done, or use:');
    console.log('  [ENTER] - Stop recording and save');
    console.log('  [s]     - Take screenshot');
    console.log('  [c]     - Save cookies');
    console.log('  [q]     - Quit without saving');
    console.log('========================================\n');
  }

  private startAutoSave(): void {
    // Ensure output directory exists
    fs.mkdirSync(this.options.outputDir, { recursive: true });

    // Save every second
    this.saveInterval = setInterval(() => {
      this.saveIncrementally();
    }, 1000);
  }

  private saveIncrementally(): void {
    if (this.recording.steps.length === 0) return;

    const jsonPath = path.join(this.options.outputDir, `${this.options.name}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(this.recording, null, 2));
  }

  private setupEventListeners(): void {
    if (!this.page) return;

    // Track all interactions via console messages
    this.page.on('console', async (msg) => {
      const text = msg.text();
      if (!text.startsWith('BEHAVIOR_')) return;

      const [type, data] = text.split(':', 2);
      const timestamp = Date.now() - this.startTime;

      switch (type) {
        case 'BEHAVIOR_CLICK':
          this.addStep({ action: 'click', selector: data, timestamp });
          break;
        case 'BEHAVIOR_TYPE':
          const [selector, value] = data.split('|');
          this.addStep({ action: 'type', selector, value: '[redacted]', timestamp });
          break;
        case 'BEHAVIOR_SCROLL':
          const [scrollX, scrollY] = data.split(',');
          this.addStep({ action: 'scroll', value: `${scrollX},${scrollY}`, timestamp });
          break;
        case 'BEHAVIOR_HOVER':
          this.addStep({ action: 'hover', selector: data, timestamp });
          break;
        case 'BEHAVIOR_SELECT':
          const [selSelector, selValue] = data.split('|');
          this.addStep({ action: 'select', selector: selSelector, value: selValue, timestamp });
          break;
        case 'BEHAVIOR_FOCUS':
          this.addStep({ action: 'click', selector: data, timestamp, description: 'focus' });
          break;
      }
    });

    // Inject comprehensive recording script
    this.page.evaluateOnNewDocument(() => {
      let lastScrollTime = 0;
      let lastHoverTime = 0;
      const THROTTLE_MS = 500;

      // Click tracking
      document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const selector = getUniqueSelector(target);
        const text = getElementText(target);
        console.log(`BEHAVIOR_CLICK:${selector}${text ? ` (${text})` : ''}`);
      }, true);

      // Input tracking (redact values for security)
      document.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const selector = getUniqueSelector(target);
        console.log(`BEHAVIOR_TYPE:${selector}|${target.type === 'password' ? '***' : target.value}`);
      }, true);

      // Select/dropdown tracking
      document.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        if (target.tagName === 'SELECT') {
          const selector = getUniqueSelector(target);
          console.log(`BEHAVIOR_SELECT:${selector}|${target.value}`);
        }
      }, true);

      // Scroll tracking (throttled)
      document.addEventListener('scroll', () => {
        const now = Date.now();
        if (now - lastScrollTime < THROTTLE_MS) return;
        lastScrollTime = now;
        console.log(`BEHAVIOR_SCROLL:${window.scrollX},${window.scrollY}`);
      }, true);

      // Hover tracking (throttled, only significant elements)
      document.addEventListener('mouseover', (e) => {
        const now = Date.now();
        if (now - lastHoverTime < THROTTLE_MS) return;

        const target = e.target as HTMLElement;
        // Only track hovers on interactive elements
        if (!['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) &&
            !target.getAttribute('role') &&
            !target.onclick) {
          return;
        }

        lastHoverTime = now;
        const selector = getUniqueSelector(target);
        console.log(`BEHAVIOR_HOVER:${selector}`);
      }, true);

      // Focus tracking
      document.addEventListener('focus', (e) => {
        const target = e.target as HTMLElement;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
          const selector = getUniqueSelector(target);
          console.log(`BEHAVIOR_FOCUS:${selector}`);
        }
      }, true);

      function getUniqueSelector(el: HTMLElement): string {
        // Try ID first
        if (el.id) return `#${el.id}`;

        // Try data attributes
        if (el.dataset && Object.keys(el.dataset).length > 0) {
          const key = Object.keys(el.dataset)[0];
          const value = el.dataset[key];
          if (value) return `[data-${key}="${value}"]`;
        }

        // Try aria-label
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel) return `[aria-label="${ariaLabel}"]`;

        // Try name attribute
        const name = el.getAttribute('name');
        if (name) return `[name="${name}"]`;

        // Try class-based selector
        if (el.className && typeof el.className === 'string') {
          const classes = el.className.split(' ').filter(c => c && !c.includes(':')).slice(0, 3).join('.');
          if (classes) return `${el.tagName.toLowerCase()}.${classes}`;
        }

        // Try role
        const role = el.getAttribute('role');
        if (role) return `[role="${role}"]`;

        // Fallback to tag
        return el.tagName.toLowerCase();
      }

      function getElementText(el: HTMLElement): string {
        const text = el.textContent?.trim().slice(0, 30);
        return text || '';
      }
    });

    // Track navigation
    this.page.on('framenavigated', (frame) => {
      if (frame === this.page?.mainFrame()) {
        const url = frame.url();
        if (url !== 'about:blank') {
          this.addStep({
            action: 'navigate',
            url,
            timestamp: Date.now() - this.startTime,
            description: 'Page navigation',
          });
        }
      }
    });
  }

  private addStep(step: BehaviorStep): void {
    this.recording.steps.push(step);
    console.log(`[${step.timestamp}ms] ${step.action}: ${step.selector || step.url || ''}`);
  }

  async takeScreenshot(name?: string): Promise<string> {
    if (!this.page) throw new Error('No page available');

    const screenshotName = name || `screenshot-${Date.now()}`;
    const screenshotPath = path.join(
      this.options.outputDir,
      'evidence',
      this.options.name,
      `${screenshotName}.png`
    );

    // Ensure directory exists
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });

    await this.page.screenshot({ path: screenshotPath, fullPage: true });

    this.recording.evidence?.push({
      name: screenshotName,
      type: 'screenshot',
      path: screenshotPath,
      timestamp: new Date().toISOString(),
    });

    this.addStep({
      action: 'screenshot',
      value: screenshotName,
      timestamp: Date.now() - this.startTime,
      description: `Screenshot: ${screenshotName}`,
    });

    console.log(`Screenshot saved: ${screenshotPath}`);
    return screenshotPath;
  }

  async saveCookies(): Promise<void> {
    if (!this.page) throw new Error('No page available');

    const cookies = await this.page.cookies();
    this.recording.cookies = cookies as Cookie[];

    // Ensure directory exists
    fs.mkdirSync(path.dirname(this.options.cookiesPath), { recursive: true });
    fs.writeFileSync(this.options.cookiesPath, JSON.stringify(cookies, null, 2));

    console.log(`Saved ${cookies.length} cookies to: ${this.options.cookiesPath}`);
  }

  async stop(): Promise<BehaviorRecording> {
    if (this.state !== 'recording') {
      throw new Error(`Cannot stop in state: ${this.state}`);
    }

    // Stop auto-save interval
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }

    // Save final cookies (only if browser still open)
    if (this.page) {
      try {
        await this.saveCookies();
      } catch {
        console.log('Could not save cookies (browser may have closed)');
      }
    }

    // Final save
    this.saveIncrementally();

    // Close browser if still open
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // Browser may already be closed
      }
      this.browser = null;
      this.page = null;
    }

    this.state = 'extracted';
    console.log('\n========================================');
    console.log('RECORDING COMPLETE');
    console.log('========================================');
    console.log(`Steps recorded: ${this.recording.steps.length}`);
    console.log(`Cookies saved: ${this.recording.cookies?.length || 0}`);
    console.log(`Evidence captured: ${this.recording.evidence?.length || 0}`);
    console.log(`Output: ${path.join(this.options.outputDir, this.options.name + '.json')}`);
    console.log('========================================\n');

    return this.recording;
  }

  async abort(): Promise<void> {
    this.state = 'aborted';

    // Stop auto-save interval
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }

    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // Browser may already be closed
      }
      this.browser = null;
      this.page = null;
    }
    console.log('\nRecording aborted.');
  }

  // Set callback for browser close
  setOnBrowserClose(callback: () => void): void {
    this.onBrowserClose = callback;
  }

  getState(): RecordingState {
    return this.state;
  }

  getRecording(): BehaviorRecording {
    return this.recording;
  }
}

// Interactive recording session
export async function recordBehavior(options: RecorderOptions): Promise<BehaviorRecording | null> {
  const recorder = new BehaviorRecorder(options);

  await recorder.start();

  return new Promise((resolve) => {
    let resolved = false;

    const finishRecording = async () => {
      if (resolved) return;
      resolved = true;

      try {
        if (recorder.getState() === 'recording') {
          const recording = await recorder.stop();
          resolve(recording);
        } else {
          resolve(recorder.getRecording());
        }
      } catch (error) {
        console.error('Error stopping recording:', error);
        resolve(recorder.getRecording());
      }
    };

    // Handle browser close
    recorder.setOnBrowserClose(() => {
      console.log('Browser closed detected - saving recording...');
      finishRecording();
    });

    // Auto-save mode: wait for delay then save automatically
    if (options.autoSaveDelay && options.autoSaveDelay > 0) {
      console.log(`Auto-saving recording in ${options.autoSaveDelay / 1000} seconds...`);
      console.log('Or close the browser when done.\n');

      setTimeout(finishRecording, options.autoSaveDelay);
      return;
    }

    // Manual mode: wait for ENTER or browser close
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const handleInput = async (input: string) => {
      if (resolved) {
        rl.close();
        return;
      }

      const cmd = input.trim().toLowerCase();

      if (cmd === 's') {
        try {
          await recorder.takeScreenshot();
        } catch {
          console.log('Could not take screenshot');
        }
        rl.question('', handleInput);
      } else if (cmd === 'c') {
        try {
          await recorder.saveCookies();
        } catch {
          console.log('Could not save cookies');
        }
        rl.question('', handleInput);
      } else if (cmd === 'q') {
        await recorder.abort();
        rl.close();
        resolve(null);
      } else {
        // Empty or Enter - stop recording
        rl.close();
        await finishRecording();
      }
    };

    rl.question('', handleInput);
  });
}
