/**
 * Genesis Matcher - Pattern matching against Genesis Key rules
 *
 * Matches file paths, tags, and actors against Genesis Key triage patterns
 * to determine tier classification.
 */

import type { GenesisKey } from '../types.js';
import { readGenesisKey } from '../core/genesis.js';

export type Tier = 'T1' | 'T2' | 'T3';

export interface GenesisPattern {
  pattern?: string;          // Glob pattern for file paths
  match?: {
    tags?: string[];
    actor?: string;
  };
  tier: Tier;
  reason: string;
}

export interface MatchResult {
  matched: boolean;
  pattern?: GenesisPattern;
  specificity: number;
}

export interface MatchContext {
  paths: string[];
  tags: string[];
  actor: string;
}

/**
 * Convert a glob pattern to a regex.
 * Supports:
 * - ** for directory recursion
 * - * for single path segment
 * - ? for single character
 */
export function globToRegex(pattern: string): RegExp {
  let regex = pattern
    // Escape special regex chars except * and ?
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    // ** matches any path segments
    .replace(/\*\*/g, '<<<GLOBSTAR>>>')
    // * matches anything except /
    .replace(/\*/g, '[^/]*')
    // Restore ** as .*
    .replace(/<<<GLOBSTAR>>>/g, '.*')
    // ? matches single char
    .replace(/\?/g, '.');

  return new RegExp(`^${regex}$`);
}

/**
 * Calculate specificity score for a pattern.
 * Higher scores indicate more specific patterns.
 */
export function calculateSpecificity(pattern: GenesisPattern): number {
  let score = 0;

  if (pattern.pattern) {
    // File path pattern specificity
    const parts = pattern.pattern.split('/').filter(Boolean);

    // More path segments = more specific
    score += parts.length * 10;

    // Exact file name (no wildcards in last segment)
    const lastPart = parts[parts.length - 1] || '';
    if (!lastPart.includes('*') && !lastPart.includes('?')) {
      score += 50;
    }

    // Penalize wildcards
    const wildcardCount = (pattern.pattern.match(/\*\*/g) || []).length;
    const singleStarCount = (pattern.pattern.match(/(?<!\*)\*(?!\*)/g) || []).length;
    score -= wildcardCount * 5;
    score -= singleStarCount * 2;
  }

  if (pattern.match) {
    // Tag specificity - more tags = more specific
    if (pattern.match.tags) {
      score += pattern.match.tags.length * 15;
    }

    // Actor specificity
    if (pattern.match.actor) {
      if (pattern.match.actor.includes('*')) {
        score += 5; // Wildcard actor
      } else {
        score += 20; // Exact actor match
      }
    }
  }

  return score;
}

/**
 * Match a file path against glob patterns.
 * Returns the highest specificity match.
 */
export function matchPath(path: string, patterns: GenesisPattern[]): MatchResult {
  let bestMatch: MatchResult = { matched: false, specificity: -1 };

  for (const pattern of patterns) {
    if (!pattern.pattern) continue;

    const regex = globToRegex(pattern.pattern);
    if (regex.test(path)) {
      const specificity = calculateSpecificity(pattern);
      if (specificity > bestMatch.specificity) {
        bestMatch = {
          matched: true,
          pattern,
          specificity,
        };
      }
    }
  }

  return bestMatch;
}

/**
 * Match tags against tag patterns.
 * All tags in the pattern must be present (AND logic).
 */
export function matchTags(tags: string[], patterns: GenesisPattern[]): MatchResult {
  let bestMatch: MatchResult = { matched: false, specificity: -1 };

  for (const pattern of patterns) {
    if (!pattern.match?.tags) continue;

    // All pattern tags must be present in input tags
    const allTagsPresent = pattern.match.tags.every(t => tags.includes(t));

    if (allTagsPresent) {
      const specificity = calculateSpecificity(pattern);
      if (specificity > bestMatch.specificity) {
        bestMatch = {
          matched: true,
          pattern,
          specificity,
        };
      }
    }
  }

  return bestMatch;
}

/**
 * Match an actor against actor patterns.
 * Supports wildcards: agent:*, human:*
 */
export function matchActor(actor: string, patterns: GenesisPattern[]): MatchResult {
  let bestMatch: MatchResult = { matched: false, specificity: -1 };

  for (const pattern of patterns) {
    if (!pattern.match?.actor) continue;

    const actorPattern = pattern.match.actor;
    let matches = false;

    if (actorPattern === actor) {
      // Exact match
      matches = true;
    } else if (actorPattern.includes('*')) {
      // Wildcard match
      const regex = new RegExp(
        '^' + actorPattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'
      );
      matches = regex.test(actor);
    }

    if (matches) {
      const specificity = calculateSpecificity(pattern);
      if (specificity > bestMatch.specificity) {
        bestMatch = {
          matched: true,
          pattern,
          specificity,
        };
      }
    }
  }

  return bestMatch;
}

/**
 * Match against all dimensions and return highest specificity match.
 * Precedence: Path > Tags > Actor
 */
