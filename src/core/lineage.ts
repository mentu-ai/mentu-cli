/**
 * Lineage utilities for compact, traceable ledger entries.
 *
 * Key features:
 * - Body compaction (≤80 chars)
 * - Source key for deduplication
 * - Duplicate detection
 */

import * as crypto from 'crypto';
import type { Operation } from '../types.js';

/**
 * Maximum body length for compact entries.
 */
export const MAX_BODY_LENGTH = 80;

/**
 * Compact a verbose body string to ≤80 characters.
 *
 * Strips timestamps like "[20:00:45] " and command prefixes like "Ran: mentu ".
 * Truncates with ellipsis if still too long.
 *
 * @param verbose - The original verbose body text
 * @param maxLen - Maximum length (default: 80)
 * @returns Compacted body string
 *
 * @example
 * compactBody("[20:00:45] Ran: mentu submit cmt_xxx --summary \"Very long...\"")
 * // Returns: "submit cmt_xxx --summary \"Very long...\""
 */
export function compactBody(verbose: string, maxLen: number = MAX_BODY_LENGTH): string {
  // Strip timestamps: "[20:00:45] Ran:" → ""
  let body = verbose.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/g, '');

  // Strip command prefixes: "Ran: mentu submit" → "submit"
  body = body.replace(/^Ran:\s*(mentu\s+)?/i, '');

  // Strip "Created:" and "Edited:" prefixes for tool-evidence
  body = body.replace(/^(Created|Edited):\s*/i, '');

  // Truncate with ellipsis if still too long
  if (body.length > maxLen) {
    body = body.slice(0, maxLen - 3) + '...';
  }

  return body.trim();
}

/**
 * Generate a source_key for deduplication.
 *
 * Creates an 8-character hash from command and arguments.
 * Same command + args = same source_key.
 *
 * @param command - The command name (e.g., "npm", "mentu")
 * @param args - Command arguments
 * @returns 8-character hex hash
 *
 * @example
 * sourceKey("npm", ["test"])
 * // Returns: "a1b2c3d4"
 */
export function sourceKey(command: string, args: string[]): string {
  const hash = crypto.createHash('sha256');
  hash.update(command + args.join(' '));
  return hash.digest('hex').slice(0, 8);
}

/**
 * Check if a capture with this source_key already exists in recent entries.
 *
 * Looks at the last 50 ledger entries for matching source_key.
 *
 * @param key - The source_key to check
 * @param ledger - The full ledger array
 * @returns true if duplicate found
 */
export function isDuplicate(key: string, ledger: Operation[]): boolean {
  const recent = ledger.slice(-50);
  return recent.some(op => {
    if (op.op !== 'capture') return false;
    // Type guard for capture operations with source_key
    const payload = op.payload as { source_key?: string };
    return payload.source_key === key;
  });
}

/**
 * Extended payload fields for lineage tracking.
 */
export interface LineagePayload {
  /** The body text (≤80 chars recommended) */
  body: string;
  /** Classification kind (evidence, task, validation, etc.) */
  kind?: string;
  /** Related IDs (commitments, memories) for traceability */
  refs?: string[];
  /** Path to associated document (RESULT, HANDOFF, etc.) */
  path?: string;
  /** Idempotency key for deduplication */
  source_key?: string;
}

/**
 * Extended commit payload with lineage fields.
 */
export interface CommitLineagePayload {
  /** Commitment description */
  body: string;
  /** Source memory ID */
  source: string;
  /** Path to expected RESULT document */
  result?: string;
  /** Validation tier (1, 2, or 3) */
  tier?: number;
}

/**
 * Validate lineage payload fields.
 *
 * @param payload - The payload to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateLineagePayload(payload: Partial<LineagePayload>): string[] {
  const errors: string[] = [];

  if (payload.body && payload.body.length > 200) {
    errors.push(`Body too long: ${payload.body.length} chars (max 200, recommended ≤80)`);
  }

  if (payload.refs) {
    for (const ref of payload.refs) {
      if (!ref.match(/^(mem|cmt|op)_[a-f0-9]{8}$/)) {
        errors.push(`Invalid ref format: ${ref}`);
      }
    }
  }

  if (payload.path && !payload.path.match(/^[a-zA-Z0-9_\-./]+$/)) {
    errors.push(`Invalid path format: ${payload.path}`);
  }

  if (payload.source_key && !payload.source_key.match(/^[a-f0-9]{8}$/)) {
    errors.push(`Invalid source_key format: ${payload.source_key}`);
  }

  return errors;
}
