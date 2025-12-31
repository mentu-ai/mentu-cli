import fs from 'fs';
import path from 'path';
import type { Command } from 'commander';
import type { Config, InitOutput } from '../types.js';
import { MentuError } from '../types.js';
import { timestamp } from '../utils/time.js';
import {
  getMentuDir,
  workspaceExists,
  writeConfig,
} from '../core/config.js';
import { getLedgerPath } from '../core/ledger.js';

interface InitOptions {
  force?: boolean;
  silent?: boolean;
  noGitignore?: boolean;
  actor?: string;
  workspace?: string;
}

function outputResult(result: InitOutput, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result));
  } else {
    console.log(`Initialized Mentu workspace at ${result.workspace}`);
    console.log(`Created: ${result.created.join(', ')}`);
    if (result.gitignore_updated) {
      console.log('Updated .gitignore');
    }
  }
}

function outputError(error: MentuError, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(error.toJSON()));
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize a Mentu workspace')
    .option('-f, --force', 'Overwrite existing workspace')
    .option('-s, --silent', 'Non-interactive mode')
    .option('--no-gitignore', 'Skip .gitignore modification')
    .option('--actor <id>', 'Set default actor')
    .option('--workspace <name>', 'Set workspace name')
    .action(async (options: InitOptions) => {
      const json = program.opts().json || false;

      try {
        // Always initialize in the current directory, not a parent project root
        // This prevents creating .mentu in unexpected locations when package.json exists up the tree
        const cwd = process.cwd();
        const projectRoot = cwd;

        // Check for existing workspace in current directory only
        if (workspaceExists(projectRoot) && !options.force) {
          throw new MentuError(
            'E_WORKSPACE_EXISTS',
            '.mentu/ already exists. Use --force to overwrite.'
          );
        }

        // Create .mentu directory
        const mentuDir = getMentuDir(projectRoot);

        if (options.force && fs.existsSync(mentuDir)) {
          fs.rmSync(mentuDir, { recursive: true });
        }

        fs.mkdirSync(mentuDir, { recursive: true });

        // Create empty ledger
        const ledgerPath = getLedgerPath(projectRoot);
        fs.writeFileSync(ledgerPath, '', 'utf-8');

        // Create config
        const workspaceName = options.workspace || path.basename(projectRoot);
        const config: Config = {
          workspace: workspaceName,
          created: timestamp(),
        };

        if (options.actor) {
          config.default_actor = options.actor;
        }

        writeConfig(projectRoot, config);

        const created = ['ledger.jsonl', 'config.yaml'];

        // Update .gitignore
        let gitignoreUpdated = false;
        if (options.noGitignore !== true && !options.silent) {
          const gitignorePath = path.join(projectRoot, '.gitignore');
          const mentuEntry = '.mentu/';

          if (fs.existsSync(gitignorePath)) {
            const content = fs.readFileSync(gitignorePath, 'utf-8');
            if (!content.includes(mentuEntry)) {
              fs.appendFileSync(
                gitignorePath,
                `\n# Mentu workspace\n${mentuEntry}\n`,
                'utf-8'
              );
              gitignoreUpdated = true;
            }
          } else {
            fs.writeFileSync(
              gitignorePath,
              `# Mentu workspace\n${mentuEntry}\n`,
              'utf-8'
            );
            gitignoreUpdated = true;
          }
        }

        const result: InitOutput = {
          workspace: mentuDir,
          created,
          project_root: projectRoot,
          gitignore_updated: gitignoreUpdated,
        };

        outputResult(result, json);
      } catch (err) {
        if (err instanceof MentuError) {
          outputError(err, json);
        } else {
          const error = new MentuError(
            'E_INVALID_OP',
            err instanceof Error ? err.message : 'Unknown error'
          );
          outputError(error, json);
        }
      }
    });
}
