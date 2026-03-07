import { describe, it, expect } from 'vitest';
import { validateDAG } from '../../src/workflows/dag-validator.js';
import type { WorkflowDefinition } from '../../src/workflows/types.js';

describe('DAG Validator', () => {
  it('accepts valid linear workflow', () => {
    const workflow: WorkflowDefinition = {
      name: 'Linear',
      version: 1,
      definition: {
        steps: {
          start: { type: 'trigger', next: ['middle'] },
          middle: { type: 'task', next: ['end'] },
          end: { type: 'terminal' },
        },
        initial_step: 'start',
      },
    };

    const result = validateDAG(workflow);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('detects cycle in workflow', () => {
    const workflow: WorkflowDefinition = {
      name: 'Cyclic',
      version: 1,
      definition: {
        steps: {
          a: { type: 'task', next: ['b'] },
          b: { type: 'task', next: ['c'] },
          c: { type: 'task', next: ['a'] }, // Cycle: a → b → c → a
        },
        initial_step: 'a',
      },
    };

    const result = validateDAG(workflow);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.includes('Cycle detected'))).toBe(true);
  });

  it('validates initial_step exists', () => {
    const workflow: WorkflowDefinition = {
      name: 'Missing Initial',
      version: 1,
      definition: {
        steps: {
          start: { type: 'trigger', next: ['end'] },
          end: { type: 'terminal' },
        },
        initial_step: 'nonexistent',
      },
    };

    const result = validateDAG(workflow);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('initial_step "nonexistent" not found in steps');
  });

  it('validates all next steps exist', () => {
    const workflow: WorkflowDefinition = {
      name: 'Missing Next Step',
      version: 1,
      definition: {
        steps: {
          start: { type: 'trigger', next: ['missing_step'] },
        },
        initial_step: 'start',
      },
    };

    const result = validateDAG(workflow);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Step "start" references nonexistent next step: "missing_step"');
  });

  it('accepts workflow with branching paths', () => {
    const workflow: WorkflowDefinition = {
      name: 'Branching',
      version: 1,
      definition: {
        steps: {
          start: { type: 'trigger', next: ['path_a', 'path_b'] },
          path_a: { type: 'task', next: ['end'] },
          path_b: { type: 'task', next: ['end'] },
          end: { type: 'terminal' },
        },
        initial_step: 'start',
      },
    };

    const result = validateDAG(workflow);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts workflow with no next steps (terminal)', () => {
    const workflow: WorkflowDefinition = {
      name: 'Single Step',
      version: 1,
      definition: {
        steps: {
          only_step: { type: 'terminal' },
        },
        initial_step: 'only_step',
      },
    };

    const result = validateDAG(workflow);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('detects self-referencing cycle', () => {
    const workflow: WorkflowDefinition = {
      name: 'Self Loop',
      version: 1,
      definition: {
        steps: {
          start: { type: 'task', next: ['start'] }, // Self-loop
        },
        initial_step: 'start',
      },
    };

    const result = validateDAG(workflow);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Cycle detected'))).toBe(true);
  });

  it('detects complex cycle in larger graph', () => {
    const workflow: WorkflowDefinition = {
      name: 'Complex Cycle',
      version: 1,
      definition: {
        steps: {
          start: { type: 'trigger', next: ['a'] },
          a: { type: 'task', next: ['b', 'c'] },
          b: { type: 'task', next: ['d'] },
          c: { type: 'task', next: ['d'] },
          d: { type: 'task', next: ['a'] }, // Cycle: a → b/c → d → a
          end: { type: 'terminal' },
        },
        initial_step: 'start',
      },
    };

    const result = validateDAG(workflow);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Cycle detected'))).toBe(true);
  });

  it('handles multiple validation errors', () => {
    const workflow: WorkflowDefinition = {
      name: 'Multiple Errors',
      version: 1,
      definition: {
        steps: {
          start: { type: 'trigger', next: ['missing', 'end'] },
          end: { type: 'terminal' },
        },
        initial_step: 'nonexistent',
      },
    };

    const result = validateDAG(workflow);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});
