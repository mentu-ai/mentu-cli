/**
 * Hooks Pattern Matcher
 *
 * Implements glob-style pattern matching for tool permissions.
 * Patterns follow the format: Tool(argument_pattern)
 *
 * Examples:
 *   "Bash(git *)"     - matches any git command
 *   "Write(src/*)"    - matches any file in src/
 *   "Read(*)"         - matches any Read operation
 *   "Bash"            - matches any Bash command (no arg restriction)
 */

import type { PermissionPattern } from './types.js';

/**
 * Parse a permission pattern string into its components.
 *
 * Pattern format: "Tool(argument_pattern)" or just "Tool"
 *
 * @param pattern - The pattern string (e.g., "Bash(git *)")
 * @returns Parsed pattern or null if invalid
 */
export function parsePattern(pattern: string): PermissionPattern | null {
  if (!pattern || typeof pattern !== 'string') {
    return null;
  }

  // Match: ToolName or ToolName(args)
  const match = pattern.match(/^(\w+)(?:\((.+)\))?$/);
  if (!match) {
    return null;
  }

  const [, tool, argPattern] = match;

  return {
    tool,
    argPattern: argPattern || undefined,
    raw: pattern,
  };
}

/**
 * Convert a glob pattern to a RegExp.
 *
 * Supports:
 *   * - matches any sequence of characters
 *   ? - matches single character (future enhancement)
 *
 * @param pattern - Glob pattern
 * @returns RegExp for matching
 */
export function globToRegex(pattern: string): RegExp {
  // Escape special regex characters except * and ?
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');

  return new RegExp(`^${escaped}$`);
}

/**
 * Check if a string matches a glob pattern.
 *
 * @param pattern - Glob pattern (e.g., "git *")
 * @param text - Text to match against
 * @returns true if matches
 */
export function globMatch(pattern: string, text: string): boolean {
  if (!pattern || !text) {
    return false;
  }

  const regex = globToRegex(pattern);
  return regex.test(text);
}

/**
 * Extract the tool name from a tool use request.
 *
 * @param toolUse - Tool use string or object
 * @returns Tool name
 */
export function extractToolName(
  toolUse: string | { tool_name?: string; name?: string }
): string {
  if (typeof toolUse === 'string') {
    // Handle "Tool(args)" format
    const match = toolUse.match(/^(\w+)/);
    return match ? match[1] : toolUse;
  }
  return toolUse.tool_name || toolUse.name || '';
}

/**
 * Extract the argument string from a tool use request.
 *
 * For Bash: extracts the command
 * For Write/Edit: extracts the file_path
 * For Read: extracts the file_path
 *
 * @param toolName - Name of the tool
 * @param toolInput - Tool input parameters
 * @returns Argument string for pattern matching
 */
export function extractToolArgs(
  toolName: string,
  toolInput: Record<string, unknown>
): string {
  switch (toolName) {
    case 'Bash':
      return (toolInput.command as string) || '';
    case 'Write':
    case 'Edit':
    case 'Read':
      return (toolInput.file_path as string) || '';
    case 'Task':
      return (toolInput.subagent_type as string) || '';
    default:
      // For other tools, try common parameter names
      return (
        (toolInput.command as string) ||
        (toolInput.path as string) ||
        (toolInput.file_path as string) ||
        ''
      );
  }
}

/**
 * Check if a tool use matches a permission pattern.
 *
 * @param pattern - Permission pattern (e.g., "Bash(git *)")
 * @param toolName - Actual tool name being used
 * @param toolInput - Tool input parameters
 * @returns true if the tool use matches the pattern
 */
export function matchesPattern(
  pattern: string,
  toolName: string,
  toolInput: Record<string, unknown>
): boolean {
  const parsed = parsePattern(pattern);
  if (!parsed) {
    return false;
  }

  // Check tool name match
  // Support pipe for OR matching (e.g., "Write|Edit")
  const toolPatterns = parsed.tool.split('|');
  const toolMatches = toolPatterns.some(
    (tp) => tp === '*' || tp === toolName || globMatch(tp, toolName)
  );

  if (!toolMatches) {
    return false;
  }

  // If no argument pattern, tool match is sufficient
  if (!parsed.argPattern) {
    return true;
  }

  // Match argument pattern
  const args = extractToolArgs(toolName, toolInput);
  return globMatch(parsed.argPattern, args);
}

/**
 * Check if an actor has permission for a tool use.
 *
 * Deny patterns are checked first; if any match, denied.
 * Then allow patterns are checked; if any match, allowed.
 * If no patterns match, default is deny.
 *
 * @param allowPatterns - Patterns that allow the action
 * @param denyPatterns - Patterns that deny the action
 * @param toolName - Tool being used
 * @param toolInput - Tool input parameters
 * @returns { allowed: boolean, matchedPattern?: string, reason?: string }
 */
export function checkPermission(
  allowPatterns: string[],
  denyPatterns: string[],
  toolName: string,
  toolInput: Record<string, unknown>
): { allowed: boolean; matchedPattern?: string; reason?: string } {
  // Check deny patterns first
  for (const pattern of denyPatterns) {
    if (matchesPattern(pattern, toolName, toolInput)) {
      return {
        allowed: false,
        matchedPattern: pattern,
        reason: `Denied by pattern: ${pattern}`,
      };
    }
  }

  // Check allow patterns
  for (const pattern of allowPatterns) {
    if (matchesPattern(pattern, toolName, toolInput)) {
      return {
        allowed: true,
        matchedPattern: pattern,
      };
    }
  }

  // Default: no matching pattern = denied
  return {
    allowed: false,
    reason: 'No matching allow pattern',
  };
}
