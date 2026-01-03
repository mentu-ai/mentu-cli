/**
 * Tier Classifier - Classifies memories and commitments into tiers
 *
 * Uses Genesis Key patterns to determine tier classification,
 * falling back to default tier when no patterns match.
 */

import type { Memory, Commitment, GenesisKey } from '../types.js';
import { readGenesisKey } from '../core/genesis.js';
import { findWorkspace } from '../core/config.js';
import {
  matchCombined,
  type Tier,
  type GenesisPattern,
  type MatchContext,
} from './genesis-matcher.js';

export { Tier };

export interface ClassificationResult {
  tier: Tier;
  reason: string;
  matched_pattern?: GenesisPattern;
  confidence: 'high' | 'medium' | 'low';
}

export interface TriageResult {
  memory_id: string;
  tier: Tier;
  matching_pattern: GenesisPattern | null;
  reasoning: string;
  affected_paths: string[];
  action: 'commit' | 'dismiss' | 'defer';
  suggested_docs: string[];
}

// Extended Genesis Key type with triage sections
export interface GenesisKeyWithTriage extends GenesisKey {
  triage?: {
    default_tier?: Tier;
    auto_approve_tiers?: Tier[];
    require_docs_tiers?: Tier[];
    require_preapproval_tiers?: Tier[];
    ai_agent?: {
      enabled?: boolean;
      actor?: string;
    };
  };
  requires_approval?: GenesisPattern[];
}

/**
 * Load Genesis Key with triage extensions.
 */
export function loadGenesisKey(): GenesisKeyWithTriage | null {
  try {
    const workspacePath = findWorkspace(process.cwd());
    return readGenesisKey(workspacePath) as GenesisKeyWithTriage | null;
  } catch {
    return null;
  }
}

/**
 * Extract file paths from text using regex.
 * Matches patterns like: src/foo/bar.ts, ./file.js, etc.
 */
