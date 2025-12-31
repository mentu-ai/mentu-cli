import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

function tryReadPackageJsonVersion(packageJsonPath: string): string | null {
  try {
    const raw = fs.readFileSync(packageJsonPath, 'utf-8');
    const parsed = JSON.parse(raw) as { version?: unknown };
    return typeof parsed.version === 'string' ? parsed.version : null;
  } catch {
    return null;
  }
}

/**
 * Resolve Mentu version from the nearest package.json (repo/package root).
 * Works in both src/ (ts-node) and dist/ (compiled) layouts.
 */
export function getMentuVersion(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);

  // src/utils/version.ts -> ../../package.json
  // dist/utils/version.js -> ../../package.json
  const candidate = path.resolve(currentDir, '..', '..', 'package.json');
  return tryReadPackageJsonVersion(candidate) ?? 'unknown';
}

