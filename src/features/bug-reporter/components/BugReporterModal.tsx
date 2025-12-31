/**
 * Bug Reporter Modal
 * PRD: In-App Bug Reporting - Reporting Flow
 * PRD: Loom Integration for Bug Reporter
 *
 * Clean, simple modal for submitting bug reports with Loom recording support.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useBugReporterStore } from '../stores/bugReporterStore';
import { useLoomSettingsStore } from '../stores/loomSettingsStore';
import { captureScreenshot } from '../utils/screenshotCapture';
import { ElementHighlighter } from './ElementHighlighter';
import { SettingsPanel } from './SettingsPanel';
import { LoomRecordButton } from './LoomRecordButton';
import { LoomService } from '../services/loomService';

// Feature flags - set to false to hide advanced features
const SHOW_VIDEO_SECTION = false;
const SHOW_SETTINGS_BUTTON = false;

export function BugReporterModal() {
  // Use individual selectors for stable references
  const isOpen = useBugReporterStore((s) => s.isOpen);
  const isSubmitting = useBugReporterStore((s) => s.isSubmitting);
  const isElementSelectionActive = useBugReporterStore((s) => s.isElementSelectionActive);
  const selectedElement = useBugReporterStore((s) => s.selectedElement);
  const screenshot = useBugReporterStore((s) => s.screenshot);
  const description = useBugReporterStore((s) => s.description);
  const videoUrl = useBugReporterStore((s) => s.videoUrl);
  const lastSubmissionResult = useBugReporterStore((s) => s.lastSubmissionResult);

  // Loom settings
  const isLoomEnabled = useLoomSettingsStore((s) => s.isEnabled);

  // Actions (these are stable from Zustand)
  const closeReporter = useBugReporterStore((s) => s.closeReporter);
  const setDescription = useBugReporterStore((s) => s.setDescription);
  const setVideoUrl = useBugReporterStore((s) => s.setVideoUrl);
  const startElementSelection = useBugReporterStore((s) => s.startElementSelection);
  const setSelectedElement = useBugReporterStore((s) => s.setSelectedElement);
  const setScreenshot = useBugReporterStore((s) => s.setScreenshot);
  const submitReport = useBugReporterStore((s) => s.submitReport);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasAutoCapture = useRef(false);

  // Settings panel state
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);

  // Take screenshot function - stable callback
  const takeScreenshot = useCallback(async () => {
    setScreenshot(null);
    await new Promise(resolve => setTimeout(resolve, 150));
    try {
      const newScreenshot = await captureScreenshot();
      setScreenshot(newScreenshot);
    } catch (err) {
      console.error('[BugReporter] Screenshot failed:', err);
      setScreenshot(null);
    }
  }, [setScreenshot]);

  // Handle Loom recording completion
  const handleLoomRecordingComplete = useCallback(
    (recordedUrl: string) => {
      setVideoUrl(recordedUrl);
    },
    [setVideoUrl]
  );

  // Clear video URL handler
  const clearVideoUrl = useCallback(() => {
    setVideoUrl('');
  }, [setVideoUrl]);

  // Focus textarea when modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
    // Reset auto-capture flag when modal closes
    if (!isOpen) {
      hasAutoCapture.current = false;
    }
  }, [isOpen]);

  // Note: Screenshot is now captured BEFORE modal opens (in store.openReporter)
  // This ensures we capture the page without the modal overlay

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to close (if not selecting element)
      if (e.key === 'Escape' && !useBugReporterStore.getState().isElementSelectionActive) {
        closeReporter();
      }
      // Ctrl+Enter to submit
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        const state = useBugReporterStore.getState();
        if (state.description.trim() && !state.isSubmitting) {
          submitReport();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeReporter, submitReport]);

  if (!isOpen) return null;

  const canSubmit = description.trim().length > 0 && !isSubmitting;

  return (
    <>
      <ElementHighlighter />

      {/* Backdrop */}
      {!isElementSelectionActive && (
        <div
          data-bug-reporter-ignore
          className="bug-reporter-overlay"
          onClick={closeReporter}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 9998,
          }}
        />
      )}

      {/* Modal */}
      {!isElementSelectionActive && (
        <div
          data-bug-reporter-ignore
          className="bug-reporter-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bug-modal-title"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '100%',
            maxWidth: '460px',
            maxHeight: '90vh',
            margin: '0 16px',
            backgroundColor: '#fff',
            borderRadius: '12px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <h2 id="bug-modal-title" style={{
              margin: 0,
              fontSize: '17px',
              fontWeight: 600,
              color: '#111827'
            }}>
              Report a Bug
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Settings gear button (hidden via feature flag) */}
              {SHOW_SETTINGS_BUTTON && (
                <button
                  onClick={() => setIsSettingsPanelOpen(true)}
                  aria-label="Open settings"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '6px',
                    margin: '-6px',
                    borderRadius: '6px',
                    color: '#9ca3af',
                    display: 'flex',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button>
              )}
              {/* Close button */}
              <button
                onClick={closeReporter}
                aria-label="Close"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '6px',
                  margin: '-6px',
                  borderRadius: '6px',
                  color: '#9ca3af',
                  display: 'flex',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
            {/* Success/Error Messages */}
            {lastSubmissionResult?.success && (
              <div style={{
                padding: '12px',
                backgroundColor: '#ecfdf5',
                borderRadius: '8px',
                marginBottom: '16px',
                color: '#065f46',
                fontSize: '14px',
              }}>
                ✓ Bug report submitted. Thank you!
              </div>
            )}
            {lastSubmissionResult?.error && (
              <div style={{
                padding: '12px',
                backgroundColor: '#fef2f2',
                borderRadius: '8px',
                marginBottom: '16px',
                color: '#991b1b',
                fontSize: '14px',
              }}>
                {lastSubmissionResult.error}
              </div>
            )}

            {/* Description */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#374151'
              }}>
                What happened? <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <textarea
                ref={textareaRef}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue..."
                style={{
                  width: '100%',
                  minHeight: '100px',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  backgroundColor: '#fff',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Screenshot */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px'
              }}>
                <label style={{ fontSize: '14px', fontWeight: 500, color: '#374151' }}>
                  Screenshot
                </label>
                {screenshot && (
                  <button
                    onClick={takeScreenshot}
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: '#3b82f6',
                      padding: 0,
                    }}
                  >
                    Retake
                  </button>
                )}
              </div>
              <div style={{
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                overflow: 'hidden',
                backgroundColor: '#f9fafb',
              }}>
                {screenshot ? (
                  <img
                    src={screenshot}
                    alt="Screenshot"
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                  />
                ) : (
                  <div style={{
                    padding: '24px',
                    textAlign: 'center',
                    color: '#9ca3af',
                    fontSize: '14px',
                  }}>
                    Capturing...
                  </div>
                )}
              </div>
            </div>

            {/* Optional: Element Selection */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#374151'
              }}>
                Highlight an element <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span>
              </label>
              {selectedElement ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                }}>
                  <code style={{ fontSize: '12px', color: '#374151' }}>
                    &lt;{selectedElement.tagName.toLowerCase()}&gt;
                  </code>
                  <button
                    onClick={() => setSelectedElement(null)}
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#9ca3af',
                      padding: '2px',
                      display: 'flex',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={startElementSelection}
                  type="button"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px dashed #d1d5db',
                    borderRadius: '8px',
                    backgroundColor: '#fff',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: '#6b7280',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h6v6h-6z" />
                  </svg>
                  Click to select
                </button>
              )}
            </div>

            {/* Video Section (hidden via feature flag) */}
            {SHOW_VIDEO_SECTION && (
            <div>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#374151'
              }}>
                Video <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span>
              </label>

              {/* Show video preview if we have a URL */}
              {videoUrl ? (
                <div style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  backgroundColor: '#f9fafb',
                }}>
                  {/* Video preview header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderBottom: '1px solid #e5e7eb',
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flex: 1,
                      minWidth: 0,
                    }}>
                      {LoomService.isLoomUrl(videoUrl) && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <rect width="24" height="24" rx="6" fill="#625DF5" />
                          <path d="M12 7L17 10V14L12 17L7 14V10L12 7Z" fill="white" />
                        </svg>
                      )}
                      <a
                        href={videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: '13px',
                          color: '#3b82f6',
                          textDecoration: 'none',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {videoUrl}
                      </a>
                    </div>
                    <button
                      onClick={clearVideoUrl}
                      type="button"
                      aria-label="Remove video"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#9ca3af',
                        padding: '4px',
                        display: 'flex',
                        flexShrink: 0,
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Loom embed preview (if it's a Loom URL) */}
                  {LoomService.isLoomUrl(videoUrl) && (
                    <div style={{ position: 'relative', paddingTop: '56.25%' }}>
                      <iframe
                        src={LoomService.getEmbedUrl(videoUrl) || ''}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          border: 'none',
                        }}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Loom Record Button (if enabled) */}
                  {isLoomEnabled && LoomService.isConfigured() && (
                    <LoomRecordButton onRecordingComplete={handleLoomRecordingComplete} />
                  )}

                  {/* Divider with "or" (if Loom is enabled) */}
                  {isLoomEnabled && LoomService.isConfigured() && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      color: '#9ca3af',
                      fontSize: '12px',
                    }}>
                      <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }} />
                      <span>or paste a link</span>
                      <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }} />
                    </div>
                  )}

                  {/* Manual URL input */}
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="Paste Loom or YouTube URL"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: '#fff',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}
            </div>
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
          }}>
            <button
              onClick={closeReporter}
              disabled={isSubmitting}
              type="button"
              style={{
                padding: '10px 18px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                backgroundColor: '#fff',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                color: '#374151',
                opacity: isSubmitting ? 0.5 : 1,
              }}
            >
              Cancel
            </button>
            <button
              onClick={submitReport}
              disabled={!canSubmit}
              type="button"
              style={{
                padding: '10px 24px',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: canSubmit ? '#3b82f6' : '#94a3b8',
                color: '#fff',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </div>
      )}

      {/* Settings Panel (hidden via feature flag) */}
      {SHOW_SETTINGS_BUTTON && (
        <SettingsPanel
          isOpen={isSettingsPanelOpen}
          onClose={() => setIsSettingsPanelOpen(false)}
        />
      )}
    </>
  );
}
