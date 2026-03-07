/**
 * Bug Reporter SDK Types
 *
 * Types for external systems to report bugs and receive completion callbacks.
 */

// Severity levels
export type BugSeverity = 'critical' | 'high' | 'medium' | 'low';

// Bug report input from external systems
export interface BugInput {
  title: string;
  description: string;
  severity: BugSeverity;
  tags?: string[];
  metadata?: Record<string, unknown>;
  environment?: {
    userAgent?: string;
    url?: string;
    version?: string;
  };
}

// SDK configuration
export interface BugReporterConfig {
  apiUrl?: string;           // Default: https://mentu-proxy.affihub.workers.dev
  apiToken: string;          // X-API-Key header
  workspaceId: string;
  workspacePath: string;     // For workflow execution context
  source: string;            // e.g., 'WarrantyOS', 'inline-substitute'
  callbackUrl?: string;      // POST here when workflow completes
  callbackSecret?: string;   // HMAC-SHA256 signing key
}

// Result from reporting a bug
export interface BugResult {
  memoryId: string;
  commitmentId: string;
  workflowInstanceId: string;
}

// Bug status query result
export interface BugStatus {
  memoryId: string;
  commitmentId: string;
  commitmentState: 'open' | 'claimed' | 'in_review' | 'closed' | 'reopened';
  workflowInstanceId?: string;
  workflowState?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  currentStep?: string;
  stepStates?: Record<string, {
    state: string;
    output?: unknown;
  }>;
  prUrl?: string;
  summary?: string;
  error?: string;
}

// Callback payload sent to external system
export interface BugCallback {
  commitmentId: string;
  memoryId: string;
  state: 'closed' | 'failed';
  prUrl?: string;
  summary?: string;
  error?: string;
  timestamp: string;
}

// Callback registration
export interface CallbackRegistration {
  commitmentId: string;
  callbackUrl: string;
  callbackSecret?: string;
  registeredAt: string;
}
