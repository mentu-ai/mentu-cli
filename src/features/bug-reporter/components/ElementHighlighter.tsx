/**
 * Element Highlighter Overlay
 * PRD: In-App Bug Reporting - Element Selection
 *
 * An overlay that allows users to select UI elements.
 * Shows visual feedback as user hovers over elements.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useBugReporterStore } from '../stores/bugReporterStore';
import {
  getMeaningfulElementAtPoint,
  shouldIgnoreElement,
  createSelectedElement,
} from '../utils/elementSelector';

export function ElementHighlighter() {
  // Access store directly to avoid hook reference changes
  const isElementSelectionActive = useBugReporterStore((s) => s.isElementSelectionActive);
  const setSelectedElement = useBugReporterStore((s) => s.setSelectedElement);
  const stopElementSelection = useBugReporterStore((s) => s.stopElementSelection);

  const [hoveredElement, setHoveredElement] = useState<Element | null>(null);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Handle mouse move to track hovered element
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const element = getMeaningfulElementAtPoint(e.clientX, e.clientY);

    if (element && !shouldIgnoreElement(element)) {
      setHoveredElement(element);
      setHighlightRect(element.getBoundingClientRect());
    } else {
      setHoveredElement(null);
      setHighlightRect(null);
    }
  }, []);

  // Handle click to select element
  // Use the already-hovered element for more reliable selection
  const handleClick = useCallback((e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Prefer the already-hovered element (what user sees highlighted)
    // Fall back to computing at click position if needed
    const element = hoveredElement || getMeaningfulElementAtPoint(e.clientX, e.clientY);

    if (element && !shouldIgnoreElement(element)) {
      const selected = createSelectedElement(element);
      setSelectedElement(selected);
    } else {
      // If no valid element, just stop selection mode
      stopElementSelection();
    }
  }, [hoveredElement, setSelectedElement, stopElementSelection]);

  // Handle escape to cancel
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      stopElementSelection();
    }
  }, [stopElementSelection]);

  // Set up event listeners when element selection is active
  useEffect(() => {
    if (!isElementSelectionActive) {
      setHoveredElement(null);
      setHighlightRect(null);
      return;
    }

    document.addEventListener('mousemove', handleMouseMove, { capture: true });
    document.addEventListener('click', handleClick, { capture: true });
    document.addEventListener('keydown', handleKeyDown);

    // Prevent scrolling during selection
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, { capture: true });
      document.removeEventListener('click', handleClick, { capture: true });
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isElementSelectionActive, handleMouseMove, handleClick, handleKeyDown]);

  if (!isElementSelectionActive) {
    return null;
  }

  return (
    <div
      ref={overlayRef}
      className="bug-reporter-overlay"
      data-bug-reporter-ignore
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999998,
        cursor: 'crosshair',
      }}
    >
      {/* Semi-transparent overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.1)',
          pointerEvents: 'none',
        }}
      />

      {/* Highlight box */}
      {highlightRect && (
        <div
          style={{
            position: 'fixed',
            top: highlightRect.top,
            left: highlightRect.left,
            width: highlightRect.width,
            height: highlightRect.height,
            border: '2px solid #3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            borderRadius: '4px',
            pointerEvents: 'none',
            transition: 'all 0.1s ease',
          }}
        />
      )}

      {/* Element info tooltip */}
      {highlightRect && hoveredElement && (
        <div
          style={{
            position: 'fixed',
            top: Math.max(8, highlightRect.top - 32),
            left: Math.max(8, highlightRect.left),
            backgroundColor: '#1e293b',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'monospace',
            maxWidth: '300px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 999999,
          }}
        >
          &lt;{hoveredElement.tagName.toLowerCase()}
          {hoveredElement.id ? `#${hoveredElement.id}` : ''}
          {hoveredElement.className && typeof hoveredElement.className === 'string'
            ? `.${hoveredElement.className.split(' ')[0]}`
            : ''}
          &gt;
        </div>
      )}

      {/* Instructions banner */}
      <div
        style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#1e293b',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '8px',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          zIndex: 999999,
        }}
      >
        <span>Click an element to select it, or press</span>
        <kbd
          style={{
            backgroundColor: '#374151',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '12px',
          }}
        >
          Esc
        </kbd>
        <span>to cancel</span>
      </div>
    </div>
  );
}
