/**
 * Mentu Bug Reporter SDK
 *
 * @example
 * ```typescript
 * import { BugReporter } from '@mentu/bug-reporter';
 *
 * const reporter = new BugReporter({
 *   apiToken: 'mentu_xxx',
 *   workspaceId: 'workspace-uuid',
 *   workspacePath: '/path/to/project',
 *   source: 'MyApp'
 * });
 *
 * const { commitmentId } = await reporter.report({
 *   title: 'Something broke',
 *   description: 'Details...',
 *   severity: 'high'
 * });
 *
 * const status = await reporter.getStatus(commitmentId);
 * ```
 */

export { BugReporter } from './bug-reporter.js';
export type {
  BugReporterConfig,
  BugInput,
  BugResult,
  BugStatus,
  BugSeverity,
  BugCallback,
  CallbackRegistration,
} from './types.js';
