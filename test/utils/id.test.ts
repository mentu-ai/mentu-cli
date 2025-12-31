import { describe, it, expect } from 'vitest';
import { generateId, getIdPrefix, isValidId, generateApiKey } from '../../src/utils/id.js';
import type { IdPrefix } from '../../src/utils/id.js';

describe('ID Generation', () => {
  describe('generateId', () => {
    it('should generate mem_ prefixed IDs', () => {
      const id = generateId('mem');
      expect(id).toMatch(/^mem_[a-f0-9]{8}$/);
    });

    it('should generate cmt_ prefixed IDs', () => {
      const id = generateId('cmt');
      expect(id).toMatch(/^cmt_[a-f0-9]{8}$/);
    });

    it('should generate op_ prefixed IDs', () => {
      const id = generateId('op');
      expect(id).toMatch(/^op_[a-f0-9]{8}$/);
    });

    it('should generate 8-character hex suffixes', () => {
      const id = generateId('mem');
      const suffix = id.split('_')[1];
      expect(suffix).toHaveLength(8);
      expect(suffix).toMatch(/^[a-f0-9]{8}$/);
    });

    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        ids.add(generateId('mem'));
      }
      expect(ids.size).toBe(1000);
    });

    it('should generate unique IDs across all prefixes', () => {
      const prefixes: IdPrefix[] = ['mem', 'cmt', 'op'];
      const ids = new Set<string>();

      for (const prefix of prefixes) {
        for (let i = 0; i < 100; i++) {
          ids.add(generateId(prefix));
        }
      }

      expect(ids.size).toBe(300);
    });

    it('should only use lowercase hex characters', () => {
      for (let i = 0; i < 100; i++) {
        const id = generateId('mem');
        const suffix = id.split('_')[1];
        expect(suffix).not.toMatch(/[A-F]/);
        expect(suffix).toMatch(/^[a-f0-9]+$/);
      }
    });

    it('should maintain consistent format', () => {
      for (let i = 0; i < 100; i++) {
        const id = generateId('cmt');
        expect(id.split('_')).toHaveLength(2);
        expect(id.indexOf('_')).toBe(3);
      }
    });
  });

  describe('getIdPrefix', () => {
    it('should extract mem prefix', () => {
      expect(getIdPrefix('mem_12345678')).toBe('mem');
    });

    it('should extract cmt prefix', () => {
      expect(getIdPrefix('cmt_abcdef01')).toBe('cmt');
    });

    it('should extract op prefix', () => {
      expect(getIdPrefix('op_99887766')).toBe('op');
    });

    it('should return null for invalid prefix', () => {
      expect(getIdPrefix('invalid_12345678')).toBeNull();
    });

    it('should return null for missing underscore', () => {
      expect(getIdPrefix('mem12345678')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(getIdPrefix('')).toBeNull();
    });

    it('should return null for malformed ID', () => {
      expect(getIdPrefix('m_12345678')).toBeNull();
    });

    it('should handle IDs with extra underscores', () => {
      expect(getIdPrefix('mem_1234_5678')).toBe('mem');
    });

    it('should not extract prefix from non-ID strings', () => {
      expect(getIdPrefix('memory_test')).toBeNull();
      expect(getIdPrefix('commitment_example')).toBeNull();
    });
  });

  describe('isValidId', () => {
    it('should validate correct mem_ IDs', () => {
      expect(isValidId('mem_12345678')).toBe(true);
      expect(isValidId('mem_abcdef01')).toBe(true);
      expect(isValidId('mem_00000000')).toBe(true);
    });

    it('should validate correct cmt_ IDs', () => {
      expect(isValidId('cmt_12345678')).toBe(true);
      expect(isValidId('cmt_fedcba98')).toBe(true);
    });

    it('should validate correct op_ IDs', () => {
      expect(isValidId('op_12345678')).toBe(true);
      expect(isValidId('op_abcdef01')).toBe(true);
    });

    it('should reject IDs with wrong prefix', () => {
      expect(isValidId('invalid_12345678')).toBe(false);
      expect(isValidId('memory_12345678')).toBe(false);
    });

    it('should reject IDs with too short suffix', () => {
      expect(isValidId('mem_1234567')).toBe(false);
      expect(isValidId('mem_123')).toBe(false);
    });

    it('should reject IDs with too long suffix', () => {
      expect(isValidId('mem_123456789')).toBe(false);
      expect(isValidId('mem_12345678abc')).toBe(false);
    });

    it('should reject IDs with uppercase hex', () => {
      expect(isValidId('mem_ABCDEF01')).toBe(false);
      expect(isValidId('mem_AbCdEf01')).toBe(false);
    });

    it('should reject IDs with non-hex characters', () => {
      expect(isValidId('mem_1234567g')).toBe(false);
      expect(isValidId('mem_xyz12345')).toBe(false);
    });

    it('should reject IDs with missing underscore', () => {
      expect(isValidId('mem12345678')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidId('')).toBe(false);
    });

    it('should reject IDs with spaces', () => {
      expect(isValidId('mem_ 12345678')).toBe(false);
      expect(isValidId('mem_1234 5678')).toBe(false);
    });

    it('should reject IDs with special characters in suffix', () => {
      expect(isValidId('mem_1234-678')).toBe(false);
      expect(isValidId('mem_1234_678')).toBe(false);
    });

    it('should validate IDs generated by generateId', () => {
      for (let i = 0; i < 100; i++) {
        const id = generateId('mem');
        expect(isValidId(id)).toBe(true);
      }
    });
  });

  describe('generateApiKey', () => {
    it('should generate a 48-character hex string', () => {
      const key = generateApiKey();
      expect(key).toHaveLength(48);
      expect(key).toMatch(/^[a-f0-9]{48}$/);
    });

    it('should generate unique API keys', () => {
      const keys = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        keys.add(generateApiKey());
      }
      expect(keys.size).toBe(1000);
    });

    it('should only use lowercase hex characters', () => {
      for (let i = 0; i < 100; i++) {
        const key = generateApiKey();
        expect(key).not.toMatch(/[A-F]/);
        expect(key).toMatch(/^[a-f0-9]+$/);
      }
    });

    it('should not contain hyphens or special characters', () => {
      for (let i = 0; i < 100; i++) {
        const key = generateApiKey();
        expect(key).not.toContain('-');
        expect(key).not.toMatch(/[^a-f0-9]/);
      }
    });

    it('should generate cryptographically random keys', () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();

      // Keys should be different
      expect(key1).not.toBe(key2);

      // Keys should not have obvious patterns
      const uniqueChars1 = new Set(key1.split('')).size;
      const uniqueChars2 = new Set(key2.split('')).size;

      // Should use multiple different hex characters
      expect(uniqueChars1).toBeGreaterThan(8);
      expect(uniqueChars2).toBeGreaterThan(8);
    });
  });
});
