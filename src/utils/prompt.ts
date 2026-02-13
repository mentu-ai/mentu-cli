// Minimal interactive prompts for Mentu CLI (zero external deps)

import readline from 'readline';

/**
 * Check if the current environment supports interactive prompts.
 * Returns false for piped stdin, --json, --silent, or --no-interactive.
 */
export function isInteractive(options?: { json?: boolean; silent?: boolean; noInteractive?: boolean }): boolean {
  if (options?.json || options?.silent || options?.noInteractive) {
    return false;
  }
  return process.stdin.isTTY === true;
}

/**
 * Ask a Y/n confirmation question.
 * Returns the default if stdin is not a TTY.
 */
export async function confirm(question: string, defaultYes = true): Promise<boolean> {
  if (!process.stdin.isTTY) {
    return defaultYes;
  }

  const hint = defaultYes ? 'Y/n' : 'y/N';
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  return new Promise((resolve) => {
    rl.question(`${question} (${hint}) `, (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      if (trimmed === '') {
        resolve(defaultYes);
      } else {
        resolve(trimmed === 'y' || trimmed === 'yes');
      }
    });
  });
}

/**
 * Show a numbered list and let the user pick one.
 * Returns the 0-based index of the selected item.
 * Returns -1 if the user cancels or input is invalid.
 */
export async function selectFromList(items: string[], prompt: string): Promise<number> {
  if (!process.stdin.isTTY || items.length === 0) {
    return -1;
  }

  for (let i = 0; i < items.length; i++) {
    console.log(`  ${i + 1}. ${items[i]}`);
  }
  console.log('');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  return new Promise((resolve) => {
    rl.question(`${prompt} (1-${items.length}): `, (answer) => {
      rl.close();
      const num = parseInt(answer.trim(), 10);
      if (isNaN(num) || num < 1 || num > items.length) {
        resolve(-1);
      } else {
        resolve(num - 1);
      }
    });
  });
}
