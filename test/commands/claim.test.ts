import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('claim command', () => {
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

  describe('basic claim', () => {
    it('should claim an open commitment', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix bug" --source ${memory.id} --json`, { encoding: 'utf-8' }));

      const result = execSync(`mentu claim ${commitment.id} --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.id).toMatch(/^op_[a-f0-9]{8}$/);
      expect(output.op).toBe('claim');
      expect(output.commitment).toBe(commitment.id);
      expect(output.actor).toBeDefined();
      expect(output.ts).toBeDefined();
    });

    it('should append to ledger file', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));

      execSync(`mentu claim ${commitment.id}`, { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBe(3); // capture + commit + claim
      const claimOp = JSON.parse(lines[2]);
      expect(claimOp.op).toBe('claim');
      expect(claimOp.payload.commitment).toBe(commitment.id);
    });

    it('should set owner in computed state', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));

      execSync(`mentu claim ${commitment.id} --actor alice`, { encoding: 'utf-8' });

      const status = execSync('mentu status --json', { encoding: 'utf-8' });
      const statusOutput = JSON.parse(status);

      expect(statusOutput.claimed).toHaveLength(1);
      expect(statusOutput.claimed[0].id).toBe(commitment.id);
      expect(statusOutput.claimed[0].owner).toBe('alice');
    });
  });

  describe('validation', () => {
    it('should reject claim on nonexistent commitment', () => {
      try {
        execSync('mentu claim cmt_nonexist --json', { encoding: 'utf-8' });
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        const output = JSON.parse(err.stdout.toString());
        expect(output.error).toBe('E_REF_NOT_FOUND');
        expect(output.field).toBe('commitment');
        expect(output.value).toBe('cmt_nonexist');
      }
    });

    it('should reject claim on closed commitment', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      const evidence = JSON.parse(execSync('mentu capture "Done" --kind evidence --json', { encoding: 'utf-8' }));

      execSync(`mentu close ${commitment.id} --evidence ${evidence.id}`, { encoding: 'utf-8' });

      try {
        execSync(`mentu claim ${commitment.id} --json`, { encoding: 'utf-8' });
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        const output = JSON.parse(err.stdout.toString());
        expect(output.error).toBe('E_ALREADY_CLOSED');
        expect(output.commitment).toBe(commitment.id);
      }
    });

    it('should reject claim when already claimed by another actor', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));

      execSync(`mentu claim ${commitment.id} --actor alice`, { encoding: 'utf-8' });

      try {
        execSync(`mentu claim ${commitment.id} --actor bob --json`, { encoding: 'utf-8' });
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        const output = JSON.parse(err.stdout.toString());
        expect(output.error).toBe('E_ALREADY_CLAIMED');
        expect(output.commitment).toBe(commitment.id);
        expect(output.owner).toBe('alice');
      }
    });

    it('should allow reclaim by same actor', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));

      execSync(`mentu claim ${commitment.id} --actor alice`, { encoding: 'utf-8' });

      const result = execSync(`mentu claim ${commitment.id} --actor alice --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.op).toBe('claim');
      expect(output.commitment).toBe(commitment.id);
    });

    it('should reject claim outside workspace', () => {
      const nonWorkspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mentu-no-workspace-'));
      process.chdir(nonWorkspaceDir);

      try {
        execSync('mentu claim cmt_12345678 --json', { encoding: 'utf-8' });
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

      const result = execSync(`mentu claim ${commitment.id} --actor alice --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.actor).toBe('alice');
    });

    it('should use default actor if not specified', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));

      const result = execSync(`mentu claim ${commitment.id} --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.actor).toBeDefined();
      expect(typeof output.actor).toBe('string');
      expect(output.actor.length).toBeGreaterThan(0);
    });
  });

  describe('output format', () => {
    it('should output human-readable format by default', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));

      const result = execSync(`mentu claim ${commitment.id}`, { encoding: 'utf-8' });

      expect(result).toContain('Claimed commitment');
      expect(result).toContain(commitment.id);
    });

    it('should output JSON format with --json flag', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));

      const result = execSync(`mentu claim ${commitment.id} --json`, { encoding: 'utf-8' });

      expect(() => JSON.parse(result)).not.toThrow();
      const output = JSON.parse(result);
      expect(output.op).toBe('claim');
    });
  });

  describe('state transitions', () => {
    it('should transition commitment from open to claimed', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));

      const beforeStatus = JSON.parse(execSync('mentu status --json', { encoding: 'utf-8' }));
      expect(beforeStatus.open).toHaveLength(1);
      expect(beforeStatus.claimed).toHaveLength(0);

      execSync(`mentu claim ${commitment.id} --actor alice`, { encoding: 'utf-8' });

      const afterStatus = JSON.parse(execSync('mentu status --json', { encoding: 'utf-8' }));
      expect(afterStatus.open).toHaveLength(0);
      expect(afterStatus.claimed).toHaveLength(1);
      expect(afterStatus.claimed[0].id).toBe(commitment.id);
      expect(afterStatus.claimed[0].owner).toBe('alice');
    });

    it('should allow claim after release', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));

      execSync(`mentu claim ${commitment.id} --actor alice`, { encoding: 'utf-8' });
      execSync(`mentu release ${commitment.id} --actor alice`, { encoding: 'utf-8' });

      const result = execSync(`mentu claim ${commitment.id} --actor bob --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.op).toBe('claim');
      expect(output.actor).toBe('bob');
    });
  });

  describe('ledger integrity', () => {
    it('should create valid JSONL format', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const cmt1 = JSON.parse(execSync(`mentu commit "Fix 1" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      const cmt2 = JSON.parse(execSync(`mentu commit "Fix 2" --source ${memory.id} --json`, { encoding: 'utf-8' }));

      execSync(`mentu claim ${cmt1.id}`, { encoding: 'utf-8' });
      execSync(`mentu claim ${cmt2.id}`, { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBe(5); // 1 capture + 2 commits + 2 claims
      lines.forEach(line => {
        expect(() => JSON.parse(line)).not.toThrow();
      });
    });

    it('should include workspace in operation', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));

      execSync(`mentu claim ${commitment.id}`, { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n');
      const claimOp = JSON.parse(lines[2]);

      expect(claimOp.workspace).toBeDefined();
    });
  });
});
