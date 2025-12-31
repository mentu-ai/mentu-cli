/**
 * Bug Reporter - In-App Bug Reporting Feature
 * PRD: In-App Bug Reporting
 *
 * A self-contained bug reporting module for web applications.
 * Captures console logs, user behavior, screenshots, and environment data.
 */

// Components
export { BugReporterModal } from './components/BugReporterModal';
export { BugReporterTrigger, BugReporterTriggerCompact } from './components/BugReporterTrigger';
export { BugReporterProvider } from './components/BugReporterProvider';
export { ElementHighlighter } from './components/ElementHighlighter';

// Hooks
export { useBugReporter } from './hooks/useBugReporter';
export {
  useConsoleCapture,
  getConsoleLogs,
  clearConsoleLogs,
  configureConsoleCapture,
  initializeConsoleCapture,
} from './hooks/useConsoleCapture';
export {
  useBehaviorTracking,
  getBehaviorEvents,
  clearBehaviorEvents,
  configureBehaviorTracking,
  initializeBehaviorTracking,
} from './hooks/useBehaviorTracking';

// Store
export { useBugReporterStore } from './stores/bugReporterStore';

// Services
export {
  BugReporterService,
  configureBugReporter,
} from './services/bugReporterService';

// Utilities
export { captureScreenshot, captureElementScreenshot } from './utils/screenshotCapture';
export { collectEnvironmentMetadata, formatEnvironmentSummary } from './utils/environmentCollector';
export {
  createSelectedElement,
  generateSelector,
  highlightElement,
  getMeaningfulElementAtPoint,
} from './utils/elementSelector';

// Types
export type {
  BugReport,
  BugReportSubmission,
  ConsoleLogEntry,
  BehaviorEvent,
  SelectedElement,
  EnvironmentMetadata,
  BugReporterState,
  CaptureBufferConfig,
} from './types/bugReport.types';
