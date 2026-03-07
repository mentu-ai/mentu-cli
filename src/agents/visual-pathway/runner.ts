/**
 * Visual Pathway Runner
 *
 * Replays recorded browser pathways and captures screenshots at each step.
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { VisualStorage } from './storage.js';
import {
  type PathwayRecording,
  type PathwayStep,
  type ScreenshotCapture,
  type ViewportConfig,
  type VisualPathwayOptions,
  type VisualPathwayResult,
  VIEWPORT_PRESETS,
} from './types.js';

const DEFAULT_COOKIES_DIR = path.join(
  process.env.HOME || '',
  '.mentu',
  'cookies'
);

export class VisualPathwayRunner {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private storage: VisualStorage;
  private options: VisualPathwayOptions;
  private recording: PathwayRecording | null = null;
  private screenshots: ScreenshotCapture[] = [];
  private errors: string[] = [];
  private tempDir: string;

  constructor(options: VisualPathwayOptions) {
    this.options = {
      ...options,
      viewports: options.viewports || ['desktop'],
      headless: options.headless ?? true,
      screenshotFormat: options.screenshotFormat || 'webp',
      screenshotQuality: options.screenshotQuality || 85,
      waitBetweenSteps: options.waitBetweenSteps || 1000,
    };

    this.storage = new VisualStorage(options.supabaseBucket);
    this.tempDir = path.join('/tmp', `visual-pathway-${Date.now()}`);
    fs.mkdirSync(this.tempDir, { recursive: true });
  }

  /**
   * Load a pathway recording from file
   */
  async loadRecording(): Promise<void> {
    const recordingPath = this.options.recordingPath;

    if (!fs.existsSync(recordingPath)) {
      throw new Error(`Recording not found: ${recordingPath}`);
    }

    const content = fs.readFileSync(recordingPath, 'utf-8');
    const ext = path.extname(recordingPath).toLowerCase();

    if (ext === '.yaml' || ext === '.yml') {
      const parsed = yaml.parse(content);
      // Handle both direct format and nested behavior format
      this.recording = parsed.behavior || parsed;
    } else if (ext === '.json') {
      this.recording = JSON.parse(content);
    } else {
      throw new Error(`Unsupported recording format: ${ext}`);
    }

    if (!this.recording?.steps || this.recording.steps.length === 0) {
      throw new Error('Recording has no steps');
    }

    console.log(`Loaded recording: ${this.recording.name}`);
    console.log(`Target: ${this.recording.target}`);
    console.log(`Steps: ${this.recording.steps.length}`);
  }

  /**
   * Initialize the browser
   */
  async initBrowser(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: this.options.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
    });

    this.page = await this.browser.newPage();

    // Load cookies if available
    await this.loadCookies();
  }

  /**
   * Load cookies from file
   */
  private async loadCookies(): Promise<void> {
    if (!this.page || !this.recording) return;

    // Try explicit cookies path first
    let cookiesPath = this.options.cookiesPath;

    // Fall back to domain-based cookies
    if (!cookiesPath && this.recording.target) {
      const hostname = new URL(this.recording.target).hostname
        .replace(/^www\./, '')
        .replace(/\./g, '-');
      cookiesPath = path.join(DEFAULT_COOKIES_DIR, `${hostname}.json`);
    }

    if (cookiesPath && fs.existsSync(cookiesPath)) {
      try {
        const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));
        await this.page.setCookie(...cookies);
        console.log(`Loaded ${cookies.length} cookies from: ${cookiesPath}`);
      } catch (error) {
        console.log('Could not load cookies:', error);
      }
    }
  }

  /**
   * Run the visual pathway capture
   */
  async run(): Promise<VisualPathwayResult> {
    const startTime = Date.now();
    const startedAt = new Date().toISOString();

    try {
      // Load recording
      await this.loadRecording();
      if (!this.recording) {
        throw new Error('Failed to load recording');
      }

      // Initialize browser
      await this.initBrowser();
      if (!this.page) {
        throw new Error('Failed to initialize browser');
      }

      // Process each viewport
      for (const viewportName of this.options.viewports) {
        const viewport = VIEWPORT_PRESETS[viewportName];
        if (!viewport) {
          this.errors.push(`Unknown viewport: ${viewportName}`);
          continue;
        }

        console.log(`\n=== Viewport: ${viewportName} (${viewport.width}x${viewport.height}) ===`);

        // Set viewport
        await this.page.setViewport({
          width: viewport.width,
          height: viewport.height,
          deviceScaleFactor: viewport.deviceScaleFactor || 1,
          isMobile: viewport.isMobile || false,
          hasTouch: viewport.hasTouch || false,
        });

        // Process each step
        for (let i = 0; i < this.recording.steps.length; i++) {
          const step = this.recording.steps[i];

          try {
            await this.executeStep(step, i);
            await this.captureScreenshot(step, i, viewportName);
          } catch (error) {
            const errorMsg = `Step ${i} (${step.action}): ${error instanceof Error ? error.message : String(error)}`;
            this.errors.push(errorMsg);
            console.error(errorMsg);
          }

          // Wait between steps
          await this.wait(this.options.waitBetweenSteps);
        }
      }

      // Upload all screenshots to Supabase
      await this.uploadScreenshots();

      // Generate result
      const completedAt = new Date().toISOString();
      const duration = Date.now() - startTime;

      return {
        success: this.errors.length === 0,
        pathwayName: this.options.pathwayName,
        recording: this.options.recordingPath,
        startedAt,
        completedAt,
        duration,
        totalSteps: this.recording.steps.length,
        totalScreenshots: this.screenshots.length,
        viewports: this.options.viewports,
        screenshots: this.screenshots,
        errors: this.errors,
        supabaseFolder: `pathways/${this.options.pathwayName}`,
        evidenceId: undefined, // Set by caller if using Mentu
      };
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(step: PathwayStep, index: number): Promise<void> {
    if (!this.page) return;

    console.log(`Step ${index}: ${step.action} ${step.url || step.selector || ''}`);

    switch (step.action) {
      case 'navigate':
        if (step.url) {
          await this.page.goto(step.url, { waitUntil: 'networkidle2', timeout: 30000 });
        }
        break;

      case 'click':
        if (step.selector) {
          await this.page.waitForSelector(step.selector, { timeout: 10000 });
          await this.page.click(step.selector);
        }
        break;

      case 'type':
        if (step.selector && step.value) {
          await this.page.waitForSelector(step.selector, { timeout: 10000 });
          await this.page.type(step.selector, step.value);
        }
        break;

      case 'scroll':
        if (step.value) {
          const [x, y] = step.value.split(',').map(Number);
          await this.page.evaluate(
            (scrollX, scrollY) => window.scrollTo(scrollX, scrollY),
            x,
            y
          );
        }
        break;

      case 'hover':
        if (step.selector) {
          await this.page.waitForSelector(step.selector, { timeout: 10000 });
          await this.page.hover(step.selector);
        }
        break;

      case 'select':
        if (step.selector && step.value) {
          await this.page.waitForSelector(step.selector, { timeout: 10000 });
          await this.page.select(step.selector, step.value);
        }
        break;

      case 'wait':
        const waitTime = step.timeout || 1000;
        await this.wait(waitTime);
        break;

      case 'screenshot':
        // Screenshot is handled separately
        break;

      default:
        console.log(`Unknown action: ${step.action}`);
    }
  }

  /**
   * Capture a screenshot at current step
   */
  private async captureScreenshot(
    step: PathwayStep,
    stepIndex: number,
    viewport: string
  ): Promise<void> {
    if (!this.page) return;

    // Only capture on navigation or explicit screenshot steps
    if (step.action !== 'navigate' && step.action !== 'screenshot') {
      return;
    }

    const timestamp = new Date().toISOString();
    const filename = `step-${String(stepIndex).padStart(3, '0')}-${viewport}.${this.options.screenshotFormat}`;
    const localPath = path.join(this.tempDir, filename);

    // Capture screenshot
    const screenshotOptions: any = {
      path: localPath,
      fullPage: true,
    };

    if (this.options.screenshotFormat === 'jpeg' || this.options.screenshotFormat === 'webp') {
      screenshotOptions.quality = this.options.screenshotQuality;
    }

    await this.page.screenshot(screenshotOptions);

    // Get file stats
    const stats = fs.statSync(localPath);
    const viewportConfig = VIEWPORT_PRESETS[viewport];

    this.screenshots.push({
      stepIndex,
      step,
      viewport,
      localPath,
      timestamp,
      fileSize: stats.size,
      dimensions: {
        width: viewportConfig.width,
        height: viewportConfig.height,
      },
    });

    console.log(`  Screenshot: ${filename} (${Math.round(stats.size / 1024)}KB)`);
  }

  /**
   * Upload all screenshots to Supabase
   */
  private async uploadScreenshots(): Promise<void> {
    if (this.screenshots.length === 0) return;

    console.log(`\n=== Uploading ${this.screenshots.length} screenshots to Supabase ===`);

    const uploads = this.screenshots.map((screenshot) => ({
      localPath: screenshot.localPath,
      remotePath: `pathways/${this.options.pathwayName}/${path.basename(screenshot.localPath)}`,
    }));

    const results = await this.storage.uploadBatch(uploads);

    // Update screenshots with Supabase URLs
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.success) {
        this.screenshots[i].supabasePath = result.path;
        this.screenshots[i].supabaseUrl = result.publicUrl;
        console.log(`  Uploaded: ${result.path}`);
      } else {
        this.errors.push(`Upload failed: ${result.error}`);
        console.error(`  Failed: ${result.error}`);
      }
    }

    // Upload manifest JSON
    const manifestPath = path.join(this.tempDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(this.screenshots, null, 2));

    const manifestResult = await this.storage.uploadScreenshot(
      manifestPath,
      `pathways/${this.options.pathwayName}/manifest.json`
    );

    if (manifestResult.success) {
      console.log(`  Manifest: ${manifestResult.path}`);
    }
  }

  /**
   * Clean up resources
   */
  private async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }

    // Clean up temp directory
    try {
      fs.rmSync(this.tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Wait helper
   */
  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Run a visual pathway capture
 */
export async function runVisualPathway(
  options: VisualPathwayOptions
): Promise<VisualPathwayResult> {
  const runner = new VisualPathwayRunner(options);
  return runner.run();
}
