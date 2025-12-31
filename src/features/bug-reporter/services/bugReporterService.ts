/**
 * Bug Reporter Service
 * PRD: In-App Bug Reporting + Universal Ticket Layer
 * PRD: Loom Integration for Bug Reporter
 *
 * Handles submission of bug reports via the Universal Ticket Layer API.
 * Uses the UTL SDK to communicate with the tickets-api Edge Function.
 * Triggers async video processing for Loom URLs.
 */

import type { BugReport, BugReportSubmission, BugPriority } from '../types/bugReport.types';
import { UTLClient } from '@/lib/utl-sdk';
import type { CreateTicketRequest } from '@/lib/utl-sdk';
import { LoomService } from './loomService';

// Configuration for the bug reporter service
interface BugReporterConfig {
  // UTL SDK configuration
  utlApiUrl?: string;
  utlApiKey?: string;
  // Legacy: direct Supabase client (deprecated)
  supabaseClient?: unknown;
  // Legacy: custom endpoint (deprecated)
  endpoint?: string;
}

let config: BugReporterConfig = {};
let utlClient: UTLClient | null = null;

/**
 * Configure the bug reporter service
 */
export function configureBugReporter(newConfig: Partial<BugReporterConfig>) {
  config = { ...config, ...newConfig };

  // Initialize UTL client if configured
  if (config.utlApiUrl && config.utlApiKey) {
    utlClient = new UTLClient({
      apiUrl: config.utlApiUrl,
      apiKey: config.utlApiKey,
    });
    console.log('[BugReporter] UTL SDK client initialized');
  }
}

/**
 * Auto-configure from environment variables
 */
function autoConfigureFromEnv() {
  if (utlClient) return; // Already configured

  // Use dedicated UTL URL if available, otherwise fall back to WarrantyOS Supabase
  const apiUrl = import.meta.env.VITE_UTL_API_URL || import.meta.env.VITE_SUPABASE_URL;
  const apiKey = import.meta.env.VITE_UTL_API_KEY || import.meta.env.VITE_UTL_INGEST_API_KEY;

  if (apiUrl && apiKey) {
    configureBugReporter({
      utlApiUrl: apiUrl.includes('/functions/v1') ? apiUrl : `${apiUrl}/functions/v1`,
      utlApiKey: apiKey,
    });
  }
}

/**
 * Generate a unique session ID for the current browser session
 */
function getOrCreateSessionId(): string {
  const SESSION_KEY = 'bug_reporter_session_id';
  let sessionId = sessionStorage.getItem(SESSION_KEY);

  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }

  return sessionId;
}

/**
 * Get the current user ID from the auth context
 */
function getCurrentUserId(): string {
  try {
    const authData = localStorage.getItem('vin-to-value-auth');
    if (authData) {
      const parsed = JSON.parse(authData);
      return parsed?.user?.id || 'anonymous';
    }
  } catch {
    // Ignore parsing errors
  }
  return 'anonymous';
}

