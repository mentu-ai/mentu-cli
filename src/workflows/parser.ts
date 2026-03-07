// Workflow definition parser - converts YAML to internal model

import yaml from 'yaml';
import type { WorkflowDefinition, WorkflowStep } from './types.js';

const VALID_STEP_TYPES = ['trigger', 'task', 'gate', 'terminal'];

export function parseWorkflowDefinition(yamlContent: string): WorkflowDefinition {
  // Parse YAML
  const parsed = yaml.parse(yamlContent);

  // Validate required fields
  if (!parsed.name) {
    throw new Error('Missing required field: name');
  }

  if (!parsed.definition) {
    throw new Error('Missing required field: definition');
  }

  if (!parsed.definition.steps) {
    throw new Error('Missing required field: definition.steps');
  }

  if (!parsed.definition.initial_step) {
    throw new Error('Missing required field: definition.initial_step');
  }

  // Validate step types
  for (const [stepId, step] of Object.entries<WorkflowStep>(parsed.definition.steps)) {
    if (!step.type) {
      throw new Error(`Step "${stepId}" missing required field: type`);
    }
    if (!VALID_STEP_TYPES.includes(step.type)) {
      throw new Error(`Invalid step type: ${step.type}`);
    }
  }

  // Set default version if not provided
  if (!parsed.version) {
    parsed.version = 1;
  }

  return parsed as WorkflowDefinition;
}
