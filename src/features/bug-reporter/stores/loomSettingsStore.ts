/**
 * Loom Settings Store
 * PRD: Loom Integration for Bug Reporter
 *
 * Manages Loom recording preferences and SDK state.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// Recording status states
export type LoomRecordingStatus =
  | 'idle'
  | 'starting'
  | 'recording'
  | 'processing'
  | 'complete'
  | 'error';

export interface LoomSettingsState {
  // Persisted preferences
  isEnabled: boolean;

  // Runtime state
  isSDKLoaded: boolean;
  sdkLoadError: string | null;
  isExtensionDetected: boolean | null;

  // Recording state
  isRecording: boolean;
  recordingStatus: LoomRecordingStatus;
  lastRecordedUrl: string | null;
  lastError: string | null;
}

export interface LoomSettingsActions {
  setEnabled: (enabled: boolean) => void;
  setSDKLoaded: (loaded: boolean, error?: string) => void;
  setExtensionDetected: (detected: boolean) => void;
  setRecordingStatus: (status: LoomRecordingStatus) => void;
  setLastRecordedUrl: (url: string | null) => void;
  setLastError: (error: string | null) => void;
  reset: () => void;
}

const initialState: LoomSettingsState = {
  isEnabled: false,
  isSDKLoaded: false,
  sdkLoadError: null,
  isExtensionDetected: null,
  isRecording: false,
  recordingStatus: 'idle',
  lastRecordedUrl: null,
  lastError: null,
};

export const useLoomSettingsStore = create<LoomSettingsState & LoomSettingsActions>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,

        setEnabled: (enabled) => set({ isEnabled: enabled }),

        setSDKLoaded: (loaded, error) =>
          set({
            isSDKLoaded: loaded,
            sdkLoadError: error || null,
          }),

        setExtensionDetected: (detected) => set({ isExtensionDetected: detected }),

        setRecordingStatus: (status) =>
          set({
            recordingStatus: status,
            isRecording: status === 'recording' || status === 'starting',
          }),

        setLastRecordedUrl: (url) => set({ lastRecordedUrl: url }),

        setLastError: (error) => set({ lastError: error }),

        reset: () =>
          set({
            isRecording: false,
            recordingStatus: 'idle',
            lastRecordedUrl: null,
            lastError: null,
          }),
      }),
      {
        name: 'loom-settings-storage',
        partialize: (state) => ({ isEnabled: state.isEnabled }), // Only persist preference
      }
    ),
    { name: 'loom-settings-store' }
  )
);
