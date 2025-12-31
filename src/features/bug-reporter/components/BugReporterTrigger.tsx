/**
 * Bug Reporter Trigger Button
 * PRD: In-App Bug Reporting - Activation
 *
 * A button to trigger the bug reporter modal.
 * Designed to sit in the header next to the Help button.
 */

import React from 'react';
import { useBugReporter } from '../hooks/useBugReporter';

export interface BugReporterTriggerProps {
  className?: string;
  variant?: 'default' | 'compact';
}

export function BugReporterTrigger({
  className = '',
  variant = 'default',
}: BugReporterTriggerProps) {
  const { open, isOpen } = useBugReporter();

  // Bug icon SVG
  const BugIcon = () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Bug body */}
      <rect x="8" y="6" width="8" height="14" rx="4" />
      {/* Bug head */}
      <path d="M12 6V2" />
      <path d="M9 2h6" />
      {/* Bug legs */}
      <path d="M4 10h4" />
      <path d="M4 14h4" />
      <path d="M16 10h4" />
      <path d="M16 14h4" />
      {/* Antennae */}
      <path d="M9 6l-2-2" />
      <path d="M15 6l2-2" />
    </svg>
  );

  const baseStyles = [
    'flex items-center gap-2 rounded-lg text-sm font-medium transition-colors',
    isOpen
      ? 'bg-orange-500 text-white'
      : 'text-muted-foreground hover:text-foreground hover:bg-muted',
  ].join(' ');

  const sizeStyles =
    variant === 'compact' ? 'p-2' : 'px-3 py-1.5';

  return (
    <button
      onClick={open}
      className={`${baseStyles} ${sizeStyles} ${className}`}
      title="Report a Bug (Ctrl+Shift+B)"
      aria-label="Report a Bug"
    >
      <BugIcon />
      {variant !== 'compact' && (
        <span className="hidden sm:inline">Report Bug</span>
      )}
    </button>
  );
}

/**
 * Compact variant for mobile/narrow spaces
 */
export function BugReporterTriggerCompact({ className = '' }: { className?: string }) {
  return <BugReporterTrigger variant="compact" className={className} />;
}
