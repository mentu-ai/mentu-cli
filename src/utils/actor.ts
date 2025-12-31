import { execSync } from 'child_process';
import type { Config } from '../types.js';

/**
 * Resolve actor identity.
 * Priority:
 * 1. --actor flag
 * 2. MENTU_ACTOR environment variable
 * 3. config.yaml default_actor field
 * 4. git config user.email
 * 5. "user" fallback
 */
export function resolveActor(flagValue?: string, config?: Config): string {
  // 1. Check flag
  if (flagValue) return flagValue;

  // 2. Check environment variable
  if (process.env.MENTU_ACTOR) return process.env.MENTU_ACTOR;

  // 3. Check config
  if (config?.default_actor) return config.default_actor;

  // 4. Try git config
  try {
    const email = execSync('git config user.email', { encoding: 'utf-8' }).trim();
    if (email) return email;
  } catch {
    // Git not available or not configured
  }

  // 5. Fallback
  return 'user';
}

/**
 * Check if an actor is classified as an agent (non-human).
 */
export function isAgent(actor: string): boolean {
  return (
    actor.startsWith('agent:') ||
    actor.startsWith('bot:') ||
    actor.startsWith('service:')
  );
}
