// Workflow executor - manages workflow step lifecycle through the ledger.
// All state changes go through ledger operations. workflow_instances is refreshed as cache.

import type { CaptureOperation, ClaimOperation } from '../types.js';
import { generateId } from '../utils/id.js';
import { timestamp } from '../utils/time.js';
import { resolveActor } from '../utils/actor.js';
import { findWorkspace, readConfig, getWorkspaceName } from '../core/config.js';
import { readLedger, appendOperation } from '../core/ledger.js';
import { readGenesisKey } from '../core/genesis.js';
import { validateOperation } from '../core/validate.js';
import { CloudClient } from '../cloud/client.js';
import { refreshWorkflowCache } from './cache.js';

export class WorkflowExecutor {
  constructor(
    private client: CloudClient,
    private instanceId: string
  ) {}

  /**
   * Complete a step: capture evidence, close commitment, refresh cache, claim next.
   */
  async completeStep(
    stepId: string,
    evidence: string,
  ): Promise<void> {
    const supabase = this.client.getSupabaseClient();

    // 1. Find step commitment
    const { data: cmtData, error: cmtError } = await supabase
      .from('commitments')
      .select('id, state')
      .eq('workflow_instance_id', this.instanceId)
      .eq('workflow_step_id', stepId)
      .single();

    if (cmtError || !cmtData) {
      throw new Error(`Step commitment not found: ${stepId}`);
    }

    const stepCmt = cmtData as { id: string; state: string };

    // 2. Create evidence memory via ledger
    const workspacePath = findWorkspace(process.cwd());
    const config = readConfig(workspacePath);
    const genesis = readGenesisKey(workspacePath);
    const actor = resolveActor(undefined, config ?? undefined);
    const workspace = getWorkspaceName(workspacePath);
    const ledger = readLedger(workspacePath);

    const evidenceMemId = generateId('mem');
    const captureOp: CaptureOperation = {
      id: evidenceMemId,
      op: 'capture',
      ts: timestamp(),
      actor,
      workspace,
      payload: {
        body: evidence,
        kind: 'step_result',
        refs: [stepCmt.id],
      },
    };
    const captureValidation = validateOperation(captureOp, ledger, genesis);
    if (!captureValidation.valid && captureValidation.error) throw captureValidation.error;
    appendOperation(workspacePath, captureOp);

    // 3. Close step commitment with evidence
    const ledger2 = readLedger(workspacePath);
    const closeOp = {
      id: generateId('op'),
      op: 'close' as const,
      ts: timestamp(),
      actor,
      workspace,
      payload: {
        commitment: stepCmt.id,
        evidence: evidenceMemId,
      },
    };
    const closeValidation = validateOperation(closeOp, ledger2, genesis);
    if (!closeValidation.valid && closeValidation.error) throw closeValidation.error;
    appendOperation(workspacePath, closeOp);

    // 4. Update step outcome in Supabase
    await supabase
      .from('commitments')
      .update({ step_outcome: 'completed' })
      .eq('id', stepCmt.id);

    // 5. Refresh cache
    await refreshWorkflowCache(this.client, this.instanceId);

    // 6. Claim next unclaimed step (if any)
    await this.claimNextStep();
  }

  /**
   * Approve a gate step via ledger approve operation.
   */
  async approveGate(
    stepId: string,
    approvedBy: string,
  ): Promise<void> {
    const supabase = this.client.getSupabaseClient();

    // Find step commitment
    const { data: cmtData, error: cmtError } = await supabase
      .from('commitments')
      .select('id, state')
      .eq('workflow_instance_id', this.instanceId)
      .eq('workflow_step_id', stepId)
      .single();

    if (cmtError || !cmtData) {
      throw new Error(`Step commitment not found: ${stepId}`);
    }

    const stepCmt = cmtData as { id: string; state: string };

    if (stepCmt.state !== 'in_review') {
      throw new Error(`Step "${stepId}" is not in review (state: ${stepCmt.state})`);
    }

    // Create approve operation
    const workspacePath = findWorkspace(process.cwd());
    const config = readConfig(workspacePath);
    const genesis = readGenesisKey(workspacePath);
    const actor = resolveActor(approvedBy, config ?? undefined);
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
      },
    };

    const validation = validateOperation(approveOp, ledger, genesis);
    if (!validation.valid && validation.error) throw validation.error;
    appendOperation(workspacePath, approveOp);

    // Refresh cache
    await refreshWorkflowCache(this.client, this.instanceId);
  }

  /**
   * Mark a step as failed via annotate.
   */
  async failStep(
    stepId: string,
    error: string,
  ): Promise<void> {
    const supabase = this.client.getSupabaseClient();

    const { data: cmtData, error: cmtError } = await supabase
      .from('commitments')
      .select('id')
      .eq('workflow_instance_id', this.instanceId)
      .eq('workflow_step_id', stepId)
      .single();

    if (cmtError || !cmtData) {
      throw new Error(`Step commitment not found: ${stepId}`);
    }

    const stepCmt = cmtData as { id: string };

    const workspacePath = findWorkspace(process.cwd());
    const config = readConfig(workspacePath);
    const genesis = readGenesisKey(workspacePath);
    const actor = resolveActor(undefined, config ?? undefined);
    const workspace = getWorkspaceName(workspacePath);
    const ledger = readLedger(workspacePath);

    const annotateOp = {
      id: generateId('op'),
      op: 'annotate' as const,
      ts: timestamp(),
      actor,
      workspace,
      payload: {
        target: stepCmt.id,
        body: `Step failed: ${error}`,
      },
    };

    const validation = validateOperation(annotateOp, ledger, genesis);
    if (!validation.valid && validation.error) throw validation.error;
    appendOperation(workspacePath, annotateOp);

    // Update step outcome
    await supabase
      .from('commitments')
      .update({ step_outcome: 'cancelled' })
      .eq('id', stepCmt.id);

    await refreshWorkflowCache(this.client, this.instanceId);
  }

  /**
   * Claim the next unclaimed step commitment in order.
   */
  private async claimNextStep(): Promise<void> {
    const supabase = this.client.getSupabaseClient();

    // Find unclaimed step commitments
    const { data: openSteps } = await supabase
      .from('commitments')
      .select('id, workflow_step_id, state')
      .eq('workflow_instance_id', this.instanceId)
      .eq('state', 'open')
      .order('created_at', { ascending: true })
      .limit(1);

    if (!openSteps || openSteps.length === 0) return;

    const nextStep = openSteps[0] as { id: string; workflow_step_id: string; state: string };

    const workspacePath = findWorkspace(process.cwd());
    const config = readConfig(workspacePath);
    const genesis = readGenesisKey(workspacePath);
    const actor = resolveActor(undefined, config ?? undefined);
    const workspace = getWorkspaceName(workspacePath);
    const ledger = readLedger(workspacePath);

    const claimOp: ClaimOperation = {
      id: generateId('op'),
      op: 'claim',
      ts: timestamp(),
      actor,
      workspace,
      payload: { commitment: nextStep.id },
    };

    const validation = validateOperation(claimOp, ledger, genesis);
    if (validation.valid) {
      appendOperation(workspacePath, claimOp);
      await refreshWorkflowCache(this.client, this.instanceId);
    }
  }
}
