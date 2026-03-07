/**
 * Author Type System for Trust Gradient Orchestration
 *
 * This module provides utilities for the Architect→Auditor→Executor pattern,
 * enabling stratified trust through author types and provenance tracking.
 *
 * Key Concepts:
 * - Actor = Identity (WHO) - e.g., agent:claude-code
 * - Author Type = Role (WHAT role) - architect, auditor, executor
 *
 * These are orthogonal. The same actor can play different roles at different times.
 */

import type { Operation, GenesisKey, MentuError, ValidationResult } from '../types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Author types in the trust gradient.
 */
export type AuthorType = 'architect' | 'auditor' | 'executor';

/**
 * Trust levels corresponding to author types.
 */
export type TrustLevel = 'untrusted' | 'trusted' | 'authorized';

/**
 * A single link in the provenance chain.
 */
export interface ProvenanceLink {
  author_type: AuthorType;
  memory: string;
  actor: string;
  ts: string;
}

/**
 * Full provenance tracking structure.
 */
export interface Provenance {
  intent?: string;      // mem_xxx of architect intent
  audit?: string;       // mem_xxx of audit evidence
  chain?: ProvenanceLink[];
}

/**
 * Author metadata that can appear in operation meta.
 */
export interface AuthorMeta {
  author_type?: AuthorType;
  trust_level?: TrustLevel;
  provenance?: Provenance;
}

/**
 * Trust gradient configuration from genesis.key.
 */
