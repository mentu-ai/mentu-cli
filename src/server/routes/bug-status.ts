/**
 * GET /bug-status/:commitmentId
 *
 * Returns the current status of a bug report including:
 * - Commitment state (open, claimed, in_review, closed)
 * - Workflow state (pending, running, completed, failed)
 * - Current step and step outputs
 * - PR URL if available
 */

import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';

interface BugStatusResponse {
  memoryId: string;
  commitmentId: string;
  commitmentState: string;
  workflowInstanceId?: string;
  workflowState?: string;
  currentStep?: string;
  stepStates?: Record<string, unknown>;
  prUrl?: string;
  summary?: string;
  error?: string;
}

interface OperationPayload {
  source?: string;
  target?: string;
  [key: string]: unknown;
}

interface WorkflowInstance {
  id: string;
  state: string;
  current_step?: string;
  step_states?: Record<string, {
    state: string;
    output?: {
      pr_url?: string;
      summary?: string;
      error?: string;
    };
    error?: string;
  }>;
  parameters?: {
    commitment_id?: string;
  };
}

/**
 * Bug status routes.
 */
export function bugStatusRoutes(_workspacePath: string) {
  const router = new Hono();

  // GET /bug-status/:commitmentId
  router.get('/:commitmentId', async (c) => {
    const commitmentId = c.req.param('commitmentId');

    if (!commitmentId || !commitmentId.startsWith('cmt_')) {
      return c.json({
        error: 'Invalid commitment ID format. Expected cmt_xxx',
      }, 400);
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return c.json({
        error: 'Server configuration error: missing Supabase credentials',
      }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
      // 1. Find the commitment in operations
      const { data: commitmentOps, error: commitmentError } = await supabase
        .from('operations')
        .select('*')
        .eq('id', commitmentId)
        .single();

      if (commitmentError || !commitmentOps) {
        return c.json({
          error: `Commitment ${commitmentId} not found`,
        }, 404);
      }

      // Get commitment state from most recent state-changing operation
      const { data: stateOps } = await supabase
        .from('operations')
        .select('kind, timestamp')
        .or(`id.eq.${commitmentId},payload->>target.eq.${commitmentId}`)
        .in('kind', ['commit', 'claim', 'release', 'submit', 'approve', 'close', 'reopen'])
        .order('timestamp', { ascending: false })
        .limit(1);

      const latestStateOp = stateOps?.[0];
      let commitmentState = 'open';
      if (latestStateOp) {
        switch (latestStateOp.kind) {
          case 'claim': commitmentState = 'claimed'; break;
          case 'release': commitmentState = 'open'; break;
          case 'submit': commitmentState = 'in_review'; break;
          case 'approve':
          case 'close': commitmentState = 'closed'; break;
          case 'reopen': commitmentState = 'reopened'; break;
        }
      }

      // 2. Find source memory
      const payload = commitmentOps.payload as OperationPayload;
      const sourceMemoryId = payload?.source;

      // 3. Find workflow instance
      const { data: workflowInstances } = await supabase
        .from('workflow_instances')
        .select('*')
        .filter('parameters->commitment_id', 'eq', commitmentId)
        .order('created_at', { ascending: false })
        .limit(1);

      const workflowInstance = workflowInstances?.[0] as WorkflowInstance | undefined;

      // 4. Extract PR URL from executor step output if available
      let prUrl: string | undefined;
      let summary: string | undefined;
      let error: string | undefined;

      if (workflowInstance?.step_states) {
        const executorStep = workflowInstance.step_states.executor;
        if (executorStep?.output) {
          prUrl = executorStep.output.pr_url;
          summary = executorStep.output.summary;
        }

        // Check for failures
        const failedSteps = Object.entries(workflowInstance.step_states)
          .filter(([, step]) => step.state === 'failed');
        if (failedSteps.length > 0) {
          const [stepName, stepData] = failedSteps[0];
          error = `Step ${stepName} failed: ${stepData.error || 'unknown error'}`;
        }
      }

      const response: BugStatusResponse = {
        memoryId: sourceMemoryId || '',
        commitmentId,
        commitmentState,
        workflowInstanceId: workflowInstance?.id,
        workflowState: workflowInstance?.state,
        currentStep: workflowInstance?.current_step,
        stepStates: workflowInstance?.step_states,
        prUrl,
        summary,
        error,
      };

      return c.json(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  return router;
}
