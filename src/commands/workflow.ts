import { Command } from 'commander';
import { readFileSync } from 'fs';
import { CloudClient } from '../cloud/client.js';
import { findWorkspace, readConfig, getWorkspaceName } from '../core/config.js';
import { readLedger, appendOperation } from '../core/ledger.js';
import { resolveActor } from '../utils/actor.js';
import { generateId } from '../utils/id.js';
import { timestamp } from '../utils/time.js';
import { readGenesisKey } from '../core/genesis.js';
import { validateOperation } from '../core/validate.js';
import { refreshWorkflowCache } from '../workflows/cache.js';
import type {
  CaptureOperation,
  CommitOperation,
  ClaimOperation,
  LinkOperation,
  AnnotateOperation,
  ReleaseOperation,
} from '../types.js';
import yaml from 'yaml';

// Type definitions for workflow
interface WorkflowParameter {
  type: string;
  required?: boolean;
  default?: unknown;
}

interface WorkflowStep {
  id: string;
  type: string;
  body?: string;
  repo?: string;
  author_type?: string;
  duration_estimate?: number;
  scheduling_mode?: string;
  execution_window?: {
    start: string;
    end: string;
    days?: number[];
  };
  approvers?: string[];
  timeout?: string;
  on_timeout?: string;
  delay?: string;
  until?: string;
  webhook_id?: string;
  source_step?: string;
  branches?: Array<{ condition: string; target: string }>;
}

interface WorkflowEdge {
  from: string;
  to: string;
  condition?: string;
}

interface WorkflowDefinition {
  name: string;
  version?: number;
  description?: string;
  steps: WorkflowStep[];
  edges: WorkflowEdge[];
  parameters?: Record<string, WorkflowParameter>;
}

