/**
 * Bug Reporter Main Hook
 * PRD: In-App Bug Reporting
 *
 * Provides a unified interface for bug reporting functionality.
 */

import { useCallback } from 'react';
import { useBugReporterStore } from '../stores/bugReporterStore';
import { captureScreenshot } from '../utils/screenshotCapture';
import type { SelectedElement } from '../types/bugReport.types';

export interface UseBugReporterReturn {
  // State
  isOpen: boolean;
  isSubmitting: boolean;
  currentStep: 'element' | 'description' | 'screenshot' | 'review';
  isElementSelectionActive: boolean;
  selectedElement: SelectedElement | null;
  screenshot: string | null;
  description: string;
  videoUrl: string;
  lastSubmissionResult: {
    success: boolean;
    reportId?: string;
    error?: string;
  } | null;

  // Actions
  open: () => void;
  close: () => void;
  setStep: (step: 'element' | 'description' | 'screenshot' | 'review') => void;
  reset: () => void;
  startElementSelection: () => void;
  stopElementSelection: () => void;
  selectElement: (element: SelectedElement | null) => void;
  takeScreenshot: () => Promise<void>;
  setDescription: (description: string) => void;
  setVideoUrl: (url: string) => void;
  submit: () => Promise<void>;
}

/**
 * Main hook for bug reporting functionality
 * Use this in components that need to interact with the bug reporter
 */
export function useBugReporter(): UseBugReporterReturn {
  const store = useBugReporterStore();

  const open = useCallback(() => {
    store.openReporter();
  }, [store]);

  const close = useCallback(() => {
    store.closeReporter();
  }, [store]);

  const setStep = useCallback(
    (step: 'element' | 'description' | 'screenshot' | 'review') => {
      store.setStep(step);
    },
    [store]
  );

  const reset = useCallback(() => {
    store.reset();
  }, [store]);

  const startElementSelection = useCallback(() => {
    store.startElementSelection();
  }, [store]);

  const stopElementSelection = useCallback(() => {
    store.stopElementSelection();
  }, [store]);

  const selectElement = useCallback(
    (element: SelectedElement | null) => {
      store.setSelectedElement(element);
    },
    [store]
  );

  const takeScreenshot = useCallback(async () => {
    try {
      // Clear existing screenshot first to show loading state
      store.setScreenshot(null);

      // Small delay to ensure modal overlay is properly excluded
      await new Promise(resolve => setTimeout(resolve, 100));

      // Capture fresh screenshot (modal elements are ignored via data-bug-reporter-ignore)
      const screenshot = await captureScreenshot();
      store.setScreenshot(screenshot);
    } catch (error) {
      console.error('[BugReporter] Screenshot capture failed:', error);
      // Continue without screenshot - don't block the flow
      store.setScreenshot(null);
    }
  }, [store]);

  const setDescription = useCallback(
    (description: string) => {
      store.setDescription(description);
    },
    [store]
  );

  const setVideoUrl = useCallback(
    (url: string) => {
      store.setVideoUrl(url);
    },
    [store]
  );

  const submit = useCallback(async () => {
    await store.submitReport();
  }, [store]);

  return {
    // State
    isOpen: store.isOpen,
    isSubmitting: store.isSubmitting,
    currentStep: store.currentStep,
    isElementSelectionActive: store.isElementSelectionActive,
    selectedElement: store.selectedElement,
    screenshot: store.screenshot,
    description: store.description,
    videoUrl: store.videoUrl,
    lastSubmissionResult: store.lastSubmissionResult,

    // Actions
    open,
    close,
    setStep,
    reset,
    startElementSelection,
    stopElementSelection,
    selectElement,
    takeScreenshot,
    setDescription,
    setVideoUrl,
    submit,
  };
}
