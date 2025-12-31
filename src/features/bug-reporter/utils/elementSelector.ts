/**
 * Element Selector Utility
 * PRD: In-App Bug Reporting - Element Selection
 *
 * Provides functionality for users to select UI elements
 * to tag as related to their bug report.
 */

import type { SelectedElement } from '../types/bugReport.types';

/**
 * Generate a stable CSS selector for an element
 */
export function generateSelector(element: Element): string {
  // If element has a unique ID, use it
  if (element.id) {
    return `#${element.id}`;
  }

  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();

    // Add id if available
    if (current.id) {
      selector = `#${current.id}`;
      parts.unshift(selector);
      break;
    }

    // Add meaningful classes (skip utility classes that might change)
    const classList = Array.from(current.classList);
    const meaningfulClass = classList.find(
      (cls) =>
        !cls.startsWith('_') &&
        !cls.startsWith('css-') &&
        !cls.startsWith('sc-') &&
        !cls.match(/^[a-z]{1,2}-/) && // Skip single-letter prefixed utility classes
        cls.length > 2
    );

    if (meaningfulClass) {
      selector += `.${meaningfulClass}`;
    }

    // Add nth-child for specificity if needed
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children);
      const sameTagSiblings = siblings.filter((s) => s.tagName === current!.tagName);
      if (sameTagSiblings.length > 1) {
        const index = sameTagSiblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    parts.unshift(selector);
    current = current.parentElement;
  }

  return parts.join(' > ');
}

/**
 * Extract relevant attributes from an element
 */
export function extractAttributes(element: Element): Record<string, string> {
  const attrs: Record<string, string> = {};
  const relevantAttrs = [
    'id',
    'class',
    'name',
    'type',
    'href',
    'src',
    'alt',
    'title',
    'placeholder',
    'aria-label',
    'aria-describedby',
    'data-testid',
    'data-id',
    'role',
  ];

  for (const attr of relevantAttrs) {
    const value = element.getAttribute(attr);
    if (value) {
      attrs[attr] = value;
    }
  }

  // Also capture any data-* attributes
  for (const attr of Array.from(element.attributes)) {
    if (attr.name.startsWith('data-') && !attrs[attr.name]) {
      attrs[attr.name] = attr.value;
    }
  }

  return attrs;
}

/**
 * Get text content of an element (truncated)
 */
export function getElementText(element: Element, maxLength = 100): string {
  const text = element.textContent?.trim() || '';
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + '...';
}

/**
 * Create a SelectedElement object from a DOM element
 */
export function createSelectedElement(element: Element): SelectedElement {
  const rect = element.getBoundingClientRect();

  return {
    selector: generateSelector(element),
    tagName: element.tagName.toLowerCase(),
    id: element.id || undefined,
    className:
      element.className && typeof element.className === 'string'
        ? element.className
        : undefined,
    text: getElementText(element),
    attributes: extractAttributes(element),
    boundingRect: {
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      height: rect.height,
    },
  };
}

/**
 * Highlight an element with a visual overlay
 */
export function highlightElement(element: Element): () => void {
  const rect = element.getBoundingClientRect();

  // Create highlight overlay
  const overlay = document.createElement('div');
  overlay.className = 'bug-reporter-element-highlight';
  overlay.style.cssText = `
    position: fixed;
    top: ${rect.top}px;
    left: ${rect.left}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    border: 2px solid #3b82f6;
    background: rgba(59, 130, 246, 0.1);
    pointer-events: none;
    z-index: 999999;
    border-radius: 4px;
    transition: all 0.15s ease;
  `;

  document.body.appendChild(overlay);

  // Return cleanup function
  return () => {
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  };
}

/**
 * Get the most meaningful element at a point
 * (Skips over wrapper divs to find actual interactive elements)
 */
export function getMeaningfulElementAtPoint(x: number, y: number): Element | null {
  const allElements = document.elementsFromPoint(x, y);

  // IMPORTANT: Filter out bug reporter overlay elements FIRST
  // This prevents selecting the overlay, highlight box, or tooltip
  const elements = allElements.filter((el) => !shouldIgnoreElement(el));

  // Priority list of element types (most meaningful first)
  const priorityTags = [
    'button',
    'a',
    'input',
    'select',
    'textarea',
    'img',
    'video',
    'audio',
    'canvas',
    'table',
    'form',
    'label',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p',
    'li',
    'td',
    'th',
  ];

  // First, look for priority elements
  for (const tag of priorityTags) {
    const match = elements.find((el) => el.tagName.toLowerCase() === tag);
    if (match) {
      return match;
    }
  }

  // Look for elements with role attribute
  const roleElement = elements.find(
    (el) => el.hasAttribute('role') && el.getAttribute('role') !== 'presentation'
  );
  if (roleElement) {
    return roleElement;
  }

  // Look for elements with data-testid (likely important)
  const testIdElement = elements.find((el) => el.hasAttribute('data-testid'));
  if (testIdElement) {
    return testIdElement;
  }

  // Look for clickable elements
  const clickable = elements.find((el) => {
    const style = window.getComputedStyle(el);
    return style.cursor === 'pointer';
  });
  if (clickable) {
    return clickable;
  }

  // Return first non-body, non-html element with content
  return elements.find(
    (el) =>
      el !== document.body &&
      el !== document.documentElement &&
      el.textContent?.trim()
  ) || elements[0] || null;
}

/**
 * Check if an element should be ignored for selection
 */
export function shouldIgnoreElement(element: Element): boolean {
  // Ignore the bug reporter's own UI
  if (element.closest('.bug-reporter-modal')) return true;
  if (element.closest('.bug-reporter-overlay')) return true;
  if (element.closest('[data-bug-reporter-ignore]')) return true;

  // Ignore script, style, and meta elements
  const ignoredTags = ['script', 'style', 'link', 'meta', 'noscript'];
  if (ignoredTags.includes(element.tagName.toLowerCase())) return true;

  return false;
}
