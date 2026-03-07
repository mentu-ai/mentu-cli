import { describe, it, expect } from 'vitest';
import { parseWorkflowDefinition } from '../../src/workflows/parser.js';
import type { WorkflowDefinition } from '../../src/workflows/types.js';

describe('Workflow Parser', () => {
  it('parses valid workflow definition', () => {
    const yaml = `
name: Simple Workflow
version: 1
definition:
  steps:
    start:
      type: trigger
      next: [end]
    end:
      type: terminal
  initial_step: start
`;

    const result = parseWorkflowDefinition(yaml);

    expect(result.name).toBe('Simple Workflow');
    expect(result.version).toBe(1);
    expect(result.definition.steps.start.type).toBe('trigger');
    expect(result.definition.initial_step).toBe('start');
  });

  it('rejects workflow with missing required fields', () => {
    const yaml = `
name: Invalid Workflow
`;

    expect(() => parseWorkflowDefinition(yaml)).toThrow('Missing required field: definition');
  });

  it('validates step types', () => {
    const yaml = `
name: Invalid Step Type
definition:
  steps:
    start:
      type: invalid_type
      next: [end]
  initial_step: start
`;

    expect(() => parseWorkflowDefinition(yaml)).toThrow('Invalid step type: invalid_type');
  });

  it('handles parameters correctly', () => {
    const yaml = `
name: Parameterized Workflow
definition:
  steps:
    start:
      type: trigger
      next: [end]
    end:
      type: terminal
  initial_step: start
  parameters:
    memory_id:
      type: string
      required: true
`;

    const result = parseWorkflowDefinition(yaml);

    expect(result.definition.parameters?.memory_id.type).toBe('string');
    expect(result.definition.parameters?.memory_id.required).toBe(true);
  });

  it('sets default version when not provided', () => {
    const yaml = `
name: No Version Workflow
definition:
  steps:
    start:
      type: trigger
      next: [end]
    end:
      type: terminal
  initial_step: start
`;

    const result = parseWorkflowDefinition(yaml);

    expect(result.version).toBe(1);
  });

  it('throws error for missing name', () => {
    const yaml = `
definition:
  steps:
    start:
      type: trigger
  initial_step: start
`;

    expect(() => parseWorkflowDefinition(yaml)).toThrow('Missing required field: name');
  });

  it('throws error for missing steps', () => {
    const yaml = `
name: Missing Steps
definition:
  initial_step: start
`;

    expect(() => parseWorkflowDefinition(yaml)).toThrow('Missing required field: definition.steps');
  });

  it('throws error for missing initial_step', () => {
    const yaml = `
name: Missing Initial Step
definition:
  steps:
    start:
      type: trigger
`;

    expect(() => parseWorkflowDefinition(yaml)).toThrow('Missing required field: definition.initial_step');
  });

  it('accepts all valid step types', () => {
    const yaml = `
name: All Step Types
definition:
  steps:
    trigger_step:
      type: trigger
      next: [task_step]
    task_step:
      type: task
      next: [gate_step]
    gate_step:
      type: gate
      next: [terminal_step]
    terminal_step:
      type: terminal
  initial_step: trigger_step
`;

    const result = parseWorkflowDefinition(yaml);

    expect(result.definition.steps.trigger_step.type).toBe('trigger');
    expect(result.definition.steps.task_step.type).toBe('task');
    expect(result.definition.steps.gate_step.type).toBe('gate');
    expect(result.definition.steps.terminal_step.type).toBe('terminal');
  });
});
