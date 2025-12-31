import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('dismiss command', () => {
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

  describe('basic dismiss', () => {
    it('should dismiss memory with reason', () => {
      const memory = JSON.parse(execSync('mentu capture "Spam message" --json', { encoding: 'utf-8' }));

      const result = execSync(`mentu dismiss ${memory.id} --reason "Not actionable" --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.id).toMatch(/^op_[a-f0-9]{8}$/);
      expect(output.op).toBe('dismiss');
      expect(output.memory).toBe(memory.id);
      expect(output.reason).toBe('Not actionable');
      expect(output.actor).toBeDefined();
      expect(output.ts).toBeDefined();
    });

    it('should append to ledger file', () => {
      const memory = JSON.parse(execSync('mentu capture "Noise" --json', { encoding: 'utf-8' }));

      execSync(`mentu dismiss ${memory.id} --reason "Spam"`, { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBe(2); // capture + dismiss
      const dismissOp = JSON.parse(lines[1]);
      expect(dismissOp.op).toBe('dismiss');
      expect(dismissOp.payload.memory).toBe(memory.id);
      expect(dismissOp.payload.reason).toBe('Spam');
    });
  });

  describe('reason option', () => {
    it('should require --reason flag', () => {
      const memory = JSON.parse(execSync('mentu capture "Test" --json', { encoding: 'utf-8' }));

      try {
        execSync(`mentu dismiss ${memory.id} --json`, { encoding: 'utf-8' });
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        // Commander will exit with error for missing required option
        expect(err.status).not.toBe(0);
      }
    });

    it('should support -r short flag', () => {
      const memory = JSON.parse(execSync('mentu capture "Test" --json', { encoding: 'utf-8' }));

      const result = execSync(`mentu dismiss ${memory.id} -r "Duplicate" --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.reason).toBe('Duplicate');
    });

    it('should handle reason with special characters', () => {
      const memory = JSON.parse(execSync('mentu capture "Test" --json', { encoding: 'utf-8' }));

      const result = execSync(`mentu dismiss ${memory.id} --reason "Won't fix - out of scope" --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.reason).toBe("Won't fix - out of scope");
    });
  });

  describe('tags option', () => {
    it('should support --tags flag', () => {
      const memory = JSON.parse(execSync('mentu capture "Noise" --json', { encoding: 'utf-8' }));

      execSync(`mentu dismiss ${memory.id} --reason "Spam" --tags spam,automated`, { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n');
      const dismissOp = JSON.parse(lines[1]);

      expect(dismissOp.payload.tags).toEqual(['spam', 'automated']);
    });

    it('should support -t short flag', () => {
      const memory = JSON.parse(execSync('mentu capture "Test" --json', { encoding: 'utf-8' }));

      execSync(`mentu dismiss ${memory.id} --reason "Out of scope" -t wontfix`, { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n');
      const dismissOp = JSON.parse(lines[1]);

      expect(dismissOp.payload.tags).toEqual(['wontfix']);
    });

    it('should work without tags (optional)', () => {
      const memory = JSON.parse(execSync('mentu capture "Test" --json', { encoding: 'utf-8' }));

      execSync(`mentu dismiss ${memory.id} --reason "Not needed"`, { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n');
      const dismissOp = JSON.parse(lines[1]);

      expect(dismissOp.payload.tags).toBeUndefined();
    });

    it('should trim whitespace from tags', () => {
      const memory = JSON.parse(execSync('mentu capture "Test" --json', { encoding: 'utf-8' }));

      execSync(`mentu dismiss ${memory.id} --reason "Spam" --tags " spam , noise , automated "`, { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n');
      const dismissOp = JSON.parse(lines[1]);

      expect(dismissOp.payload.tags).toEqual(['spam', 'noise', 'automated']);
    });
  });

  describe('validation', () => {
    it('should validate memory exists', () => {
      try {
        execSync('mentu dismiss mem_nonexist --reason "Test" --json', { encoding: 'utf-8' });
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        const output = JSON.parse(err.stdout.toString());
        expect(output.error).toBe('E_REF_NOT_FOUND');
      }
    });

    it('should reject dismissing a commitment', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));

      try {
        execSync(`mentu dismiss ${commitment.id} --reason "Test" --json`, { encoding: 'utf-8' });
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        const output = JSON.parse(err.stdout.toString());
        expect(output.error).toBe('E_REF_NOT_FOUND');
      }
    });

    it('should reject dismissing memory that is source of commitment', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      execSync(`mentu commit "Fix" --source ${memory.id}`, { encoding: 'utf-8' });

      try {
        execSync(`mentu dismiss ${memory.id} --reason "Not needed" --json`, { encoding: 'utf-8' });
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        const output = JSON.parse(err.stdout.toString());
        expect(output.error).toBe('E_CONSTRAINT_VIOLATED');
      }
    });

    it('should allow dismissing memory that is linked but not a source', () => {
      const mem1 = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${mem1.id} --json`, { encoding: 'utf-8' }));
      const mem2 = JSON.parse(execSync('mentu capture "Additional info" --json', { encoding: 'utf-8' }));

      execSync(`mentu link ${mem2.id} ${commitment.id}`, { encoding: 'utf-8' });

      const result = execSync(`mentu dismiss ${mem2.id} --reason "Not relevant after all" --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.op).toBe('dismiss');
      expect(output.memory).toBe(mem2.id);
    });

    it('should reject dismiss outside workspace', () => {
      const nonWorkspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mentu-no-workspace-'));
      process.chdir(nonWorkspaceDir);

      try {
        execSync('mentu dismiss mem_12345678 --reason "Test" --json', { encoding: 'utf-8' });
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

  describe('actor option', () => {
    it('should support --actor flag', () => {
      const memory = JSON.parse(execSync('mentu capture "Noise" --json', { encoding: 'utf-8' }));

      const result = execSync(`mentu dismiss ${memory.id} --reason "Spam" --actor alice --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.actor).toBe('alice');
    });

    it('should use default actor if not specified', () => {
      const memory = JSON.parse(execSync('mentu capture "Noise" --json', { encoding: 'utf-8' }));

      const result = execSync(`mentu dismiss ${memory.id} --reason "Spam" --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.actor).toBeDefined();
      expect(typeof output.actor).toBe('string');
      expect(output.actor.length).toBeGreaterThan(0);
    });
  });

  describe('output format', () => {
    it('should output human-readable format by default', () => {
      const memory = JSON.parse(execSync('mentu capture "Spam" --json', { encoding: 'utf-8' }));

      const result = execSync(`mentu dismiss ${memory.id} --reason "Not actionable"`, { encoding: 'utf-8' });

      expect(result).toContain('Dismissed memory');
      expect(result).toContain(memory.id);
      expect(result).toContain('Reason: Not actionable');
    });

    it('should output JSON format with --json flag', () => {
      const memory = JSON.parse(execSync('mentu capture "Spam" --json', { encoding: 'utf-8' }));

      const result = execSync(`mentu dismiss ${memory.id} --reason "Not actionable" --json`, { encoding: 'utf-8' });

      expect(() => JSON.parse(result)).not.toThrow();
      const output = JSON.parse(result);
      expect(output.op).toBe('dismiss');
    });
  });

  describe('complex scenarios', () => {
    it('should handle all options together', () => {
      const memory = JSON.parse(execSync('mentu capture "Spam email" --json', { encoding: 'utf-8' }));

      execSync(`mentu dismiss ${memory.id} --reason "Automated spam" --tags spam,automated --actor bob`, { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n');
      const dismissOp = JSON.parse(lines[1]);

      expect(dismissOp.payload.memory).toBe(memory.id);
      expect(dismissOp.payload.reason).toBe('Automated spam');
      expect(dismissOp.payload.tags).toEqual(['spam', 'automated']);
      expect(dismissOp.actor).toBe('bob');
    });

    it('should allow dismissing multiple memories', () => {
      const mem1 = JSON.parse(execSync('mentu capture "Spam 1" --json', { encoding: 'utf-8' }));
      const mem2 = JSON.parse(execSync('mentu capture "Spam 2" --json', { encoding: 'utf-8' }));
      const mem3 = JSON.parse(execSync('mentu capture "Spam 3" --json', { encoding: 'utf-8' }));

      execSync(`mentu dismiss ${mem1.id} --reason "Spam"`, { encoding: 'utf-8' });
      execSync(`mentu dismiss ${mem2.id} --reason "Spam"`, { encoding: 'utf-8' });
      execSync(`mentu dismiss ${mem3.id} --reason "Spam"`, { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBe(6); // 3 captures + 3 dismisses
    });

    it('should allow re-dismissing with different reason (append-only)', () => {
      // In an append-only system, dismissing again just adds another dismiss operation
      const memory = JSON.parse(execSync('mentu capture "Noise" --json', { encoding: 'utf-8' }));
      execSync(`mentu dismiss ${memory.id} --reason "Spam"`, { encoding: 'utf-8' });

      // Second dismiss should succeed (append-only behavior)
      const result = execSync(`mentu dismiss ${memory.id} --reason "Really spam" --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.op).toBe('dismiss');
      expect(output.reason).toBe('Really spam');
    });
  });

  describe('ledger integrity', () => {
    it('should create valid JSONL format', () => {
      const mem1 = JSON.parse(execSync('mentu capture "Spam 1" --json', { encoding: 'utf-8' }));
      const mem2 = JSON.parse(execSync('mentu capture "Spam 2" --json', { encoding: 'utf-8' }));
      const mem3 = JSON.parse(execSync('mentu capture "Valid" --json', { encoding: 'utf-8' }));

      execSync(`mentu dismiss ${mem1.id} --reason "Spam"`, { encoding: 'utf-8' });
      execSync(`mentu dismiss ${mem2.id} --reason "Duplicate"`, { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBe(5); // 3 captures + 2 dismisses
      lines.forEach(line => {
        expect(() => JSON.parse(line)).not.toThrow();
      });
    });

    it('should include workspace in operation', () => {
      const memory = JSON.parse(execSync('mentu capture "Spam" --json', { encoding: 'utf-8' }));
      execSync(`mentu dismiss ${memory.id} --reason "Not actionable"`, { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n');
      const dismissOp = JSON.parse(lines[1]);

      expect(dismissOp.workspace).toBeDefined();
    });
  });
});
