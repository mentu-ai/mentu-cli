/**
 * Bug Reporter Types
 * PRD: In-App Bug Reporting + Universal Ticket Layer
 *
 * These types support both the bug reporter UI and the universal tickets system.
 */

// Console log entry captured during session
export interface ConsoleLogEntry {
  timestamp: number;
  level: 'log' | 'warn' | 'error' | 'debug' | 'info';
  message: string;
  args?: unknown[];
  stack?: string;
}

// User behavior event captured during session
export interface BehaviorEvent {
  timestamp: number;
  type: 'click' | 'input' | 'navigation' | 'scroll' | 'focus' | 'blur' | 'change';
  target: {
    selector: string;
    tagName: string;
    id?: string;
    className?: string;
    text?: string;
    name?: string;
    type?: string;
  };
  metadata?: {
    url?: string;
    scrollPosition?: { x: number; y: number };
    inputType?: string;
    // Note: We do NOT capture input values for privacy
  };
}

// Element selected by user for bug context
export interface SelectedElement {
  selector: string;
  tagName: string;
  id?: string;
  className?: string;
  text?: string;
  attributes: Record<string, string>;
  boundingRect: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

// Environment metadata
export interface EnvironmentMetadata {
  userAgent: string;
  browser: {
    name: string;
    version: string;
  };
  os: {
    name: string;
    version?: string;
  };
  viewport: {
    width: number;
    height: number;
  };
  url: string;
  route: string;
  timestamp: number;
  timezone: string;
  language: string;
  screenResolution: {
    width: number;
    height: number;
  };
}

// Bug priority levels
export type BugPriority = 'low' | 'medium' | 'high' | 'critical';

// Bug status values (aligned with GitHub workflow)
export type BugStatus = 'submitted' | 'triaged' | 'in_progress' | 'resolved' | 'closed' | 'wont_fix';

// Video processing status values
export type VideoProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

// Complete bug report structure
export interface BugReport {
  id?: string;
  description: string;
  element: SelectedElement | null;
  screenshot: string | null; // base64 encoded image
  videoUrl: string | null;
  consoleLogs: ConsoleLogEntry[];
  behaviorTrace: BehaviorEvent[];
  environment: EnvironmentMetadata;
  userId: string;
  sessionId: string;
  createdAt: number;
  status?: BugStatus;

  // GitHub integration fields
  priority?: BugPriority;
  assignedTo?: string;
  githubIssueNumber?: number;
  githubIssueUrl?: string;

  // Video processing fields (Loom integration)
  videoStoragePath?: string;
  videoTranscript?: string;
  videoProcessingStatus?: VideoProcessingStatus;
  videoProcessedAt?: number;
  videoDurationSeconds?: number;
}

// Bug report submission payload
export interface BugReportSubmission {
  description: string;
  element?: SelectedElement | null;
  screenshot?: string | null;
  videoUrl?: string | null;
  consoleLogs: ConsoleLogEntry[];
  behaviorTrace: BehaviorEvent[];
  environment: EnvironmentMetadata;
}

// Store state
export interface BugReporterState {
  // UI State
  isOpen: boolean;
  isSubmitting: boolean;
  currentStep: 'element' | 'description' | 'screenshot' | 'review';

  // Capture State
  isElementSelectionActive: boolean;
  selectedElement: SelectedElement | null;
  screenshot: string | null;
  description: string;
  videoUrl: string;

  // Submission State
  lastSubmissionResult: {
    success: boolean;
    reportId?: string;
    error?: string;
  } | null;
}

// Store actions
export interface BugReporterActions {
  // UI Actions
  openReporter: () => Promise<void>;
  closeReporter: () => void;
  setStep: (step: BugReporterState['currentStep']) => void;
  reset: () => void;

  // Capture Actions
  startElementSelection: () => void;
  stopElementSelection: () => void;
  setSelectedElement: (element: SelectedElement | null) => void;
  setScreenshot: (screenshot: string | null) => void;
  setDescription: (description: string) => void;
  setVideoUrl: (url: string) => void;

  // Submission Actions
  submitReport: () => Promise<void>;
}

// Buffer configuration
export interface CaptureBufferConfig {
  maxConsoleEntries: number;
  maxBehaviorEvents: number;
  consoleRetentionMs: number;
  behaviorRetentionMs: number;
}

// ============================================================================
// Universal Ticket Layer Types
// ============================================================================

// Ticket source - where did this ticket come from?
export type TicketSource = 'bug_reporter' | 'email' | 'slack' | 'api' | 'manual';

// Ticket type - what kind of work is this?
export type TicketType = 'bug' | 'feature' | 'support' | 'task' | 'question';

// External system reference
export interface ExternalRef {
  system: string;      // 'github', 'linear', 'jira', etc.
  id: string;          // ID in the external system
  url?: string;        // URL to the external resource
  synced_at?: string;  // ISO timestamp of last sync
}

// Universal ticket structure (matches tickets table)
export interface Ticket {
  id: string;

  // Source tracking
  source: TicketSource;
  source_id?: string;
  source_metadata?: Record<string, unknown>;

  // Normalized fields
  type: TicketType;
  title?: string;
  description: string;
  priority: BugPriority;
  status: BugStatus;

  // Assignment
  assigned_to?: string;
  assigned_at?: string;

  // Rich payload (source-specific data)
  payload?: {
    console_logs?: ConsoleLogEntry[];
    behavior_trace?: BehaviorEvent[];
    element?: SelectedElement;
    screenshot?: string;
    video_url?: string;
    [key: string]: unknown;
  };

  // Location context
  page_url?: string;
  environment?: EnvironmentMetadata;

  // External system sync
  external_refs?: ExternalRef[];

  // Legacy fields (for backward compatibility)
  screenshot?: string;
  video_url?: string;
  element?: SelectedElement;
  console_logs?: ConsoleLogEntry[];
  behavior_trace?: BehaviorEvent[];

  // Video processing
  video_storage_path?: string;
  video_transcript?: string;
  video_processing_status?: VideoProcessingStatus;
  video_processed_at?: string;
  video_duration_seconds?: number;

  // Metadata
  created_by?: string;
  session_id?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  resolved_by?: string;
  resolution_notes?: string;
}

// Ticket creation input (for manual entry or API)
export interface CreateTicketInput {
  source?: TicketSource;
  source_id?: string;
  source_metadata?: Record<string, unknown>;
  type: TicketType;
  title?: string;
  description: string;
  priority?: BugPriority;
  payload?: Record<string, unknown>;
  page_url?: string;
  environment?: Partial<EnvironmentMetadata>;
}

// Ticket update input
export interface UpdateTicketInput {
  title?: string;
  description?: string;
  priority?: BugPriority;
  status?: BugStatus;
  assigned_to?: string;
  resolution_notes?: string;
}

// Query options for fetching tickets
export interface TicketQueryOptions {
  source?: TicketSource;
  type?: TicketType;
  status?: BugStatus | BugStatus[];
  priority?: BugPriority | BugPriority[];
  assigned_to?: string;
  unassigned?: boolean;
  created_after?: string;
  created_before?: string;
  limit?: number;
  offset?: number;
  order_by?: 'created_at' | 'updated_at' | 'priority';
  order_dir?: 'asc' | 'desc';
}