export interface TrustGradientConfig {
  enabled: boolean;
  author_types?: {
    [key in AuthorType]?: {
      trust_level: TrustLevel;
      allowed_operations?: string[];
      allowed_kinds?: string[];
      requires_audit?: boolean;
      scope_bounded?: boolean;
    };
  };
  constraints?: Array<{
    match: { author_type?: AuthorType; trust_level?: TrustLevel };
    deny?: string[];
    require_provenance?: boolean;
  }>;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Mapping from author type to default trust level.
 */
export const AUTHOR_TYPE_TRUST_LEVELS: Record<AuthorType, TrustLevel> = {
  architect: 'untrusted',
  auditor: 'trusted',
  executor: 'authorized',
};

/**
 * Memory kinds typically created by each author type.
 */
export const AUTHOR_TYPE_KINDS: Record<AuthorType, string[]> = {
  architect: [
    'architect-intent',
    'strategic-intent',
    'clarification',
  ],
  auditor: [
    'audit-evidence',
    'audit-approval',
    'audit-rejection',
    'audit-modification',
    'validated-instruction',
  ],
  executor: [
    'execution-progress',
    'result-document',
    'implementation-evidence',
  ],
};

/**
 * Default allowed operations per author type.
 */
export const AUTHOR_TYPE_OPERATIONS: Record<AuthorType, string[]> = {
  architect: ['capture', 'annotate'],
  auditor: ['capture', 'annotate', 'commit', 'claim', 'release', 'close'],
  executor: ['capture', 'annotate', 'commit', 'claim', 'release', 'close', 'submit'],
};

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Get author type from operation metadata.
 */
export function getAuthorType(op: Operation): AuthorType | undefined {
  const meta = (op.payload as { meta?: AuthorMeta })?.meta;
  return meta?.author_type;
}

/**
 * Get trust level from operation, computing from author type if not explicit.
 */
export function getTrustLevel(op: Operation): TrustLevel {
  const meta = (op.payload as { meta?: AuthorMeta })?.meta;

  // Explicit trust level takes precedence
  if (meta?.trust_level) {
    return meta.trust_level;
  }

  // Compute from author type
  const authorType = getAuthorType(op);
  if (authorType) {
    return AUTHOR_TYPE_TRUST_LEVELS[authorType];
  }

  // Default for operations without author type
  return 'trusted';
}

/**
 * Get provenance from operation metadata.
 */
export function getProvenance(op: Operation): Provenance | undefined {
  const meta = (op.payload as { meta?: AuthorMeta })?.meta;
  return meta?.provenance;
}

/**
 * Check if an operation has the specified author type.
 */
export function hasAuthorType(op: Operation, authorType: AuthorType): boolean {
  return getAuthorType(op) === authorType;
}

/**
 * Check if an operation has the specified or higher trust level.
 */
export function hasTrustLevel(op: Operation, minLevel: TrustLevel): boolean {
  const level = getTrustLevel(op);
  const levels: TrustLevel[] = ['untrusted', 'trusted', 'authorized'];
  return levels.indexOf(level) >= levels.indexOf(minLevel);
}

// =============================================================================
// Provenance Functions
// =============================================================================

/**
 * Check if operation has valid provenance chain.
 */
export function hasValidProvenance(
  op: Operation,
  ledger: Operation[]
): boolean {
  const provenance = getProvenance(op);
  if (!provenance) {
    return false;
  }

  // Verify intent exists if referenced
  if (provenance.intent) {
    const intent = findMemoryById(ledger, provenance.intent);
    if (!intent) {
      return false;
    }
  }

  // Verify audit exists if referenced
  if (provenance.audit) {
    const audit = findMemoryById(ledger, provenance.audit);
    if (!audit) {
      return false;
    }

    // Audit must be an approval
    const kind = (audit.payload as { kind?: string })?.kind;
    if (!kind?.includes('approval')) {
      return false;
    }
  }

  // Verify chain integrity if present
  if (provenance.chain && provenance.chain.length > 0) {
    for (const link of provenance.chain) {
      const memory = findMemoryById(ledger, link.memory);
      if (!memory) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Build a provenance chain from intent and audit references.
 */
export function buildProvenanceChain(
  ledger: Operation[],
  intentId?: string,
  auditId?: string
): Provenance {
  const chain: ProvenanceLink[] = [];

  if (intentId) {
    const intent = findMemoryById(ledger, intentId);
    if (intent) {
      chain.push({
        author_type: 'architect',
        memory: intentId,
        actor: intent.actor,
        ts: intent.ts,
      });
    }
  }

  if (auditId) {
    const audit = findMemoryById(ledger, auditId);
    if (audit) {
      chain.push({
        author_type: 'auditor',
        memory: auditId,
        actor: audit.actor,
        ts: audit.ts,
      });
    }
  }

  return {
    intent: intentId,
    audit: auditId,
    chain,
  };
}

/**
 * Extend an existing provenance chain with a new link.
 */
export function extendProvenanceChain(
  existing: Provenance,
  newLink: ProvenanceLink
): Provenance {
  return {
    ...existing,
    chain: [...(existing.chain || []), newLink],
  };
}

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validate author type constraints for an operation.
 */
export function validateAuthorTypeConstraints(
  op: Operation,
  genesis: GenesisKey,
  ledger: Operation[]
): { valid: boolean; error?: string } {
  const authorType = getAuthorType(op);

  // No author type = no constraints
  if (!authorType) {
    return { valid: true };
  }

  // Get trust gradient config
  const trustGradient = (genesis as GenesisKey & {
    trust_gradient?: TrustGradientConfig;
  }).trust_gradient;

  if (!trustGradient?.enabled) {
    return { valid: true };
  }

  const config = trustGradient.author_types?.[authorType];
  if (!config) {
    return { valid: true };
  }

  // Check allowed operations
  if (config.allowed_operations && !config.allowed_operations.includes(op.op)) {
    return {
      valid: false,
      error: `${authorType} cannot perform ${op.op} operation`,
    };
  }

  // Check allowed kinds for capture
  if (op.op === 'capture' && config.allowed_kinds) {
    const kind = (op.payload as { kind?: string })?.kind;
    if (kind && !config.allowed_kinds.includes(kind)) {
      return {
        valid: false,
        error: `${authorType} cannot create memories of kind ${kind}`,
      };
    }
  }

  // Check requires_audit for executor
  if (authorType === 'executor' && config.requires_audit) {
    if (!hasValidProvenance(op, ledger)) {
      return {
        valid: false,
        error: 'Executor operations require valid audit provenance',
      };
    }
  }

  return { valid: true };
}

/**
 * Check if a memory kind is appropriate for an author type.
 */
export function isKindValidForAuthorType(kind: string, authorType: AuthorType): boolean {
  const validKinds = AUTHOR_TYPE_KINDS[authorType];
  return validKinds.some((k) => kind.includes(k) || k.includes(kind));
}

/**
 * Check if an operation type is allowed for an author type.
 */
export function isOperationAllowedForAuthorType(
  opType: string,
  authorType: AuthorType
): boolean {
  return AUTHOR_TYPE_OPERATIONS[authorType].includes(opType);
}

// =============================================================================
// Resolution Functions
// =============================================================================

/**
 * Resolve author type from various sources.
 *
 * Priority:
 * 1. Explicit author_type in meta
 * 2. MENTU_AUTHOR_TYPE environment variable
 * 3. Actor's default author_type from genesis.key
 * 4. Inferred from memory kind
 * 5. undefined (no author type)
 */
export function resolveAuthorType(
  flagValue?: AuthorType,
  config?: GenesisKey,
  actor?: string,
  kind?: string
): AuthorType | undefined {
  // 1. Explicit flag
  if (flagValue) {
    return flagValue;
  }

  // 2. Environment variable
  const envAuthorType = process.env.MENTU_AUTHOR_TYPE;
  if (envAuthorType && isValidAuthorType(envAuthorType)) {
    return envAuthorType as AuthorType;
  }

  // 3. Actor's default from genesis.key
  if (actor && config?.permissions?.actors) {
    const actorConfig = findActorConfig(config, actor);
    if (actorConfig?.author_type) {
      return actorConfig.author_type as AuthorType;
    }
  }

  // 4. Infer from kind
  if (kind) {
    for (const [authorType, kinds] of Object.entries(AUTHOR_TYPE_KINDS)) {
      if (kinds.some((k) => kind.includes(k))) {
        return authorType as AuthorType;
      }
    }
  }

  // 5. No author type
  return undefined;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if a string is a valid author type.
 */
export function isValidAuthorType(value: string): boolean {
  return ['architect', 'auditor', 'executor'].includes(value);
}

/**
 * Check if a string is a valid trust level.
 */
export function isValidTrustLevel(value: string): boolean {
  return ['untrusted', 'trusted', 'authorized'].includes(value);
}

/**
 * Find a memory (capture operation) by ID in the ledger.
 */
function findMemoryById(ledger: Operation[], id: string): Operation | undefined {
  return ledger.find((op) => op.op === 'capture' && op.id === id);
}

/**
 * Find actor configuration from genesis.key, handling wildcards.
 */
function findActorConfig(
  genesis: GenesisKey,
  actor: string
): { author_type?: string } | undefined {
  const actors = genesis.permissions?.actors;
  if (!actors) {
    return undefined;
  }

  // Exact match first
  if (actors[actor]) {
    return actors[actor] as { author_type?: string };
  }

  // Wildcard match
  for (const [pattern, config] of Object.entries(actors)) {
    if (pattern.includes('*')) {
      const regexPattern = pattern.replace(/\*/g, '.*');
      if (new RegExp(`^${regexPattern}$`).test(actor)) {
        return config as { author_type?: string };
      }
    }
  }

  return undefined;
}

// =============================================================================
// Meta Builder
// =============================================================================

/**
 * Build author metadata for an operation.
 */
export function buildAuthorMeta(options: {
  authorType: AuthorType;
  intentId?: string;
  auditId?: string;
  ledger?: Operation[];
}): AuthorMeta {
  const { authorType, intentId, auditId, ledger } = options;

  const meta: AuthorMeta = {
    author_type: authorType,
    trust_level: AUTHOR_TYPE_TRUST_LEVELS[authorType],
  };

  // Build provenance if references provided
  if ((intentId || auditId) && ledger) {
    meta.provenance = buildProvenanceChain(ledger, intentId, auditId);
  }

  return meta;
}

/**
 * Merge author metadata with existing meta.
 */
export function mergeAuthorMeta(
  existing: Record<string, unknown> | undefined,
  authorMeta: AuthorMeta
): Record<string, unknown> {
  return {
    ...existing,
    ...authorMeta,
  };
}
