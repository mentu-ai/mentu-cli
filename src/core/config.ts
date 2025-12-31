import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import type { Config } from '../types.js';
import { MentuError } from '../types.js';

const MENTU_DIR = '.mentu';
const CONFIG_FILE = 'config.yaml';

/**
 * Find the project root by walking up looking for .git or package.json.
 * Returns the start directory if no markers found.
 */
export function findProjectRoot(startDir: string): string {
  let dir = startDir;

  while (dir !== path.dirname(dir)) {
    if (
      fs.existsSync(path.join(dir, '.git')) ||
      fs.existsSync(path.join(dir, 'package.json'))
    ) {
      return dir;
    }
    dir = path.dirname(dir);
  }

  return startDir;
}

/**
 * Find the workspace path (.mentu directory).
 * Walks up from startDir looking for .mentu/.
 * Throws if not found.
 */
export function findWorkspace(startDir: string): string {
  let dir = startDir;

  while (dir !== path.dirname(dir)) {
    const mentuPath = path.join(dir, MENTU_DIR);
    if (fs.existsSync(mentuPath)) {
      return dir;
    }
    dir = path.dirname(dir);
  }

  // Check startDir itself
  const mentuPath = path.join(startDir, MENTU_DIR);
  if (fs.existsSync(mentuPath)) {
    return startDir;
  }

  throw new MentuError(
    'E_NO_WORKSPACE',
    'No .mentu/ found. Run "mentu init" first.'
  );
}

/**
 * Get the .mentu directory path.
 */
export function getMentuDir(workspacePath: string): string {
  return path.join(workspacePath, MENTU_DIR);
}

/**
 * Get the config file path.
 */
export function getConfigPath(workspacePath: string): string {
  return path.join(workspacePath, MENTU_DIR, CONFIG_FILE);
}

/**
 * Read workspace configuration.
 */
export function readConfig(workspacePath: string): Config | null {
  const configPath = getConfigPath(workspacePath);

  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return YAML.parse(content) as Config;
  } catch {
    return null;
  }
}

/**
 * Write workspace configuration.
 */
export function writeConfig(workspacePath: string, config: Config): void {
  const configPath = getConfigPath(workspacePath);
  const content = YAML.stringify(config);
  fs.writeFileSync(configPath, content, 'utf-8');
}

/**
 * Check if workspace exists.
 */
export function workspaceExists(dir: string): boolean {
  return fs.existsSync(path.join(dir, MENTU_DIR));
}

/**
 * Get the workspace name from config or directory name.
 */
export function getWorkspaceName(workspacePath: string): string {
  const config = readConfig(workspacePath);
  if (config?.workspace) {
    return config.workspace;
  }
  return path.basename(workspacePath);
}

/**
 * Get a config value by dot-notation path.
 */
export function getConfigValue(config: Config, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = config;
  for (const part of parts) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Set a config value by dot-notation path.
 * Returns a new config object (immutable).
 */
export function setConfigValue(config: Config, pathStr: string, value: unknown): Config {
  const parts = pathStr.split('.');
  const result = JSON.parse(JSON.stringify(config)) as Config;
  let current: Record<string, unknown> = result as unknown as Record<string, unknown>;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== 'object' || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
  return result;
}
