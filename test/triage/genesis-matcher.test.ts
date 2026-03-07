import { describe, it, expect } from 'vitest';
import {
  globToRegex,
  calculateSpecificity,
  matchPath,
  matchTags,
  matchActor,
  matchCombined,
  type GenesisPattern,
} from '../../src/triage/genesis-matcher.js';

describe('globToRegex', () => {
  it('converts exact path to regex', () => {
    const regex = globToRegex('src/auth/login.ts');
    expect(regex.test('src/auth/login.ts')).toBe(true);
    expect(regex.test('src/auth/logout.ts')).toBe(false);
  });

  it('converts * to match file name', () => {
    const regex = globToRegex('src/auth/*.ts');
    expect(regex.test('src/auth/login.ts')).toBe(true);
    expect(regex.test('src/auth/logout.ts')).toBe(true);
    expect(regex.test('src/auth/nested/file.ts')).toBe(false);
  });

  it('converts ** to match any path segments', () => {
    const regex = globToRegex('src/auth/**');
    expect(regex.test('src/auth/login.ts')).toBe(true);
    expect(regex.test('src/auth/utils/helper.ts')).toBe(true);
    expect(regex.test('src/api/endpoint.ts')).toBe(false);
  });
});

describe('calculateSpecificity', () => {
  it('gives higher score to exact paths', () => {
    const exact: GenesisPattern = { pattern: 'src/auth/login.ts', tier: 'T3', reason: 'exact' };
    const glob: GenesisPattern = { pattern: 'src/auth/**', tier: 'T3', reason: 'glob' };

    expect(calculateSpecificity(exact)).toBeGreaterThan(calculateSpecificity(glob));
  });

  it('gives higher score to more path segments', () => {
    const deep: GenesisPattern = { pattern: 'src/auth/utils/**', tier: 'T2', reason: 'deep' };
    const shallow: GenesisPattern = { pattern: 'src/**', tier: 'T2', reason: 'shallow' };

    expect(calculateSpecificity(deep)).toBeGreaterThan(calculateSpecificity(shallow));
  });

  it('gives higher score to more tags', () => {
    const moreTags: GenesisPattern = {
      match: { tags: ['security', 'production'] },
      tier: 'T3',
      reason: 'more tags',
    };
    const fewerTags: GenesisPattern = {
      match: { tags: ['security'] },
      tier: 'T3',
      reason: 'fewer tags',
    };

    expect(calculateSpecificity(moreTags)).toBeGreaterThan(calculateSpecificity(fewerTags));
  });
});

describe('matchPath', () => {
  it('matches exact path patterns', () => {
    const patterns: GenesisPattern[] = [
      { pattern: 'src/auth/login.ts', tier: 'T3', reason: 'auth' },
    ];
    const result = matchPath('src/auth/login.ts', patterns);

    expect(result.matched).toBe(true);
    expect(result.pattern?.tier).toBe('T3');
  });

  it('matches glob patterns with **', () => {
    const patterns: GenesisPattern[] = [
      { pattern: 'src/auth/**', tier: 'T3', reason: 'auth' },
    ];
    const result = matchPath('src/auth/utils/helper.ts', patterns);

    expect(result.matched).toBe(true);
    expect(result.pattern?.tier).toBe('T3');
  });

  it('returns highest specificity match', () => {
    const patterns: GenesisPattern[] = [
      { pattern: 'src/**', tier: 'T1', reason: 'generic' },
      { pattern: 'src/auth/**', tier: 'T2', reason: 'auth' },
      { pattern: 'src/auth/login.ts', tier: 'T3', reason: 'login' },
    ];
    const result = matchPath('src/auth/login.ts', patterns);

    expect(result.matched).toBe(true);
    expect(result.pattern?.tier).toBe('T3');
    expect(result.pattern?.reason).toBe('login');
  });

  it('returns not matched for no match', () => {
    const patterns: GenesisPattern[] = [
      { pattern: 'src/auth/**', tier: 'T3', reason: 'auth' },
    ];
    const result = matchPath('src/api/endpoint.ts', patterns);

    expect(result.matched).toBe(false);
  });
});

describe('matchTags', () => {
  it('matches when all tags present', () => {
    const patterns: GenesisPattern[] = [
      { match: { tags: ['security', 'production'] }, tier: 'T3', reason: 'sec+prod' },
    ];
    const result = matchTags(['security', 'production', 'api'], patterns);

    expect(result.matched).toBe(true);
    expect(result.pattern?.tier).toBe('T3');
  });

  it('does not match when tag missing', () => {
    const patterns: GenesisPattern[] = [
      { match: { tags: ['security', 'production'] }, tier: 'T3', reason: 'sec+prod' },
    ];
    const result = matchTags(['security'], patterns);

    expect(result.matched).toBe(false);
  });
});

describe('matchActor', () => {
  it('matches exact actor', () => {
    const patterns: GenesisPattern[] = [
      { match: { actor: 'agent:triage-bot' }, tier: 'T2', reason: 'triage bot' },
    ];
    const result = matchActor('agent:triage-bot', patterns);

    expect(result.matched).toBe(true);
  });

  it('matches actor wildcards', () => {
    const patterns: GenesisPattern[] = [
      { match: { actor: 'agent:*' }, tier: 'T2', reason: 'any agent' },
    ];

    expect(matchActor('agent:triage-bot', patterns).matched).toBe(true);
    expect(matchActor('agent:worker-1', patterns).matched).toBe(true);
    expect(matchActor('human:rashid', patterns).matched).toBe(false);
  });
});

describe('matchCombined', () => {
  it('matches path with highest priority', () => {
    const patterns: GenesisPattern[] = [
      { pattern: 'src/auth/**', tier: 'T3', reason: 'auth path' },
      { match: { actor: 'agent:*' }, tier: 'T2', reason: 'any agent' },
    ];
    const result = matchCombined(
      { paths: ['src/auth/login.ts'], tags: [], actor: 'agent:worker' },
      patterns
    );

    expect(result.matched).toBe(true);
    expect(result.pattern?.tier).toBe('T3');
  });

  it('returns highest specificity across dimensions', () => {
    const patterns: GenesisPattern[] = [
      { pattern: 'src/**', tier: 'T1', reason: 'generic src' },
      { match: { tags: ['security'] }, tier: 'T2', reason: 'security tag' },
    ];
    const result = matchCombined(
      { paths: ['src/utils.ts'], tags: ['security'], actor: 'human:dev' },
      patterns
    );

    // Path match gets boosted, so should win
    expect(result.matched).toBe(true);
  });

  it('matches combined tag and actor patterns', () => {
    const patterns: GenesisPattern[] = [
      {
        match: { tags: ['hotfix'], actor: 'human:*' },
        tier: 'T1',
        reason: 'human hotfix',
      },
    ];
    const result = matchCombined(
      { paths: [], tags: ['hotfix'], actor: 'human:rashid' },
      patterns
    );

    expect(result.matched).toBe(true);
    expect(result.pattern?.tier).toBe('T1');
  });
});