export function extractPaths(text: string): string[] {
  // Match file paths with extensions
  const pathRegex = /(?:^|[\s`"'(])([a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+)(?:[\s`"'),:;]|$)/gm;
  const matches = [...text.matchAll(pathRegex)];
  const paths = matches.map(m => m[1].replace(/^\.\//, '')); // Remove leading ./

  // Also match directory patterns like src/auth/**
  const dirRegex = /(?:^|[\s`"'(])([a-zA-Z0-9_/-]+\/\*{1,2})(?:[\s`"'),:;]|$)/gm;
  const dirMatches = [...text.matchAll(dirRegex)];
  paths.push(...dirMatches.map(m => m[1]));

  return [...new Set(paths)];
}

/**
 * Check if memory describes actionable work.
 */
export function isActionable(memory: Memory): boolean {
  const actionWords = [
    'fix', 'add', 'update', 'implement', 'create', 'modify', 'refactor',
    'remove', 'delete', 'change', 'build', 'write', 'configure', 'setup',
    'enable', 'disable', 'migrate', 'upgrade', 'downgrade', 'deploy',
  ];
  const lowerBody = memory.body.toLowerCase();
  return actionWords.some(word => {
    // Match word boundaries to avoid false positives
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(lowerBody);
  });
}

/**
 * Extract tags from memory metadata or body.
 */
function extractTags(memory: Memory): string[] {
  const tags: string[] = [];

  // Get tags from meta if present
  if (memory.meta && Array.isArray((memory.meta as { tags?: string[] }).tags)) {
    tags.push(...(memory.meta as { tags: string[] }).tags);
  }

  // Extract hashtag-style tags from body
  const hashtagRegex = /#([a-zA-Z0-9_-]+)/g;
  const matches = [...memory.body.matchAll(hashtagRegex)];
  tags.push(...matches.map(m => m[1]));

  return [...new Set(tags)];
}

/**
 * Classify a memory based on Genesis Key patterns.
 */
export function classifyMemory(memory: Memory): ClassificationResult {
  const genesis = loadGenesisKey();
  const patterns = genesis?.requires_approval || [];
  const defaultTier = (genesis?.triage?.default_tier || 'T2') as Tier;

  // Build match context
  const paths = extractPaths(memory.body);
  const tags = extractTags(memory);

  const context: MatchContext = {
    paths,
    tags,
    actor: memory.actor,
  };

  // Match against patterns
  const match = matchCombined(context, patterns);

  if (match.matched && match.pattern) {
    return {
      tier: match.pattern.tier,
      reason: match.pattern.reason,
      matched_pattern: match.pattern,
      confidence: match.specificity > 80 ? 'high' : 'medium',
    };
  }

  return {
    tier: defaultTier,
    reason: 'No pattern matched, using default tier',
    confidence: 'low',
  };
}

/**
 * Classify a commitment based on Genesis Key patterns.
 */
export function classifyCommitment(commitment: Commitment): ClassificationResult {
  const genesis = loadGenesisKey();
  const patterns = genesis?.requires_approval || [];
  const defaultTier = (genesis?.triage?.default_tier || 'T2') as Tier;

  // Build match context
  const paths = extractPaths(commitment.body);
  const tags = commitment.tags || [];

  const context: MatchContext = {
    paths,
    tags,
    actor: commitment.actor,
  };

  // Match against patterns
  const match = matchCombined(context, patterns);

  if (match.matched && match.pattern) {
    return {
      tier: match.pattern.tier,
      reason: match.pattern.reason,
      matched_pattern: match.pattern,
      confidence: match.specificity > 80 ? 'high' : 'medium',
    };
  }

  return {
    tier: defaultTier,
    reason: 'No pattern matched, using default tier',
    confidence: 'low',
  };
}

/**
 * Perform full triage on a memory.
 */
export function triageMemory(memory: Memory): TriageResult {
  const classification = classifyMemory(memory);
  const paths = extractPaths(memory.body);
  const genesis = loadGenesisKey();

  // Determine action based on actionability and tier
  let action: 'commit' | 'dismiss' | 'defer' = 'commit';

  if (!isActionable(memory)) {
    action = 'dismiss';
  } else if (classification.tier === 'T3') {
    // T3 items might need deferral for pre-approval
    const requiresPreapproval = genesis?.triage?.require_preapproval_tiers?.includes('T3');
    if (requiresPreapproval) {
      action = 'defer';
    }
  }

  // Determine which docs are needed
  const requireDocsTiers = genesis?.triage?.require_docs_tiers || ['T2', 'T3'];
  const suggestedDocs: string[] = [];

  if (requireDocsTiers.includes(classification.tier)) {
    suggestedDocs.push('PRD', 'HANDOFF');
    if (classification.tier === 'T3') {
      suggestedDocs.push('PROMPT', 'RESULT');
    }
  }

  return {
    memory_id: memory.id,
    tier: classification.tier,
    matching_pattern: classification.matched_pattern || null,
    reasoning: classification.reason,
    affected_paths: paths,
    action,
    suggested_docs: suggestedDocs,
  };
}

/**
 * Get triage configuration from Genesis Key.
 */
export function getTriageConfig(): {
  defaultTier: Tier;
  autoApproveTiers: Tier[];
  requireDocsTiers: Tier[];
  requirePreapprovalTiers: Tier[];
  aiAgent: { enabled: boolean; actor: string } | null;
} {
  const genesis = loadGenesisKey();

  return {
    defaultTier: (genesis?.triage?.default_tier || 'T2') as Tier,
    autoApproveTiers: (genesis?.triage?.auto_approve_tiers || ['T1']) as Tier[],
    requireDocsTiers: (genesis?.triage?.require_docs_tiers || ['T2', 'T3']) as Tier[],
    requirePreapprovalTiers: (genesis?.triage?.require_preapproval_tiers || ['T3']) as Tier[],
    aiAgent: genesis?.triage?.ai_agent?.enabled
      ? {
          enabled: true,
          actor: genesis.triage.ai_agent.actor || 'agent:triage-bot',
        }
      : null,
  };
}
