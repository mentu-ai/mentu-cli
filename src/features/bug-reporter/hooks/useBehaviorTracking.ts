/**
 * Behavior Tracking Hook
 * PRD: In-App Bug Reporting - User Behavior Trace
 *
 * Tracks user interactions using event delegation.
 * Captures: clicks, navigation, form interactions, scroll positions
 * Does NOT capture sensitive field values (passwords, etc.)
 */

import { useEffect, useRef } from 'react';
import type { BehaviorEvent, CaptureBufferConfig } from '../types/bugReport.types';

// Rolling buffer for behavior events
let behaviorBuffer: BehaviorEvent[] = [];
let isInitialized = false;

// Default configuration
const DEFAULT_CONFIG: Pick<CaptureBufferConfig, 'maxBehaviorEvents' | 'behaviorRetentionMs'> = {
  maxBehaviorEvents: 50,
  behaviorRetentionMs: 5 * 60 * 1000, // 5 minutes
};

let config = { ...DEFAULT_CONFIG };

// Sensitive field types that should never have values captured
const SENSITIVE_FIELD_TYPES = [
  'password',
  'credit-card',
  'cc-number',
  'cc-exp',
  'cc-csc',
  'ssn',
];

// Sensitive field patterns (checked against name and id)
const SENSITIVE_FIELD_PATTERNS = [
  /password/i,
  /passwd/i,
  /secret/i,
  /credit/i,
  /card/i,
  /cvv/i,
  /cvc/i,
  /ssn/i,
  /social/i,
  /token/i,
  /auth/i,
  /api.?key/i,
];

/**
 * Check if an element is a sensitive field
 */
function isSensitiveField(element: HTMLElement): boolean {
  if (!(element instanceof HTMLInputElement)) return false;

  // Check type
  if (SENSITIVE_FIELD_TYPES.includes(element.type)) return true;

  // Check autocomplete
  const autocomplete = element.autocomplete?.toLowerCase() || '';
  if (SENSITIVE_FIELD_TYPES.some((t) => autocomplete.includes(t))) return true;

  // Check name and id patterns
  const name = element.name || '';
  const id = element.id || '';
  return SENSITIVE_FIELD_PATTERNS.some(
    (pattern) => pattern.test(name) || pattern.test(id)
  );
}

/**
 * Generate a CSS selector for an element
 */
