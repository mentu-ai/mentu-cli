import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import type {
  GenesisKey,
  OperationType,
  Commitment,
  Operation,
  MatchRule,
} from '../types.js';
import { getMentuDir } from './config.js';
import { isAgent } from '../utils/actor.js';
import { getMemory, computeCommitmentState } from './state.js';

const GENESIS_FILE = 'genesis.key';

/**
 * Get the genesis key file path.
 */
export function getGenesisPath(workspacePath: string): string {
  return path.join(getMentuDir(workspacePath), GENESIS_FILE);
}

/**
 * Read and parse the Genesis Key.
 */
export function readGenesisKey(workspacePath: string): GenesisKey | null {
  const genesisPath = getGenesisPath(workspacePath);

  if (!fs.existsSync(genesisPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(genesisPath, 'utf-8');
    return YAML.parse(content) as GenesisKey;
  } catch {
    return null;
  }
}

/**
 * Match an actor against a pattern.
 * Patterns support * as a wildcard for any sequence of characters.
 */
function matchActorPattern(actor: string, pattern: string): boolean {
  // Exact match
  if (pattern === actor) {
    return true;
  }

  // Pattern with wildcard
  if (pattern.includes('*')) {
    // Convert pattern to regex
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special chars except *
      .replace(/\*/g, '.*'); // Convert * to .*
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(actor);
  }

  return false;
}

/**
 * Find the best matching actor entry in permissions.
 * Priority:
 * 1. Exact match
 * 2. Longer pattern
 * 3. First defined
 */
function findActorPermissions(
  genesis: GenesisKey,
  actor: string
): { operations: OperationType[] } | null {
  if (!genesis.permissions?.actors) {
    return null;
  }

  const actors = genesis.permissions.actors;
  let bestMatch: { pattern: string; value: { operations: OperationType[] } } | null = null;

  for (const [pattern, value] of Object.entries(actors)) {
    if (matchActorPattern(actor, pattern)) {
      if (!bestMatch) {
        bestMatch = { pattern, value };
      } else {
        // Exact match wins
        if (pattern === actor) {
          bestMatch = { pattern, value };
          break;
        }
        // Longer pattern wins
        if (!pattern.includes('*') && bestMatch.pattern.includes('*')) {
          bestMatch = { pattern, value };
        } else if (pattern.length > bestMatch.pattern.length) {
          bestMatch = { pattern, value };
        }
      }
    }
  }

  return bestMatch?.value ?? null;
}

/**
 * Check if an actor has permission to perform an operation.
 */
export function hasPermission(
  genesis: GenesisKey,
  actor: string,
  op: OperationType
): boolean {
  const actorPerms = findActorPermissions(genesis, actor);

  if (actorPerms) {
    return actorPerms.operations.includes(op);
  }

  // Check defaults
  if (genesis.permissions?.defaults?.authenticated) {
    return genesis.permissions.defaults.authenticated.operations.includes(op);
  }

  // If no permissions defined at all, allow everything
  if (!genesis.permissions) {
    return true;
  }

  // Default deny
  return false;
}

/**
 * Check if a match rule matches a commitment.
 */
function matchesRule(
  rule: MatchRule,
  commitment: Commitment,
  ledger: Operation[]
): boolean {
  // Match all
  if (rule === 'all') {
    return true;
  }

  // Empty match (matches nothing)
  if (typeof rule === 'object' && Object.keys(rule).length === 0) {
    return false;
  }

  // Object match
  if (typeof rule === 'object') {
    // Check tags
    if (rule.tags) {
      const commitmentTags = commitment.tags || [];
      for (const tag of rule.tags) {
        if (!commitmentTags.includes(tag)) {
          return false;
        }
      }
    }

    // Check actor
    if (rule.actor) {
      if (!matchActorPattern(commitment.actor, rule.actor)) {
        return false;
      }
    }

    // Check source_kind
    if (rule.source_kind) {
      const sourceMemory = getMemory(ledger, commitment.source);
      if (!sourceMemory || sourceMemory.kind !== rule.source_kind) {
        return false;
      }
    }

    return true;
  }

  return false;
}

interface ConstraintResult {
  satisfied: boolean;
  constraint?: string;
  message?: string;
}

/**
 * Check all constraints for a close operation.
 */
export function checkConstraints(
  genesis: GenesisKey,
  commitment: Commitment,
  actor: string,
  ledger: Operation[]
): ConstraintResult {
  if (!genesis.constraints) {
    return { satisfied: true };
  }

  // Check require_claim
  if (genesis.constraints.require_claim) {
    for (const constraint of genesis.constraints.require_claim) {
      if (matchesRule(constraint.match, commitment, ledger)) {
        // Actor must be current owner
        const state = computeCommitmentState(ledger, commitment.id);
        if (state.owner !== actor) {
          return {
            satisfied: false,
            constraint: 'require_claim',
            message: 'Must claim commitment before closing',
          };
        }
      }
    }
  }

  // Check require_human
  if (genesis.constraints.require_human) {
    for (const constraint of genesis.constraints.require_human) {
      if (constraint.operation === 'close') {
        if (matchesRule(constraint.match, commitment, ledger)) {
          if (isAgent(actor)) {
            // Construct appropriate message based on tags
            const tagName = commitment.tags?.[0] || 'these';
            return {
              satisfied: false,
              constraint: 'require_human',
              message: `${tagName.charAt(0).toUpperCase() + tagName.slice(1)} commitments require human to close`,
            };
          }
        }
      }
    }
  }

  // Check require_validation (if implemented)
  if (genesis.constraints.require_validation) {
    for (const constraint of genesis.constraints.require_validation) {
      if (matchesRule(constraint.match, commitment, ledger)) {
        // Find validation memory
        const validatorPattern = constraint.validator || '*';
        let hasValidation = false;

        for (const op of ledger) {
          if (op.op === 'capture') {
            const payload = op.payload;
            if (payload.kind === 'validation') {
              // Check if it references this commitment
              const refs = payload.refs || [];
              const meta = payload.meta || {};
              const validates =
                refs.includes(commitment.id) || meta.validates === commitment.id;

              if (validates && matchActorPattern(op.actor, validatorPattern)) {
                // Check for approval
                if (meta.approved === true || meta.passed === true) {
                  hasValidation = true;
                  break;
                }
              }
            }
          }
        }

        if (!hasValidation) {
          return {
            satisfied: false,
            constraint: 'require_validation',
            message: 'Commitment requires validation before close',
          };
        }
      }
    }
  }

  return { satisfied: true };
}
