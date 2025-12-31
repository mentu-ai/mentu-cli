import fs from 'fs';
import path from 'path';
import type { Command } from 'commander';
import { MentuError } from '../types.js';

interface ClaudeStatusOutput {
  initialized: boolean;
  config_path: string | null;
  hooks_installed: string[];
  active_commitment: string | null;
  env_vars: {
    api_url: boolean;
    token: boolean;
    workspace_id: boolean;
    actor: string | null;
  };
}

function outputResult(result: ClaudeStatusOutput, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result));
  } else {
    console.log('Mentu Claude Integration Status');
    console.log('================================');
    console.log('');

    if (result.initialized) {
      console.log('Integration: Initialized');
      console.log(`Config: ${result.config_path}`);
      console.log(`Hooks: ${result.hooks_installed.join(', ') || 'None'}`);
    } else {
      console.log('Integration: Not initialized');
      console.log('Run: mentu init-claude');
    }

    console.log('');
    console.log('Environment:');
    console.log(`  MENTU_API_URL: ${result.env_vars.api_url ? 'Set' : 'Not set'}`);
    console.log(`  MENTU_PROXY_TOKEN: ${result.env_vars.token ? 'Set' : 'Not set'}`);
    console.log(`  MENTU_WORKSPACE_ID: ${result.env_vars.workspace_id ? 'Set' : 'Not set'}`);
    console.log(`  MENTU_ACTOR: ${result.env_vars.actor || 'Not set (default: agent:claude-code)'}`);

    if (result.active_commitment) {
      console.log('');
      console.log(`Active Commitment: ${result.active_commitment}`);
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

export function registerClaudeStatusCommand(program: Command): void {
  program
    .command('claude-status')
    .description('Show Mentu Claude integration status')
    .action(() => {
      const json = program.opts().json || false;

      try {
        const projectRoot = process.cwd();
        const claudeDir = path.join(projectRoot, '.claude');
        const configPath = path.join(claudeDir, 'mentu_config.yaml');
        const hooksDir = path.join(claudeDir, 'hooks');
        const statePath = path.join(claudeDir, 'mentu_state.json');

        const initialized = fs.existsSync(configPath);

        // Check which hooks are installed
        const hookFiles = ['mentu_pre_task.py', 'mentu_post_task.py', 'mentu_pr_events.py'];
        const hooksInstalled: string[] = [];

        if (fs.existsSync(hooksDir)) {
          for (const hook of hookFiles) {
            if (fs.existsSync(path.join(hooksDir, hook))) {
              hooksInstalled.push(hook);
            }
          }
        }

        // Check active commitment
        let activeCommitment: string | null = null;
        if (fs.existsSync(statePath)) {
          try {
            const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
            activeCommitment = state.active_commitment || null;
          } catch {
            // Ignore parse errors
          }
        }

        const result: ClaudeStatusOutput = {
          initialized,
          config_path: initialized ? configPath : null,
          hooks_installed: hooksInstalled,
          active_commitment: activeCommitment,
          env_vars: {
            api_url: !!process.env.MENTU_API_URL,
            token: !!process.env.MENTU_PROXY_TOKEN,
            workspace_id: !!process.env.MENTU_WORKSPACE_ID,
            actor: process.env.MENTU_ACTOR || null,
          },
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
