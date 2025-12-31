import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('release command', () => {
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

  describe('basic release', () => {
    it('should release a claimed commitment', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      execSync(`mentu claim ${commitment.id} --actor alice`, { encoding: 'utf-8' });

      const result = execSync(`mentu release ${commitment.id} --actor alice --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.id).toMatch(/^op_[a-f0-9]{8}$/);
      expect(output.op).toBe('release');
      expect(output.commitment).toBe(commitment.id);
      expect(output.actor).toBe('alice');
      expect(output.ts).toBeDefined();
    });

    it('should append to ledger file', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      execSync(`mentu claim ${commitment.id} --actor alice`, { encoding: 'utf-8' });

      execSync(`mentu release ${commitment.id} --actor alice`, { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBe(4); // capture + commit + claim + release
      const releaseOp = JSON.parse(lines[3]);
      expect(releaseOp.op).toBe('release');
      expect(releaseOp.payload.commitment).toBe(commitment.id);
    });

    it('should clear owner in computed state', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      execSync(`mentu claim ${commitment.id} --actor alice`, { encoding: 'utf-8' });

      execSync(`mentu release ${commitment.id} --actor alice`, { encoding: 'utf-8' });

      const status = JSON.parse(execSync('mentu status --json', { encoding: 'utf-8' }));

      expect(status.open).toHaveLength(1);
      expect(status.open[0].id).toBe(commitment.id);
      expect(status.open[0].owner).toBeNull();
      expect(status.claimed).toHaveLength(0);
    });
  });

  describe('validation', () => {
    it('should reject release on nonexistent commitment', () => {
      try {
        execSync('mentu release cmt_nonexist --json', { encoding: 'utf-8' });
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        const output = JSON.parse(err.stdout.toString());
        expect(output.error).toBe('E_REF_NOT_FOUND');
        expect(output.field).toBe('commitment');
        expect(output.value).toBe('cmt_nonexist');
      }
    });

    it('should reject release on closed commitment', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      const evidence = JSON.parse(execSync('mentu capture "Done" --kind evidence --json', { encoding: 'utf-8' }));

      execSync(`mentu close ${commitment.id} --evidence ${evidence.id}`, { encoding: 'utf-8' });

      try {
        execSync(`mentu release ${commitment.id} --json`, { encoding: 'utf-8' });
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        const output = JSON.parse(err.stdout.toString());
        expect(output.error).toBe('E_ALREADY_CLOSED');
        expect(output.commitment).toBe(commitment.id);
      }
    });

    it('should reject release from non-owner', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      execSync(`mentu claim ${commitment.id} --actor alice`, { encoding: 'utf-8' });

      try {
        execSync(`mentu release ${commitment.id} --actor bob --json`, { encoding: 'utf-8' });
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        const output = JSON.parse(err.stdout.toString());
        expect(output.error).toBe('E_NOT_OWNER');
        expect(output.commitment).toBe(commitment.id);
        expect(output.owner).toBe('alice');
        expect(output.actor).toBe('bob');
      }
    });

    it('should reject release outside workspace', () => {
      const nonWorkspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mentu-no-workspace-'));
      process.chdir(nonWorkspaceDir);

      try {
        execSync('mentu release cmt_12345678 --json', { encoding: 'utf-8' });
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

  describe('reason option', () => {
    it('should support --reason flag', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      execSync(`mentu claim ${commitment.id} --actor alice`, { encoding: 'utf-8' });

      const result = execSync(`mentu release ${commitment.id} --actor alice --reason "Too busy" --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.reason).toBe('Too busy');
    });

    it('should support -r short flag', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      execSync(`mentu claim ${commitment.id} --actor alice`, { encoding: 'utf-8' });

      execSync(`mentu release ${commitment.id} --actor alice -r "Blocked"`, { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n');
      const releaseOp = JSON.parse(lines[3]);

      expect(releaseOp.payload.reason).toBe('Blocked');
    });

    it('should work without reason (optional)', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      execSync(`mentu claim ${commitment.id} --actor alice`, { encoding: 'utf-8' });

      const result = execSync(`mentu release ${commitment.id} --actor alice --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.reason).toBeUndefined();
    });
  });

  describe('actor option', () => {
    it('should support --actor flag', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      execSync(`mentu claim ${commitment.id} --actor alice`, { encoding: 'utf-8' });

      const result = execSync(`mentu release ${commitment.id} --actor alice --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.actor).toBe('alice');
    });

    it('should use default actor if not specified', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      const claimResult = execSync(`mentu claim ${commitment.id} --json`, { encoding: 'utf-8' });
      const claimOutput = JSON.parse(claimResult);

      const result = execSync(`mentu release ${commitment.id} --json`, { encoding: 'utf-8' });
      const output = JSON.parse(result);

      expect(output.actor).toBeDefined();
      expect(output.actor).toBe(claimOutput.actor); // Same actor as claim
    });
  });

  describe('output format', () => {
    it('should output human-readable format by default', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      execSync(`mentu claim ${commitment.id} --actor alice`, { encoding: 'utf-8' });

      const result = execSync(`mentu release ${commitment.id} --actor alice`, { encoding: 'utf-8' });

      expect(result).toContain('Released commitment');
      expect(result).toContain(commitment.id);
    });

    it('should include reason in human-readable output', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      execSync(`mentu claim ${commitment.id} --actor alice`, { encoding: 'utf-8' });

      const result = execSync(`mentu release ${commitment.id} --actor alice --reason "Need help"`, { encoding: 'utf-8' });

      expect(result).toContain('Released commitment');
      expect(result).toContain('Reason: Need help');
    });

    it('should output JSON format with --json flag', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      execSync(`mentu claim ${commitment.id} --actor alice`, { encoding: 'utf-8' });

      const result = execSync(`mentu release ${commitment.id} --actor alice --json`, { encoding: 'utf-8' });

      expect(() => JSON.parse(result)).not.toThrow();
      const output = JSON.parse(result);
      expect(output.op).toBe('release');
    });
  });

  describe('state transitions', () => {
    it('should transition commitment from claimed to open', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      execSync(`mentu claim ${commitment.id} --actor alice`, { encoding: 'utf-8' });

      const beforeStatus = JSON.parse(execSync('mentu status --json', { encoding: 'utf-8' }));
      expect(beforeStatus.claimed).toHaveLength(1);
      expect(beforeStatus.open).toHaveLength(0);

      execSync(`mentu release ${commitment.id} --actor alice`, { encoding: 'utf-8' });

      const afterStatus = JSON.parse(execSync('mentu status --json', { encoding: 'utf-8' }));
      expect(afterStatus.claimed).toHaveLength(0);
      expect(afterStatus.open).toHaveLength(1);
      expect(afterStatus.open[0].id).toBe(commitment.id);
      expect(afterStatus.open[0].owner).toBeNull();
    });

    it('should allow re-claim after release', () => {
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

      execSync(`mentu claim ${cmt1.id} --actor alice`, { encoding: 'utf-8' });
      execSync(`mentu claim ${cmt2.id} --actor bob`, { encoding: 'utf-8' });
      execSync(`mentu release ${cmt1.id} --actor alice`, { encoding: 'utf-8' });
      execSync(`mentu release ${cmt2.id} --actor bob`, { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBe(7); // 1 capture + 2 commits + 2 claims + 2 releases
      lines.forEach(line => {
        expect(() => JSON.parse(line)).not.toThrow();
      });
    });

    it('should include workspace in operation', () => {
      const memory = JSON.parse(execSync('mentu capture "Bug" --json', { encoding: 'utf-8' }));
      const commitment = JSON.parse(execSync(`mentu commit "Fix" --source ${memory.id} --json`, { encoding: 'utf-8' }));
      execSync(`mentu claim ${commitment.id} --actor alice`, { encoding: 'utf-8' });
      execSync(`mentu release ${commitment.id} --actor alice`, { encoding: 'utf-8' });

      const ledgerPath = path.join(testDir, '.mentu', 'ledger.jsonl');
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n');
      const releaseOp = JSON.parse(lines[3]);

      expect(releaseOp.workspace).toBeDefined();
    });
  });
});
