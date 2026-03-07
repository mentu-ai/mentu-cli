/**
 * Mentu Hooks Architecture
 *
 * Composable middleware for tool execution with:
 * - PreToolUse, PostToolUse, Stop lifecycle hooks
 * - Glob-style permission patterns
 * - Genesis.key configuration
 *
 * @example
 * ```typescript
 * import {
 *   parseGenesisWithHooks,
 *   matchesPattern,
 *   checkPermission,
 *   getHooksForEvent,
 * } from './hooks';
 *
 * // Parse genesis.key with hooks
 * const genesis = parseGenesisWithHooks(genesisContent);
 *
 * // Check if a tool use matches a pattern
 * const matches = matchesPattern('Bash(git *)', 'Bash', { command: 'git status' });
 *
 * // Check actor permissions
 * const { allowed, reason } = checkPermission(
 *   ['Bash(git *)'],
 *   ['Bash(rm -rf *)'],
 *   'Bash',
 *   { command: 'git commit -m "test"' }
 * );
 *
 * // Get hooks for an event
 * const preHooks = getHooksForEvent(genesis, 'pre_tool_use');
 * ```
 */

// Types
export type {
  HookEvent,
  HookType,
  HookDecision,
  HookConfig,
  GenesisHooks,
  HookInput,
  HookOutput,
  PermissionPattern,
  ActorPermissions,
  GenesisPermissions,
  GenesisKeyWithHooks,
  HookEvaluationResult,
  HookContext,
} from './types.js';

// Pattern Matching
export {
  parsePattern,
  globToRegex,
  globMatch,
  extractToolName,
  extractToolArgs,
  matchesPattern,
  checkPermission,
} from './matcher.js';

// Genesis Parsing
export {
  HookValidationError,
  parseGenesisWithHooks,
  getHooksForEvent,
  getActorPermissions,
  hasHooks,
  hasPermissions,
} from './parser.js';
