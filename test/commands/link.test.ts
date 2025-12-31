import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('link command', () => {
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

  describe('basic link', () => {
    it('should link memory to commitment', () => {
      const memory1 = JSON.parse(execSync('mentu capture "Bug report" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix bug" --source ${memory1.id} --json`, { encoding: 'utf-8' }));
      const memory2 = JSON.parse(execSync('mentu capture "Additional info" --json', { encoding: 'utf-8' }));

      const result = execSync(`mentu link ${memory2.id} ${commitment.id} --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.id).toMatch(/^op_[a-f0-9]{8}$/);
      expect(output.op).toBe('link');
      expect(output.source).toBe(memory2.id);
      expect(output.target).toBe(commitment.id);
      expect(output.kind).toBe('related'); // default
      expect(output.actor).toBeDefined();
      expect(output.ts).toBeDefined();
    });

    it('should link commitment to commitment', () => {
      const memory = JSON.parse(execSync('mentu capture "Issue" --json', { encoding: 'utf-8' }));
      const cmt1 = JSON.parse(execSync(`mentu commit "Task 1" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      const cmt2 = JSON.parse(execSync(`mentu commit "Task 2" --source ${memory.id} --json`, { encoding: 'utf-8' }));

      const result = execSync(`mentu link ${cmt1.id} ${cmt2.id} --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.source).toBe(cmt1.id);
      expect(output.target).toBe(cmt2.id);
    });

    it('should append to ledger file', () => {
      const memory1 = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory1.id} --json`, { encoding: 'utf-8' }));
      const memory2 = JSON.parse(execSync('mentu capture "Info" --json', { encoding: 'utf-8' }));

      execSync(`mentu link ${memory2.id} ${commitment.id}`, { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBe(4); // 2 captures + commit + link
      const linkOp = JSON.parse(lines[3]);
      expect(linkOp.op).toBe('link');
      expect(linkOp.payload.source).toBe(memory2.id);
      expect(linkOp.payload.target).toBe(commitment.id);
    });
  });

  describe('kind option', () => {
    it('should default to "related" kind', () => {
      const memory1 = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory1.id} --json`, { encoding: 'utf-8' }));
      const memory2 = JSON.parse(execSync('mentu capture "Info" --json', { encoding: 'utf-8' }));

      const result = execSync(`mentu link ${memory2.id} ${commitment.id} --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.kind).toBe('related');
    });

    it('should support --kind flag with "duplicate"', () => {
      const memory = JSON.parse(execSync('mentu capture "Issue" --json', { encoding: 'utf-8' }));
      const cmt1 = JSON.parse(execSync(`mentu commit "Task 1" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      const cmt2 = JSON.parse(execSync(`mentu commit "Task 2" --source ${memory.id} --json`, { encoding: 'utf-8' }));

      const result = execSync(`mentu link ${cmt2.id} ${cmt1.id} --kind duplicate --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.kind).toBe('duplicate');
    });

    it('should support -k short flag', () => {
      const memory1 = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory1.id} --json`, { encoding: 'utf-8' }));
      const memory2 = JSON.parse(execSync('mentu capture "Cause" --json', { encoding: 'utf-8' }));

      const result = execSync(`mentu link ${memory2.id} ${commitment.id} -k caused_by --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.kind).toBe('caused_by');
    });

    it('should support "blocks" kind', () => {
      const memory = JSON.parse(execSync('mentu capture "Issue" --json', { encoding: 'utf-8' }));
      const cmt1 = JSON.parse(execSync(`mentu commit "Blocked task" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      const cmt2 = JSON.parse(execSync(`mentu commit "Blocker" --source ${memory.id} --json`, { encoding: 'utf-8' }));

      const result = execSync(`mentu link ${cmt1.id} ${cmt2.id} --kind blocks --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.kind).toBe('blocks');
    });

    it('should support "evidence" kind', () => {
      const memory1 = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory1.id} --json`, { encoding: 'utf-8' }));
      const memory2 = JSON.parse(execSync('mentu capture "Proof" --json', { encoding: 'utf-8' }));

      const result = execSync(`mentu link ${memory2.id} ${commitment.id} --kind evidence --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.kind).toBe('evidence');
    });

    it('should reject invalid kind', () => {
      const memory1 = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory1.id} --json`, { encoding: 'utf-8' }));
      const memory2 = JSON.parse(execSync('mentu capture "Info" --json', { encoding: 'utf-8' }));

      try {
        execSync(`mentu link ${memory2.id} ${commitment.id} --kind invalid_kind --json`, { encoding: 'utf-8' });
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        const output = JSON.parse(err.stdout.toString());
        expect(output.error).toBe('E_INVALID_OP');
      }
    });
  });

  describe('reason option', () => {
    it('should support --reason flag', () => {
      const memory1 = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory1.id} --json`, { encoding: 'utf-8' }));
      const memory2 = JSON.parse(execSync('mentu capture "Info" --json', { encoding: 'utf-8' }));

      execSync(`mentu link ${memory2.id} ${commitment.id} --reason "Provides context"`, { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n');
      const linkOp = JSON.parse(lines[3]);

      expect(linkOp.payload.reason).toBe('Provides context');
    });

    it('should support -r short flag', () => {
      const memory1 = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory1.id} --json`, { encoding: 'utf-8' }));
      const memory2 = JSON.parse(execSync('mentu capture "Info" --json', { encoding: 'utf-8' }));

      execSync(`mentu link ${memory2.id} ${commitment.id} -r "Related issue"`, { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n');
      const linkOp = JSON.parse(lines[3]);

      expect(linkOp.payload.reason).toBe('Related issue');
    });

    it('should work without reason (optional)', () => {
      const memory1 = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory1.id} --json`, { encoding: 'utf-8' }));
      const memory2 = JSON.parse(execSync('mentu capture "Info" --json', { encoding: 'utf-8' }));

      execSync(`mentu link ${memory2.id} ${commitment.id}`, { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n');
      const linkOp = JSON.parse(lines[3]);

      expect(linkOp.payload.reason).toBeUndefined();
    });
  });

  describe('validation', () => {
    it('should validate source exists', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));

      try {
        execSync(`mentu link mem_nonexist ${commitment.id} --json`, { encoding: 'utf-8' });
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        const output = JSON.parse(err.stdout.toString());
        expect(output.error).toBe('E_REF_NOT_FOUND');
      }
    });

    it('should validate target exists', () => {
      const memory = JSON.parse(execSync('mentu capture "Info" --json', { encoding: 'utf-8' }));

      try {
        execSync(`mentu link ${memory.id} cmt_nonexist --json`, { encoding: 'utf-8' });
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        const output = JSON.parse(err.stdout.toString());
        expect(output.error).toBe('E_REF_NOT_FOUND');
      }
    });

    it('should validate target is a commitment', () => {
      const memory1 = JSON.parse(execSync('mentu capture "Info 1" --json', { encoding: 'utf-8' }));
      const memory2 = JSON.parse(execSync('mentu capture "Info 2" --json', { encoding: 'utf-8' }));

      try {
        execSync(`mentu link ${memory1.id} ${memory2.id} --json`, { encoding: 'utf-8' });
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        const output = JSON.parse(err.stdout.toString());
        expect(output.error).toBe('E_REF_NOT_FOUND');
      }
    });

    it('should reject link outside workspace', () => {
      const nonWorkspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mentu-no-workspace-'));
      process.chdir(nonWorkspaceDir);

      try {
        execSync('mentu link mem_12345678 cmt_12345678 --json', { encoding: 'utf-8' });
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
      const memory1 = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory1.id} --json`, { encoding: 'utf-8' }));
      const memory2 = JSON.parse(execSync('mentu capture "Info" --json', { encoding: 'utf-8' }));

      const result = execSync(`mentu link ${memory2.id} ${commitment.id} --actor alice --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.actor).toBe('alice');
    });

    it('should use default actor if not specified', () => {
      const memory1 = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory1.id} --json`, { encoding: 'utf-8' }));
      const memory2 = JSON.parse(execSync('mentu capture "Info" --json', { encoding: 'utf-8' }));

      const result = execSync(`mentu link ${memory2.id} ${commitment.id} --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.actor).toBeDefined();
      expect(typeof output.actor).toBe('string');
      expect(output.actor.length).toBeGreaterThan(0);
    });
  });

  describe('output format', () => {
    it('should output human-readable format by default', () => {
      const memory1 = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory1.id} --json`, { encoding: 'utf-8' }));
      const memory2 = JSON.parse(execSync('mentu capture "Info" --json', { encoding: 'utf-8' }));

      const result = execSync(`mentu link ${memory2.id} ${commitment.id}`, { encoding: 'utf-8' });

      expect(result).toContain('Linked');
      expect(result).toContain(memory2.id);
      expect(result).toContain(commitment.id);
      expect(result).toContain('Kind: related');
    });

    it('should output JSON format with --json flag', () => {
      const memory1 = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory1.id} --json`, { encoding: 'utf-8' }));
      const memory2 = JSON.parse(execSync('mentu capture "Info" --json', { encoding: 'utf-8' }));

      const result = execSync(`mentu link ${memory2.id} ${commitment.id} --json`, { encoding: 'utf-8' });

      expect(() => JSON.parse(result)).not.toThrow();
      const output = JSON.parse(result);
      expect(output.op).toBe('link');
    });
  });

  describe('complex scenarios', () => {
    it('should handle all options together', () => {
      const memory1 = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory1.id} --json`, { encoding: 'utf-8' }));
      const memory2 = JSON.parse(execSync('mentu capture "Root cause" --json', { encoding: 'utf-8' }));

      execSync(`mentu link ${memory2.id} ${commitment.id} --kind caused_by --reason "Identified root cause" --actor bob`, { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n');
      const linkOp = JSON.parse(lines[3]);

      expect(linkOp.payload.source).toBe(memory2.id);
      expect(linkOp.payload.target).toBe(commitment.id);
      expect(linkOp.payload.kind).toBe('caused_by');
      expect(linkOp.payload.reason).toBe('Identified root cause');
      expect(linkOp.actor).toBe('bob');
    });

    it('should allow multiple links to same commitment', () => {
      const source = JSON.parse(execSync('mentu capture "Original" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Task" --source ${source.id} --json`, { encoding: 'utf-8' }));
      const mem1 = JSON.parse(execSync('mentu capture "Info 1" --json', { encoding: 'utf-8' }));
      const mem2 = JSON.parse(execSync('mentu capture "Info 2" --json', { encoding: 'utf-8' }));

      const link1 = JSON.parse(execSync(`mentu link ${mem1.id} ${commitment.id} --json`, { encoding: 'utf-8' }));
      const link2 = JSON.parse(execSync(`mentu link ${mem2.id} ${commitment.id} --json`, { encoding: 'utf-8' }));

      expect(link1.target).toBe(commitment.id);
      expect(link2.target).toBe(commitment.id);
      expect(link1.source).toBe(mem1.id);
      expect(link2.source).toBe(mem2.id);
    });
  });

  describe('ledger integrity', () => {
    it('should create valid JSONL format', () => {
      const mem1 = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const cmt1 = JSON.parse(execSync(`mentu commit "Fix 1" --source ${mem1.id} --json`, { encoding: 'utf-8' }));
      const cmt2 = JSON.parse(execSync(`mentu commit "Fix 2" --source ${mem1.id} --json`, { encoding: 'utf-8' }));
      const mem2 = JSON.parse(execSync('mentu capture "Info" --json', { encoding: 'utf-8' }));

      execSync(`mentu link ${mem2.id} ${cmt1.id}`, { encoding: 'utf-8' });
      execSync(`mentu link ${cmt2.id} ${cmt1.id} --kind blocks`, { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBe(6); // 2 captures + 2 commits + 2 links
      lines.forEach(line => {
        expect(() => JSON.parse(line)).not.toThrow();
      });
    });

    it('should include workspace in operation', () => {
      const memory1 = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory1.id} --json`, { encoding: 'utf-8' }));
      const memory2 = JSON.parse(execSync('mentu capture "Info" --json', { encoding: 'utf-8' }));

      execSync(`mentu link ${memory2.id} ${commitment.id}`, { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n');
      const linkOp = JSON.parse(lines[3]);

      expect(linkOp.workspace).toBeDefined();
    });
  });
});
