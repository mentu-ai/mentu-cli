/**
 * Generate an ISO 8601 UTC timestamp.
 */
export function timestamp(): string {
  return new Date().toISOString();
}

/**
 * Parse an ISO 8601 timestamp.
 */
export function parseTimestamp(ts: string): Date {
  return new Date(ts);
}

/**
 * Format a timestamp for display.
 */
export function formatTimestamp(ts: string): string {
  const date = new Date(ts);
  return date.toLocaleString();
}
