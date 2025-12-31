/**
 * Settings Panel
 * PRD: Loom Integration for Bug Reporter
 *
 * Slide-out panel for bug reporter settings including Loom toggle.
 */

import { useEffect, useState } from 'react';
import { useLoomSettingsStore } from '../stores/loomSettingsStore';
import { LoomService } from '../services/loomService';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { isEnabled, setEnabled, isExtensionDetected, setExtensionDetected } =
    useLoomSettingsStore();
  const [isLoomConfigured] = useState(() => LoomService.isConfigured());
  const [isLoomSupported] = useState(() => LoomService.isSupported());

  // Check for Loom extension on mount
  useEffect(() => {
    if (isOpen && isExtensionDetected === null) {
      LoomService.checkExtensionInstalled().then(setExtensionDetected);
    }
  }, [isOpen, isExtensionDetected, setExtensionDetected]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const canEnableLoom = isLoomConfigured && isLoomSupported;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          zIndex: 10000,
        }}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Bug reporter settings"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '320px',
          height: '100%',
          backgroundColor: '#fff',
          boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.15)',
          zIndex: 10001,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideIn 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 600,
              color: '#111827',
            }}
          >
            Settings
          </h3>
          <button
            onClick={onClose}
            aria-label="Close settings"
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
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
          {/* Loom Integration Section */}
          <div style={{ marginBottom: '24px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '16px',
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '4px',
                  }}
                >
                  {/* Loom Logo */}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <rect width="24" height="24" rx="6" fill="#625DF5" />
                    <path
                      d="M12 7L17 10V14L12 17L7 14V10L12 7Z"
                      fill="white"
                    />
                  </svg>
                  <span
                    style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: '#374151',
                    }}
                  >
                    Loom Recording
                  </span>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: '13px',
                    color: '#6b7280',
                    lineHeight: '1.4',
                  }}
                >
                  Record your screen directly in the bug reporter
                </p>
              </div>

              {/* Toggle Switch */}
              <button
                onClick={() => canEnableLoom && setEnabled(!isEnabled)}
                disabled={!canEnableLoom}
                aria-pressed={isEnabled}
                aria-label={`Loom recording ${isEnabled ? 'enabled' : 'disabled'}`}
                style={{
                  width: '44px',
                  height: '24px',
                  borderRadius: '12px',
                  border: 'none',
                  padding: '2px',
                  cursor: canEnableLoom ? 'pointer' : 'not-allowed',
                  backgroundColor: isEnabled ? '#3b82f6' : '#d1d5db',
                  opacity: canEnableLoom ? 1 : 0.5,
                  transition: 'background-color 0.2s',
                  position: 'relative',
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    display: 'block',
                    width: '20px',
                    height: '20px',
                    borderRadius: '10px',
                    backgroundColor: '#fff',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
                    transform: isEnabled ? 'translateX(20px)' : 'translateX(0)',
                    transition: 'transform 0.2s',
                  }}
                />
              </button>
            </div>

            {/* Status messages */}
            {!isLoomConfigured && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '10px 12px',
                  backgroundColor: '#fef3c7',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#92400e',
                }}
              >
                Loom is not configured. Contact your administrator.
              </div>
            )}

            {isLoomConfigured && !isLoomSupported && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '10px 12px',
                  backgroundColor: '#fef2f2',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#991b1b',
                }}
              >
                Loom is not supported in this browser.
              </div>
            )}

            {isEnabled && isExtensionDetected === false && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '10px 12px',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#374151',
                }}
              >
                <span>For best experience, install the Loom extension. </span>
                <button
                  onClick={() => LoomService.openExtensionStore()}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: '#3b82f6',
                    cursor: 'pointer',
                    fontSize: 'inherit',
                    textDecoration: 'underline',
                  }}
                >
                  Install now
                </button>
              </div>
            )}
          </div>

          {/* Divider */}
          <div
            style={{
              height: '1px',
              backgroundColor: '#e5e7eb',
              margin: '0 -24px 24px',
            }}
          />

          {/* Keyboard Shortcuts */}
          <div>
            <h4
              style={{
                margin: '0 0 12px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Keyboard Shortcuts
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <ShortcutRow keys={['Ctrl', '.']} description="Open bug reporter" />
              <ShortcutRow keys={['Ctrl', 'Enter']} description="Submit report" />
              <ShortcutRow keys={['Esc']} description="Close / Cancel" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #e5e7eb',
            fontSize: '12px',
            color: '#9ca3af',
          }}
        >
          Settings are saved automatically
        </div>
      </div>

      {/* Inline keyframes */}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
}

function ShortcutRow({
  keys,
  description,
}: {
  keys: string[];
  description: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <span style={{ fontSize: '13px', color: '#6b7280' }}>{description}</span>
      <div style={{ display: 'flex', gap: '4px' }}>
        {keys.map((key, i) => (
          <kbd
            key={i}
            style={{
              padding: '2px 6px',
              backgroundColor: '#f3f4f6',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 500,
              color: '#374151',
              border: '1px solid #e5e7eb',
              fontFamily: 'inherit',
            }}
          >
            {key}
          </kbd>
        ))}
      </div>
    </div>
  );
}
