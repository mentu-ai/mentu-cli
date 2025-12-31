import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('commit command', () => {
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

  describe('basic commit', () => {
    it('should create commitment with body and source', () => {
      const memResult = execSync('mentu capture "Bug report" --json', { encoding: 'utf-8' });
      const memory = JSON.parse(memResult);

      const cmtResult = execSync(`mentu commit "Fix the bug" --source ${memory.id} --json`, { encoding: 'utf-8' });
      const output = JSON.parse(cmtResult);

      expect(output.id).toMatch(/^cmt_[a-f0-9]{8}$/);
      expect(output.op).toBe('commit');
      expect(output.body).toBe('Fix the bug');
      expect(output.source).toBe(memory.id);
      expect(output.actor).toBeDefined();
      expect(output.ts).toBeDefined();
    });

    it('should generate unique IDs for multiple commits', () => {
      const memResult = execSync('mentu capture "Issue" --json', { encoding: 'utf-8' });
      const memory = JSON.parse(memResult);

      const cmt1 = JSON.parse(execSync(`mentu commit "Task 1" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      const cmt2 = JSON.parse(execSync(`mentu commit "Task 2" --source ${memory.id} --json`, { encoding: 'utf-8' }));

      expect(cmt1.id).not.toBe(cmt2.id);
      expect(cmt1.id).toMatch(/^cmt_[a-f0-9]{8}$/);
      expect(cmt2.id).toMatch(/^cmt_[a-f0-9]{8}$/);
    });

    it('should trim whitespace from body', () => {
      const memory = JSON.parse(execSync('mentu capture "Test" --json', { encoding: 'utf-8' }));
      const result = execSync(`mentu commit "  Whitespace  " --source ${memory.id} --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.body).toBe('Whitespace');
    });

    it('should append to ledger file', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      execSync(`mentu commit "Fix bug" --source ${memory.id}`, { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBe(2); // capture + commit
      const commitOp = JSON.parse(lines[1]);
      expect(commitOp.op).toBe('commit');
      expect(commitOp.payload.body).toBe('Fix bug');
    });
  });

  describe('source option', () => {
    it('should require --source flag', () => {
      try {
        execSync('mentu commit "Task" --json', { encoding: 'utf-8' });
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        // Commander will exit with error for missing required option
        expect(err.status).not.toBe(0);
      }
    });

    it('should support -s short flag', () => {
      const memory = JSON.parse(execSync('mentu capture "Issue" --json', { encoding: 'utf-8' }));
      const result = execSync(`mentu commit "Task" -s ${memory.id} --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.source).toBe(memory.id);
    });

    it('should validate source exists', () => {
      try {
        execSync('mentu commit "Task" --source mem_nonexist --json', { encoding: 'utf-8' });
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        const output = JSON.parse(err.stdout.toString());
        expect(output.error).toBe('E_REF_NOT_FOUND');
        expect(output.field).toBe('source');
        expect(output.value).toBe('mem_nonexist');
      }
    });

    it('should allow multiple commitments from same memory', () => {
      const memory = JSON.parse(execSync('mentu capture "Complex issue" --json', { encoding: 'utf-8' }));

      const cmt1 = JSON.parse(execSync(`mentu commit "Subtask 1" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      const cmt2 = JSON.parse(execSync(`mentu commit "Subtask 2" --source ${memory.id} --json`, { encoding: 'utf-8' }));

      expect(cmt1.source).toBe(memory.id);
      expect(cmt2.source).toBe(memory.id);
      expect(cmt1.id).not.toBe(cmt2.id);
    });
  });

  describe('tags option', () => {
    it('should support --tags flag', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      execSync(`mentu commit "Fix" --source ${memory.id} --tags critical,security`, { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n');
      const commitOp = JSON.parse(lines[1]);

      expect(commitOp.payload.tags).toEqual(['critical', 'security']);
    });

    it('should support -t short flag', () => {
      const memory = JSON.parse(execSync('mentu capture "Task" --json', { encoding: 'utf-8' }));
      execSync(`mentu commit "Work" --source ${memory.id} -t urgent`, { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n');
      const commitOp = JSON.parse(lines[1]);

      expect(commitOp.payload.tags).toEqual(['urgent']);
    });

    it('should work without tags (optional)', () => {
      const memory = JSON.parse(execSync('mentu capture "Task" --json', { encoding: 'utf-8' }));
      execSync(`mentu commit "Work" --source ${memory.id} --json`, { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n');
      const commitOp = JSON.parse(lines[1]);

      expect(commitOp.payload.tags).toBeUndefined();
    });

    it('should trim whitespace from tags', () => {
      const memory = JSON.parse(execSync('mentu capture "Task" --json', { encoding: 'utf-8' }));
      execSync(`mentu commit "Work" --source ${memory.id} --tags "urgent , bug , feature"`, { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n');
      const commitOp = JSON.parse(lines[1]);

      expect(commitOp.payload.tags).toEqual(['urgent', 'bug', 'feature']);
    });
  });

  describe('actor option', () => {
    it('should support --actor flag', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const result = execSync(`mentu commit "Fix" --source ${memory.id} --actor alice --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.actor).toBe('alice');
    });

    it('should use default actor if not specified', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const result = execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.actor).toBeDefined();
      expect(typeof output.actor).toBe('string');
      expect(output.actor.length).toBeGreaterThan(0);
    });
  });

  describe('validation', () => {
    it('should reject empty body', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));

      try {
        execSync(`mentu commit "" --source ${memory.id} --json`, { encoding: 'utf-8' });
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        const output = JSON.parse(err.stdout.toString());
        expect(output.error).toBe('E_EMPTY_BODY');
        expect(output.field).toBe('body');
      }
    });

    it('should reject whitespace-only body', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));

      try {
        execSync(`mentu commit "   " --source ${memory.id} --json`, { encoding: 'utf-8' });
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        const output = JSON.parse(err.stdout.toString());
        expect(output.error).toBe('E_EMPTY_BODY');
        expect(output.field).toBe('body');
      }
    });

    it('should reject commit outside workspace', () => {
      const nonWorkspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mentu-no-workspace-'));
      process.chdir(nonWorkspaceDir);

      try {
        execSync('mentu commit "Task" --source mem_12345678 --json', { encoding: 'utf-8' });
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
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const result = execSync(`mentu commit "Fix bug" --source ${memory.id}`, { encoding: 'utf-8' });

      expect(result).toContain('Created commitment');
      expect(result).toMatch(/cmt_[a-f0-9]{8}/);
      expect(result).toContain('Source:');
      expect(result).toContain(memory.id);
    });

    it('should output JSON format with --json flag', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const result = execSync(`mentu commit "Fix bug" --source ${memory.id} --json`, { encoding: 'utf-8' });

      expect(() => JSON.parse(result)).not.toThrow();
      const output = JSON.parse(result);
      expect(output.op).toBe('commit');
    });
  });

  describe('complex scenarios', () => {
    it('should handle body with special characters', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const result = execSync(`mentu commit "Fix \\"quoted\\" issue" --source ${memory.id} --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.body).toBe('Fix "quoted" issue');
    });

    it('should handle all options together', () => {
      const memory = JSON.parse(execSync('mentu capture "Complex issue" --json', { encoding: 'utf-8' }));
      execSync(`mentu commit "Complete task" --source ${memory.id} --tags urgent,bug --actor bob`, { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n');
      const commitOp = JSON.parse(lines[1]);

      expect(commitOp.payload.body).toBe('Complete task');
      expect(commitOp.payload.source).toBe(memory.id);
      expect(commitOp.payload.tags).toEqual(['urgent', 'bug']);
      expect(commitOp.actor).toBe('bob');
    });
  });

  describe('ledger integrity', () => {
    it('should create valid JSONL format', () => {
      const mem1 = JSON.parse(execSync('mentu capture "Bug 1" --json', { encoding: 'utf-8' }));
      const mem2 = JSON.parse(execSync('mentu capture "Bug 2" --json', { encoding: 'utf-8' }));

      execSync(`mentu commit "Fix 1" --source ${mem1.id}`, { encoding: 'utf-8' });
      execSync(`mentu commit "Fix 2" --source ${mem2.id}`, { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBe(4); // 2 captures + 2 commits
      lines.forEach(line => {
        expect(() => JSON.parse(line)).not.toThrow();
      });
    });

    it('should include workspace in operation', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      execSync(`mentu commit "Fix" --source ${memory.id}`, { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n');
      const commitOp = JSON.parse(lines[1]);

      expect(commitOp.workspace).toBeDefined();
    });
  });
});
