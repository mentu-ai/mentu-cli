/**
 * Bug Reporter Zustand Store
 * PRD: In-App Bug Reporting
 *
 * Manages UI state and captured data for bug reports.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  BugReporterState,
  BugReporterActions,
  SelectedElement,
} from '../types/bugReport.types';
import { BugReporterService } from '../services/bugReporterService';
import { getConsoleLogs } from '../hooks/useConsoleCapture';
import { getBehaviorEvents } from '../hooks/useBehaviorTracking';
import { collectEnvironmentMetadata } from '../utils/environmentCollector';
import { captureScreenshot } from '../utils/screenshotCapture';

const initialState: BugReporterState = {
  isOpen: false,
  isSubmitting: false,
  currentStep: 'description',
  isElementSelectionActive: false,
  selectedElement: null,
  screenshot: null,
  description: '',
  videoUrl: '',
  lastSubmissionResult: null,
};

export const useBugReporterStore = create<BugReporterState & BugReporterActions>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // UI Actions
      openReporter: async () => {
        // Capture screenshot BEFORE showing the modal
        // This ensures we capture the page without the modal overlay
        try {
          const screenshot = await captureScreenshot();
          set({
            isOpen: true,
            currentStep: 'description',
            lastSubmissionResult: null,
            screenshot,
          });
        } catch (error) {
          console.error('[BugReporter] Failed to capture screenshot:', error);
          set({
            isOpen: true,
            currentStep: 'description',
            lastSubmissionResult: null,
            screenshot: null,
          });
        }
      },

      closeReporter: () => {
        const state = get();
        // Clean up element selection if active
        if (state.isElementSelectionActive) {
          state.stopElementSelection();
        }
        set({ isOpen: false });
      },

      setStep: (step) => set({ currentStep: step }),

      reset: () => set({ ...initialState }),

      // Capture Actions
      startElementSelection: () => set({
        isElementSelectionActive: true,
        currentStep: 'element',
      }),

      stopElementSelection: () => set({
        isElementSelectionActive: false,
      }),

      setSelectedElement: (element: SelectedElement | null) => set({
        selectedElement: element,
        isElementSelectionActive: false,
        currentStep: 'description',
      }),

      setScreenshot: (screenshot: string | null) => set({ screenshot }),

      setDescription: (description: string) => set({ description }),

      setVideoUrl: (url: string) => set({ videoUrl: url }),

      // Submission Actions
      submitReport: async () => {
        const state = get();

        if (!state.description.trim()) {
          set({
            lastSubmissionResult: {
              success: false,
              error: 'Description is required',
            },
          });
          return;
        }

        set({ isSubmitting: true });

        try {
          // Collect all captured data
          const consoleLogs = getConsoleLogs();
          const behaviorTrace = getBehaviorEvents();
          const environment = collectEnvironmentMetadata();

          // Submit the report
          const result = await BugReporterService.submitReport({
            description: state.description,
            element: state.selectedElement,
            screenshot: state.screenshot,
            videoUrl: state.videoUrl || null,
            consoleLogs,
            behaviorTrace,
            environment,
          });

          set({
            isSubmitting: false,
            lastSubmissionResult: {
              success: true,
              reportId: result.id,
            },
            // Reset form after successful submission
            description: '',
            selectedElement: null,
            screenshot: null,
            videoUrl: '',
            currentStep: 'description',
          });

          // Auto-close after success (can be changed based on UX preference)
          setTimeout(() => {
            set({ isOpen: false });
          }, 2000);

        } catch (error) {
          set({
            isSubmitting: false,
            lastSubmissionResult: {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to submit report',
            },
          });
        }
      },
    }),
    {
      name: 'bug-reporter-store',
    }
  )
);
