/**
 * Hooks Parser
 *
 * Parses the hooks and permissions sections from genesis.key.
 * Validates configuration and provides typed access to hook definitions.
 */

import { parse as parseYaml } from 'yaml';
import type {
  GenesisHooks,
  GenesisPermissions,
  GenesisKeyWithHooks,
  HookConfig,
  ActorPermissions,
} from './types.js';
import { parsePattern } from './matcher.js';

// ============================================================
// VALIDATION
// ============================================================

/**
 * Valid hook types that can be configured.
 */
const VALID_HOOK_TYPES = new Set([
  'genesis_enforcement',
  'evidence_capture',
  'approval_gate',
  'deny',
  'command',
  'modify',
]);

/**
 * Validation error for hook configuration.
 */
export class HookValidationError extends Error {
  constructor(
    message: string,
    public readonly path: string,
    public readonly value?: unknown
  ) {
    super(`${path}: ${message}`);
    this.name = 'HookValidationError';
  }
}

/**
 * Validate a single hook configuration.
 */
function validateHookConfig(
  hook: unknown,
  path: string
): asserts hook is HookConfig {
  if (!hook || typeof hook !== 'object') {
    throw new HookValidationError('Hook must be an object', path, hook);
  }

  const h = hook as Record<string, unknown>;

  // Validate type
  if (!h.type || typeof h.type !== 'string') {
    throw new HookValidationError('Hook must have a type', path);
  }

  if (!VALID_HOOK_TYPES.has(h.type)) {
    throw new HookValidationError(
      `Invalid hook type: ${h.type}. Valid types: ${Array.from(VALID_HOOK_TYPES).join(', ')}`,
      path
    );
  }

  // Validate matcher if present
  if (h.matcher !== undefined) {
    if (typeof h.matcher !== 'string') {
      throw new HookValidationError('Matcher must be a string', path);
    }

    // Validate pattern syntax (unless it's "*" which matches everything)
    if (h.matcher !== '*' && !parsePattern(h.matcher)) {
      throw new HookValidationError(
        `Invalid matcher pattern: ${h.matcher}. Format: Tool(args) or Tool`,
        path
      );
    }
  }

  // Validate config if present
  if (h.config !== undefined && typeof h.config !== 'object') {
    throw new HookValidationError('Config must be an object', path);
  }
}

/**
 * Validate hooks section of genesis.key.
 */
function validateHooksSection(
  hooks: unknown,
  path: string
): asserts hooks is GenesisHooks {
  if (!hooks || typeof hooks !== 'object') {
    throw new HookValidationError('Hooks must be an object', path);
  }

  const h = hooks as Record<string, unknown>;
  const validSections = ['pre_tool_use', 'post_tool_use', 'stop'];

  for (const key of Object.keys(h)) {
    if (!validSections.includes(key)) {
      throw new HookValidationError(
        `Invalid hooks section: ${key}. Valid sections: ${validSections.join(', ')}`,
        `${path}.${key}`
      );
    }

    const section = h[key];
    if (!Array.isArray(section)) {
      throw new HookValidationError(
        `${key} must be an array of hooks`,
        `${path}.${key}`
      );
    }

    section.forEach((hook, i) => {
      validateHookConfig(hook, `${path}.${key}[${i}]`);
    });
  }
}

/**
 * Validate a permission pattern string.
 */
function validatePermissionPattern(pattern: unknown, path: string): void {
  if (typeof pattern !== 'string') {
    throw new HookValidationError('Pattern must be a string', path, pattern);
  }

  // Allow wildcard patterns
  if (pattern === '*') {
    return;
  }

  if (!parsePattern(pattern)) {
    throw new HookValidationError(
      `Invalid permission pattern: ${pattern}. Format: Tool(args) or Tool`,
      path
    );
  }
}

/**
 * Validate actor permissions configuration.
 */
