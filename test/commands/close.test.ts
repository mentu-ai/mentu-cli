import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('close command', () => {
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

  describe('close with evidence', () => {
    it('should close commitment with evidence', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      const evidence = JSON.parse(execSync('mentu capture "Fixed" --kind evidence --json', { encoding: 'utf-8' }));

      const result = execSync(`mentu close ${commitment.id} --evidence ${evidence.id} --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.id).toMatch(/^op_[a-f0-9]{8}$/);
      expect(output.op).toBe('close');
      expect(output.commitment).toBe(commitment.id);
      expect(output.evidence).toBe(evidence.id);
      expect(output.actor).toBeDefined();
      expect(output.ts).toBeDefined();
    });

    it('should support -e short flag', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      const evidence = JSON.parse(execSync('mentu capture "Done" --json', { encoding: 'utf-8' }));

      const result = execSync(`mentu close ${commitment.id} -e ${evidence.id} --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.evidence).toBe(evidence.id);
    });

    it('should append to ledger file', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      const evidence = JSON.parse(execSync('mentu capture "Fixed" --json', { encoding: 'utf-8' }));

      execSync(`mentu close ${commitment.id} --evidence ${evidence.id}`, { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBe(4); // 2 captures + commit + close
      const closeOp = JSON.parse(lines[3]);
      expect(closeOp.op).toBe('close');
      expect(closeOp.payload.commitment).toBe(commitment.id);
      expect(closeOp.payload.evidence).toBe(evidence.id);
    });

    it('should validate evidence exists', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));

      try {
        execSync(`mentu close ${commitment.id} --evidence mem_nonexist --json`, { encoding: 'utf-8' });
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        const output = JSON.parse(err.stdout.toString());
        expect(output.error).toBe('E_REF_NOT_FOUND');
        expect(output.field).toBe('evidence');
        expect(output.value).toBe('mem_nonexist');
      }
    });
  });

  describe('close as duplicate', () => {
    it('should close commitment as duplicate', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const cmt1 = JSON.parse(execSync(`mentu commit "Fix 1" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      const cmt2 = JSON.parse(execSync(`mentu commit "Fix 2" --source ${memory.id} --json`, { encoding: 'utf-8' }));

      const result = execSync(`mentu close ${cmt2.id} --duplicate-of ${cmt1.id} --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.id).toMatch(/^op_[a-f0-9]{8}$/);
      expect(output.op).toBe('close');
      expect(output.commitment).toBe(cmt2.id);
      expect(output.duplicate_of).toBe(cmt1.id);
      expect(output.evidence).toBeUndefined();
    });

    it('should support -d short flag', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const cmt1 = JSON.parse(execSync(`mentu commit "Fix 1" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      const cmt2 = JSON.parse(execSync(`mentu commit "Fix 2" --source ${memory.id} --json`, { encoding: 'utf-8' }));

      const result = execSync(`mentu close ${cmt2.id} -d ${cmt1.id} --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.duplicate_of).toBe(cmt1.id);
    });

    it('should validate duplicate target exists', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));

      try {
        execSync(`mentu close ${commitment.id} --duplicate-of cmt_nonexist --json`, { encoding: 'utf-8' });
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        const output = JSON.parse(err.stdout.toString());
        expect(output.error).toBe('E_REF_NOT_FOUND');
        expect(output.field).toBe('duplicate_of');
        expect(output.value).toBe('cmt_nonexist');
      }
    });

    it('should append duplicate close to ledger', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const cmt1 = JSON.parse(execSync(`mentu commit "Fix 1" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      const cmt2 = JSON.parse(execSync(`mentu commit "Fix 2" --source ${memory.id} --json`, { encoding: 'utf-8' }));

      execSync(`mentu close ${cmt2.id} --duplicate-of ${cmt1.id}`, { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBe(4); // capture + 2 commits + close
      const closeOp = JSON.parse(lines[3]);
      expect(closeOp.op).toBe('close');
      expect(closeOp.payload.duplicate_of).toBe(cmt1.id);
      expect(closeOp.payload.evidence).toBeUndefined();
    });
  });

  describe('validation', () => {
    it('should require either evidence or duplicate-of', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));

      try {
        execSync(`mentu close ${commitment.id} --json`, { encoding: 'utf-8' });
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        const output = JSON.parse(err.stdout.toString());
        expect(output.error).toBe('E_MISSING_FIELD');
        expect(output.field).toBe('evidence');
      }
    });

    it('should reject both evidence and duplicate-of', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const cmt1 = JSON.parse(execSync(`mentu commit "Fix 1" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      const cmt2 = JSON.parse(execSync(`mentu commit "Fix 2" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      const evidence = JSON.parse(execSync('mentu capture "Done" --json', { encoding: 'utf-8' }));

      try {
        execSync(`mentu close ${cmt2.id} --evidence ${evidence.id} --duplicate-of ${cmt1.id} --json`, { encoding: 'utf-8' });
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        const output = JSON.parse(err.stdout.toString());
        expect(output.error).toBe('E_INVALID_OP');
      }
    });

    it('should reject close on nonexistent commitment', () => {
      const evidence = JSON.parse(execSync('mentu capture "Done" --json', { encoding: 'utf-8' }));

      try {
        execSync(`mentu close cmt_nonexist --evidence ${evidence.id} --json`, { encoding: 'utf-8' });
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        const output = JSON.parse(err.stdout.toString());
        expect(output.error).toBe('E_REF_NOT_FOUND');
        expect(output.field).toBe('commitment');
        expect(output.value).toBe('cmt_nonexist');
      }
    });

    it('should reject close on already closed commitment', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      const evidence = JSON.parse(execSync('mentu capture "Done" --json', { encoding: 'utf-8' }));

      execSync(`mentu close ${commitment.id} --evidence ${evidence.id}`, { encoding: 'utf-8' });

      const evidence2 = JSON.parse(execSync('mentu capture "Done again" --json', { encoding: 'utf-8' }));
      try {
        execSync(`mentu close ${commitment.id} --evidence ${evidence2.id} --json`, { encoding: 'utf-8' });
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        const output = JSON.parse(err.stdout.toString());
        expect(output.error).toBe('E_ALREADY_CLOSED');
        expect(output.commitment).toBe(commitment.id);
      }
    });

    it('should reject close on duplicate commitment', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const cmt1 = JSON.parse(execSync(`mentu commit "Fix 1" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      const cmt2 = JSON.parse(execSync(`mentu commit "Fix 2" --source ${memory.id} --json`, { encoding: 'utf-8' }));

      execSync(`mentu close ${cmt2.id} --duplicate-of ${cmt1.id}`, { encoding: 'utf-8' });

      const evidence = JSON.parse(execSync('mentu capture "Done" --json', { encoding: 'utf-8' }));
      try {
        execSync(`mentu close ${cmt2.id} --evidence ${evidence.id} --json`, { encoding: 'utf-8' });
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        const output = JSON.parse(err.stdout.toString());
        expect(output.error).toBe('E_ALREADY_CLOSED');
      }
    });

    it('should reject close outside workspace', () => {
      const nonWorkspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mentu-no-workspace-'));
      process.chdir(nonWorkspaceDir);

      try {
        execSync('mentu close cmt_12345678 --evidence mem_12345678 --json', { encoding: 'utf-8' });
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
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      const evidence = JSON.parse(execSync('mentu capture "Done" --json', { encoding: 'utf-8' }));

      const result = execSync(`mentu close ${commitment.id} --evidence ${evidence.id} --actor alice --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.actor).toBe('alice');
    });

    it('should use default actor if not specified', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      const evidence = JSON.parse(execSync('mentu capture "Done" --json', { encoding: 'utf-8' }));

      const result = execSync(`mentu close ${commitment.id} --evidence ${evidence.id} --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.actor).toBeDefined();
      expect(typeof output.actor).toBe('string');
      expect(output.actor.length).toBeGreaterThan(0);
    });
  });

  describe('output format', () => {
    it('should output human-readable format by default for evidence close', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      const evidence = JSON.parse(execSync('mentu capture "Done" --json', { encoding: 'utf-8' }));

      const result = execSync(`mentu close ${commitment.id} --evidence ${evidence.id}`, { encoding: 'utf-8' });

      expect(result).toContain('Closed commitment');
      expect(result).toContain(commitment.id);
      expect(result).toContain('Evidence:');
      expect(result).toContain(evidence.id);
    });

    it('should output human-readable format for duplicate close', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const cmt1 = JSON.parse(execSync(`mentu commit "Fix 1" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      const cmt2 = JSON.parse(execSync(`mentu commit "Fix 2" --source ${memory.id} --json`, { encoding: 'utf-8' }));

      const result = execSync(`mentu close ${cmt2.id} --duplicate-of ${cmt1.id}`, { encoding: 'utf-8' });

      expect(result).toContain('Closed commitment');
      expect(result).toContain(cmt2.id);
      expect(result).toContain('duplicate of');
      expect(result).toContain(cmt1.id);
    });

    it('should output JSON format with --json flag', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      const evidence = JSON.parse(execSync('mentu capture "Done" --json', { encoding: 'utf-8' }));

      const result = execSync(`mentu close ${commitment.id} --evidence ${evidence.id} --json`, { encoding: 'utf-8' });

      expect(() => JSON.parse(result)).not.toThrow();
      const output = JSON.parse(result);
      expect(output.op).toBe('close');
    });
  });

  describe('state transitions', () => {
    it('should transition commitment to closed state', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      const evidence = JSON.parse(execSync('mentu capture "Done" --json', { encoding: 'utf-8' }));

      const beforeStatus = JSON.parse(execSync('mentu status --json', { encoding: 'utf-8' }));
      expect(beforeStatus.open).toHaveLength(1);
      expect(beforeStatus.closed).toHaveLength(0);

      execSync(`mentu close ${commitment.id} --evidence ${evidence.id} --actor alice`, { encoding: 'utf-8' });

      const afterStatus = JSON.parse(execSync('mentu status --json', { encoding: 'utf-8' }));
      expect(afterStatus.open).toHaveLength(0);
      expect(afterStatus.closed).toHaveLength(1);
      expect(afterStatus.closed[0].id).toBe(commitment.id);
      expect(afterStatus.closed[0].evidence).toBe(evidence.id);
      expect(afterStatus.closed[0].closed_by).toBe('alice');
    });

    it('should allow closing claimed commitment', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      const evidence = JSON.parse(execSync('mentu capture "Done" --json', { encoding: 'utf-8' }));

      execSync(`mentu claim ${commitment.id} --actor alice`, { encoding: 'utf-8' });

      const result = execSync(`mentu close ${commitment.id} --evidence ${evidence.id} --actor alice --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.op).toBe('close');
      expect(output.commitment).toBe(commitment.id);
    });
  });

  describe('ledger integrity', () => {
    it('should create valid JSONL format', () => {
      const mem1 = JSON.parse(execSync('mentu capture "Bug 1" --json', { encoding: 'utf-8' }));
      const mem2 = JSON.parse(execSync('mentu capture "Bug 2" --json', { encoding: 'utf-8' }));
      const cmt1 = JSON.parse(execSync(`mentu commit "Fix 1" --source ${mem1.id} --json`, { encoding: 'utf-8' }));
      const cmt2 = JSON.parse(execSync(`mentu commit "Fix 2" --source ${mem2.id} --json`, { encoding: 'utf-8' }));
      const ev1 = JSON.parse(execSync('mentu capture "Done 1" --json', { encoding: 'utf-8' }));
      const ev2 = JSON.parse(execSync('mentu capture "Done 2" --json', { encoding: 'utf-8' }));

      execSync(`mentu close ${cmt1.id} --evidence ${ev1.id}`, { encoding: 'utf-8' });
      execSync(`mentu close ${cmt2.id} --evidence ${ev2.id}`, { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBe(8); // 4 captures + 2 commits + 2 closes
      lines.forEach(line => {
        expect(() => JSON.parse(line)).not.toThrow();
      });
    });

    it('should include workspace in operation', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      const evidence = JSON.parse(execSync('mentu capture "Done" --json', { encoding: 'utf-8' }));

      execSync(`mentu close ${commitment.id} --evidence ${evidence.id}`, { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n');
      const closeOp = JSON.parse(lines[3]);

      expect(closeOp.workspace).toBeDefined();
    });
  });
});
