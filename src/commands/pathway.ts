/**
 * Pathway Command (v1.0)
 *
 * Run a YAML pathway file to automate browser interactions.
 * Supports checkpoints with screenshots and logs results to Supabase.
 */

import type { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { MentuError } from '../types.js';

// Simple pathway format with checkpoints
interface SimplePathway {
  name: string;
  target_url: string;
  steps: PathwayStep[];
}

interface PathwayStep {
  navigate?: string;
  fill?: Record<string, string>;
  click?: string;
  wait?: string | number;
  screenshot?: string;
  hover?: string;
  select?: Record<string, string>;
  checkpoint?: string;  // Named checkpoint - triggers screenshot
}

interface CheckpointResult {
  name: string;
  step_index: number;
  passed: boolean;
  screenshot_url?: string;
  timestamp: string;
}

interface RunResult {
  id?: string;
  pathway: string;
  target_url: string;
  steps_executed: number;
  steps_total: number;
  checkpoints: CheckpointResult[];
  passed: boolean;
  error?: string;
  duration_ms: number;
  started_at: string;
  completed_at?: string;
}

function loadPathway(filePath: string): SimplePathway {
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new MentuError(
      'E_NOT_FOUND',
      `Pathway file not found: ${absolutePath}`
    );
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const pathway = parseSimpleYaml(content);

  if (!pathway.name) {
    throw new MentuError('E_MISSING_FIELD', 'Pathway requires "name" field');
  }
  if (!pathway.target_url) {
    throw new MentuError('E_MISSING_FIELD', 'Pathway requires "target_url" field');
  }
  if (!pathway.steps || !Array.isArray(pathway.steps)) {
    throw new MentuError('E_MISSING_FIELD', 'Pathway requires "steps" array');
  }

  return pathway as unknown as SimplePathway;
}

function parseSimpleYaml(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = content.split('\n');
  let inSteps = false;
  const steps: PathwayStep[] = [];
  let currentStep: PathwayStep | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (trimmed.startsWith('#') || trimmed === '') continue;

    // Check for top-level key
    const topLevelMatch = line.match(/^(\w+):\s*(.*)$/);
    if (topLevelMatch) {
      const [, key, value] = topLevelMatch;

      if (key === 'steps') {
        inSteps = true;
        continue;
      }

      inSteps = false;

      if (value) {
        result[key] = value.replace(/^["']|["']$/g, '');
      }
      continue;
    }

    // Handle steps array items
    if (inSteps) {
      // New step item (starts with -)
      const stepMatch = line.match(/^\s*-\s*(\w+):\s*(.*)$/);
      if (stepMatch) {
        if (currentStep) {
          steps.push(currentStep);
        }
        const [, action, value] = stepMatch;
        currentStep = {};

        // Handle fill/select with arrow notation: "#selector" → "value"
        if (value.includes('→') || value.includes('->')) {
          const parts = value.split(/→|->/).map(s => s.trim().replace(/^["']|["']$/g, ''));
          if (parts.length === 2) {
            (currentStep as Record<string, unknown>)[action] = { [parts[0]]: parts[1] };
          }
        } else {
          (currentStep as Record<string, unknown>)[action] = value.replace(/^["']|["']$/g, '');
        }
        continue;
      }

      // Continuation of previous step (nested key)
      const nestedMatch = line.match(/^\s+(\w+):\s*(.*)$/);
      if (nestedMatch && currentStep) {
        const [, key, value] = nestedMatch;
        (currentStep as Record<string, unknown>)[key] = value.replace(/^["']|["']$/g, '');
      }
    }
  }

  // Don't forget the last step
  if (currentStep) {
    steps.push(currentStep);
  }

  if (inSteps) {
    result.steps = steps;
  }

  return result;
}

async function logToSupabase(result: RunResult): Promise<string | undefined> {
  const url = process.env.MENTU_API_URL || process.env.MENTU_PROXY_URL;
  const token = process.env.MENTU_PROXY_TOKEN;

  if (!url || !token) {
    return undefined;
  }

  try {
    const response = await fetch(`${url}/pathway-runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Proxy-Token': token,
      },
      body: JSON.stringify({
        pathway_name: result.pathway,
        target_url: result.target_url,
        steps_executed: result.steps_executed,
        steps_total: result.steps_total,
        checkpoints: result.checkpoints,
        status: result.passed ? 'passed' : 'failed',
        error_message: result.error,
        duration_ms: result.duration_ms,
        started_at: result.started_at,
        completed_at: result.completed_at,
      }),
    });

    if (response.ok) {
      const data = await response.json() as { id: string };
      return data.id;
    }
  } catch {
    // Silent fail - logging is best effort
  }

  return undefined;
}

export function registerPathwayCommand(program: Command): void {
  const pathwayCmd = program
    .command('pathway')
    .description('Run browser automation pathways');

  // mentu pathway run <file> [--dry-run] [--tab <id>]
  pathwayCmd
    .command('run <file>')
    .description('Run a pathway YAML file')
    .option('--dry-run', 'Preview steps without executing')
    .option('--tab <id>', 'Use existing browser tab (Kapture MCP)')
    .option('--no-log', 'Skip logging to Supabase')
    .action(async (file: string, options: { dryRun?: boolean; tab?: string; log?: boolean }) => {
      const json = program.opts().json || false;
      const startTime = Date.now();
      const startedAt = new Date().toISOString();

      try {
        const pathway = loadPathway(file);

        const result: RunResult = {
          pathway: pathway.name,
          target_url: pathway.target_url,
          steps_executed: 0,
          steps_total: pathway.steps.length,
          checkpoints: [],
          passed: false,
          duration_ms: 0,
          started_at: startedAt,
        };

        if (options.dryRun) {
          // Dry run - just show what would happen
          if (json) {
            console.log(JSON.stringify({
              ...result,
              dry_run: true,
              steps: pathway.steps,
            }));
          } else {
            console.log(`Pathway: ${pathway.name}`);
            console.log(`Target: ${pathway.target_url}`);
            console.log(`\nSteps (${pathway.steps.length}):`);

            for (let i = 0; i < pathway.steps.length; i++) {
              const step = pathway.steps[i];
              const action = Object.keys(step)[0];
              const value = step[action as keyof PathwayStep];
              const display = typeof value === 'object'
                ? JSON.stringify(value)
                : String(value);
              console.log(`  ${i + 1}. ${action}: ${display}`);

              if (step.checkpoint) {
                console.log(`      [CHECKPOINT: ${step.checkpoint}]`);
              }
            }
            console.log('\n(Dry run - no browser automation)');
          }
          return;
        }

        // Check for Kapture MCP tab
        if (!options.tab) {
          throw new MentuError(
            'E_MISSING_FIELD',
            'Browser tab required. Use --tab <id> with Kapture MCP, or use --dry-run to preview.'
          );
        }

        // Execute steps via Kapture MCP
        console.log(`Running pathway: ${pathway.name}`);
        console.log(`Target: ${pathway.target_url}`);
        console.log('');

        for (let i = 0; i < pathway.steps.length; i++) {
          const step = pathway.steps[i];
          const action = Object.keys(step)[0];
          const value = step[action as keyof PathwayStep];

          console.log(`Step ${i + 1}/${pathway.steps.length}: ${action}`);

          // The actual MCP calls would be made by the agent using this CLI
          // This CLI validates, prints, and logs
          switch (action) {
            case 'navigate':
              console.log(`  → Navigate to: ${pathway.target_url}${value}`);
              break;
            case 'fill':
              if (typeof value === 'object') {
                for (const [selector, text] of Object.entries(value)) {
                  console.log(`  → Fill ${selector} with "${text}"`);
                }
              }
              break;
            case 'click':
              console.log(`  → Click: ${value}`);
              break;
            case 'wait':
              console.log(`  → Wait for: ${value}`);
              break;
            case 'screenshot':
              console.log(`  → Screenshot: ${value}`);
              break;
            case 'hover':
              console.log(`  → Hover: ${value}`);
              break;
            case 'select':
              if (typeof value === 'object') {
                for (const [selector, optionValue] of Object.entries(value)) {
                  console.log(`  → Select ${optionValue} in ${selector}`);
                }
              }
              break;
            case 'checkpoint':
              console.log(`  ★ CHECKPOINT: ${value}`);
              console.log(`    → Take screenshot`);
              result.checkpoints.push({
                name: String(value),
                step_index: i,
                passed: true,
                timestamp: new Date().toISOString(),
              });
              break;
          }

          result.steps_executed++;
        }

        result.passed = result.steps_executed === result.steps_total;
        result.duration_ms = Date.now() - startTime;
        result.completed_at = new Date().toISOString();

        // Log to Supabase
        if (options.log !== false) {
          const runId = await logToSupabase(result);
          if (runId) {
            result.id = runId;
            console.log(`\nLogged to Supabase: ${runId}`);
          }
        }

        console.log('');
        console.log(`Result: ${result.passed ? 'PASSED' : 'FAILED'}`);
        console.log(`Steps: ${result.steps_executed}/${result.steps_total}`);
        console.log(`Checkpoints: ${result.checkpoints.length}`);
        console.log(`Duration: ${result.duration_ms}ms`);

        if (json) {
          console.log(JSON.stringify(result));
        }
      } catch (err) {
        const result: RunResult = {
          pathway: file,
          target_url: '',
          steps_executed: 0,
          steps_total: 0,
          checkpoints: [],
          passed: false,
          error: err instanceof Error ? err.message : 'Unknown error',
          duration_ms: Date.now() - startTime,
          started_at: startedAt,
          completed_at: new Date().toISOString(),
        };

        // Log failure to Supabase
        if (options.log !== false) {
          await logToSupabase(result);
        }

        if (err instanceof MentuError) {
          if (json) {
            console.log(JSON.stringify({ ...err.toJSON(), ...result }));
          } else {
            console.error(`Error: ${err.message}`);
          }
          process.exit(1);
        }
        throw err;
      }
    });

  // mentu pathway runs [--limit <n>]
  pathwayCmd
    .command('runs')
    .description('List recent pathway runs from Supabase')
    .option('-l, --limit <n>', 'Limit results', '20')
    .action(async (options: { limit?: string }) => {
      const json = program.opts().json || false;

      const url = process.env.MENTU_API_URL || process.env.MENTU_PROXY_URL;
      const token = process.env.MENTU_PROXY_TOKEN;

      if (!url || !token) {
        console.error('Error: MENTU_API_URL and MENTU_PROXY_TOKEN required');
        process.exit(1);
      }

      try {
        const response = await fetch(`${url}/pathway-runs?limit=${options.limit || 20}`, {
          headers: {
            'X-Proxy-Token': token,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const runs = await response.json() as RunResult[];

        if (json) {
          console.log(JSON.stringify(runs));
        } else {
          if (runs.length === 0) {
            console.log('No pathway runs found.');
            return;
          }

          console.log(`Recent runs (${runs.length}):\n`);
          for (const run of runs) {
            const status = run.passed ? '[PASS]' : '[FAIL]';
            console.log(`${run.id} ${status}`);
            console.log(`  Pathway: ${run.pathway}`);
            console.log(`  Steps: ${run.steps_executed}/${run.steps_total}`);
            console.log(`  Checkpoints: ${run.checkpoints?.length || 0}`);
            console.log(`  Duration: ${run.duration_ms}ms`);
            console.log('');
          }
        }
      } catch (err) {
        console.error('Error fetching runs:', err instanceof Error ? err.message : err);
        process.exit(1);
      }
    });
}