interface Workflow {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  definition: WorkflowDefinition;
  version: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface WorkflowInstance {
  id: string;
  workflow_id: string;
  workflow_version: number;
  name: string | null;
  parameters: Record<string, unknown>;
  state: string;
  started_at: string | null;
  completed_at: string | null;
  step_states: Record<string, unknown>;
  parent_commitment_id: string | null;
  definition_memory_id: string | null;
  created_at: string;
  updated_at: string;
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

export function registerWorkflowCommand(program: Command) {
  const workflow = program
    .command('workflow')
    .description('Manage multi-step workflow orchestrations (Protocol-native)');

  // Register a workflow definition from YAML file
  workflow
    .command('register <file>')
    .description('Upload workflow definition from YAML file')
    .action(async (file: string) => {
      const json = program.opts().json || false;

      try {
        const { client, workspaceId } = await getCloudClientWithWorkspace();
        const supabase = client.getSupabaseClient();

        const content = readFileSync(file, 'utf-8');
        const definition: WorkflowDefinition = yaml.parse(content);

        if (!definition.name || !definition.steps || !definition.edges) {
          throw new Error('Invalid workflow definition: missing name, steps, or edges');
        }

        // Check for existing workflow with same name
        const { data: existing } = await supabase
          .from('workflows')
          .select('version')
          .eq('workspace_id', workspaceId)
          .eq('name', definition.name)
          .order('version', { ascending: false })
          .limit(1);

        const existingVersion = (existing as Workflow[] | null)?.[0]?.version ?? 0;
        const newVersion = definition.version ?? existingVersion + 1;

        const { data: wf, error } = await supabase
          .from('workflows')
          .insert({
            workspace_id: workspaceId,
            name: definition.name,
            description: definition.description,
            definition,
            version: newVersion,
            active: true,
          })
          .select()
          .single();

        if (error) throw new Error(error.message);

        const result = wf as Workflow;
        if (json) {
          console.log(JSON.stringify({ id: result.id, name: result.name, version: result.version }, null, 2));
        } else {
          console.log(`Registered workflow: ${result.name} (v${result.version})`);
          console.log(`ID: ${result.id}`);
          console.log(`Steps: ${definition.steps.length}`);
          console.log(`Edges: ${definition.edges.length}`);
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

  // List all workflows
  workflow
    .command('list')
    .description('List all workflow definitions')
    .option('--all', 'Include inactive workflows')
    .action(async (options: { all?: boolean }) => {
      const json = program.opts().json || false;

      try {
        const { client, workspaceId } = await getCloudClientWithWorkspace();
        const supabase = client.getSupabaseClient();

        let query = supabase
          .from('workflows')
          .select('*')
          .eq('workspace_id', workspaceId);

        if (!options.all) {
          query = query.eq('active', true);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw new Error(error.message);

        const workflows = (data as Workflow[] | null) ?? [];

        if (json) {
          console.log(JSON.stringify(workflows, null, 2));
        } else {
          if (workflows.length === 0) {
            console.log('No workflows found.');
            return;
          }

          console.log('\nWorkflows:');
          for (const wf of workflows) {
            const status = wf.active ? '\u2713' : '\u2717';
            const stepCount = wf.definition.steps?.length ?? 0;
            console.log(`  ${status} ${wf.name} (v${wf.version}) - ${stepCount} steps`);
            console.log(`    ID: ${wf.id}`);
          }
          console.log(`\nTotal: ${workflows.length} workflow(s)`);
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

  // Run a workflow — Protocol-native: creates ledger operations
  workflow
    .command('run <name>')
    .description('Start a workflow instance (creates commitments in ledger)')
    .option('-p, --param <key=value>', 'Set parameter (can be repeated)', (val: string, acc: string[]) => [...acc, val], [] as string[])
    .option('--name <instance_name>', 'Name for this instance')
    .action(async (name: string, options: { param: string[]; name?: string }) => {
      const json = program.opts().json || false;

      try {
        const { client, workspaceId } = await getCloudClientWithWorkspace();
        const supabase = client.getSupabaseClient();

        // Resolve ledger context
        const workspacePath = findWorkspace(process.cwd());
        const config = readConfig(workspacePath);
        const genesis = readGenesisKey(workspacePath);
        const actor = resolveActor(undefined, config ?? undefined);
        const workspace = getWorkspaceName(workspacePath);
        const ledger = readLedger(workspacePath);

        // 1. Find latest active workflow definition
        const { data: wfData, error: wfError } = await supabase
          .from('workflows')
          .select('*')
          .eq('workspace_id', workspaceId)
          .eq('name', name)
          .eq('active', true)
          .order('version', { ascending: false })
          .limit(1)
          .single();

        if (wfError || !wfData) {
          throw new Error(`Workflow "${name}" not found or inactive`);
        }

        const wf = wfData as Workflow;

        // Parse parameters
        const parameters: Record<string, string> = {};
        for (const p of options.param) {
          const [key, ...valueParts] = p.split('=');
          parameters[key] = valueParts.join('=');
        }

        const stepCount = wf.definition.steps?.length ?? 0;
        const description = wf.description ?? '';

        // 2. Capture: create definition memory
        const memId = generateId('mem');
        const memTs = timestamp();
        const captureOp: CaptureOperation = {
          id: memId,
          op: 'capture',
          ts: memTs,
          actor,
          workspace,
          payload: {
            body: `Sequence: ${name} (${stepCount} steps)${description ? ` — ${description}` : ''}`,
            kind: 'sequence',
          },
        };
        const captureValidation = validateOperation(captureOp, ledger, genesis);
        if (!captureValidation.valid && captureValidation.error) throw captureValidation.error;
        appendOperation(workspacePath, captureOp);

        // Re-read ledger after each append
        const ledger2 = readLedger(workspacePath);

        // 3. Commit: create parent commitment
        const parentCmtId = generateId('cmt');
        const commitOp: CommitOperation = {
          id: parentCmtId,
          op: 'commit',
          ts: timestamp(),
          actor,
          workspace,
          payload: {
            body: `Execute ${name}`,
            source: memId,
            tags: ['sequence'],
          },
        };
        const commitValidation = validateOperation(commitOp, ledger2, genesis);
        if (!commitValidation.valid && commitValidation.error) throw commitValidation.error;
        appendOperation(workspacePath, commitOp);

        // 4. Claim parent commitment
        const ledger3 = readLedger(workspacePath);
        const claimOp: ClaimOperation = {
          id: generateId('op'),
          op: 'claim',
          ts: timestamp(),
          actor,
          workspace,
          payload: { commitment: parentCmtId },
        };
        const claimValidation = validateOperation(claimOp, ledger3, genesis);
        if (!claimValidation.valid && claimValidation.error) throw claimValidation.error;
        appendOperation(workspacePath, claimOp);

        // 5. Create instance cache row first (needed for step commitment linking)
        const { data: instanceData, error: instanceError } = await supabase
          .from('workflow_instances')
          .insert({
            workflow_id: wf.id,
            workflow_version: wf.version,
            name: options.name ?? null,
            parameters,
            state: 'running',
            started_at: new Date().toISOString(),
            step_states: {},
            parent_commitment_id: parentCmtId,
            definition_memory_id: memId,
          })
          .select()
          .single();

        if (instanceError) throw new Error(instanceError.message);
        const instance = instanceData as WorkflowInstance;

        // 6. For each step: commit + link to parent
        const stepCommitments: Array<{ stepId: string; commitmentId: string }> = [];

        for (const step of wf.definition.steps) {
          const stepLedger = readLedger(workspacePath);
          const stepCmtId = generateId('cmt');

          // Commit step
          const stepCommitOp: CommitOperation = {
            id: stepCmtId,
            op: 'commit',
            ts: timestamp(),
            actor,
            workspace,
            payload: {
              body: `Step: ${step.id}`,
              source: memId,
              tags: ['step', `sequence:${name}`],
            },
          };
          const stepCommitValidation = validateOperation(stepCommitOp, stepLedger, genesis);
          if (!stepCommitValidation.valid && stepCommitValidation.error) throw stepCommitValidation.error;
          appendOperation(workspacePath, stepCommitOp);

          // Link step to parent
          const stepLedger2 = readLedger(workspacePath);
          const linkOp: LinkOperation = {
            id: generateId('op'),
            op: 'link',
            ts: timestamp(),
            actor,
            workspace,
            payload: {
              source: stepCmtId,
              target: parentCmtId,
              kind: 'related',
            },
          };
          const linkValidation = validateOperation(linkOp, stepLedger2, genesis);
          if (!linkValidation.valid && linkValidation.error) throw linkValidation.error;
          appendOperation(workspacePath, linkOp);

          // Update commitment in Supabase with workflow linkage
          await supabase
            .from('commitments')
            .update({
              workflow_instance_id: instance.id,
              workflow_step_id: step.id,
            })
            .eq('id', stepCmtId);

          stepCommitments.push({ stepId: step.id, commitmentId: stepCmtId });
        }

        // 7. Refresh the cache from commitment states
        await refreshWorkflowCache(client, instance.id);

        if (json) {
          console.log(JSON.stringify({
            instance_id: instance.id,
            parent_commitment_id: parentCmtId,
            definition_memory_id: memId,
            workflow: wf.name,
            version: wf.version,
            steps: stepCommitments,
          }, null, 2));
        } else {
          console.log(`Started workflow instance: ${instance.id}`);
          console.log(`Workflow: ${wf.name} (v${wf.version})`);
          console.log(`Parent commitment: ${parentCmtId}`);
          console.log(`Definition memory: ${memId}`);
          console.log(`\nStep commitments:`);
          for (const sc of stepCommitments) {
            console.log(`  ${sc.stepId}: ${sc.commitmentId}`);
          }
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

  // Show workflow instance status — computed from commitment states
  workflow
    .command('status <instance_id>')
    .description('Show workflow instance status (computed from commitments)')
    .action(async (instanceId: string) => {
      const json = program.opts().json || false;

      try {
        const { client } = await getCloudClientWithWorkspace();
        const supabase = client.getSupabaseClient();

        // Fetch instance
        const { data: instanceData, error: instanceError } = await supabase
          .from('workflow_instances')
          .select('*')
          .eq('id', instanceId)
          .single();

        if (instanceError || !instanceData) {
          throw new Error(`Instance "${instanceId}" not found`);
        }

        const instance = instanceData as WorkflowInstance;

        // Fetch workflow for step definitions
        const { data: wfData } = await supabase
          .from('workflows')
          .select('*')
          .eq('id', instance.workflow_id)
          .single();

        const wf = wfData as Workflow | null;

        // Fetch commitments linked to this instance
        const { data: commitments } = await supabase
          .from('commitments')
          .select('id, state, workflow_step_id, step_outcome, owner, created_at, closed_at')
          .eq('workflow_instance_id', instanceId);

        const cmtList = (commitments ?? []) as Array<{
          id: string;
          state: string;
          workflow_step_id: string | null;
          step_outcome: string | null;
          owner: string | null;
          created_at: string;
          closed_at: string | null;
        }>;

        if (json) {
          console.log(JSON.stringify({
            ...instance,
            workflow_name: wf?.name,
            commitments: cmtList,
          }, null, 2));
        } else {
          console.log(`\nWorkflow Instance: ${instance.id}`);
          console.log(`Workflow: ${wf?.name ?? 'unknown'} (v${instance.workflow_version})`);
          console.log(`Parent commitment: ${instance.parent_commitment_id ?? 'none'}`);

          // Compute state from commitments
          const stepCmts = cmtList.filter(c => c.workflow_step_id);
          const closedCount = stepCmts.filter(c => c.state === 'closed').length;
          const activeCount = stepCmts.filter(c => c.state === 'claimed' || c.state === 'in_review').length;
          const computedState = stepCmts.length === 0 ? 'pending'
            : closedCount === stepCmts.length ? 'completed'
            : activeCount > 0 ? 'running'
            : 'pending';

          console.log(`State: ${computedState} (${closedCount}/${stepCmts.length} steps closed)`);
          console.log(`Started: ${instance.started_at ?? 'pending'}`);

          console.log('\nSteps:');
          const steps = wf?.definition.steps ?? [];
          for (const step of steps) {
            const cmt = cmtList.find(c => c.workflow_step_id === step.id);
            const stateIcon = getStateIcon(cmt?.state ?? 'unknown');
            const outcome = cmt?.step_outcome ? ` (${cmt.step_outcome})` : '';
            console.log(`  ${stateIcon} ${step.id}: ${cmt?.state ?? 'no commitment'}${outcome}`);
            if (cmt) {
              console.log(`      Commitment: ${cmt.id}`);
            }
          }
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

  // Approve a gate step — uses ledger approve operation
  workflow
    .command('approve <instance_id> <step_id>')
    .description('Approve a workflow step (creates approve operation in ledger)')
    .option('--comment <comment>', 'Approval comment')
    .action(async (instanceId: string, stepId: string, options: { comment?: string }) => {
      const json = program.opts().json || false;

      try {
        const { client } = await getCloudClientWithWorkspace();
        const supabase = client.getSupabaseClient();

        // Find the step commitment
        const { data: cmtData, error: cmtError } = await supabase
          .from('commitments')
          .select('id, state')
          .eq('workflow_instance_id', instanceId)
          .eq('workflow_step_id', stepId)
          .single();

        if (cmtError || !cmtData) {
          throw new Error(`Step "${stepId}" not found in instance "${instanceId}"`);
        }

        const stepCmt = cmtData as { id: string; state: string };

        if (stepCmt.state !== 'in_review') {
          throw new Error(`Step "${stepId}" is not in review (state: ${stepCmt.state}). Submit it first.`);
        }

        // Create approve operation in the ledger
        const workspacePath = findWorkspace(process.cwd());
        const config = readConfig(workspacePath);
        const genesis = readGenesisKey(workspacePath);
        const actor = resolveActor(undefined, config ?? undefined);
        const workspace = getWorkspaceName(workspacePath);
        const ledger = readLedger(workspacePath);

        const approveOp = {
          id: generateId('op'),
          op: 'approve' as const,
          ts: timestamp(),
          actor,
          workspace,
          payload: {
            commitment: stepCmt.id,
            comment: options.comment,
          },
        };

        const validation = validateOperation(approveOp, ledger, genesis);
        if (!validation.valid && validation.error) throw validation.error;
        appendOperation(workspacePath, approveOp);

        // Refresh cache
        await refreshWorkflowCache(client, instanceId);

        if (json) {
          console.log(JSON.stringify({ instance_id: instanceId, step_id: stepId, commitment_id: stepCmt.id, state: 'approved' }));
        } else {
          console.log(`Approved step "${stepId}" (commitment: ${stepCmt.id})`);
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

  // Cancel a workflow instance — releases commitments via ledger
  workflow
    .command('cancel <instance_id>')
    .description('Cancel a running workflow (releases commitments in ledger)')
    .option('--reason <reason>', 'Cancellation reason')
    .action(async (instanceId: string, options: { reason?: string }) => {
      const json = program.opts().json || false;

      try {
        const { client } = await getCloudClientWithWorkspace();
        const supabase = client.getSupabaseClient();

        // Fetch instance
        const { data: instanceData, error: instanceError } = await supabase
          .from('workflow_instances')
          .select('*')
          .eq('id', instanceId)
          .single();

        if (instanceError || !instanceData) {
          throw new Error(`Instance "${instanceId}" not found`);
        }

        const instance = instanceData as WorkflowInstance;
        if (instance.state !== 'running' && instance.state !== 'pending') {
          throw new Error(`Instance is already ${instance.state}`);
        }

        const workspacePath = findWorkspace(process.cwd());
        const config = readConfig(workspacePath);
        const genesis = readGenesisKey(workspacePath);
        const actor = resolveActor(undefined, config ?? undefined);
        const workspace = getWorkspaceName(workspacePath);

        const reason = options.reason ?? 'manual cancellation';

        // Annotate parent commitment
        if (instance.parent_commitment_id) {
          const ledger = readLedger(workspacePath);
          const annotateOp: AnnotateOperation = {
            id: generateId('op'),
            op: 'annotate',
            ts: timestamp(),
            actor,
            workspace,
            payload: {
              target: instance.parent_commitment_id,
              body: `Sequence cancelled: ${reason}`,
            },
          };
          const aValidation = validateOperation(annotateOp, ledger, genesis);
          if (!aValidation.valid && aValidation.error) throw aValidation.error;
          appendOperation(workspacePath, annotateOp);

          // Release parent commitment
          const ledger2 = readLedger(workspacePath);
          const releaseOp: ReleaseOperation = {
            id: generateId('op'),
            op: 'release',
            ts: timestamp(),
            actor,
            workspace,
            payload: {
              commitment: instance.parent_commitment_id,
              reason,
            },
          };
          const rValidation = validateOperation(releaseOp, ledger2, genesis);
          if (!rValidation.valid && rValidation.error) {
            // May fail if not claimed — that's OK
          } else {
            appendOperation(workspacePath, releaseOp);
          }
        }

        // Release all claimed step commitments
        const { data: stepCmts } = await supabase
          .from('commitments')
          .select('id, state, owner')
          .eq('workflow_instance_id', instanceId)
          .in('state', ['claimed', 'open']);

        for (const cmt of (stepCmts ?? []) as Array<{ id: string; state: string; owner: string | null }>) {
          if (cmt.state === 'claimed' && cmt.owner === actor) {
            const ledgerN = readLedger(workspacePath);
            const relOp: ReleaseOperation = {
              id: generateId('op'),
              op: 'release',
              ts: timestamp(),
              actor,
              workspace,
              payload: {
                commitment: cmt.id,
                reason,
              },
            };
            const relValidation = validateOperation(relOp, ledgerN, genesis);
            if (relValidation.valid) {
              appendOperation(workspacePath, relOp);
            }
          }
        }

        // Refresh cache to get correct step_states from current commitment states
        await refreshWorkflowCache(client, instanceId);

        // Override state — 'cancelled' is a sequence-level concept
        // not derivable from commitment states (released = open, not cancelled)
        await supabase
          .from('workflow_instances')
          .update({
            state: 'cancelled',
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', instanceId);

        if (json) {
          console.log(JSON.stringify({ instance_id: instanceId, state: 'cancelled' }));
        } else {
          console.log(`Cancelled workflow instance: ${instanceId}`);
          if (options.reason) {
            console.log(`Reason: ${options.reason}`);
          }
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

function getStateIcon(state: string): string {
  switch (state) {
    case 'open': return '\u25cb';      // ○ pending
    case 'claimed': return '\u25d4';   // ◔ active
    case 'in_review': return '\u25d1'; // ◑ in review
    case 'closed': return '\u2713';    // ✓ completed
    case 'reopened': return '\u21ba';  // ↺ reopened
    default: return '?';
  }
}
