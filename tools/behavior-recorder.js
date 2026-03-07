#!/usr/bin/env node
/**
 * Behavior Recorder CLI
 *
 * Usage:
 *   node tools/behavior-recorder.js [url] [options]
 *
 * Options:
 *   --name <name>       Recording name
 *   --output <dir>      Output directory
 *   --cookies <path>    Cookies file path
 *   --auto <seconds>    Auto-save after N seconds
 *
 * Examples:
 *   node tools/behavior-recorder.js https://mentu.ai
 *   node tools/behavior-recorder.js https://app.example.com --name login-flow
 *   node tools/behavior-recorder.js https://app.example.com --auto 60
 */

import { recordBehavior } from '../dist/behavior/recorder.js';
import { saveRecording } from '../dist/behavior/extractor.js';
import path from 'path';

const args = process.argv.slice(2);

// Parse arguments
const options = {
  target: 'https://mentu.ai',
  name: undefined,
  outputDir: path.join(process.cwd(), 'behaviors'),
  cookiesPath: undefined,
  autoSaveDelay: 0,
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  if (arg.startsWith('http')) {
    options.target = arg;
  } else if (arg === '--name' && args[i + 1]) {
    options.name = args[++i];
  } else if (arg === '--output' && args[i + 1]) {
    options.outputDir = args[++i];
  } else if (arg === '--cookies' && args[i + 1]) {
    options.cookiesPath = args[++i];
  } else if (arg === '--auto' && args[i + 1]) {
    const seconds = parseInt(args[++i], 10);
    if (isNaN(seconds) || seconds <= 0) {
      console.error('Error: --auto requires a positive number of seconds');
      process.exit(1);
    }
    options.autoSaveDelay = seconds * 1000; // Convert to ms
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Behavior Recorder CLI

Usage:
  node tools/behavior-recorder.js [url] [options]

Options:
  --name <name>       Recording name
  --output <dir>      Output directory (default: ./behaviors)
  --cookies <path>    Cookies file path
  --auto <seconds>    Auto-save after N seconds (no ENTER needed)
  --help, -h          Show this help

Examples:
  node tools/behavior-recorder.js https://mentu.ai
  node tools/behavior-recorder.js https://app.example.com --name login-flow
  node tools/behavior-recorder.js https://app.example.com --auto 60
  node tools/behavior-recorder.js https://dev.talismanapp.co --name talisman --auto 90
`);
    process.exit(0);
  }
}

async function main() {
  try {
    const recording = await recordBehavior(options);

    if (recording) {
      const { yamlPath, jsonPath } = saveRecording(recording, options.outputDir);

      console.log('\nOutput files:');
      console.log(`  YAML: ${yamlPath}`);
      console.log(`  JSON: ${jsonPath}`);
      console.log('\nTo replay this behavior:');
      console.log(`  node tools/behavior-replayer.js ${yamlPath}\n`);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
