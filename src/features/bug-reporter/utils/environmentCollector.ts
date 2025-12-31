/**
 * Environment Collector Utility
 * PRD: In-App Bug Reporting - Environment Metadata
 *
 * Collects browser, OS, and viewport information.
 */

import type { EnvironmentMetadata } from '../types/bugReport.types';

/**
 * Parse user agent to extract browser info
 */
function parseBrowser(userAgent: string): { name: string; version: string } {
  const browsers = [
    { name: 'Chrome', regex: /Chrome\/(\d+\.\d+)/ },
    { name: 'Firefox', regex: /Firefox\/(\d+\.\d+)/ },
    { name: 'Safari', regex: /Version\/(\d+\.\d+).*Safari/ },
    { name: 'Edge', regex: /Edg\/(\d+\.\d+)/ },
    { name: 'Opera', regex: /OPR\/(\d+\.\d+)/ },
    { name: 'IE', regex: /MSIE (\d+\.\d+)/ },
  ];

  for (const browser of browsers) {
    const match = userAgent.match(browser.regex);
    if (match) {
      return { name: browser.name, version: match[1] };
    }
  }

  return { name: 'Unknown', version: 'Unknown' };
}

/**
 * Parse user agent to extract OS info
 */
function parseOS(userAgent: string): { name: string; version?: string } {
  const operatingSystems = [
    { name: 'Windows', regex: /Windows NT (\d+\.\d+)/, versionMap: {
      '10.0': '10/11',
      '6.3': '8.1',
      '6.2': '8',
      '6.1': '7',
    } },
    { name: 'macOS', regex: /Mac OS X (\d+[._]\d+)/ },
    { name: 'iOS', regex: /iPhone OS (\d+_\d+)/ },
    { name: 'Android', regex: /Android (\d+\.\d+)/ },
    { name: 'Linux', regex: /Linux/ },
    { name: 'Chrome OS', regex: /CrOS/ },
  ];

  for (const os of operatingSystems) {
    const match = userAgent.match(os.regex);
    if (match) {
      let version = match[1]?.replace(/_/g, '.');
      if (os.name === 'Windows' && os.versionMap && version) {
        version = os.versionMap[version] || version;
      }
      return { name: os.name, version };
    }
  }

  return { name: 'Unknown' };
}

/**
 * Get the current route/path
 * Works with both hash-based and history-based routing
 */
function getCurrentRoute(): string {
  const hash = window.location.hash;
  if (hash && hash.startsWith('#/')) {
    return hash.substring(1); // Remove the # from hash routes
  }
  return window.location.pathname;
}

/**
 * Collect all environment metadata
 */
export function collectEnvironmentMetadata(): EnvironmentMetadata {
  const userAgent = navigator.userAgent;

  return {
    userAgent,
    browser: parseBrowser(userAgent),
    os: parseOS(userAgent),
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    url: window.location.href,
    route: getCurrentRoute(),
    timestamp: Date.now(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language || 'en-US',
    screenResolution: {
      width: window.screen.width,
      height: window.screen.height,
    },
  };
}

/**
 * Get a formatted environment summary for display
 */
export function formatEnvironmentSummary(env: EnvironmentMetadata): string {
  const lines = [
    `Browser: ${env.browser.name} ${env.browser.version}`,
    `OS: ${env.os.name}${env.os.version ? ` ${env.os.version}` : ''}`,
    `Viewport: ${env.viewport.width}x${env.viewport.height}`,
    `URL: ${env.url}`,
    `Time: ${new Date(env.timestamp).toISOString()}`,
    `Timezone: ${env.timezone}`,
  ];

  return lines.join('\n');
}