export function matchCombined(
  context: MatchContext,
  patterns: GenesisPattern[]
): MatchResult {
  const results: MatchResult[] = [];

  // Try matching paths
  for (const path of context.paths) {
    const result = matchPath(path, patterns);
    if (result.matched) {
      // Boost path matches as they're most specific
      results.push({
        ...result,
        specificity: result.specificity + 100,
      });
    }
  }

  // Try matching tags
  if (context.tags.length > 0) {
    const result = matchTags(context.tags, patterns);
    if (result.matched) {
      results.push({
        ...result,
        specificity: result.specificity + 50,
      });
    }
  }

  // Try matching actor
  if (context.actor) {
    const result = matchActor(context.actor, patterns);
    if (result.matched) {
      results.push(result);
    }
  }

  // Also check for patterns that combine multiple match fields
  for (const pattern of patterns) {
    if (!pattern.match) continue;

    let allFieldsMatch = true;
    let combinedSpecificity = 0;

    // Check tags if specified
    if (pattern.match.tags) {
      const allTagsPresent = pattern.match.tags.every(t => context.tags.includes(t));
      if (!allTagsPresent) {
        allFieldsMatch = false;
      } else {
        combinedSpecificity += pattern.match.tags.length * 15;
      }
    }

    // Check actor if specified
    if (pattern.match.actor && allFieldsMatch) {
      const actorPattern = pattern.match.actor;
      let actorMatches = false;

      if (actorPattern === context.actor) {
        actorMatches = true;
        combinedSpecificity += 20;
      } else if (actorPattern.includes('*')) {
        const regex = new RegExp(
          '^' + actorPattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'
        );
        actorMatches = regex.test(context.actor);
        if (actorMatches) {
          combinedSpecificity += 5;
        }
      }

      if (!actorMatches) {
        allFieldsMatch = false;
      }
    }

    if (allFieldsMatch && pattern.match.tags && pattern.match.actor) {
      // This is a combined match - give it bonus specificity
      results.push({
        matched: true,
        pattern,
        specificity: combinedSpecificity + 75, // Bonus for combined match
      });
    }
  }

  // Return highest specificity match
  if (results.length === 0) {
    return { matched: false, specificity: -1 };
  }

  return results.reduce((best, current) =>
    current.specificity > best.specificity ? current : best
  );
}

/**
 * Load patterns from a Genesis Key's triage or requires_approval sections.
 *
 * @param genesis - Parsed Genesis Key object
 * @returns Array of GenesisPattern objects
 */
export function loadPatternsFromGenesis(genesis: GenesisKey): GenesisPattern[] {
  const patterns: GenesisPattern[] = [];

  // Load from triage.tier_rules if present
  if (genesis.triage?.tier_rules) {
    for (const rule of genesis.triage.tier_rules) {
      patterns.push({
        pattern: rule.pattern,
        match: rule.match,
        tier: (rule.tier || 'T2') as Tier,
        reason: rule.reason,
      });
    }
  }

  // Load from requires_approval if present
  if (genesis.requires_approval) {
    for (const rule of genesis.requires_approval) {
      patterns.push({
        pattern: rule.pattern,
        match: rule.match,
        tier: (rule.tier || 'T2') as Tier,
        reason: rule.reason,
      });
    }
  }

  return patterns;
}

/**
 * Result of tier classification from genesis patterns.
 */
export interface TierClassificationResult {
  tier: Tier;
  reason: string;
  matched: boolean;
  specificity: number;
}

/**
 * Genesis Matcher class for tier classification.
 */
export class GenesisMatcher {
  private patterns: GenesisPattern[];
  private defaultTier: Tier;

  constructor(patterns: GenesisPattern[], defaultTier: Tier = 'T2') {
    this.patterns = patterns;
    this.defaultTier = defaultTier;
  }

  /**
   * Classify a context to determine its tier.
   */
  classify(context: MatchContext): TierClassificationResult {
    const result = matchCombined(context, this.patterns);

    if (result.matched && result.pattern) {
      return {
        tier: result.pattern.tier,
        reason: result.pattern.reason,
        matched: true,
        specificity: result.specificity,
      };
    }

    return {
      tier: this.defaultTier,
      reason: 'No matching pattern, using default tier',
      matched: false,
      specificity: -1,
    };
  }

  /**
   * Get all patterns.
   */
  getPatterns(): GenesisPattern[] {
    return this.patterns;
  }
}

/**
 * Create a GenesisMatcher from a workspace's genesis.key file.
 *
 * @param workspacePath - Path to the workspace containing .mentu/genesis.key
 * @returns GenesisMatcher configured with workspace rules, or null if no genesis.key
 */
export function createMatcherFromGenesis(workspacePath: string): GenesisMatcher | null {
  const genesis = readGenesisKey(workspacePath);

  if (!genesis) {
    return null;
  }

  const patterns = loadPatternsFromGenesis(genesis);
  const defaultTier = (genesis.triage?.default_tier || 'T2') as Tier;

  return new GenesisMatcher(patterns, defaultTier);
}
