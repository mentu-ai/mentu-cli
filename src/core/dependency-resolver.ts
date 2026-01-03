// Dependency Resolver Engine
// Polls commitments with wait_for metadata and spawns when dependencies satisfied

import type {
  ResolverConfig,
  ResolverTickResult,
  ResolverError,
} from '../types.js';
import { readLedger } from './ledger.js';
import { computeCommitments, computeCommitmentState } from './state.js';
import { readConfig } from './config.js';

export const DEFAULT_RESOLVER_CONFIG: ResolverConfig = {
  enabled: true,
  tick_interval: 60,
  max_batch: 20,
  dry_run: false,
};

interface DependencyCheck {
  satisfied: boolean;
  blocking: string[];
}

/**
 * Check if a commitment's dependencies are satisfied
 */
function checkDependencies(
  commitmentId: string,
  meta: Record<string, unknown>,
  commitmentStates: Map<string, string>
): DependencyCheck {
  const blocking: string[] = [];

  // Single dependency
  const waitFor = meta.wait_for as string | undefined;
  if (waitFor) {
    const state = commitmentStates.get(waitFor);
    if (state !== 'closed') {
      blocking.push(waitFor);
    }
  }

  // All dependencies must be closed
  const waitForAll = meta.wait_for_all as string[] | undefined;
  if (waitForAll) {
    for (const depId of waitForAll) {
      const state = commitmentStates.get(depId);
      if (state !== 'closed') {
        blocking.push(depId);
      }
    }
  }

  // Any dependency closed is sufficient
  const waitForAny = meta.wait_for_any as string[] | undefined;
  if (waitForAny) {
    const anyClosed = waitForAny.some(
      depId => commitmentStates.get(depId) === 'closed'
    );
    if (!anyClosed) {
      // All are blocking until one closes
      blocking.push(...waitForAny);
    }
  }

  return {
    satisfied: blocking.length === 0,
    blocking,
  };
}

/**
 * Detect circular dependencies
 */
function hasCircularDependency(
  commitmentId: string,
  meta: Record<string, unknown>,
  allMetas: Map<string, Record<string, unknown>>,
  visited: Set<string> = new Set()
): boolean {
  if (visited.has(commitmentId)) {
    return true;
  }

  visited.add(commitmentId);

  const deps: string[] = [];
  if (meta.wait_for) deps.push(meta.wait_for as string);
  if (meta.wait_for_all) deps.push(...(meta.wait_for_all as string[]));
  if (meta.wait_for_any) deps.push(...(meta.wait_for_any as string[]));

  for (const depId of deps) {
    const depMeta = allMetas.get(depId);
    if (depMeta && hasCircularDependency(depId, depMeta, allMetas, new Set(visited))) {
      return true;
    }
  }

  return false;
}

/**
 * Spawn a commitment via the proxy API
 */
async function spawnCommitment(
  commitmentId: string,
  workspacePath: string
): Promise<{ ok: boolean; error?: string; command_id?: string }> {
  const config = readConfig(workspacePath);

  const apiUrl = process.env.MENTU_API_URL || config?.cloud?.endpoint;
  const token = process.env.MENTU_PROXY_TOKEN;

  if (!apiUrl || !token) {
    return { ok: false, error: 'Proxy not configured' };
  }

  try {
    const response = await fetch(`${apiUrl}/bridge/spawn`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Proxy-Token': token,
      },
      body: JSON.stringify({
        commitment_id: commitmentId,
        actor: 'resolver:auto-spawn',
      }),
    });

    if (!response.ok) {
      const error = await response.json() as { error?: string };
      return { ok: false, error: error.error || `HTTP ${response.status}` };
    }

    const result = await response.json() as { command_id: string };
    return { ok: true, command_id: result.command_id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Execute a resolver tick
 */
export async function tick(
  workspacePath: string,
  config: Partial<ResolverConfig> = {}
): Promise<ResolverTickResult> {
  const cfg = { ...DEFAULT_RESOLVER_CONFIG, ...config };
  const now = new Date();
  const spawned: string[] = [];
  const blocked: Array<{ id: string; waiting_on: string[] }> = [];
  const errors: ResolverError[] = [];

  // Read current state
  const operations = readLedger(workspacePath);
  const commitments = computeCommitments(operations);

  // Build state map
  const commitmentStates = new Map<string, string>();
  const commitmentMetas = new Map<string, Record<string, unknown>>();

  for (const cmt of commitments) {
    const state = computeCommitmentState(operations, cmt.id);
    commitmentStates.set(cmt.id, state.state);
    commitmentMetas.set(cmt.id, cmt.meta || {});
  }

  let checked = 0;

  // Find commitments with dependencies
  for (const cmt of commitments) {
    if (checked >= cfg.max_batch) break;

    const meta = cmt.meta || {};

    // Skip if no dependency metadata
    if (!meta.wait_for && !meta.wait_for_all && !meta.wait_for_any) {
      continue;
    }

    // Skip if not bridge-affinity
    if (meta.affinity !== 'bridge') {
      continue;
    }

    // Skip if not open
    const state = commitmentStates.get(cmt.id);
    if (state !== 'open') {
      continue;
    }

    checked++;

    // Check for circular dependencies
    if (hasCircularDependency(cmt.id, meta, commitmentMetas)) {
      errors.push({
        commitment_id: cmt.id,
        error: 'Circular dependency detected',
        code: 'E_CIRCULAR_DEP',
      });
      continue;
    }

    // Check dependencies
    const depCheck = checkDependencies(cmt.id, meta, commitmentStates);

    if (!depCheck.satisfied) {
      blocked.push({
        id: cmt.id,
        waiting_on: depCheck.blocking,
      });
      continue;
    }

    // Dependencies satisfied - spawn it
    if (cfg.dry_run) {
      spawned.push(cmt.id);
    } else {
      const result = await spawnCommitment(cmt.id, workspacePath);
      if (result.ok) {
        spawned.push(cmt.id);
      } else {
        errors.push({
          commitment_id: cmt.id,
          error: result.error || 'Spawn failed',
          code: 'E_SPAWN_FAILED',
        });
      }
    }
  }

  return {
    tick_at: now.toISOString(),
    checked,
    spawned,
    blocked,
    errors,
  };
}

export default {
  DEFAULT_RESOLVER_CONFIG,
  tick,
};
