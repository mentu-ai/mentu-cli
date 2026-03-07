// mentu schedule command
// Schedule a task for future execution
// V3.1: Also supports commitment auto-scheduling

import { Command } from 'commander';
import type { CaptureOperation } from '../types.js';
import { MentuError } from '../types.js';
import { generateId } from '../utils/id.js';
import { timestamp } from '../utils/time.js';
import { resolveActor } from '../utils/actor.js';
import { findWorkspace, readConfig, getWorkspaceName } from '../core/config.js';
import { readLedger, appendOperation } from '../core/ledger.js';
import { computeMemories } from '../core/state.js';
import { getScheduledMemories, getDueMemories, computeTemporalState } from '../core/temporal.js';
import { CloudClient } from '../cloud/client.js';

interface ScheduleOptions {
  at?: string;
  in?: string;
  deadline?: string;
  recur?: string;
  actor?: string;
  list?: boolean;
  due?: boolean;
}

interface ScheduleOutput {
  id: string;
  body: string;
  due_at?: string;
  deadline?: string;
  recurrence?: string;
}

interface ListOutput {
  id: string;
  body: string;
  state: string;
  meta?: Record<string, unknown>;
}

function outputResult(result: ScheduleOutput, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result));
  } else {
    console.log(`Scheduled: ${result.id}`);
    console.log(`  Task: ${result.body}`);
    if (result.due_at) console.log(`  Due: ${result.due_at}`);
    if (result.deadline) console.log(`  Deadline: ${result.deadline}`);
    if (result.recurrence) console.log(`  Recurs: ${result.recurrence}`);
  }
}

function outputList(items: ListOutput[], json: boolean, mode: 'scheduled' | 'due'): void {
  if (json) {
    console.log(JSON.stringify(items));
  } else {
    if (items.length === 0) {
      console.log(mode === 'due' ? 'No due tasks.' : 'No scheduled tasks.');
    } else {
      console.log(mode === 'due' ? 'Due tasks:' : 'Scheduled tasks:');
      for (const item of items) {
        const temporal = item.meta as Record<string, unknown> | undefined;
        const dueAt = temporal?.due_at || temporal?.scheduled_for;
        console.log(`  ${item.id}: ${item.body}`);
        console.log(`    Due: ${dueAt}`);
        if (temporal?.deadline) {
          console.log(`    Deadline: ${temporal.deadline}`);
        }
      }
    }
  }
}

function outputError(error: MentuError, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ ...error.toJSON(), op: 'schedule' }));
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
}

