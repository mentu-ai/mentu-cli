/**
 * Hooks Architecture Types
 *
 * Defines the type system for Mentu's hooks architecture,
 * enabling composable middleware for tool execution.
 */

// ============================================================
// HOOK EVENTS
// ============================================================

/**
 * Hook event types matching Claude Code's lifecycle points.
 */
export type HookEvent = 'PreToolUse' | 'PostToolUse' | 'Stop';

/**
 * Hook type identifiers for different behaviors.
 */
export type HookType =
  | 'genesis_enforcement'   // Check genesis permissions
  | 'evidence_capture'      // Write to ledger
  | 'approval_gate'         // Require human approval
  | 'deny'                  // Block with reason
  | 'command'               // Run shell command
  | 'modify';               // Transform input/output

/**
 * Hook decision outcomes.
 */
export type HookDecision = 'allow' | 'deny' | 'ask';

// ============================================================
// HOOK CONFIGURATION
// ============================================================

/**
 * Configuration for a single hook in genesis.key.
 */
export interface HookConfig {
  /** Tool pattern with wildcards (e.g., "Bash(git *)") */
  matcher?: string;
  /** Type of hook behavior */
  type: HookType;
  /** Hook-specific configuration */
  config?: Record<string, unknown>;
}

/**
 * Genesis hooks configuration section.
 */
export interface GenesisHooks {
  pre_tool_use?: HookConfig[];
  post_tool_use?: HookConfig[];
  stop?: HookConfig[];
}

// ============================================================
// HOOK INPUT/OUTPUT
// ============================================================

/**
 * Input passed to hook execution.
 */
export interface HookInput {
  /** Which lifecycle point triggered this hook */
  hook_event_name: HookEvent;
  /** Name of the tool being used */
  tool_name: string;
  /** Tool input parameters */
  tool_input: Record<string, unknown>;
  /** Tool output (PostToolUse only) */
  tool_output?: Record<string, unknown>;
  /** Current session ID */
  session_id: string;
  /** Associated commitment ID if any */
  commitment_id?: string;
  /** Actor performing the operation */
  actor: string;
}

/**
 * Output returned from hook execution.
 */
export interface HookOutput {
  /** Decision: allow, deny, or ask for human input */
  decision: HookDecision;
  /** Reason for deny/ask decisions */
  reason?: string;
  /** Modified input (for modify hooks) */
  modified_input?: Record<string, unknown>;
  /** Evidence to capture */
  evidence?: {
    kind: string;
    data: Record<string, unknown>;
  };
}

// ============================================================
// PERMISSION PATTERNS
// ============================================================

/**
 * Parsed permission pattern.
 */
export interface PermissionPattern {
  /** Tool name (e.g., "Bash", "Write") */
  tool: string;
  /** Argument pattern with wildcards (e.g., "git *") */
  argPattern?: string;
  /** Original pattern string */
  raw: string;
}

/**
 * Actor permission configuration.
 */
export interface ActorPermissions {
  /** Patterns that are allowed */
  allow?: string[];
  /** Patterns that are denied */
  deny?: string[];
}

/**
 * Permissions section in genesis.key.
 */
export interface GenesisPermissions {
  actors?: Record<string, ActorPermissions>;
}

// ============================================================
// EXTENDED GENESIS KEY
// ============================================================

/**
 * Extended genesis.key structure with hooks support.
 * Extends the existing GenesisKey type.
 */
export interface GenesisKeyWithHooks {
  version: string;
  hooks?: GenesisHooks;
  permissions?: GenesisPermissions;
  // ... other existing genesis.key fields are preserved
  [key: string]: unknown;
}

// ============================================================
// HOOK EXECUTION
// ============================================================

/**
 * Result of evaluating hooks for a tool use.
 */
export interface HookEvaluationResult {
  /** Final decision after all hooks */
  decision: HookDecision;
  /** Reason if denied or asking */
  reason?: string;
  /** Hooks that fired */
  fired: Array<{
    matcher: string;
    type: HookType;
    decision: HookDecision;
  }>;
  /** Evidence to capture */
  evidence?: Array<{
    kind: string;
    data: Record<string, unknown>;
  }>;
}

/**
 * Context for hook evaluation.
 */
export interface HookContext {
  /** Actor performing the operation */
  actor: string;
  /** Current session ID */
  sessionId: string;
  /** Associated commitment ID */
  commitmentId?: string;
}
