import { describe, it, expect } from 'vitest';
import {
  toSlug,
  extractTitle,
  extractSummary,
  docsRequired,
} from '../../src/triage/doc-generator.js';

describe('toSlug', () => {
  it('converts to lowercase', () => {
    expect(toSlug('Hello World')).toBe('hello-world');
  });

  it('replaces special characters with hyphens', () => {
    expect(toSlug('Add user_authentication!')).toBe('add-user-authentication');
  });

  it('removes leading and trailing hyphens', () => {
    expect(toSlug('---test---')).toBe('test');
  });

  it('truncates long slugs', () => {
    const longTitle = 'A'.repeat(100);
    expect(toSlug(longTitle).length).toBeLessThanOrEqual(50);
  });
});

describe('extractTitle', () => {
  it('returns first line', () => {
    const body = 'Add user login\nMore details here';
    expect(extractTitle(body)).toBe('user login');
  });

  it('removes action verbs', () => {
    expect(extractTitle('Implement user auth')).toBe('user auth');
    expect(extractTitle('Fix the login bug')).toBe('the login bug');
    expect(extractTitle('Add new feature')).toBe('new feature');
  });

  it('truncates long titles', () => {
    const longBody = 'A'.repeat(100);
    const title = extractTitle(longBody);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.endsWith('...')).toBe(true);
  });
});

describe('extractSummary', () => {
  it('returns first two lines', () => {
    const body = 'Line one\nLine two\nLine three';
    const summary = extractSummary(body);
    expect(summary).toBe('Line one Line two');
  });

  it('truncates long summaries', () => {
    const longBody = 'A'.repeat(300);
    const summary = extractSummary(longBody);
    expect(summary.length).toBeLessThanOrEqual(200);
    expect(summary.endsWith('...')).toBe(true);
  });
});

describe('docsRequired', () => {
  it('returns true for T2 tier', () => {
    expect(docsRequired('T2')).toBe(true);
  });

  it('returns true for T3 tier', () => {
    expect(docsRequired('T3')).toBe(true);
  });

  it('returns false for T1 tier with default config', () => {
    expect(docsRequired('T1')).toBe(false);
  });

  it('respects custom requireDocsTiers', () => {
    expect(docsRequired('T1', ['T1', 'T2'])).toBe(true);
    expect(docsRequired('T3', ['T1', 'T2'])).toBe(false);
  });
});
