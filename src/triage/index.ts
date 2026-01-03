/**
 * Triage Pipeline Module
 *
 * Provides tier classification, pattern matching, and document generation
 * for automated triage workflows.
 */

// Genesis Pattern Matcher
export {
  globToRegex,
  calculateSpecificity,
  matchPath,
  matchTags,
  matchActor,
  matchCombined,
  type Tier,
  type GenesisPattern,
  type MatchResult,
  type MatchContext,
} from './genesis-matcher.js';

// Tier Classifier
export {
  loadGenesisKey,
  extractPaths,
  isActionable,
  classifyMemory,
  classifyCommitment,
  triageMemory,
  getTriageConfig,
  type ClassificationResult,
  type TriageResult,
  type GenesisKeyWithTriage,
} from './classifier.js';

// Document Generator
export {
  toSlug,
  extractTitle,
  extractMission,
  extractDesiredState,
  extractCriteria,
  extractSummary,
  generatePRD,
  generateHANDOFF,
  generateDocs,
  docsRequired,
  type GeneratedDoc,
} from './doc-generator.js';
