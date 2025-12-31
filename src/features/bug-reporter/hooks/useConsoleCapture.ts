/**
 * Console Capture Hook
 * PRD: In-App Bug Reporting - Automatic Capture
 *
 * Wraps console methods to capture logs in a rolling buffer.
 * Captures: console.log, console.warn, console.error, console.debug, console.info
 * Also captures uncaught exceptions and unhandled promise rejections.
 */

import { useEffect, useRef } from 'react';
import type { ConsoleLogEntry, CaptureBufferConfig } from '../types/bugReport.types';

// Rolling buffer for console logs
let consoleBuffer: ConsoleLogEntry[] = [];
let isInitialized = false;

// Default configuration
const DEFAULT_CONFIG: Pick<CaptureBufferConfig, 'maxConsoleEntries' | 'consoleRetentionMs'> = {
  maxConsoleEntries: 100,
  consoleRetentionMs: 5 * 60 * 1000, // 5 minutes
};

let config = { ...DEFAULT_CONFIG };

// Store original console methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
  info: console.info,
};

/**
 * Format arguments to string for storage
 */
function formatArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (arg === null) return 'null';
      if (arg === undefined) return 'undefined';
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return '[Object - unable to stringify]';
        }
      }
      return String(arg);
    })
    .join(' ');
}

/**
 * Add entry to buffer with size and time management
 */
function addToBuffer(entry: ConsoleLogEntry): void {
  const now = Date.now();

  // Remove entries older than retention period
  consoleBuffer = consoleBuffer.filter(
    (e) => now - e.timestamp < config.consoleRetentionMs
  );

  // Add new entry
  consoleBuffer.push(entry);

  // Trim to max size
  if (consoleBuffer.length > config.maxConsoleEntries) {
    consoleBuffer = consoleBuffer.slice(-config.maxConsoleEntries);
  }
}

/**
 * Create a wrapped console method
 */
function createWrapper(level: ConsoleLogEntry['level']) {
  return function (...args: unknown[]): void {
    // Call original method
    originalConsole[level].apply(console, args);

    // Capture to buffer
    const entry: ConsoleLogEntry = {
      timestamp: Date.now(),
      level,
      message: formatArgs(args),
      args: args.length > 0 ? args : undefined,
    };

    // Capture stack trace for errors
    if (level === 'error') {
      try {
        entry.stack = new Error().stack;
      } catch {
        // Ignore stack trace capture failures
      }
    }

    addToBuffer(entry);
  };
}

/**
 * Handle uncaught errors
 */
function handleError(event: ErrorEvent): void {
  const entry: ConsoleLogEntry = {
    timestamp: Date.now(),
    level: 'error',
    message: `Uncaught Error: ${event.message}`,
    stack: event.error?.stack,
  };
  addToBuffer(entry);
}

/**
 * Handle unhandled promise rejections
 */
function handleUnhandledRejection(event: PromiseRejectionEvent): void {
  const entry: ConsoleLogEntry = {
    timestamp: Date.now(),
    level: 'error',
    message: `Unhandled Promise Rejection: ${formatArgs([event.reason])}`,
    stack: event.reason?.stack,
  };
  addToBuffer(entry);
}

/**
 * Initialize console capture
 */
function initializeConsoleCapture(): void {
  if (isInitialized) return;

  // Wrap console methods
  console.log = createWrapper('log');
  console.warn = createWrapper('warn');
  console.error = createWrapper('error');
  console.debug = createWrapper('debug');
  console.info = createWrapper('info');

  // Add global error handlers
  window.addEventListener('error', handleError);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);

  isInitialized = true;

  // Log initialization (will be captured)
  console.debug('[BugReporter] Console capture initialized');
}

/**
 * Cleanup console capture
 */
function cleanupConsoleCapture(): void {
  if (!isInitialized) return;

  // Restore original methods
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  console.debug = originalConsole.debug;
  console.info = originalConsole.info;

  // Remove global error handlers
  window.removeEventListener('error', handleError);
  window.removeEventListener('unhandledrejection', handleUnhandledRejection);

  isInitialized = false;
}

/**
 * Get captured console logs
 */
export function getConsoleLogs(): ConsoleLogEntry[] {
  const now = Date.now();
  // Return only entries within retention period
  return consoleBuffer.filter(
    (e) => now - e.timestamp < config.consoleRetentionMs
  );
}

/**
 * Clear captured console logs
 */
export function clearConsoleLogs(): void {
  consoleBuffer = [];
}

/**
 * Configure console capture
 */
export function configureConsoleCapture(
  newConfig: Partial<Pick<CaptureBufferConfig, 'maxConsoleEntries' | 'consoleRetentionMs'>>
): void {
  config = { ...config, ...newConfig };
}

/**
 * React hook for console capture
 * Should be used once at the app root level
 */
export function useConsoleCapture(
  options: Partial<Pick<CaptureBufferConfig, 'maxConsoleEntries' | 'consoleRetentionMs'>> = {}
): void {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;

    // Apply configuration
    if (options.maxConsoleEntries !== undefined) {
      config.maxConsoleEntries = options.maxConsoleEntries;
    }
    if (options.consoleRetentionMs !== undefined) {
      config.consoleRetentionMs = options.consoleRetentionMs;
    }

    // Initialize capture
    initializeConsoleCapture();
    initializedRef.current = true;

    // Cleanup on unmount (usually only when app is completely torn down)
    return () => {
      // Note: We typically don't cleanup in production as the app
      // should always have console capture running
      // cleanupConsoleCapture();
    };
  }, [options.maxConsoleEntries, options.consoleRetentionMs]);
}

// Export for direct initialization (non-React contexts)
export { initializeConsoleCapture, cleanupConsoleCapture };
