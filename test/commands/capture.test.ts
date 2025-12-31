import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('capture command', () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mentu-cmd-test-'));
    process.chdir(testDir);
    execSync('mentu init', { encoding: 'utf-8' });
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('basic capture', () => {
    it('should create memory with body', () => {
      const result = execSync('mentu capture "Test memory" --json', { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.id).toMatch(/^mem_[a-f0-9]{8}$/);
      expect(output.op).toBe('capture');
      expect(output.body).toBe('Test memory');
      expect(output.actor).toBeDefined();
      expect(output.ts).toBeDefined();
    });

    it('should generate unique IDs for multiple captures', () => {
      const result1 = execSync('mentu capture "First memory" --json', { encoding: 'utf-8' });
      const result2 = execSync('mentu capture "Second memory" --json', { encoding: 'utf-8' });

      const output1 = JSON.parse(result1);
      const output2 = JSON.parse(result2);

      expect(output1.id).not.toBe(output2.id);
      expect(output1.id).toMatch(/^mem_[a-f0-9]{8}$/);
      expect(output2.id).toMatch(/^mem_[a-f0-9]{8}$/);
    });

    it('should trim whitespace from body', () => {
      const result = execSync('mentu capture "  Whitespace test  " --json', { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.body).toBe('Whitespace test');
    });

    it('should append to ledger file', () => {
      execSync('mentu capture "Test memory"', { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      expect(fs.existsSync(ledgerPath)).toBe(true);

      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines.length).toBe(1);

      const operation = JSON.parse(lines[0]);
      expect(operation.op).toBe('capture');
      expect(operation.payload.body).toBe('Test memory');
    });
  });

  describe('kind option', () => {
    it('should support --kind flag', () => {
      const result = execSync('mentu capture "Bug report" --kind bug_report --json', { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.kind).toBe('bug_report');
    });

    it('should support -k short flag', () => {
      const result = execSync('mentu capture "Evidence" -k evidence --json', { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.kind).toBe('evidence');
    });

    it('should work without kind (optional)', () => {
      const result = execSync('mentu capture "No kind specified" --json', { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.kind).toBeUndefined();
    });

    it('should allow custom kind values', () => {
      const result = execSync('mentu capture "Custom" --kind custom_type --json', { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.kind).toBe('custom_type');
    });
  });

  describe('source-key option', () => {
    it('should support --source-key flag', () => {
      const result = execSync('mentu capture "External item" --source-key github:123 --json', { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.source_key).toBe('github:123');
    });

    it('should reject duplicate source_key', () => {
      execSync('mentu capture "First" --source-key unique-1', { encoding: 'utf-8' });

      try {
        execSync('mentu capture "Second" --source-key unique-1 --json', { encoding: 'utf-8' });
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        const output = JSON.parse(err.stdout.toString());
        expect(output.error).toBe('E_DUPLICATE_SOURCE_KEY');
        expect(output.source_key).toBe('unique-1');
      }
    });

    it('should allow unique source_keys', () => {
      const result1 = execSync('mentu capture "First" --source-key key-1 --json', { encoding: 'utf-8' });
      const result2 = execSync('mentu capture "Second" --source-key key-2 --json', { encoding: 'utf-8' });

      const output1 = JSON.parse(result1);
      const output2 = JSON.parse(result2);

      expect(output1.source_key).toBe('key-1');
      expect(output2.source_key).toBe('key-2');
    });
  });

  describe('actor option', () => {
    it('should support --actor flag', () => {
      const result = execSync('mentu capture "Test" --actor alice --json', { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.actor).toBe('alice');
    });

    it('should use default actor if not specified', () => {
      const result = execSync('mentu capture "Test" --json', { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.actor).toBeDefined();
      expect(typeof output.actor).toBe('string');
      expect(output.actor.length).toBeGreaterThan(0);
    });
  });

  describe('validation', () => {
    it('should reject empty body', () => {
      try {
        execSync('mentu capture "" --json', { encoding: 'utf-8' });
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        const output = JSON.parse(err.stdout.toString());
        expect(output.error).toBe('E_EMPTY_BODY');
        expect(output.field).toBe('body');
      }
    });

    it('should reject whitespace-only body', () => {
      try {
        execSync('mentu capture "   " --json', { encoding: 'utf-8' });
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        const output = JSON.parse(err.stdout.toString());
        expect(output.error).toBe('E_EMPTY_BODY');
        expect(output.field).toBe('body');
      }
    });

    it('should reject capture outside workspace', () => {
      const nonWorkspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mentu-no-workspace-'));
      process.chdir(nonWorkspaceDir);

      try {
        execSync('mentu capture "Test" --json', { encoding: 'utf-8' });
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        const output = JSON.parse(err.stdout.toString());
        expect(output.error).toBe('E_NO_WORKSPACE');
      } finally {
        process.chdir(testDir);
        fs.rmSync(nonWorkspaceDir, { recursive: true, force: true });
      }
    });
  });

  describe('output format', () => {
    it('should output human-readable format by default', () => {
      const result = execSync('mentu capture "Test memory"', { encoding: 'utf-8' });

      expect(result).toContain('Created memory');
      expect(result).toMatch(/mem_[a-f0-9]{8}/);
    });

    it('should output JSON format with --json flag', () => {
      const result = execSync('mentu capture "Test memory" --json', { encoding: 'utf-8' });

      expect(() => JSON.parse(result)).not.toThrow();
      const output = JSON.parse(result);
      expect(output.op).toBe('capture');
    });

    it('should include kind in human-readable output', () => {
      const result = execSync('mentu capture "Bug" --kind bug_report', { encoding: 'utf-8' });

      expect(result).toContain('Created memory');
      expect(result).toContain('Kind: bug_report');
    });
  });

  describe('complex scenarios', () => {
    it('should handle body with special characters', () => {
      const result = execSync('mentu capture "Test with \\\"quotes\\\" and \'apostrophes\'" --json', { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.body).toBe('Test with "quotes" and \'apostrophes\'');
    });

    it('should handle multiline body', () => {
      const multilineBody = 'Line 1\\nLine 2\\nLine 3';
      const result = execSync(`mentu capture "${multilineBody}" --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.body).toContain('Line 1');
      expect(output.body).toContain('Line 2');
    });

    it('should handle all options together', () => {
      const result = execSync('mentu capture "Complete test" --kind evidence --source-key ext:999 --actor bob --json', { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.body).toBe('Complete test');
      expect(output.kind).toBe('evidence');
      expect(output.source_key).toBe('ext:999');
      expect(output.actor).toBe('bob');
    });
  });

  describe('ledger integrity', () => {
    it('should create valid JSONL format', () => {
      execSync('mentu capture "First"', { encoding: 'utf-8' });
      execSync('mentu capture "Second"', { encoding: 'utf-8' });
      execSync('mentu capture "Third"', { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBe(3);
      lines.forEach(line => {
        expect(() => JSON.parse(line)).not.toThrow();
      });
    });

    it('should include workspace in operation', () => {
      const result = execSync('mentu capture "Test" --json', { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const operation = JSON.parse(content.trim());

      expect(operation.workspace).toBeDefined();
    });
  });
});