/**
 * Parse duration string to milliseconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([mhd])$/);
  if (!match) {
    throw new MentuError('E_INVALID_OP', `Invalid duration: ${duration}. Use format like "5m", "2h", "1d"`, {
      field: 'in',
      value: duration,
    });
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: throw new MentuError('E_INVALID_OP', `Unknown unit: ${unit}`, { field: 'in', value: duration });
  }
}

export function registerScheduleCommand(program: Command): void {
  // Create parent schedule command
  const schedule = new Command('schedule')
    .description('Schedule tasks and commitments');

  // Task subcommand (original behavior)
  schedule
    .command('task [body]')
    .description('Schedule a task for future execution')
    .option('--at <timestamp>', 'ISO 8601 timestamp when task becomes due')
    .option('--in <duration>', 'Duration from now (e.g., "5m", "2h", "1d")')
    .option('--deadline <timestamp>', 'ISO 8601 deadline for completion')
    .option('--recur <pattern>', 'Recurrence pattern (daily, weekly, monthly, or cron)')
    .option('--actor <id>', 'Override actor identity')
    .option('--list', 'List scheduled tasks')
    .option('--due', 'List tasks that are due')
    .action((body: string | undefined, options: ScheduleOptions) => {
      const json = program.opts().json || false;

      try {
        const workspacePath = findWorkspace(process.cwd());
        const config = readConfig(workspacePath);
        const operations = readLedger(workspacePath);
        const memories = computeMemories(operations);

        // List mode
        if (options.list || options.due) {
          const now = new Date();

          const filtered = options.due
            ? getDueMemories(memories, now)
            : getScheduledMemories(memories, now);

          const items: ListOutput[] = filtered.map(m => ({
            id: m.id,
            body: m.body,
            state: computeTemporalState(m, now),
            meta: m.meta,
          }));

          outputList(items, json, options.due ? 'due' : 'scheduled');
          return;
        }

        // Create mode
        if (!body) {
          throw new MentuError('E_EMPTY_BODY', 'Task description required', { field: 'body' });
        }

        // Parse due time
        let dueAt: string | undefined;

        if (options.at) {
          const parsedDate = new Date(options.at);
          if (isNaN(parsedDate.getTime())) {
            throw new MentuError('E_INVALID_OP', `Invalid timestamp: ${options.at}`, {
              field: 'at',
              value: options.at,
            });
          }
          dueAt = parsedDate.toISOString();
        } else if (options.in) {
          const duration = parseDuration(options.in);
          dueAt = new Date(Date.now() + duration).toISOString();
        }

        if (!dueAt && !options.recur) {
          throw new MentuError('E_INVALID_OP', '--at, --in, or --recur required', {
            field: 'at',
          });
        }

        const meta: Record<string, unknown> = {};

        if (dueAt) {
          meta.due_at = dueAt;
        }

        if (options.deadline) {
          const deadlineDate = new Date(options.deadline);
          if (isNaN(deadlineDate.getTime())) {
            throw new MentuError('E_INVALID_OP', `Invalid deadline: ${options.deadline}`, {
              field: 'deadline',
              value: options.deadline,
            });
          }
          meta.deadline = deadlineDate.toISOString();
        }

        if (options.recur) {
          meta.recurrence = {
            pattern: options.recur,
            next_at: dueAt,
          };
        }

        const actor = resolveActor(options.actor, config ?? undefined);
        const workspace = getWorkspaceName(workspacePath);

        const id = generateId('mem');
        const ts = timestamp();

        const op: CaptureOperation = {
          id,
          op: 'capture',
          ts,
          actor,
          workspace,
          payload: {
            body: body.trim(),
            kind: 'scheduled',
            meta,
          },
        };

        appendOperation(workspacePath, op);

        const output: ScheduleOutput = {
          id,
          body: body.trim(),
          due_at: dueAt,
          deadline: options.deadline,
          recurrence: options.recur,
        };

        outputResult(output, json);
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

  // V3.1: Commitment auto-scheduling subcommand
  schedule
    .command('commitment <id>')
    .description('Schedule a commitment using the placement algorithm (V3.1)')
    .option('--auto', 'Auto-schedule using placement algorithm')
    .option('--at <datetime>', 'Schedule at specific time (ISO 8601)')
    .action(async (commitmentId: string, options: { auto?: boolean; at?: string }) => {
      const json = program.opts().json || false;

      try {
        // Validate options
        if (options.auto && options.at) {
          throw new MentuError('E_INVALID_OP', 'Cannot use both --auto and --at', {});
        }

        if (!options.auto && !options.at) {
          throw new MentuError('E_INVALID_OP', 'Must specify --auto or --at', {});
        }

        const workspacePath = findWorkspace(process.cwd());
        const config = readConfig(workspacePath);

        if (!config?.cloud?.workspace_id) {
          throw new MentuError('E_NO_WORKSPACE', 'No cloud workspace linked. Run: mentu workspace link', {});
        }

        const client = await CloudClient.create(config.cloud.workspace_id);
        const supabase = client.getSupabaseClient();

        // Fetch commitment
        const { data: commitment, error: fetchError } = await supabase
          .from('commitments')
          .select('*')
          .eq('id', commitmentId)
          .eq('workspace_id', config.cloud.workspace_id)
          .single();

        if (fetchError || !commitment) {
          throw new MentuError('E_NOT_FOUND', `Commitment ${commitmentId} not found`, {
            id: commitmentId,
          });
        }

        if (options.at) {
          // Manual scheduling
          const scheduledAt = new Date(options.at);
          if (isNaN(scheduledAt.getTime())) {
            throw new MentuError('E_INVALID_OP', `Invalid datetime format: ${options.at}`, {
              field: 'at',
              value: options.at,
            });
          }

          const { error: updateError } = await supabase
            .from('commitments')
            .update({
              scheduled_start_at: scheduledAt.toISOString(),
              scheduling_mode: 'manual',
              scheduled_by: 'human',
              scheduling_explanation: 'Manually scheduled by user via CLI',
            })
            .eq('id', commitmentId);

          if (updateError) {
            throw new MentuError('E_INTERNAL', updateError.message, {});
          }

          if (json) {
            console.log(JSON.stringify({
              id: commitmentId,
              scheduled_start_at: scheduledAt.toISOString(),
              scheduling_mode: 'manual',
              scheduling_explanation: 'Manually scheduled by user via CLI',
            }));
          } else {
            console.log(`Scheduled at: ${scheduledAt.toISOString()}`);
          }
          return;
        }

        // Auto-scheduling
        if (commitment.scheduled_start_at) {
          console.error(`Warning: Commitment already scheduled at ${commitment.scheduled_start_at}`);
          console.error('Use --at to reschedule manually');
          process.exit(1);
        }

        // Call proxy for placement
        const proxyUrl = process.env.MENTU_PROXY_URL || 'https://mentu-proxy.affihub.workers.dev';
        const proxyToken = process.env.MENTU_PROXY_TOKEN;

        if (!proxyToken) {
          throw new MentuError('E_INTERNAL', 'MENTU_PROXY_TOKEN not set', {});
        }

        const placementRequest = {
          commitment_id: commitmentId,
          earliest_start_at: commitment.earliest_start_at || new Date().toISOString(),
          due_at: commitment.due_at,
          duration_estimate: commitment.duration_estimate || 60,
          execution_window: commitment.execution_window,
        };

        const response = await fetch(`${proxyUrl}/schedule/place`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Proxy-Token': proxyToken,
          },
          body: JSON.stringify(placementRequest),
        });

        if (!response.ok) {
          throw new MentuError('E_INTERNAL', `Proxy error: ${response.status}`, {});
        }

        const result = await response.json() as {
          success: boolean;
          scheduled_start_at?: string;
          scheduling_explanation: string;
        };

        if (!result.success) {
          // Store explanation even on failure
          await supabase
            .from('commitments')
            .update({ scheduling_explanation: result.scheduling_explanation })
            .eq('id', commitmentId);

          if (json) {
            console.log(JSON.stringify({
              success: false,
              scheduling_explanation: result.scheduling_explanation,
            }));
          } else {
            console.log(`Unschedulable: ${result.scheduling_explanation}`);
          }
          process.exit(1);
        }

        // Update commitment with schedule
        const { error: updateError } = await supabase
          .from('commitments')
          .update({
            scheduled_start_at: result.scheduled_start_at,
            scheduling_mode: 'auto',
            scheduled_by: 'scheduler',
            scheduling_explanation: result.scheduling_explanation,
          })
          .eq('id', commitmentId);

        if (updateError) {
          throw new MentuError('E_INTERNAL', `Error updating: ${updateError.message}`, {});
        }

        if (json) {
          console.log(JSON.stringify({
            id: commitmentId,
            scheduled_start_at: result.scheduled_start_at,
            scheduling_mode: 'auto',
            scheduling_explanation: result.scheduling_explanation,
          }));
        } else {
          console.log(`Scheduled: ${result.scheduled_start_at}`);
          console.log(`Explanation: ${result.scheduling_explanation}`);
        }
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

  // Add the schedule command with its subcommands
  program.addCommand(schedule);
}
