// mentu autopilot — CLI commands for the autonomous bug-fix pipeline
//
// Subcommands:
//   mentu autopilot preflight     — Auth, workspace, stack detection → JSON
//   mentu autopilot init-wave     — Create wave state file for Stop hook
//   mentu autopilot wave-status   — Read current wave state
//   mentu autopilot complete-wave — Advance wave, check circuit breakers, capture evidence

import type { Command } from 'commander';
import { MentuError } from '../types.js';
import { findWorkspace, readConfig, getWorkspaceName, workspaceExists } from '../core/config.js';
import { readLedger } from '../core/ledger.js';
import { computeMemories, computeCommitments, computeMemoryState } from '../core/state.js';
import { resolveActor } from '../utils/actor.js';
import { getValidCredentials } from '../cloud/auth.js';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PreflightResult {
  ok: boolean;
  action?: string;
  message?: string;
  workspace?: string;
  workspace_name?: string;
  actor?: string;
  stack?: string;
  project?: string;
  build_cmd?: string;
  has_prisma?: boolean;
  has_supabase?: boolean;
  git_remote?: string;
  workspaces?: Array<{ id: string; name: string }>;
}

interface WaveState {
  active: boolean;
  wave: number;
  max_waves: number;
  batch_size: number;
  empty_waves: number;
  max_empty_waves: number;
  total_fixed: number;
  dry_run: boolean;
  workspace: string;
  stack: string;
  project: string;
  started_at: string;
}

interface WaveStatusResult {
  active: boolean;
  wave: number;
  max_waves: number;
  batch_size: number;
  empty_waves: number;
  max_empty_waves: number;
  total_fixed: number;
  dry_run: boolean;
  workspace: string;
  stack: string;
  project: string;
  started_at: string;
  state_file: string;
}

interface CompleteWaveResult {
  decision: 'continue' | 'stop';
  reason: string;
  wave: number;
  next_wave?: number;
  total_fixed: number;
  empty_waves: number;
  prompt?: string;
  system_message?: string;
}

// ─── Stack Detection ─────────────────────────────────────────────────────────

function detectStack(cwd: string): string {
  // Next.js
  for (const f of ['next.config.js', 'next.config.mjs', 'next.config.ts']) {
    if (fs.existsSync(path.join(cwd, f))) {
      if (fs.existsSync(path.join(cwd, 'app'))) return 'nextjs-app';
      if (fs.existsSync(path.join(cwd, 'pages'))) return 'nextjs-pages';
      return 'nextjs-app';
    }
  }

  // Vite
  for (const f of ['vite.config.ts', 'vite.config.js', 'vite.config.mjs']) {
    if (fs.existsSync(path.join(cwd, f))) return 'vite-react';
  }

  // Angular
  if (fs.existsSync(path.join(cwd, 'angular.json'))) return 'angular';

  // Svelte
  if (fs.existsSync(path.join(cwd, 'svelte.config.js'))) return 'svelte';

  return 'other';
}

function detectBuildCommand(cwd: string): string {
  if (fs.existsSync(path.join(cwd, 'bun.lockb'))) return 'bun run build';
  if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) return 'pnpm run build';
  if (fs.existsSync(path.join(cwd, 'yarn.lock'))) return 'yarn build';
  return 'npm run build';
}

function readPackageJson(cwd: string): Record<string, unknown> | null {
  const pkgPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  } catch {
    return null;
  }
}

function getGitRemote(cwd: string): string {
  try {
    return execSync('git remote get-url origin', { cwd, encoding: 'utf-8', timeout: 5000 }).trim();
  } catch {
    return '';
  }
}

// ─── Wave State File ─────────────────────────────────────────────────────────

const WAVE_STATE_FILE = '.claude/autopilot.local.md';

