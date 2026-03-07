// Workflow type definitions for V4.1 DAG-based orchestration

export interface WorkflowParameter {
  type: string;
  required?: boolean;
  default?: unknown;
}

export interface WorkflowStep {
  type: string;
  next?: string[];
  gate_type?: 'approval' | 'validation';
  timeout_hours?: number;
  [key: string]: unknown;
}

export interface WorkflowDefinitionContent {
  steps: Record<string, WorkflowStep>;
  initial_step: string;
  parameters?: Record<string, WorkflowParameter>;
}

export interface WorkflowDefinition {
  name: string;
  version: number;
  definition: WorkflowDefinitionContent;
}

export interface DAGValidationResult {
  valid: boolean;
  errors: string[];
}

export interface WorkflowInstance {
  id: string;
  workflow_id: string;
  workflow_version: number;
  name: string | null;
  parameters: Record<string, unknown>;
  state: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  current_step: string;
  started_at: string | null;
  completed_at: string | null;
  step_states: Record<string, StepStatus>;
  created_at: string;
  updated_at: string;
  parent_commitment_id?: string;
  definition_memory_id?: string;
}

export interface StepStatus {
  state: string;
  commitment_id: string;
  commitment_state: string;
  outcome?: string;
  activated_at?: string;
  completed_at?: string;
  error?: string;
  approved_by?: string;
  rejected_by?: string;
  started_at?: number;
  // Legacy compat: status maps to state
  status?: 'waiting' | 'active' | 'completed' | 'failed' | 'approved' | 'rejected';
  [key: string]: unknown;
}

export interface GateConfig {
  type: 'gate';
  gate_type: 'approval' | 'validation';
  timeout_hours?: number;
  next?: Record<string, string[]>;
}

export interface GateEvaluationResult {
  should_proceed: boolean;
  next_step?: string;
  reason?: string;
}
