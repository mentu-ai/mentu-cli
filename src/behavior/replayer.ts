/**
 * Behavior Replayer
 *
 * Executes recorded behaviors on target environments.
 * Captures evidence and links to Mentu commitments.
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type {
  BehaviorYAML,
  BehaviorYAMLStep,
  ReplayOptions,
  ReplayResult,
  StepResult,
  EvidenceCapture,
  Cookie
} from './types.js';
import { loadBehaviorYAML } from './extractor.js';

const execAsync = promisify(exec);

const DEFAULT_OPTIONS: ReplayOptions = {
  headless: true,
  viewport: { width: 1280, height: 720 },
  timeout: 30000,
  evidenceDir: 'docs/evidence',
};

export class BehaviorReplayer {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private options: ReplayOptions;
  private behavior: BehaviorYAML;
  private results: StepResult[] = [];
  private evidence: EvidenceCapture[] = [];
  private startTime: number = 0;

  constructor(behavior: BehaviorYAML, options: Partial<ReplayOptions> = {}) {
    this.behavior = behavior;
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Parse viewport from YAML if present
    if (behavior.replay?.viewport) {
      const [width, height] = behavior.replay.viewport.split('x').map(Number);
      this.options.viewport = { width, height };
    }
  }

  async start(): Promise<void> {
    console.log('\n========================================');
    console.log('BEHAVIOR REPLAYER');
    console.log('========================================\n');
    console.log(`Behavior: ${this.behavior.behavior.name}`);
    console.log(`Target: ${this.behavior.behavior.target}`);
    console.log(`Steps: ${this.behavior.behavior.steps.length}`);
    console.log(`Headless: ${this.options.headless}`);
    console.log('');

    // Launch browser
    this.browser = await puppeteer.launch({
      headless: this.options.headless,
      defaultViewport: this.options.viewport,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    this.page = await this.browser.newPage();

    // Load cookies if available
    await this.loadCookies();

    this.startTime = Date.now();
  }

  private async loadCookies(): Promise<void> {
    if (!this.page) return;

    // Try options path first, then YAML path
    const cookiesPath = this.options.cookiesPath ||
      (this.behavior.cookies?.path?.replace('~', process.env.HOME || ''));

    if (cookiesPath && fs.existsSync(cookiesPath)) {
      try {
        const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8')) as Cookie[];
        await this.page.setCookie(...cookies);
        console.log(`Loaded ${cookies.length} cookies from: ${cookiesPath}`);
      } catch {
        console.log('Warning: Could not load cookies');
      }
    }
  }

  async replay(): Promise<ReplayResult> {
    if (!this.page) {
      throw new Error('Replayer not started. Call start() first.');
    }

    console.log('\n--- Replaying Steps ---\n');

    for (const step of this.behavior.behavior.steps) {
      const stepStart = Date.now();
      let success = true;
      let error: string | undefined;

      try {
        console.log(`[${step.action}] ${step.selector || step.url || step.value || ''}`);

        switch (step.action) {
          case 'navigate':
            if (step.url) {
              await this.page.goto(step.url, {
                waitUntil: 'networkidle2',
                timeout: step.timeout || this.options.timeout,
              });
            }
            break;

          case 'click':
            if (step.selector) {
              await this.page.waitForSelector(step.selector, { timeout: this.options.timeout });
              await this.page.click(step.selector);
            }
            break;

          case 'type':
            if (step.selector && step.value) {
              await this.page.waitForSelector(step.selector, { timeout: this.options.timeout });
              await this.page.type(step.selector, step.value);
            }
            break;

          case 'wait':
            if (step.condition === 'selector' && step.selector) {
              await this.page.waitForSelector(step.selector, { timeout: step.timeout || this.options.timeout });
            } else if (step.condition === 'url-contains' && step.value) {
              await this.page.waitForFunction(
                (urlPart: string) => window.location.href.includes(urlPart),
                { timeout: step.timeout || this.options.timeout },
                step.value
              );
            } else if (step.condition === 'network-idle') {
              await this.page.waitForNetworkIdle({ timeout: step.timeout || this.options.timeout });
            } else if (step.condition === 'timeout' && step.timeout) {
              await new Promise(resolve => setTimeout(resolve, step.timeout));
            }
            break;

          case 'screenshot':
            await this.captureEvidence(step.value || 'screenshot');
            break;

          case 'scroll':
            if (step.selector) {
              await this.page.evaluate((sel: string) => {
                document.querySelector(sel)?.scrollIntoView({ behavior: 'smooth' });
              }, step.selector);
            }
            break;

          case 'select':
            if (step.selector && step.value) {
              await this.page.select(step.selector, step.value);
            }
            break;

          case 'hover':
            if (step.selector) {
              await this.page.hover(step.selector);
            }
            break;
        }
      } catch (e) {
        success = false;
        error = e instanceof Error ? e.message : String(e);
        console.log(`  ERROR: ${error}`);
      }

      this.results.push({
        step,
        success,
        duration: Date.now() - stepStart,
        error,
      });
    }

    // Capture final screenshot
    await this.captureEvidence('final-state');

    return this.getResult();
  }

  private async captureEvidence(name: string): Promise<void> {
    if (!this.page) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}-${name}.png`;
    const evidencePath = path.join(
      this.options.evidenceDir,
      this.behavior.behavior.name,
      'screenshots',
      filename
    );

    // Ensure directory exists
    fs.mkdirSync(path.dirname(evidencePath), { recursive: true });

    await this.page.screenshot({ path: evidencePath, fullPage: true });

    const evidence: EvidenceCapture = {
      name,
      type: 'screenshot',
      path: evidencePath,
      timestamp: new Date().toISOString(),
      commitmentId: this.options.commitmentId,
    };

    this.evidence.push(evidence);
    console.log(`  Screenshot: ${evidencePath}`);

    // Link to Mentu if commitment ID provided
    if (this.options.commitmentId) {
      await this.linkToMentu(evidence);
    }
  }

  private sanitizeForShell(input: string): string {
    // Remove or escape shell-dangerous characters
    return input.replace(/[`$\\!"';&|<>(){}[\]]/g, '');
  }

  private async linkToMentu(evidence: EvidenceCapture): Promise<void> {
    try {
      // Sanitize all user-controlled inputs before shell execution
      const safeName = this.sanitizeForShell(evidence.name);
      const safePath = this.sanitizeForShell(evidence.path || '');
      const safeCommitmentId = this.sanitizeForShell(this.options.commitmentId || '');

      // Validate commitment ID format
      if (!safeCommitmentId.match(/^cmt_[a-f0-9]+$/)) {
        console.log('  Warning: Invalid commitment ID format');
        return;
      }

      // Capture evidence to Mentu using sanitized values
      const captureCmd = `mentu capture "Screenshot: ${safeName}" --kind screenshot-evidence --path "${safePath}" --refs ${safeCommitmentId}`;
      const { stdout } = await execAsync(captureCmd);

      // Extract memory ID from output
      const memMatch = stdout.match(/mem_[a-f0-9]+/);
      if (memMatch) {
        evidence.memoryId = memMatch[0];
        console.log(`  Linked to Mentu: ${evidence.memoryId}`);
      }

      // Annotate commitment using sanitized values
      const annotateCmd = `mentu annotate ${safeCommitmentId} "Visual evidence: ${safeName}"`;
      await execAsync(annotateCmd);
    } catch {
      console.log('  Warning: Could not link evidence to Mentu');
    }
  }

  async stop(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  getResult(): ReplayResult {
    const errors = this.results.filter(r => !r.success).map(r => r.error || 'Unknown error');

    return {
      success: errors.length === 0,
      recording: this.behavior.behavior.name,
      steps: this.results,
      evidence: this.evidence,
      duration: Date.now() - this.startTime,
      errors,
    };
  }
}

// Convenience function to replay a behavior file
export async function replayBehavior(
  yamlPath: string,
  options: Partial<ReplayOptions> = {}
): Promise<ReplayResult> {
  const behavior = loadBehaviorYAML(yamlPath);
  const replayer = new BehaviorReplayer(behavior, options);

  await replayer.start();
  const result = await replayer.replay();
  await replayer.stop();

  console.log('\n========================================');
  console.log('REPLAY COMPLETE');
  console.log('========================================');
  console.log(`Success: ${result.success}`);
  console.log(`Steps: ${result.steps.length} (${result.errors.length} failed)`);
  console.log(`Evidence: ${result.evidence.length} screenshots`);
  console.log(`Duration: ${result.duration}ms`);
  console.log('========================================\n');

  return result;
}
