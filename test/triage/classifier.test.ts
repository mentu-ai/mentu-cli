import { describe, it, expect } from 'vitest';
import {
  extractPaths,
  isActionable,
} from '../../src/triage/classifier.js';
import type { Memory } from '../../src/types.js';

describe('extractPaths', () => {
  it('extracts file paths from text', () => {
    const text = 'Update src/auth/login.ts and src/api/endpoint.ts';
    const paths = extractPaths(text);

    expect(paths).toContain('src/auth/login.ts');
    expect(paths).toContain('src/api/endpoint.ts');
  });

  it('extracts paths with various extensions', () => {
    const text = 'Edit config.json, styles.css, and index.html';
    const paths = extractPaths(text);

    expect(paths).toContain('config.json');
    expect(paths).toContain('styles.css');
    expect(paths).toContain('index.html');
  });

  it('removes leading ./ from paths', () => {
    const text = 'Check ./src/utils.ts';
    const paths = extractPaths(text);

    expect(paths).toContain('src/utils.ts');
    expect(paths).not.toContain('./src/utils.ts');
  });

  it('returns unique paths', () => {
    const text = 'src/file.ts and src/file.ts again';
    const paths = extractPaths(text);

    expect(paths.filter(p => p === 'src/file.ts').length).toBe(1);
  });

  it('handles paths in code blocks', () => {
    const text = 'Edit `src/auth/login.ts` for changes';
    const paths = extractPaths(text);

    expect(paths).toContain('src/auth/login.ts');
  });
});

describe('isActionable', () => {
  const createMemory = (body: string): Memory => ({
    id: 'mem_test',
    body,
    kind: null,
    actor: 'test',
    ts: new Date().toISOString(),
    annotations: [],
  });

  it('returns true for action verbs', () => {
    expect(isActionable(createMemory('Fix the login bug'))).toBe(true);
    expect(isActionable(createMemory('Add user authentication'))).toBe(true);
    expect(isActionable(createMemory('Implement new feature'))).toBe(true);
    expect(isActionable(createMemory('Update the config file'))).toBe(true);
    expect(isActionable(createMemory('Refactor the codebase'))).toBe(true);
    expect(isActionable(createMemory('Create new component'))).toBe(true);
  });

  it('returns false for non-actionable text', () => {
    expect(isActionable(createMemory('The system is running'))).toBe(false);
    expect(isActionable(createMemory('User reported an issue'))).toBe(false);
    expect(isActionable(createMemory('Observed slow performance'))).toBe(false);
  });

  it('matches word boundaries', () => {
    expect(isActionable(createMemory('prefix text'))).toBe(false); // 'fix' in prefix
    expect(isActionable(createMemory('Fix the issue'))).toBe(true);
  });
});
