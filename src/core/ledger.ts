import fs from 'fs';
import path from 'path';
import type { Operation } from '../types.js';
import { MentuError } from '../types.js';
import { getMentuDir } from './config.js';
import { withLockSync } from './lock.js';

const LEDGER_FILE = 'ledger.jsonl';

/**
 * Get the ledger file path.
 */
export function getLedgerPath(workspacePath: string): string {
  return path.join(getMentuDir(workspacePath), LEDGER_FILE);
}

/**
 * Read all operations from the ledger.
 */
export function readLedger(workspacePath: string): Operation[] {
  const ledgerPath = getLedgerPath(workspacePath);

  if (!fs.existsSync(ledgerPath)) {
    return [];
  }

  const content = fs.readFileSync(ledgerPath, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim());

  return lines.map((line, index) => {
    try {
      return JSON.parse(line) as Operation;
    } catch (err) {
      throw new Error(`Invalid JSON at line ${index + 1}: ${line}`);
    }
  });
}

/**
 * Append an operation to the ledger.
 * Uses locking to prevent concurrent writes.
 */
export function appendOperation(workspacePath: string, op: Operation): void {
  withLockSync(workspacePath, () => {
    const ledgerPath = getLedgerPath(workspacePath);
    const line = JSON.stringify(op) + '\n';
    fs.appendFileSync(ledgerPath, line, 'utf-8');
  });
}

/**
 * Check if an ID exists in the ledger.
 */
export function idExists(ledger: Operation[], id: string): boolean {
  return ledger.some((op) => op.id === id);
}

/**
 * Check if a source_key exists in the ledger.
 */
export function sourceKeyExists(ledger: Operation[], sourceKey: string): boolean {
  return ledger.some((op) => op.source_key === sourceKey);
}

/**
 * Get all memory IDs from the ledger.
 */
export function getMemoryIds(ledger: Operation[]): Set<string> {
  const ids = new Set<string>();
  for (const op of ledger) {
    if (op.op === 'capture') {
      ids.add(op.id);
    }
  }
  return ids;
}

/**
 * Get all commitment IDs from the ledger.
 */
export function getCommitmentIds(ledger: Operation[]): Set<string> {
  const ids = new Set<string>();
  for (const op of ledger) {
    if (op.op === 'commit') {
      ids.add(op.id);
    }
  }
  return ids;
}

/**
 * Get all IDs (memories and commitments) from the ledger.
 */
export function getAllRecordIds(ledger: Operation[]): Set<string> {
  const ids = new Set<string>();
  for (const op of ledger) {
    if (op.op === 'capture' || op.op === 'commit') {
      ids.add(op.id);
    }
  }
  return ids;
}