function parseWaveState(content: string): WaveState | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const fm: Record<string, string | number | boolean> = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let val: string | number | boolean = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (val === 'true') val = true;
    else if (val === 'false') val = false;
    else if (/^\d+$/.test(val as string)) val = parseInt(val as string, 10);
    fm[key] = val;
  }

  return {
    active: fm.active as boolean ?? false,
    wave: fm.wave as number ?? 1,
    max_waves: fm.max_waves as number ?? 5,
    batch_size: fm.batch_size as number ?? 5,
    empty_waves: fm.empty_waves as number ?? 0,
    max_empty_waves: fm.max_empty_waves as number ?? 2,
    total_fixed: fm.total_fixed as number ?? 0,
    dry_run: fm.dry_run as boolean ?? false,
    workspace: fm.workspace as string ?? '',
    stack: fm.stack as string ?? '',
    project: fm.project as string ?? '',
    started_at: fm.started_at as string ?? '',
  };
}

function getWavePrompt(content: string): string {
  const parts = content.split('---');
  if (parts.length >= 3) return parts.slice(2).join('---').trim();
  return '';
}

function buildWaveStateFile(state: WaveState, prompt: string): string {
  return `---
active: ${state.active}
wave: ${state.wave}
max_waves: ${state.max_waves}
batch_size: ${state.batch_size}
empty_waves: ${state.empty_waves}
max_empty_waves: ${state.max_empty_waves}
total_fixed: ${state.total_fixed}
dry_run: ${state.dry_run}
workspace: ${state.workspace}
stack: ${state.stack}
project: ${state.project}
started_at: "${state.started_at}"
---

${prompt}
`;
}

function buildDefaultPrompt(state: WaveState): string {
  return `Continue the autopilot pipeline. This is wave ${state.wave}.

## Your task

1. Fetch untriaged bugs: \`mentu list memories --untriaged --json\`
2. Apply 5-gate filter (coherence, test detection, project match, dedup, actionability)
3. Score and sort survivors — pick top ${state.batch_size}
4. For each ticket:
   a. Investigate the codebase (stack-aware: ${state.stack})
   b. Create branch: \`fix/ticket-{short_id}\`
   c. Create HANDOFF doc
   d. Create Mentu commitment: \`mentu commit "Fix: {title}" --source {mem_id}\`
   e. Claim commitment: \`mentu claim {cmt_id}\`
   f. Fix the bug (follow HANDOFF steps)
   g. Verify: \`${detectBuildCommand(process.cwd())}\`
   h. Commit changes: \`[Ticket-{short_id} Step N] description\`
   i. Capture progress: \`mentu capture "[Ticket-{id} Step N] done" --kind execution-progress\`
5. After all tickets in this wave:
   a. Push branches: \`git push origin {branch} -u\`
   b. Create PRs: \`gh pr create --title "Fix: {title}" ...\`
   c. Capture PR evidence: \`mentu capture "PR: {url}" --kind document\`
   d. Submit commitments: \`mentu submit {cmt_id} --summary "..." --include-files\`

## Rules
- \`${detectBuildCommand(process.cwd())}\` after EVERY step — fix all errors before committing
- One commit per step: \`[Ticket-{short_id} Step N] description\`
- Skip tickets that already have commitments
- If no actionable tickets found, output: <promise>COMPLETE</promise>
- When all tickets in this wave are fixed and PRs created: <promise>COMPLETE</promise>`;
}

// ─── Output Helpers ──────────────────────────────────────────────────────────

function outputJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

function outputError(error: MentuError, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ ...error.toJSON(), op: 'autopilot' }));
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
}

// ─── Command Registration ────────────────────────────────────────────────────

