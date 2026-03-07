#!/usr/bin/env node
/**
 * Visual Pathway CLI
 *
 * Replays recorded browser pathways and captures screenshots at multiple resolutions.
 * Uploads to Supabase and generates a JSON manifest.
 *
 * Usage:
 *   node tools/visual-pathway.js <recording> [options]
 *
 * Options:
 *   --name <name>           Pathway name (default: from recording)
 *   --viewports <list>      Comma-separated viewports: desktop,laptop,tablet,mobile
 *   --bucket <name>         Supabase bucket (default: visual-evidence)
 *   --format <fmt>          Screenshot format: png, jpeg, webp (default: webp)
 *   --quality <num>         Screenshot quality 1-100 (default: 85)
 *   --wait <ms>             Wait between steps in ms (default: 1000)
 *   --cookies <path>        Cookies file path
 *   --commitment <id>       Link to Mentu commitment
 *   --headless              Run in headless mode (default: true)
 *   --no-headless           Run with visible browser
 *   --json                  Output as JSON
 *
 * Examples:
 *   node tools/visual-pathway.js behaviors/talisman-flow.json --name talisman-visual
 *   node tools/visual-pathway.js behaviors/login.yaml --viewports desktop,mobile
 *   node tools/visual-pathway.js behaviors/app.json --commitment cmt_abc123
 */

import { runVisualPathway } from '../dist/agents/visual-pathway/index.js';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

const args = process.argv.slice(2);

// Parse arguments
const options = {
  recordingPath: null,
  pathwayName: null,
  viewports: ['desktop'],
  supabaseBucket: 'visual-evidence',
  screenshotFormat: 'webp',
  screenshotQuality: 85,
  waitBetweenSteps: 1000,
  headless: true,
  cookiesPath: null,
  commitmentId: null,
  jsonOutput: false,
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  if (arg === '--help' || arg === '-h') {
    console.log(`
Visual Pathway CLI

Replays recorded browser pathways and captures screenshots at multiple resolutions.
Uploads to Supabase and generates a JSON manifest.

Usage:
  node tools/visual-pathway.js <recording> [options]

Options:
  --name <name>           Pathway name (default: from recording filename)
  --viewports <list>      Comma-separated viewports: desktop,laptop,tablet,mobile
  --bucket <name>         Supabase bucket (default: visual-evidence)
  --format <fmt>          Screenshot format: png, jpeg, webp (default: webp)
  --quality <num>         Screenshot quality 1-100 (default: 85)
  --wait <ms>             Wait between steps in ms (default: 1000)
  --cookies <path>        Cookies file path
  --commitment <id>       Link to Mentu commitment
  --headless              Run in headless mode (default)
  --no-headless           Run with visible browser
  --json                  Output as JSON

Viewports:
  desktop   1920x1080
  laptop    1366x768
  tablet    768x1024 (mobile, touch)
  mobile    375x812 (mobile, touch)

Examples:
  node tools/visual-pathway.js behaviors/talisman-flow.json --name talisman-visual
  node tools/visual-pathway.js behaviors/login.yaml --viewports desktop,mobile
  node tools/visual-pathway.js behaviors/app.json --commitment cmt_abc123 --viewports desktop,tablet,mobile
`);
    process.exit(0);
  } else if (arg === '--name' && args[i + 1]) {
    options.pathwayName = args[++i];
  } else if (arg === '--viewports' && args[i + 1]) {
    options.viewports = args[++i].split(',').map((v) => v.trim());
  } else if (arg === '--bucket' && args[i + 1]) {
    options.supabaseBucket = args[++i];
  } else if (arg === '--format' && args[i + 1]) {
    options.screenshotFormat = args[++i];
  } else if (arg === '--quality' && args[i + 1]) {
    options.screenshotQuality = parseInt(args[++i], 10);
  } else if (arg === '--wait' && args[i + 1]) {
    options.waitBetweenSteps = parseInt(args[++i], 10);
  } else if (arg === '--cookies' && args[i + 1]) {
    options.cookiesPath = args[++i];
  } else if (arg === '--commitment' && args[i + 1]) {
    options.commitmentId = args[++i];
  } else if (arg === '--headless') {
    options.headless = true;
  } else if (arg === '--no-headless') {
    options.headless = false;
  } else if (arg === '--json') {
    options.jsonOutput = true;
  } else if (!arg.startsWith('-')) {
    options.recordingPath = arg;
  }
}

// Validate recording path
if (!options.recordingPath) {
  console.error('Error: Recording path is required');
  console.error('Usage: node tools/visual-pathway.js <recording> [options]');
  process.exit(1);
}

// Resolve recording path
const recordingPath = path.resolve(options.recordingPath);
if (!fs.existsSync(recordingPath)) {
  console.error(`Error: Recording not found: ${recordingPath}`);
  process.exit(1);
}

