import { Command } from 'commander';
import { CloudClient } from '../cloud/client.js';
import { findWorkspace, readConfig } from '../core/config.js';
import type { CommitmentTemplate } from '../types.js';

const DAY_MAP: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseDays(value: string): number[] {
  return value
    .toLowerCase()
    .split(',')
    .map(d => DAY_MAP[d.trim()])
    .filter(d => d !== undefined);
}

function parseTags(value: string): string[] {
  return value.split(',').map(t => t.trim()).filter(Boolean);
}

function generateId(): string {
  const chars = 'abcdef0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

async function getCloudClientWithWorkspace(): Promise<{ client: CloudClient; workspaceId: string }> {
  const workspacePath = findWorkspace(process.cwd());
  const config = readConfig(workspacePath);

  if (!config?.cloud?.workspace_id) {
    throw new Error('No cloud workspace linked. Run: mentu workspace link');
  }

  const client = await CloudClient.create(config.cloud.workspace_id);
  return { client, workspaceId: config.cloud.workspace_id };
}

export function registerTemplateCommand(program: Command) {
  const template = program
    .command('template')
    .description('Manage recurring commitment templates');

  template
    .command('create <name>')
    .description('Create a recurring template')
    .requiredOption('--body <body>', 'Template body (use {date} for dynamic date, {day} for day name)')
    .requiredOption('--days <days>', 'Days of week (mon,tue,wed,thu,fri,sat,sun)', parseDays)
    .requiredOption('--time <time>', 'Time in HH:MM format')
    .option('--timezone <tz>', 'IANA timezone', 'America/Los_Angeles')
    .option('--duration <minutes>', 'Duration in minutes', parseInt)
    .option('--priority <number>', 'Priority', parseInt)
    .option('--source <source>', 'Default source memory')
    .option('--tags <tags>', 'Comma-separated tags', parseTags)
    .action(async (name, options) => {
      const json = program.opts().json || false;

      try {
        const { client, workspaceId } = await getCloudClientWithWorkspace();

        const id = `tpl_${generateId()}`;

        const templateData: Partial<CommitmentTemplate> = {
          id,
          workspace_id: workspaceId,
          name,
          body_template: options.body,
          recurrence: {
            frequency: 'weekly',
            days: options.days,
            time: options.time,
            timezone: options.timezone,
          },
          defaults: {
            duration_estimate: options.duration,
            priority: options.priority,
            source: options.source,
            tags: options.tags,
          },
          active: true,
        };

        // Use CloudClient's internal supabase through a raw query
        const result = await (client as unknown as { supabase: { from: (table: string) => { insert: (data: unknown) => Promise<{ error?: { message: string } }> } } }).supabase
          .from('commitment_templates')
          .insert(templateData);

        if (result.error) {
          throw new Error(result.error.message);
        }

        if (json) {
          console.log(JSON.stringify({
            id,
            name,
            recurrence: templateData.recurrence,
            defaults: templateData.defaults,
          }, null, 2));
        } else {
          console.log(`Created template: ${id}`);
          console.log(`Name: ${name}`);
          console.log(`Schedule: ${options.days.map((d: number) => DAY_NAMES[d]).join(', ')} at ${options.time}`);
          console.log(`Body: ${options.body.slice(0, 60)}...`);
        }
      } catch (err) {
        if (json) {
          console.log(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }));
        } else {
          console.error('Error:', err instanceof Error ? err.message : err);
        }
        process.exit(1);
      }
    });

  template
    .command('list')
    .description('List all templates')
    .option('--all', 'Include inactive templates')
    .action(async (options) => {
      const json = program.opts().json || false;

      try {
        const { client, workspaceId } = await getCloudClientWithWorkspace();

        const supabase = (client as unknown as { supabase: { from: (table: string) => { select: (cols: string) => { eq: (col: string, val: unknown) => { order: (col: string, opts: { ascending: boolean }) => Promise<{ data: CommitmentTemplate[] | null; error?: { message: string } }> } } } } }).supabase;

        let query = supabase
          .from('commitment_templates')
          .select('*')
          .eq('workspace_id', workspaceId);

        if (!options.all) {
          query = (query as unknown as { eq: (col: string, val: unknown) => typeof query }).eq('active', true);
        }

        const { data: templates, error } = await query.order('created_at', { ascending: false });

        if (error) {
          throw new Error(error.message);
        }

        if (json) {
          console.log(JSON.stringify(templates, null, 2));
        } else {
          if (!templates || templates.length === 0) {
            console.log('No templates found.');
            return;
          }

          console.log('\nTemplates:');
          for (const t of templates) {
            const days = t.recurrence.days.map((d: number) => DAY_NAMES[d]).join(',');
            const status = t.active ? '\u2713' : '\u2717';
            console.log(`  ${status} ${t.id}: ${t.name} (${days} @ ${t.recurrence.time})`);
          }
          console.log(`\nTotal: ${templates.length} template(s)`);
        }
      } catch (err) {
        if (json) {
          console.log(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }));
        } else {
          console.error('Error:', err instanceof Error ? err.message : err);
        }
        process.exit(1);
      }
    });

  template
    .command('show <id>')
    .description('Show template details')
    .action(async (id) => {
      const json = program.opts().json || false;

      try {
        const { client } = await getCloudClientWithWorkspace();

        const supabase = (client as unknown as { supabase: { from: (table: string) => { select: (cols: string) => { eq: (col: string, val: unknown) => { single: () => Promise<{ data: CommitmentTemplate | null; error?: { message: string } }> } } } } }).supabase;

        const { data: templateData, error } = await supabase
          .from('commitment_templates')
          .select('*')
          .eq('id', id)
          .single();

        if (error || !templateData) {
          throw new Error(error?.message || 'Template not found');
        }

        if (json) {
          console.log(JSON.stringify(templateData, null, 2));
        } else {
          const t = templateData;
          console.log(`\nTemplate: ${t.id}`);
          console.log(`Name: ${t.name}`);
          console.log(`Body: ${t.body_template}`);
          console.log(`Schedule: ${t.recurrence.days.map((d: number) => DAY_NAMES[d]).join(', ')} at ${t.recurrence.time} ${t.recurrence.timezone}`);
          console.log(`Active: ${t.active ? 'Yes' : 'No'}`);
          if (t.defaults.duration_estimate) {
            console.log(`Duration: ${t.defaults.duration_estimate} min`);
          }
          if (t.defaults.priority !== undefined) {
            console.log(`Priority: ${t.defaults.priority}`);
          }
          if (t.defaults.tags?.length) {
            console.log(`Tags: ${t.defaults.tags.join(', ')}`);
          }
          console.log(`Created: ${t.created_at}`);
        }
      } catch (err) {
        if (json) {
          console.log(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }));
        } else {
          console.error('Error:', err instanceof Error ? err.message : err);
        }
        process.exit(1);
      }
    });

  template
    .command('pause <id>')
    .description('Pause a template (stop creating new instances)')
    .action(async (id) => {
      const json = program.opts().json || false;

      try {
        const { client } = await getCloudClientWithWorkspace();

        const supabase = (client as unknown as { supabase: { from: (table: string) => { update: (data: unknown) => { eq: (col: string, val: unknown) => Promise<{ error?: { message: string } }> } } } }).supabase;

        const { error } = await supabase
          .from('commitment_templates')
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq('id', id);

        if (error) {
          throw new Error(error.message);
        }

        if (json) {
          console.log(JSON.stringify({ id, active: false }));
        } else {
          console.log(`Paused template: ${id}`);
        }
      } catch (err) {
        if (json) {
          console.log(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }));
        } else {
          console.error('Error:', err instanceof Error ? err.message : err);
        }
        process.exit(1);
      }
    });

  template
    .command('resume <id>')
    .description('Resume a paused template')
    .action(async (id) => {
      const json = program.opts().json || false;

      try {
        const { client } = await getCloudClientWithWorkspace();

        const supabase = (client as unknown as { supabase: { from: (table: string) => { update: (data: unknown) => { eq: (col: string, val: unknown) => Promise<{ error?: { message: string } }> } } } }).supabase;

        const { error } = await supabase
          .from('commitment_templates')
          .update({ active: true, updated_at: new Date().toISOString() })
          .eq('id', id);

        if (error) {
          throw new Error(error.message);
        }

        if (json) {
          console.log(JSON.stringify({ id, active: true }));
        } else {
          console.log(`Resumed template: ${id}`);
        }
      } catch (err) {
        if (json) {
          console.log(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }));
        } else {
          console.error('Error:', err instanceof Error ? err.message : err);
        }
        process.exit(1);
      }
    });

  template
    .command('delete <id>')
    .description('Delete a template')
    .action(async (id) => {
      const json = program.opts().json || false;

      try {
        const { client } = await getCloudClientWithWorkspace();

        const supabase = (client as unknown as { supabase: { from: (table: string) => { delete: () => { eq: (col: string, val: unknown) => Promise<{ error?: { message: string } }> } } } }).supabase;

        const { error } = await supabase
          .from('commitment_templates')
          .delete()
          .eq('id', id);

        if (error) {
          throw new Error(error.message);
        }

        if (json) {
          console.log(JSON.stringify({ id, deleted: true }));
        } else {
          console.log(`Deleted template: ${id}`);
        }
      } catch (err) {
        if (json) {
          console.log(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }));
        } else {
          console.error('Error:', err instanceof Error ? err.message : err);
        }
        process.exit(1);
      }
    });
}
