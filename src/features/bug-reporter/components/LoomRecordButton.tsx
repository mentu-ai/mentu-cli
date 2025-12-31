/**
 * Loom Record Button
 * PRD: Loom Integration for Bug Reporter
 *
 * Button component that triggers Loom SDK recording.
 */

import { useEffect, useRef, useState } from 'react';
import { useLoomSettingsStore } from '../stores/loomSettingsStore';
import { LoomService, type LoomSDKInstance } from '../services/loomService';

interface LoomRecordButtonProps {
  onRecordingComplete: (videoUrl: string) => void;
}

export function LoomRecordButton({ onRecordingComplete }: LoomRecordButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const sdkRef = useRef<LoomSDKInstance | null>(null);

  const {
    recordingStatus,
    setRecordingStatus,
    setLastRecordedUrl,
    setLastError,
    setSDKLoaded,
    isSDKLoaded,
    sdkLoadError,
  } = useLoomSettingsStore();

  const [isInitializing, setIsInitializing] = useState(false);

  // Initialize SDK and configure button
  useEffect(() => {
    let mounted = true;

    const initSDK = async () => {
      if (sdkRef.current || isSDKLoaded) return;
      if (!LoomService.isConfigured() || !LoomService.isSupported()) return;

      setIsInitializing(true);

      try {
        const sdk = await LoomService.initialize();
        sdkRef.current = sdk;

        if (!mounted) return;

        setSDKLoaded(true);

        if (buttonRef.current) {
          sdk.configureButton({
            element: buttonRef.current,
            hooks: {
              onStart: () => {
                if (mounted) setRecordingStatus('starting');
              },
              onRecordingStart: () => {
                if (mounted) setRecordingStatus('recording');
              },
              onCancel: () => {
                if (mounted) setRecordingStatus('idle');
              },
              onComplete: (video) => {
                if (mounted) {
                  setRecordingStatus('complete');
                  setLastRecordedUrl(video.sharedUrl);
                  onRecordingComplete(video.sharedUrl);

                  // Reset status after brief delay
                  setTimeout(() => {
                    if (mounted) setRecordingStatus('idle');
                  }, 2000);
                }
              },
            },
          });
        }
      } catch (error) {
        console.error('[LoomRecordButton] SDK init failed:', error);
        if (mounted) {
          setSDKLoaded(false, error instanceof Error ? error.message : 'SDK initialization failed');
          setLastError('Failed to initialize Loom SDK');
        }
      } finally {
        if (mounted) setIsInitializing(false);
      }
    };

    initSDK();

    return () => {
      mounted = false;
    };
  }, [
    isSDKLoaded,
    onRecordingComplete,
    setLastError,
    setLastRecordedUrl,
    setRecordingStatus,
    setSDKLoaded,
  ]);

  // Determine button state and content
  const getButtonContent = () => {
    if (isInitializing) {
      return (
        <>
          <LoadingSpinner />
          <span>Initializing...</span>
        </>
      );
    }

    if (sdkLoadError) {
      return (
        <>
          <WarningIcon />
          <span>Loom unavailable</span>
        </>
      );
    }

    switch (recordingStatus) {
      case 'starting':
        return (
          <>
            <LoadingSpinner />
            <span>Starting...</span>
          </>
        );
      case 'recording':
        return (
          <>
            <RecordingIndicator />
            <span>Recording...</span>
          </>
        );
      case 'processing':
        return (
          <>
            <LoadingSpinner />
            <span>Processing...</span>
          </>
        );
      case 'complete':
        return (
          <>
            <CheckIcon />
            <span>Recorded!</span>
          </>
        );
      default:
        return (
          <>
            <LoomIcon />
            <span>Record with Loom</span>
          </>
        );
    }
  };

  const isDisabled =
    isInitializing ||
    !!sdkLoadError ||
    recordingStatus === 'starting' ||
    recordingStatus === 'recording' ||
    recordingStatus === 'processing';

  return (
    <button
      ref={buttonRef}
      disabled={isDisabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        width: '100%',
        padding: '12px 16px',
        border: recordingStatus === 'recording' ? '2px solid #ef4444' : '1px solid #d1d5db',
        borderRadius: '8px',
        backgroundColor:
          recordingStatus === 'recording'
            ? '#fef2f2'
            : recordingStatus === 'complete'
              ? '#ecfdf5'
              : '#fff',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        fontSize: '14px',
        fontWeight: 500,
        color:
          recordingStatus === 'recording'
            ? '#dc2626'
            : recordingStatus === 'complete'
              ? '#059669'
              : sdkLoadError
                ? '#9ca3af'
                : '#374151',
        opacity: isDisabled && !sdkLoadError ? 0.7 : 1,
        transition: 'all 0.2s',
      }}
    >
      {getButtonContent()}
    </button>
  );
}

// Icon Components

function LoomIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill="#625DF5" />
      <path d="M12 7L17 10V14L12 17L7 14V10L12 7Z" fill="white" />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ animation: 'spin 1s linear infinite' }}
    >
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" />
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </svg>
  );
}

function RecordingIndicator() {
  return (
    <span
      style={{
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        backgroundColor: '#ef4444',
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
    >
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </span>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}
