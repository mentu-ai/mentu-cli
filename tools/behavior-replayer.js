#!/usr/bin/env node
/**
 * Behavior Replayer CLI
 *
 * Usage:
 *   node tools/behavior-replayer.js <behavior.yaml> [options]
 *
 * Options:
 *   --headless          Run headless (default: true)
 *   --no-headless       Show browser window
 *   --commitment <id>   Link evidence to Mentu commitment
 *   --evidence <dir>    Evidence output directory
 *
 * Examples:
 *   node tools/behavior-replayer.js behaviors/login-flow.yaml
 *   node tools/behavior-replayer.js behaviors/login-flow.yaml --commitment cmt_abc123
 */

import { replayBehavior } from '../dist/behavior/replayer.js';

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
Behavior Replayer CLI

Usage:
  node tools/behavior-replayer.js <behavior.yaml> [options]

Options:
  --headless          Run headless (default: true)
  --no-headless       Show browser window
  --commitment <id>   Link evidence to Mentu commitment
  --evidence <dir>    Evidence output directory
  --help, -h          Show this help

Examples:
  node tools/behavior-replayer.js behaviors/login-flow.yaml
  node tools/behavior-replayer.js behaviors/login-flow.yaml --commitment cmt_abc123
`);
  process.exit(0);
}

// Parse arguments
const yamlPath = args[0];
const options = {
  headless: true,
  commitmentId: undefined,
  evidenceDir: 'docs/evidence',
};

for (let i = 1; i < args.length; i++) {
  const arg = args[i];

  if (arg === '--no-headless') {
    options.headless = false;
  } else if (arg === '--commitment' && args[i + 1]) {
    options.commitmentId = args[++i];
  } else if (arg === '--evidence' && args[i + 1]) {
    options.evidenceDir = args[++i];
  }
}

async function main() {
  try {
    const result = await replayBehavior(yamlPath, options);

    if (result.success) {
      console.log('Replay completed successfully!');
      process.exit(0);
    } else {
      console.log('Replay completed with errors:');
      result.errors.forEach(err => console.log(`  - ${err}`));
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