export const BugReporterService = {
  /**
   * Submit a bug report to the Universal Ticket Layer
   */
  async submitReport(submission: BugReportSubmission): Promise<{ id: string }> {
    // Auto-configure from environment if not already done
    autoConfigureFromEnv();

    const report: Omit<BugReport, 'id'> = {
      ...submission,
      userId: getCurrentUserId(),
      sessionId: getOrCreateSessionId(),
      createdAt: Date.now(),
      status: 'submitted',
    };

    // Primary: Use UTL SDK
    if (utlClient) {
      return this.submitToUTL(report);
    }

    // Legacy fallback: Use Supabase client directly
    if (config.supabaseClient) {
      return this.submitToSupabase(report);
    }

    // Legacy fallback: Use custom endpoint
    if (config.endpoint) {
      return this.submitToEndpoint(report);
    }

    // Fallback: Log to console and store locally (development mode)
    console.info('[BugReporter] Report captured (no backend configured):', report);
    const localId = `local_${Date.now()}`;
    this.storeLocally({ ...report, id: localId });
    return { id: localId };
  },

  /**
   * Submit to Universal Ticket Layer via SDK
   * This is the primary submission method.
   */
  async submitToUTL(report: Omit<BugReport, 'id'>): Promise<{ id: string }> {
    if (!utlClient) {
      throw new Error('UTL client not initialized');
    }

    // Generate title from first 80 chars of description
    const title = report.description.length > 80
      ? report.description.substring(0, 77) + '...'
      : report.description;

    // Build rich payload for diagnostic context
    const payload: Record<string, unknown> = {
      console_logs: report.consoleLogs,
      behavior_trace: report.behaviorTrace,
      element: report.element,
      screenshot: report.screenshot,
      video_url: report.videoUrl,
      user_id: report.userId,
      session_id: report.sessionId,
    };

    // Build the ticket request with WarrantyOS platform identification
    const ticketRequest: CreateTicketRequest = {
      source: 'bug_reporter',
      type: 'bug',
      title: title,
      description: report.description,
      priority: (report.priority as 'low' | 'medium' | 'high' | 'critical') || 'medium',
      page_url: report.environment?.url || window.location.href,
      environment: report.environment as Record<string, unknown>,
      payload: payload,
      // Source identification - WarrantyOS Web Platform
      source_id: `warrantyos_${report.sessionId || getOrCreateSessionId()}`,
      source_metadata: {
        client: 'warrantyos',
        platform: 'web',
        app_name: 'WarrantyOS',
        app_url: window.location.origin,
        submitted_at: new Date().toISOString(),
      },
    };

    try {
      const ticket = await utlClient.tickets.create(ticketRequest);

      console.log('[BugReporter] Report submitted via UTL SDK:', ticket.id);

      // Trigger async video processing for Loom URLs
      if (ticket.id && report.videoUrl && LoomService.isLoomUrl(report.videoUrl)) {
        this.triggerVideoProcessing(ticket.id, report.videoUrl).catch((err) => {
          console.error('[BugReporter] Failed to trigger video processing:', err);
        });
      }

      return { id: ticket.id };
    } catch (error) {
      console.error('[BugReporter] UTL submission failed:', error);

      // Fallback to local storage
      const localId = `local_${Date.now()}`;
      this.storeLocally({ ...report, id: localId });

      throw new Error(`Failed to submit bug report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Legacy: Submit to Supabase database directly (deprecated)
   * Use submitToUTL instead.
   */
  async submitToSupabase(report: Omit<BugReport, 'id'>): Promise<{ id: string }> {
    const client = config.supabaseClient as {
      from: (table: string) => {
        insert: (data: unknown) => {
          select: () => {
            single: () => Promise<{ data: { id: string; external_refs?: unknown[] } | null; error: unknown }>;
          };
        };
      };
    };

    // Generate title from first 80 chars of description
    const title = report.description.length > 80
      ? report.description.substring(0, 77) + '...'
      : report.description;

    // Build rich payload for diagnostic context
    const payload = {
      console_logs: report.consoleLogs,
      behavior_trace: report.behaviorTrace,
      element: report.element,
      screenshot: report.screenshot,
      video_url: report.videoUrl,
    };

    const { data, error } = await client
      .from('tickets')
      .insert({
        source: 'bug_reporter',
        type: 'bug',
        title: title,
        description: report.description,
        priority: report.priority || 'medium',
        status: report.status || 'submitted',
        payload: payload,
        page_url: report.environment?.url || window.location.href,
        environment: report.environment,
        element: report.element,
        screenshot: report.screenshot,
        video_url: report.videoUrl,
        console_logs: report.consoleLogs,
        behavior_trace: report.behaviorTrace,
        created_by: report.userId !== 'anonymous' ? report.userId : null,
        session_id: report.sessionId,
      })
      .select()
      .single();

    if (error) {
      console.error('[BugReporter] Supabase submission failed:', error);
      throw new Error('Failed to submit bug report to database');
    }

    console.log('[BugReporter] Report submitted to tickets table:', data?.id);

    const reportId = data?.id;
    if (reportId && report.videoUrl && LoomService.isLoomUrl(report.videoUrl)) {
      this.triggerVideoProcessing(reportId, report.videoUrl).catch((err) => {
        console.error('[BugReporter] Failed to trigger video processing:', err);
      });
    }

    return { id: reportId || 'unknown' };
  },

  /**
   * Trigger async video processing for Loom videos
   * Fire-and-forget - doesn't block the submission
   */
  async triggerVideoProcessing(reportId: string, videoUrl: string): Promise<void> {
    // Use UTL client if available
    if (utlClient) {
      const apiUrl = config.utlApiUrl || import.meta.env.VITE_SUPABASE_URL + '/functions/v1';
      const apiKey = config.utlApiKey || import.meta.env.VITE_UTL_API_KEY;

      if (!apiKey) {
        console.warn('[BugReporter] No API key for video processing');
        return;
      }

      console.log(`[BugReporter] Triggering video processing for report ${reportId}`);

      try {
        const response = await fetch(`${apiUrl}/process-loom-video`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
          },
          body: JSON.stringify({
            bugReportId: reportId,
            videoUrl: videoUrl,
          }),
        });

        if (!response.ok) {
          console.error('[BugReporter] Video processing trigger failed:', response.status);
        } else {
          console.log('[BugReporter] Video processing triggered successfully');
        }
      } catch (error) {
        console.error('[BugReporter] Video processing trigger failed:', error);
      }
      return;
    }

    // Legacy: Use Supabase functions
    const client = config.supabaseClient as {
      functions: {
        invoke: (name: string, options: { body: object }) => Promise<{ data: unknown; error: unknown }>;
      };
    };

    if (!client?.functions) {
      console.warn('[BugReporter] Supabase functions not available for video processing');
      return;
    }

    console.log(`[BugReporter] Triggering video processing for report ${reportId}`);

    const { error } = await client.functions.invoke('process-loom-video', {
      body: {
        bugReportId: reportId,
        videoUrl: videoUrl,
      },
    });

    if (error) {
      console.error('[BugReporter] Video processing trigger failed:', error);
    } else {
      console.log('[BugReporter] Video processing triggered successfully');
    }
  },

  /**
   * Legacy: Submit to custom endpoint
   */
  async submitToEndpoint(report: Omit<BugReport, 'id'>): Promise<{ id: string }> {
    const response = await fetch(config.endpoint!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(report),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[BugReporter] Endpoint submission failed:', errorText);
      throw new Error('Failed to submit bug report');
    }

    const result = await response.json();
    return { id: result.id || result.reportId || 'submitted' };
  },

  /**
   * Store report locally (fallback for offline or development)
   */
  storeLocally(report: BugReport): void {
    const STORAGE_KEY = 'bug_reports_pending';
    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      existing.push(report);
      // Keep only last 10 reports locally
      const trimmed = existing.slice(-10);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch (error) {
      console.error('[BugReporter] Failed to store locally:', error);
    }
  },

  /**
   * Retry submitting locally stored reports
   */
  async retryPendingReports(): Promise<void> {
    const STORAGE_KEY = 'bug_reports_pending';
    try {
      const pending = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as BugReport[];

      if (pending.length === 0) return;

      const stillPending: BugReport[] = [];

      for (const report of pending) {
        try {
          if (utlClient || config.supabaseClient || config.endpoint) {
            await this.submitReport(report);
          } else {
            stillPending.push(report);
          }
        } catch {
          stillPending.push(report);
        }
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(stillPending));
    } catch (error) {
      console.error('[BugReporter] Failed to retry pending reports:', error);
    }
  },

  /**
   * Check if UTL SDK is configured and ready
   */
  isConfigured(): boolean {
    return utlClient !== null;
  },

  /**
   * Get the UTL client instance (for advanced usage)
   */
  getClient(): UTLClient | null {
    autoConfigureFromEnv();
    return utlClient;
  },
};
