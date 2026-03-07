// Workspace Detection for Multi-Repo Support
// Reads workspace identity from .mentu/manifest.yaml
// Supports hierarchical workspaces (parent containing child workspaces)

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import YAML from 'yaml';

export interface WorkspaceInfo {
  name: string;
  path: string;
  mentuDir: string;
  ledgerPath: string;
  hasLedger: boolean;
  hasConfig: boolean;
  parent?: WorkspaceInfo;  // Parent workspace if nested
}

export interface WorkspaceHierarchy {
  current: WorkspaceInfo;
  ancestors: WorkspaceInfo[];  // From immediate parent to root
  fqn: string;                 // Fully qualified name: "parent/child"
}

/**
 * Parse a single workspace from a directory (if it has .mentu/manifest.yaml).
 */
function parseWorkspaceAt(dir: string): WorkspaceInfo | null {
  const mentuDir = join(dir, '.mentu');
  const manifestPath = join(mentuDir, 'manifest.yaml');

  if (!existsSync(manifestPath)) {
    return null;
  }

  try {
    const content = readFileSync(manifestPath, 'utf-8');
    const manifest = YAML.parse(content);

    if (manifest?.name) {
      const ledgerPath = join(mentuDir, 'ledger.jsonl');
      const configPath = join(mentuDir, 'config.yaml');

      return {
        name: manifest.name,
        path: dir,
        mentuDir,
        ledgerPath,
        hasLedger: existsSync(ledgerPath),
        hasConfig: existsSync(configPath),
      };
    }
  } catch {
    // Invalid manifest
  }

  return null;
}

/**
 * Detect workspace from current directory.
 * Walks up looking for .mentu/manifest.yaml.
 * Returns null if not in a workspace.
 */
export function detectWorkspace(startDir: string = process.cwd()): WorkspaceInfo | null {
  let dir = startDir;

  while (dir !== dirname(dir)) {
    const workspace = parseWorkspaceAt(dir);
    if (workspace) {
      return workspace;
    }
    dir = dirname(dir);
  }

  return null;
}

/**
 * Detect workspace hierarchy from current directory.
 * Finds the nearest workspace and all parent workspaces.
 * Returns null if not in any workspace.
 */
export function detectWorkspaceHierarchy(startDir: string = process.cwd()): WorkspaceHierarchy | null {
  const workspaces: WorkspaceInfo[] = [];
  let dir = startDir;

  // Collect all workspaces from current to root
  while (dir !== dirname(dir)) {
    const workspace = parseWorkspaceAt(dir);
    if (workspace) {
      workspaces.push(workspace);
    }
    dir = dirname(dir);
  }

  if (workspaces.length === 0) {
    return null;
  }

  // Link parent references (workspaces[0] is nearest, workspaces[n] is root)
  for (let i = 0; i < workspaces.length - 1; i++) {
    workspaces[i].parent = workspaces[i + 1];
  }

  // Build fully qualified name (root/parent/child)
  const fqn = workspaces
    .map((w) => w.name)
    .reverse()
    .join('/');

  return {
    current: workspaces[0],
    ancestors: workspaces.slice(1),
    fqn,
  };
}

/**
 * Discover all child workspaces under a directory.
 * Useful for multi-tenant workspace aggregation.
 */
export function discoverChildWorkspaces(parentDir: string): WorkspaceInfo[] {
  const children: WorkspaceInfo[] = [];

  if (!existsSync(parentDir)) {
    return children;
  }

  try {
    const entries = readdirSync(parentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) {
        continue;
      }

      const childPath = join(parentDir, entry.name);
      const workspace = parseWorkspaceAt(childPath);

      if (workspace) {
        children.push(workspace);
      }
    }
  } catch {
    // Permission error or similar
  }

  return children;
}

/**
 * Get all workspaces in a hierarchy (current + all children recursively).
 * For aggregation queries across multi-tenant workspace.
 */
export function getAllWorkspacesUnder(rootDir: string): WorkspaceInfo[] {
  const all: WorkspaceInfo[] = [];

  // Check if root itself is a workspace
  const rootWorkspace = parseWorkspaceAt(rootDir);
  if (rootWorkspace) {
    all.push(rootWorkspace);
  }

  // Recursively find child workspaces
  function scanDir(dir: string) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) {
          continue;
        }

        const childPath = join(dir, entry.name);
        const workspace = parseWorkspaceAt(childPath);

        if (workspace) {
          all.push(workspace);
        }

        // Continue scanning subdirectories
        scanDir(childPath);
      }
    } catch {
      // Permission error
    }
  }

  scanDir(rootDir);
  return all;
}

/**
 * Get workspace name from manifest, or fallback to directory name.
 */
export function getWorkspaceNameFromManifest(workspacePath: string): string | null {
  const manifestPath = join(workspacePath, '.mentu', 'manifest.yaml');

  if (!existsSync(manifestPath)) {
    return null;
  }

  try {
    const content = readFileSync(manifestPath, 'utf-8');
    const manifest = YAML.parse(content);
    return manifest?.name || null;
  } catch {
    return null;
  }
}