function getSelector(element: Element): string {
  if (element.id) {
    return `#${element.id}`;
  }

  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    // Add id if available
    if (current.id) {
      selector = `#${current.id}`;
      parts.unshift(selector);
      break;
    }

    // Add class names (first meaningful class)
    const className = current.className;
    if (typeof className === 'string' && className.trim()) {
      const firstClass = className.split(' ')[0];
      if (firstClass && !firstClass.startsWith('__')) {
        selector += `.${firstClass}`;
      }
    }

    // Add nth-child if needed for specificity
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (c) => c.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-child(${index})`;
      }
    }

    parts.unshift(selector);
    current = current.parentElement;
  }

  return parts.join(' > ');
}

/**
 * Extract target info from an element
 */
function getTargetInfo(element: Element): BehaviorEvent['target'] {
  const htmlElement = element as HTMLElement;
  return {
    selector: getSelector(element),
    tagName: element.tagName.toLowerCase(),
    id: element.id || undefined,
    className: element.className && typeof element.className === 'string'
      ? element.className.split(' ')[0] || undefined
      : undefined,
    text: htmlElement.textContent?.slice(0, 50) || undefined,
    name: (element as HTMLInputElement).name || undefined,
    type: (element as HTMLInputElement).type || undefined,
  };
}

/**
 * Add event to buffer
 */
function addToBuffer(event: BehaviorEvent): void {
  const now = Date.now();

  // Remove events older than retention period
  behaviorBuffer = behaviorBuffer.filter(
    (e) => now - e.timestamp < config.behaviorRetentionMs
  );

  // Add new event
  behaviorBuffer.push(event);

  // Trim to max size
  if (behaviorBuffer.length > config.maxBehaviorEvents) {
    behaviorBuffer = behaviorBuffer.slice(-config.maxBehaviorEvents);
  }
}

/**
 * Handle click events
 */
function handleClick(e: MouseEvent): void {
  const target = e.target as Element;
  if (!target || !target.tagName) return;

  addToBuffer({
    timestamp: Date.now(),
    type: 'click',
    target: getTargetInfo(target),
  });
}

/**
 * Handle input/change events (form interactions)
 */
function handleInput(e: Event): void {
  const target = e.target as HTMLElement;
  if (!target || !target.tagName) return;

  // Don't track events on sensitive fields
  if (isSensitiveField(target)) return;

  addToBuffer({
    timestamp: Date.now(),
    type: e.type as 'input' | 'change',
    target: getTargetInfo(target),
    metadata: {
      inputType: (target as HTMLInputElement).type,
      // Note: We do NOT capture the actual value
    },
  });
}

/**
 * Handle focus/blur events
 */
function handleFocus(e: FocusEvent): void {
  const target = e.target as Element;
  if (!target || !target.tagName) return;

  addToBuffer({
    timestamp: Date.now(),
    type: e.type as 'focus' | 'blur',
    target: getTargetInfo(target),
  });
}

// Track navigation state
let lastUrl = '';

/**
 * Handle navigation events
 */
function handleNavigation(): void {
  const currentUrl = window.location.href;
  if (currentUrl === lastUrl) return;

  lastUrl = currentUrl;

  addToBuffer({
    timestamp: Date.now(),
    type: 'navigation',
    target: {
      selector: 'window',
      tagName: 'window',
    },
    metadata: {
      url: currentUrl,
    },
  });
}

// Scroll throttle
let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
const SCROLL_THROTTLE_MS = 500;

/**
 * Handle scroll events (throttled)
 */
function handleScroll(): void {
  if (scrollTimeout) return;

  scrollTimeout = setTimeout(() => {
    addToBuffer({
      timestamp: Date.now(),
      type: 'scroll',
      target: {
        selector: 'window',
        tagName: 'window',
      },
      metadata: {
        scrollPosition: {
          x: window.scrollX,
          y: window.scrollY,
        },
      },
    });
    scrollTimeout = null;
  }, SCROLL_THROTTLE_MS);
}

/**
 * Wrap History API methods for SPA navigation tracking
 */
function wrapHistoryMethods(): void {
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    handleNavigation();
  };

  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    handleNavigation();
  };
}

/**
 * Initialize behavior tracking
 */
function initializeBehaviorTracking(): void {
  if (isInitialized) return;

  // Initialize last URL
  lastUrl = window.location.href;

  // Event listeners with delegation
  document.addEventListener('click', handleClick, { capture: true, passive: true });
  document.addEventListener('input', handleInput, { capture: true, passive: true });
  document.addEventListener('change', handleInput, { capture: true, passive: true });
  document.addEventListener('focusin', handleFocus, { capture: true, passive: true });
  document.addEventListener('focusout', handleFocus, { capture: true, passive: true });
  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('popstate', handleNavigation);

  // Wrap History API for SPA navigation
  wrapHistoryMethods();

  isInitialized = true;

  // Log initial navigation
  handleNavigation();

  console.debug('[BugReporter] Behavior tracking initialized');
}

/**
 * Cleanup behavior tracking
 */
function cleanupBehaviorTracking(): void {
  if (!isInitialized) return;

  document.removeEventListener('click', handleClick, { capture: true });
  document.removeEventListener('input', handleInput, { capture: true });
  document.removeEventListener('change', handleInput, { capture: true });
  document.removeEventListener('focusin', handleFocus, { capture: true });
  document.removeEventListener('focusout', handleFocus, { capture: true });
  window.removeEventListener('scroll', handleScroll);
  window.removeEventListener('popstate', handleNavigation);

  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
    scrollTimeout = null;
  }

  isInitialized = false;
}

/**
 * Get captured behavior events
 */
export function getBehaviorEvents(): BehaviorEvent[] {
  const now = Date.now();
  return behaviorBuffer.filter(
    (e) => now - e.timestamp < config.behaviorRetentionMs
  );
}

/**
 * Clear captured behavior events
 */
export function clearBehaviorEvents(): void {
  behaviorBuffer = [];
}

/**
 * Configure behavior tracking
 */
export function configureBehaviorTracking(
  newConfig: Partial<Pick<CaptureBufferConfig, 'maxBehaviorEvents' | 'behaviorRetentionMs'>>
): void {
  config = { ...config, ...newConfig };
}

/**
 * React hook for behavior tracking
 * Should be used once at the app root level
 */
export function useBehaviorTracking(
  options: Partial<Pick<CaptureBufferConfig, 'maxBehaviorEvents' | 'behaviorRetentionMs'>> = {}
): void {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;

    // Apply configuration
    if (options.maxBehaviorEvents !== undefined) {
      config.maxBehaviorEvents = options.maxBehaviorEvents;
    }
    if (options.behaviorRetentionMs !== undefined) {
      config.behaviorRetentionMs = options.behaviorRetentionMs;
    }

    // Initialize tracking
    initializeBehaviorTracking();
    initializedRef.current = true;

    return () => {
      // Note: We typically don't cleanup in production
      // cleanupBehaviorTracking();
    };
  }, [options.maxBehaviorEvents, options.behaviorRetentionMs]);
}

// Export for direct initialization (non-React contexts)
export { initializeBehaviorTracking, cleanupBehaviorTracking };