function validateActorPermissions(
  perms: unknown,
  path: string
): asserts perms is ActorPermissions {
  if (!perms || typeof perms !== 'object') {
    throw new HookValidationError('Actor permissions must be an object', path);
  }

  const p = perms as Record<string, unknown>;

  if (p.allow !== undefined) {
    if (!Array.isArray(p.allow)) {
      throw new HookValidationError('allow must be an array', `${path}.allow`);
    }
    p.allow.forEach((pattern, i) => {
      validatePermissionPattern(pattern, `${path}.allow[${i}]`);
    });
  }

  if (p.deny !== undefined) {
    if (!Array.isArray(p.deny)) {
      throw new HookValidationError('deny must be an array', `${path}.deny`);
    }
    p.deny.forEach((pattern, i) => {
      validatePermissionPattern(pattern, `${path}.deny[${i}]`);
    });
  }
}

/**
 * Validate permissions section of genesis.key.
 */
function validatePermissionsSection(
  permissions: unknown,
  path: string
): asserts permissions is GenesisPermissions {
  if (!permissions || typeof permissions !== 'object') {
    throw new HookValidationError('Permissions must be an object', path);
  }

  const p = permissions as Record<string, unknown>;

  if (p.actors !== undefined) {
    if (typeof p.actors !== 'object' || p.actors === null) {
      throw new HookValidationError(
        'actors must be an object',
        `${path}.actors`
      );
    }

    const actors = p.actors as Record<string, unknown>;
    for (const [actor, perms] of Object.entries(actors)) {
      validateActorPermissions(perms, `${path}.actors.${actor}`);
    }
  }
}

// ============================================================
// PARSING
// ============================================================

/**
 * Parse genesis.key content with hooks support.
 *
 * @param content - YAML content of genesis.key
 * @returns Parsed and validated genesis key with hooks
 * @throws HookValidationError if configuration is invalid
 */
export function parseGenesisWithHooks(content: string): GenesisKeyWithHooks {
  const parsed = parseYaml(content) as Record<string, unknown>;

  if (!parsed || typeof parsed !== 'object') {
    throw new HookValidationError('Invalid genesis.key format', 'root');
  }

  // Validate version
  if (!parsed.version || typeof parsed.version !== 'string') {
    throw new HookValidationError(
      'genesis.key must have a version field',
      'version'
    );
  }

  // Validate hooks section if present
  if (parsed.hooks !== undefined) {
    validateHooksSection(parsed.hooks, 'hooks');
  }

  // Validate permissions section if present
  if (parsed.permissions !== undefined) {
    validatePermissionsSection(parsed.permissions, 'permissions');
  }

  return parsed as GenesisKeyWithHooks;
}

/**
 * Get hooks for a specific event from genesis key.
 *
 * @param genesis - Parsed genesis key
 * @param event - Hook event type
 * @returns Array of hooks for the event, or empty array
 */
export function getHooksForEvent(
  genesis: GenesisKeyWithHooks,
  event: 'pre_tool_use' | 'post_tool_use' | 'stop'
): HookConfig[] {
  return genesis.hooks?.[event] ?? [];
}

/**
 * Get permissions for an actor from genesis key.
 *
 * @param genesis - Parsed genesis key
 * @param actor - Actor identifier (e.g., "agent:executor")
 * @returns Actor permissions, or empty allow/deny arrays
 */
export function getActorPermissions(
  genesis: GenesisKeyWithHooks,
  actor: string
): ActorPermissions {
  return genesis.permissions?.actors?.[actor] ?? { allow: [], deny: [] };
}

/**
 * Check if genesis key has hooks configured.
 *
 * @param genesis - Parsed genesis key
 * @returns true if any hooks are configured
 */
export function hasHooks(genesis: GenesisKeyWithHooks): boolean {
  if (!genesis.hooks) {
    return false;
  }

  const { pre_tool_use, post_tool_use, stop } = genesis.hooks;
  return (
    (pre_tool_use?.length ?? 0) > 0 ||
    (post_tool_use?.length ?? 0) > 0 ||
    (stop?.length ?? 0) > 0
  );
}

/**
 * Check if genesis key has permissions configured.
 *
 * @param genesis - Parsed genesis key
 * @returns true if any actor permissions are configured
 */
export function hasPermissions(genesis: GenesisKeyWithHooks): boolean {
  if (!genesis.permissions?.actors) {
    return false;
  }

  return Object.keys(genesis.permissions.actors).length > 0;
}
