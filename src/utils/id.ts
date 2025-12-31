import crypto from 'crypto';

export type IdPrefix = 'mem' | 'cmt' | 'op';

/**
 * Generate a unique ID with the given prefix.
 * Format: {prefix}_{8-char-hex}
 */
export function generateId(prefix: IdPrefix): string {
  const hex = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  return `${prefix}_${hex}`;
}

/**
 * Extract the prefix from an ID.
 */
export function getIdPrefix(id: string): IdPrefix | null {
  const match = id.match(/^(mem|cmt|op)_/);
  return match ? (match[1] as IdPrefix) : null;
}

/**
 * Validate ID format.
 */
export function isValidId(id: string): boolean {
  return /^(mem|cmt|op)_[a-f0-9]{8}$/.test(id);
}

/**
 * Generate a secure API key.
 * Format: mentu_key_{32-char-hex}
 */
export function generateApiKey(): string {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}
