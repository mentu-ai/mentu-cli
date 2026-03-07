// DAG validator - detects cycles and validates dependencies

import type { WorkflowDefinition, DAGValidationResult, WorkflowStep } from './types.js';

export function validateDAG(workflow: WorkflowDefinition): DAGValidationResult {
  const errors: string[] = [];
  const steps = workflow.definition.steps;

  // Validate initial_step exists
  if (!steps[workflow.definition.initial_step]) {
    errors.push(`initial_step "${workflow.definition.initial_step}" not found in steps`);
  }

  // Validate all next steps exist
  for (const [stepId, step] of Object.entries<WorkflowStep>(steps)) {
    if (step.next) {
      for (const nextStep of step.next) {
        if (!steps[nextStep]) {
          errors.push(`Step "${stepId}" references nonexistent next step: "${nextStep}"`);
        }
      }
    }
  }

  // Detect cycles using DFS
  const visited = new Set<string>();
  const recStack = new Set<string>();
  const cyclePath: string[] = [];

  function hasCycleDFS(stepId: string, path: string[]): boolean {
    visited.add(stepId);
    recStack.add(stepId);
    path.push(stepId);

    const step = steps[stepId];
    if (step && step.next) {
      for (const nextStep of step.next) {
        if (!visited.has(nextStep)) {
          if (hasCycleDFS(nextStep, [...path])) {
            return true;
          }
        } else if (recStack.has(nextStep)) {
          // Found a cycle
          const cycleStart = path.indexOf(nextStep);
          const cycle = [...path.slice(cycleStart), nextStep];
          errors.push(`Cycle detected: ${cycle.join(' → ')}`);
          return true;
        }
      }
    }

    recStack.delete(stepId);
    return false;
  }

  // Check for cycles starting from each unvisited node
  for (const stepId of Object.keys(steps)) {
    if (!visited.has(stepId)) {
      hasCycleDFS(stepId, []);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