export function registerAutopilotCommand(program: Command): void {
  const autopilot = program
    .command('autopilot')
    .description('Autonomous bug-fix pipeline — triage, fix, push in waves');

  // ── mentu autopilot preflight ──────────────────────────────────────────

  autopilot
    .command('preflight')
    .description('Check auth, workspace, and stack detection')
    .action(async () => {
      const json = program.opts().json || false;
      const cwd = process.cwd();

      try {
        // Step 1: Check auth (auto-refreshes expired tokens)
        const creds = await getValidCredentials();
        if (!creds) {
          const result: PreflightResult = {
            ok: false,
            action: 'login',
            message: 'Not authenticated or token refresh failed. Run: mentu login',
          };
          if (json) { outputJson(result); } else { console.log(result.message); }
          return;
        }

        const actor = creds.email || 'unknown';

        // Step 2: Check workspace
        let workspace = '';
        let workspaceName = '';

        if (workspaceExists(cwd)) {
          try {
            const wsPath = findWorkspace(cwd);
            const config = readConfig(wsPath);
            workspace = config?.cloud?.workspace_id || config?.workspace || '';
            workspaceName = getWorkspaceName(wsPath);
          } catch {
            // workspace exists but config is broken
          }
        }

        if (!workspace) {
          // Try cloud workspace list
          // For now, return the action needed
          const result: PreflightResult = {
            ok: false,
            action: 'init-workspace',
            message: 'No workspace linked to this directory. Run: mentu init or mentu workspace connect <name>',
          };
          if (json) { outputJson(result); } else { console.log(result.message); }
          return;
        }

        // Step 3: Detect stack
        const stack = detectStack(cwd);
        const pkg = readPackageJson(cwd);
        const projectName = (pkg?.name as string) || '';
        const buildCmd = detectBuildCommand(cwd);
        const hasPrisma = fs.existsSync(path.join(cwd, 'prisma'));
        const hasSupabase = fs.existsSync(path.join(cwd, 'supabase')) ||
          !!(pkg?.dependencies && typeof pkg.dependencies === 'object' &&
            '@supabase/supabase-js' in (pkg.dependencies as Record<string, unknown>));
        const gitRemote = getGitRemote(cwd);

        const result: PreflightResult = {
          ok: true,
          workspace,
          workspace_name: workspaceName,
          actor,
          stack,
          project: projectName,
          build_cmd: buildCmd,
          has_prisma: hasPrisma,
          has_supabase: hasSupabase,
          git_remote: gitRemote,
        };

        if (json) {
          outputJson(result);
        } else {
          console.log(`Mentu Autopilot preflight OK`);
          console.log(`  Actor:     ${actor}`);
          console.log(`  Workspace: ${workspaceName} (${workspace})`);
          console.log(`  Stack:     ${stack}`);
          console.log(`  Project:   ${projectName}`);
          console.log(`  Build:     ${buildCmd}`);
          console.log(`  Prisma:    ${hasPrisma}`);
          console.log(`  Supabase:  ${hasSupabase}`);
          if (gitRemote) console.log(`  Git:       ${gitRemote}`);
        }
      } catch (err) {
        if (err instanceof MentuError) {
          outputError(err, json);
        } else {
          const error = new MentuError(
            'E_INVALID_OP',
            err instanceof Error ? err.message : 'Preflight failed'
          );
          outputError(error, json);
        }
      }
    });

  // ── mentu autopilot init-wave ──────────────────────────────────────────

  autopilot
    .command('init-wave')
    .description('Create wave state file for the autopilot Stop hook')
    .option('--max-waves <n>', 'Maximum number of waves', '5')
    .option('--batch-size <n>', 'Tickets per wave', '5')
    .option('--dry-run', 'Triage only, no fixes')
    .option('--workspace <id>', 'Override workspace')
    .option('--stack <type>', 'Override stack detection')
    .option('--project <name>', 'Override project name')
    .action((options) => {
      const json = program.opts().json || false;
      const cwd = process.cwd();
      const stateFilePath = path.join(cwd, WAVE_STATE_FILE);

      try {
        // Check for existing active state
        if (fs.existsSync(stateFilePath)) {
          const content = fs.readFileSync(stateFilePath, 'utf-8');
          const existing = parseWaveState(content);

          if (existing?.active) {
            const result = {
              resumed: true,
              ...existing,
              state_file: stateFilePath,
            };

            if (json) {
              outputJson(result);
            } else {
              console.log(`Existing autopilot state found (wave ${existing.wave}, ${existing.total_fixed} fixed).`);
              console.log(`Resuming from wave ${existing.wave}.`);
              console.log(`To start fresh, delete: ${stateFilePath}`);
            }
            return;
          }
        }

        // Auto-detect values if not overridden
        const stack = options.stack || detectStack(cwd);
        const project = options.project || (readPackageJson(cwd)?.name as string) || '';
        let workspace = options.workspace || '';
        if (!workspace && workspaceExists(cwd)) {
          try {
            const wsPath = findWorkspace(cwd);
            const config = readConfig(wsPath);
            workspace = config?.cloud?.workspace_id || config?.workspace || '';
          } catch { /* ignore */ }
        }

        const state: WaveState = {
          active: true,
          wave: 1,
          max_waves: parseInt(options.maxWaves, 10) || 5,
          batch_size: parseInt(options.batchSize, 10) || 5,
          empty_waves: 0,
          max_empty_waves: 2,
          total_fixed: 0,
          dry_run: !!options.dryRun,
          workspace,
          stack,
          project,
          started_at: new Date().toISOString(),
        };

        const prompt = buildDefaultPrompt(state);
        const fileContent = buildWaveStateFile(state, prompt);

        // Ensure .claude/ directory exists
        const claudeDir = path.join(cwd, '.claude');
        if (!fs.existsSync(claudeDir)) {
          fs.mkdirSync(claudeDir, { recursive: true });
        }

        fs.writeFileSync(stateFilePath, fileContent, 'utf-8');

        const result = {
          created: true,
          state_file: stateFilePath,
          ...state,
        };

        if (json) {
          outputJson(result);
        } else {
          console.log(`Autopilot wave state created.`);
          console.log(`  State file: ${stateFilePath}`);
          console.log(`  Max waves:  ${state.max_waves}`);
          console.log(`  Batch size: ${state.batch_size}`);
          console.log(`  Workspace:  ${state.workspace}`);
          console.log(`  Stack:      ${state.stack}`);
          console.log(`  Project:    ${state.project}`);
          if (state.dry_run) console.log(`  Mode:       DRY RUN (triage only)`);
        }
      } catch (err) {
        if (err instanceof MentuError) {
          outputError(err, json);
        } else {
          const error = new MentuError(
            'E_INVALID_OP',
            err instanceof Error ? err.message : 'Failed to create wave state'
          );
          outputError(error, json);
        }
      }
    });

  // ── mentu autopilot wave-status ────────────────────────────────────────

  autopilot
    .command('wave-status')
    .description('Read current wave state')
    .action(() => {
      const json = program.opts().json || false;
      const cwd = process.cwd();
      const stateFilePath = path.join(cwd, WAVE_STATE_FILE);

      if (!fs.existsSync(stateFilePath)) {
        if (json) {
          outputJson({ active: false, message: 'No active autopilot wave' });
        } else {
          console.log('No active autopilot wave.');
        }
        return;
      }

      const content = fs.readFileSync(stateFilePath, 'utf-8');
      const state = parseWaveState(content);

      if (!state) {
        if (json) {
          outputJson({ active: false, message: 'State file corrupted' });
        } else {
          console.log('Wave state file corrupted.');
        }
        return;
      }

      const result: WaveStatusResult = {
        ...state,
        state_file: stateFilePath,
      };

      if (json) {
        outputJson(result);
      } else {
        console.log(`Autopilot wave ${state.wave}/${state.max_waves}`);
        console.log(`  Active:       ${state.active}`);
        console.log(`  Total fixed:  ${state.total_fixed}`);
        console.log(`  Empty waves:  ${state.empty_waves}/${state.max_empty_waves}`);
        console.log(`  Batch size:   ${state.batch_size}`);
        console.log(`  Workspace:    ${state.workspace}`);
        console.log(`  Stack:        ${state.stack}`);
        console.log(`  Project:      ${state.project}`);
        console.log(`  Dry run:      ${state.dry_run}`);
        console.log(`  Started:      ${state.started_at}`);
      }
    });

  // ── mentu autopilot complete-wave ──────────────────────────────────────

  autopilot
    .command('complete-wave')
    .description('Advance wave counter, check circuit breakers, capture evidence')
    .option('--wave-commits <n>', 'Number of new commits in this wave', '0')
    .action(async (options) => {
      const json = program.opts().json || false;
      const cwd = process.cwd();
      const stateFilePath = path.join(cwd, WAVE_STATE_FILE);

      try {
        if (!fs.existsSync(stateFilePath)) {
          // No active autopilot — signal to allow exit
          const result: CompleteWaveResult = {
            decision: 'stop',
            reason: 'No active autopilot wave',
            wave: 0,
            total_fixed: 0,
            empty_waves: 0,
          };
          if (json) { outputJson(result); } else { console.log(result.reason); }
          return;
        }

        const content = fs.readFileSync(stateFilePath, 'utf-8');
        const state = parseWaveState(content);

        if (!state || !state.active) {
          const result: CompleteWaveResult = {
            decision: 'stop',
            reason: 'Autopilot not active',
            wave: 0,
            total_fixed: 0,
            empty_waves: 0,
          };
          if (json) { outputJson(result); } else { console.log(result.reason); }
          return;
        }

        const waveCommits = parseInt(options.waveCommits, 10) || 0;

        // Update tracking
        let { empty_waves, total_fixed } = state;
        if (waveCommits === 0) {
          empty_waves += 1;
        } else {
          empty_waves = 0; // Reset on productive wave
          total_fixed += waveCommits;
        }

        // ── Decision logic ──

        // Dry run: always stop after wave 1
        if (state.dry_run) {
          fs.unlinkSync(stateFilePath);
          const result: CompleteWaveResult = {
            decision: 'stop',
            reason: `Dry run complete: wave ${state.wave}, ${total_fixed} fixes triaged`,
            wave: state.wave,
            total_fixed,
            empty_waves,
          };
          // Capture evidence
          captureEvidence(cwd, result.reason);
          if (json) { outputJson(result); } else { console.log(result.reason); }
          return;
        }

        // Circuit breaker: too many empty waves
        if (empty_waves >= state.max_empty_waves) {
          fs.unlinkSync(stateFilePath);
          const result: CompleteWaveResult = {
            decision: 'stop',
            reason: `Circuit breaker: ${empty_waves} consecutive empty waves. Total: ${state.wave} waves, ${total_fixed} fixes.`,
            wave: state.wave,
            total_fixed,
            empty_waves,
          };
          captureEvidence(cwd, result.reason);
          if (json) { outputJson(result); } else { console.log(result.reason); }
          return;
        }

        // Max waves reached
        if (state.max_waves > 0 && state.wave >= state.max_waves) {
          fs.unlinkSync(stateFilePath);
          const result: CompleteWaveResult = {
            decision: 'stop',
            reason: `Autopilot complete: ${state.wave}/${state.max_waves} waves, ${total_fixed} total fixes.`,
            wave: state.wave,
            total_fixed,
            empty_waves,
          };
          captureEvidence(cwd, result.reason);
          if (json) { outputJson(result); } else { console.log(result.reason); }
          return;
        }

        // ── Continue to next wave ──
        const nextWave = state.wave + 1;

        // Capture wave boundary evidence
        captureEvidence(cwd, `Wave ${state.wave} complete: ${total_fixed} total fixes. Starting wave ${nextWave}.`);

        // Update state file
        const updatedState: WaveState = {
          ...state,
          wave: nextWave,
          empty_waves,
          total_fixed,
        };

        const prompt = buildDefaultPrompt(updatedState);
        fs.writeFileSync(stateFilePath, buildWaveStateFile(updatedState, prompt), 'utf-8');

        const systemMessage = `Autopilot wave ${nextWave}/${state.max_waves} | ${total_fixed} fixed so far | Empty waves: ${empty_waves}/${state.max_empty_waves}`;

        const result: CompleteWaveResult = {
          decision: 'continue',
          reason: prompt,
          wave: state.wave,
          next_wave: nextWave,
          total_fixed,
          empty_waves,
          prompt,
          system_message: systemMessage,
        };

        if (json) {
          outputJson(result);
        } else {
          console.log(`Wave ${state.wave} complete. Starting wave ${nextWave}.`);
          console.log(`  Total fixed:  ${total_fixed}`);
          console.log(`  Empty waves:  ${empty_waves}/${state.max_empty_waves}`);
        }
      } catch (err) {
        if (err instanceof MentuError) {
          outputError(err, json);
        } else {
          const error = new MentuError(
            'E_INVALID_OP',
            err instanceof Error ? err.message : 'Failed to complete wave'
          );
          outputError(error, json);
        }
      }
    });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function captureEvidence(cwd: string, message: string): void {
  try {
    execSync(`mentu capture "${message.replace(/"/g, '\\"')}" --kind execution-progress`, {
      cwd,
      encoding: 'utf-8',
      timeout: 10000,
      stdio: 'pipe',
    });
  } catch {
    // Non-fatal: if capture fails (no workspace), we still continue
  }
}