// Generate pathway name from recording if not provided
if (!options.pathwayName) {
  const basename = path.basename(recordingPath, path.extname(recordingPath));
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  options.pathwayName = `${basename}-${timestamp}`;
}

// Validate viewports
const validViewports = ['desktop', 'laptop', 'tablet', 'mobile'];
for (const viewport of options.viewports) {
  if (!validViewports.includes(viewport)) {
    console.error(`Error: Invalid viewport '${viewport}'. Valid options: ${validViewports.join(', ')}`);
    process.exit(1);
  }
}

// Validate format
const validFormats = ['png', 'jpeg', 'webp'];
if (!validFormats.includes(options.screenshotFormat)) {
  console.error(`Error: Invalid format '${options.screenshotFormat}'. Valid options: ${validFormats.join(', ')}`);
  process.exit(1);
}

async function main() {
  if (!options.jsonOutput) {
    console.log('\n========================================');
    console.log('VISUAL PATHWAY CAPTURE');
    console.log('========================================');
    console.log(`Recording: ${recordingPath}`);
    console.log(`Name: ${options.pathwayName}`);
    console.log(`Viewports: ${options.viewports.join(', ')}`);
    console.log(`Format: ${options.screenshotFormat} (quality: ${options.screenshotQuality})`);
    console.log(`Bucket: ${options.supabaseBucket}`);
    if (options.commitmentId) {
      console.log(`Commitment: ${options.commitmentId}`);
    }
    console.log('========================================\n');
  }

  try {
    const result = await runVisualPathway({
      pathwayName: options.pathwayName,
      recordingPath,
      viewports: options.viewports,
      supabaseBucket: options.supabaseBucket,
      headless: options.headless,
      screenshotFormat: options.screenshotFormat,
      screenshotQuality: options.screenshotQuality,
      waitBetweenSteps: options.waitBetweenSteps,
      cookiesPath: options.cookiesPath,
      commitmentId: options.commitmentId,
    });

    // Capture as Mentu evidence if requested
    if (options.commitmentId && !options.jsonOutput) {
      console.log('\n========================================');
      console.log('CAPTURING MENTU EVIDENCE');
      console.log('========================================');

      try {
        const evidenceBody = `Visual Pathway: ${options.pathwayName}
Screenshots: ${result.totalScreenshots}
Viewports: ${options.viewports.join(', ')}
Duration: ${Math.round(result.duration / 1000)}s
Supabase: ${result.supabaseFolder}`;

        const captureResult = execSync(
          `mentu capture "${evidenceBody}" --kind visual-evidence --json`,
          { encoding: 'utf-8', cwd: process.cwd() }
        );

        const evidenceData = JSON.parse(captureResult);
        result.evidenceId = evidenceData.id;

        console.log(`Evidence captured: ${evidenceData.id}`);

        // Link to commitment
        execSync(
          `mentu annotate "${options.commitmentId}" "Visual pathway evidence: ${evidenceData.id} - ${options.pathwayName} (${result.totalScreenshots} screenshots)"`,
          { encoding: 'utf-8', cwd: process.cwd() }
        );

        console.log(`Linked to commitment: ${options.commitmentId}`);
      } catch (error) {
        console.error('Warning: Could not capture Mentu evidence:', error.message);
      }
    }

    // Output results
    if (options.jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('\n========================================');
      console.log('CAPTURE COMPLETE');
      console.log('========================================');
      console.log(`Success: ${result.success}`);
      console.log(`Screenshots: ${result.totalScreenshots}`);
      console.log(`Duration: ${Math.round(result.duration / 1000)}s`);
      console.log(`Supabase folder: ${result.supabaseFolder}`);
      if (result.evidenceId) {
        console.log(`Evidence ID: ${result.evidenceId}`);
      }
      if (result.errors.length > 0) {
        console.log(`\nErrors (${result.errors.length}):`);
        result.errors.forEach((err) => console.log(`  - ${err}`));
      }
      console.log('========================================\n');

      // Show sample URLs
      if (result.screenshots.length > 0 && result.screenshots[0].supabaseUrl) {
        console.log('Sample screenshot URLs:');
        result.screenshots.slice(0, 3).forEach((s) => {
          if (s.supabaseUrl) {
            console.log(`  ${s.viewport}: ${s.supabaseUrl}`);
          }
        });
        if (result.screenshots.length > 3) {
          console.log(`  ... and ${result.screenshots.length - 3} more`);
        }
      }
    }

    process.exit(result.success ? 0 : 1);
  } catch (error) {
    if (options.jsonOutput) {
      console.log(JSON.stringify({ success: false, error: error.message }, null, 2));
    } else {
      console.error('\nError:', error.message);
    }
    process.exit(1);
  }
}

main();
