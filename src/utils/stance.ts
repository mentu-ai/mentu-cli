/**
 * Cognitive Stance System for Author Types
 *
 * This module extends the author type system with cognitive stances—
 * structured reasoning modes that tell agents HOW to think when
 * operating in a role, not just what they're permitted to do.
 *
 * Key Concepts:
 * - Cognitive Stance = How a role reasons about failure and success
 * - Mantra = Core operating principle for the role
 * - Cross-Role Rules = How to handle failures outside your domain
 */

import type { AuthorType, TrustLevel } from './author.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Validation domains that map to author types.
 */
export type ValidationDomain = 'intent' | 'safety' | 'technical';

/**
 * Cognitive stance for an author type.
 * Defines how the role should reason about success and failure.
 */
export interface CognitiveStance {
  /** The validation domain this role owns */
  owns: ValidationDomain;

  /** Core operating principle - the role's guiding philosophy */
  mantra: string;

  /** How to reason when intent validation fails */
  when_intent_fails: string;

  /** How to reason when safety validation fails */
  when_safety_fails: string;

  /** How to reason when technical validation fails */
  when_technical_fails: string;
}

/**
 * Cross-role failure handling rule.
 * Defines how to respond when receiving failure in another role's domain.
 */
export interface CrossRoleRule {
  /** Agent's current role */
  agent_role: AuthorType;

  /** Which validation domain failed */
  failure_domain: ValidationDomain;

  /** Reasoning stance to adopt */
  stance: string;

  /** Recommended action */
  action: string;
}

/**
 * Result of reasoning about a failure.
 */
export interface FailureReasoning {
  /** Is this failure owned by the current role? */
  is_owned: boolean;

  /** The stance to adopt */
  stance: string;

  /** The action to take */
  action: string;

  /** Cross-role rule applied (if failure not owned) */
  cross_role_rule?: CrossRoleRule;
}

/**
 * Attribution from a validator verdict.
 */
export interface Attribution {
  author_type: AuthorType;
  responsible_for: ValidationDomain;
}

// =============================================================================
// Constants: Cognitive Stances
// =============================================================================

/**
 * Cognitive stance for the Architect role.
 * Architects dream vision but cannot see reality.
 */
export const ARCHITECT_STANCE: CognitiveStance = {
  owns: 'intent',
  mantra: `I dream freely because I cannot see reality.
My job is clarity of vision, not feasibility.`,
  when_intent_fails: `This is my failure. My vision was unclear or misaligned.
I should clarify, not defend.`,
  when_safety_fails: `This suggests my constraints were unclear.
I should work with the auditor to sharpen boundaries.`,
  when_technical_fails: `This is not my failure. I trust the executor.
I should not intervene in implementation.`,
};

/**
 * Cognitive stance for the Auditor role.
 * Auditors judge boundaries but cannot create vision.
 */
export const AUDITOR_STANCE: CognitiveStance = {
  owns: 'safety',
  mantra: `I judge fairly because I cannot create vision.
My job is boundaries, not dreams.`,
  when_intent_fails: `I approved something misaligned. My review was shallow.
Question the architect. Tighten the review.`,
  when_safety_fails: `This is my failure. My boundaries were incomplete.
I should add constraints, not blame the executor.`,
  when_technical_fails: `This is not my failure. Implementation is the executor's domain.
I should not micromanage the how.`,
};

/**
 * Cognitive stance for the Executor role.
 * Executors act decisively but cannot exceed scope.
 */
export const EXECUTOR_STANCE: CognitiveStance = {
  owns: 'technical',
  mantra: `I act decisively because I cannot exceed scope.
My job is implementation, not interpretation.`,
  when_intent_fails: `I drifted from the vision. This is my failure to follow.
Return to the HANDOFF. Read the intent again.`,
  when_safety_fails: `I violated boundaries set by another role.
I should constrain, not argue. Respect the audit.`,
  when_technical_fails: `This is my failure. The implementation doesn't work.
I should fix it, not explain why it should work.`,
};

/**
 * All cognitive stances indexed by author type.
 */
export const COGNITIVE_STANCES: Record<AuthorType, CognitiveStance> = {
  architect: ARCHITECT_STANCE,
  auditor: AUDITOR_STANCE,
  executor: EXECUTOR_STANCE,
};

/**
 * Mapping from validation domain to owning author type.
 */
export const DOMAIN_OWNERS: Record<ValidationDomain, AuthorType> = {
  intent: 'architect',
  safety: 'auditor',
  technical: 'executor',
};

// =============================================================================
// Constants: Cross-Role Rules
// =============================================================================

/**
 * Cross-role rules for handling failures outside your domain.
 * Key: `${agent_role}_receives_${failure_domain}_failure`
 */
