/**
 * Bug Reporter Provider
 * PRD: In-App Bug Reporting - Platform Integration
 *
 * Wraps the app to initialize capture systems and provide the modal.
 * Should be placed high in the component tree.
 */

import { useEffect, useRef } from 'react';
import { BugReporterModal } from './BugReporterModal';
import { useConsoleCapture } from '../hooks/useConsoleCapture';
import { useBehaviorTracking } from '../hooks/useBehaviorTracking';
import { configureBugReporter } from '../services/bugReporterService';
import { useBugReporterStore } from '../stores/bugReporterStore';
import type { CaptureBufferConfig } from '../types/bugReport.types';

export interface BugReporterProviderProps {
  children: React.ReactNode;

  /**
   * Supabase client for database storage
   * If not provided, reports will be stored locally
   */
  supabaseClient?: unknown;

  /**
   * Custom endpoint for bug report submission
   * Alternative to Supabase
   */
  endpoint?: string;

  /**
   * Table name in Supabase (default: 'bug_reports')
   */
  tableName?: string;

  /**
   * Configuration for capture buffers
   */
  captureConfig?: Partial<CaptureBufferConfig>;

  /**
   * Enable keyboard shortcut (Ctrl+Shift+B)
   * Default: true
   */
  enableKeyboardShortcut?: boolean;
}

export function BugReporterProvider({
  children,
  supabaseClient,
  endpoint,
  tableName,
  captureConfig,
  enableKeyboardShortcut = true,
}: BugReporterProviderProps) {
  const configuredRef = useRef(false);

  // Initialize console capture
  useConsoleCapture({
    maxConsoleEntries: captureConfig?.maxConsoleEntries,
    consoleRetentionMs: captureConfig?.consoleRetentionMs,
  });

  // Initialize behavior tracking
  useBehaviorTracking({
    maxBehaviorEvents: captureConfig?.maxBehaviorEvents,
    behaviorRetentionMs: captureConfig?.behaviorRetentionMs,
  });

  // Configure the service (only once)
  useEffect(() => {
    if (configuredRef.current) return;
    configuredRef.current = true;

    configureBugReporter({
      supabaseClient,
      endpoint,
      tableName,
    });
  }, [supabaseClient, endpoint, tableName]);

  // Keyboard shortcut handler - use store directly for stable references
  const openReporter = useBugReporterStore((s) => s.openReporter);
  const isOpen = useBugReporterStore((s) => s.isOpen);

  useEffect(() => {
    if (!enableKeyboardShortcut) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+B or Cmd+Shift+B
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        // Check current state from store at event time
        const currentState = useBugReporterStore.getState();
        if (!currentState.isOpen) {
          openReporter();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboardShortcut, openReporter]);

  return (
    <>
      {children}
      <BugReporterModal />
    </>
  );
}