export const CROSS_ROLE_RULES: Record<string, CrossRoleRule> = {
  // Executor receives failures
  executor_receives_intent_failure: {
    agent_role: 'executor',
    failure_domain: 'intent',
    stance: `I drifted. This is still my failure—failure to follow.
I should not argue that my interpretation was valid.
Return to source. Read the intent. Rebuild.`,
    action: 're_read_intent_and_rebuild',
  },
  executor_receives_safety_failure: {
    agent_role: 'executor',
    failure_domain: 'safety',
    stance: `I crossed a line. The auditor set boundaries I violated.
I should not argue the boundary was wrong.
Constrain. Remove the violation. Rebuild within scope.`,
    action: 'remove_violation_and_rebuild',
  },

  // Auditor receives failures
  auditor_receives_intent_failure: {
    agent_role: 'auditor',
    failure_domain: 'intent',
    stance: `I approved without understanding. My review was shallow.
I should not blame the architect for unclear vision.
Request clarification. Re-audit.`,
    action: 'request_clarification_and_reaudit',
  },
  auditor_receives_technical_failure: {
    agent_role: 'auditor',
    failure_domain: 'technical',
    stance: `This is not my failure to fix.
I should not micromanage implementation.
Trust the executor. Provide guidance if asked.`,
    action: 'trust_executor',
  },

  // Architect receives failures
  architect_receives_safety_failure: {
    agent_role: 'architect',
    failure_domain: 'safety',
    stance: `My vision created a security concern.
I should work with the auditor to refine boundaries.
Clarify constraints, don't ignore them.`,
    action: 'refine_constraints_with_auditor',
  },
  architect_receives_technical_failure: {
    agent_role: 'architect',
    failure_domain: 'technical',
    stance: `This is not my failure to fix, but it may be my failure to envision.
Was my vision realistic? Should I consult the auditor?
I should NOT attempt to fix implementation.`,
    action: 'reconsider_vision_if_pattern_repeats',
  },
};

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Get cognitive stance for an author type.
 */
export function getStance(authorType: AuthorType): CognitiveStance {
  return COGNITIVE_STANCES[authorType];
}

/**
 * Get the author type that owns a validation domain.
 */
export function getDomainOwner(domain: ValidationDomain): AuthorType {
  return DOMAIN_OWNERS[domain];
}

/**
 * Check if an author type owns a validation domain.
 */
export function ownsValidationDomain(
  authorType: AuthorType,
  domain: ValidationDomain
): boolean {
  return DOMAIN_OWNERS[domain] === authorType;
}

/**
 * Get the cross-role rule for a specific scenario.
 */
export function getCrossRoleRule(
  agentRole: AuthorType,
  failureDomain: ValidationDomain
): CrossRoleRule | undefined {
  // If agent owns this domain, no cross-role rule applies
  if (ownsValidationDomain(agentRole, failureDomain)) {
    return undefined;
  }

  const key = `${agentRole}_receives_${failureDomain}_failure`;
  return CROSS_ROLE_RULES[key];
}

/**
 * Reason about a failure based on current role and attribution.
 * Returns the stance to adopt and action to take.
 */
export function reasonAboutFailure(
  currentRole: AuthorType,
  attribution: Attribution
): FailureReasoning {
  const stance = getStance(currentRole);
  const failureDomain = attribution.responsible_for;
  const isOwned = ownsValidationDomain(currentRole, failureDomain);

  if (isOwned) {
    // This is our failure - use the direct stance
    const stanceText = stance[`when_${failureDomain}_fails` as keyof CognitiveStance] as string;
    return {
      is_owned: true,
      stance: stanceText,
      action: `fix_${failureDomain}_issue`,
    };
  }

  // Not our domain - look up cross-role rule
  const crossRoleRule = getCrossRoleRule(currentRole, failureDomain);

  if (crossRoleRule) {
    return {
      is_owned: false,
      stance: crossRoleRule.stance,
      action: crossRoleRule.action,
      cross_role_rule: crossRoleRule,
    };
  }

  // Fallback: use the stance's guidance for this failure type
  const stanceText = stance[`when_${failureDomain}_fails` as keyof CognitiveStance] as string;
  return {
    is_owned: false,
    stance: stanceText,
    action: 'consult_responsible_role',
  };
}

// =============================================================================
// Prompt Builder Functions
// =============================================================================

/**
 * Build a prompt section for an agent's cognitive stance.
 * This is meant to be injected into agent prompts.
 */
export function buildStancePrompt(authorType: AuthorType): string {
  const stance = getStance(authorType);

  return `## Your Cognitive Stance

You are operating as **${authorType}** in the Cooperation Triad.

**Your mantra:**
> ${stance.mantra.split('\n').join('\n> ')}

**When ${stance.owns} validation fails:** This is YOUR failure. Own it. Fix it. Don't explain.

**When other validations fail:**
- Intent failures: ${stance.when_intent_fails.split('\n')[0]}
- Safety failures: ${stance.when_safety_fails.split('\n')[0]}
- Technical failures: ${stance.when_technical_fails.split('\n')[0]}

**The Boundary Principle:**
- Your domain is **${stance.owns}**
- Failure in your domain → Own it, fix it
- Failure in another's domain → Route it, trust them
- Your work causing another's failure → You drifted, return to scope`;
}

/**
 * Build a minimal stance reminder for prompts.
 */
export function buildStanceReminder(authorType: AuthorType): string {
  const stance = getStance(authorType);

  return `**Role:** ${authorType} | **Owns:** ${stance.owns} | **Mantra:** "${stance.mantra.split('\n')[0]}"`;
}

/**
 * Build failure reasoning instructions for prompts.
 */
export function buildFailureInstructions(authorType: AuthorType): string {
  const stance = getStance(authorType);

  return `## When Validation Fails

If you receive a validation failure, reason as follows:

1. **Check attribution:** Who is responsible? (author_type in verdict)
2. **Check ownership:** Is ${stance.owns} your domain? YES
3. **Apply stance:**
   - If attribution.author_type === "${authorType}": This is your failure. Fix it immediately.
   - If attribution.author_type !== "${authorType}": This is another role's concern. Do not argue.

**Your failure reasoning:**
- Intent fails → ${stance.when_intent_fails.split('\n')[0]}
- Safety fails → ${stance.when_safety_fails.split('\n')[0]}
- Technical fails → ${stance.when_technical_fails.split('\n')[0]}`;
}
