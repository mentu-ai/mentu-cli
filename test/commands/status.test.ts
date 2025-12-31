import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

function runJson(cmd: string) {
  return JSON.parse(execSync(cmd, { encoding: 'utf-8' }));
}

describe('status command', () => {
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

  it('includes open, claimed, in_review, reopened, and closed', () => {
    // open
    const openMem = runJson('mentu capture "Open memory" --json');
    const openCmt = runJson(`mentu commit "Open commitment" --source ${openMem.id} --json`);

    // claimed
    const claimedMem = runJson('mentu capture "Claimed memory" --json');
    const claimedCmt = runJson(`mentu commit "Claimed commitment" --source ${claimedMem.id} --json`);
    runJson(`mentu claim ${claimedCmt.id} --json`);

    // in_review
    const inReviewMem = runJson('mentu capture "Review memory" --json');
    const inReviewCmt = runJson(`mentu commit "In review commitment" --source ${inReviewMem.id} --json`);
    runJson(`mentu claim ${inReviewCmt.id} --json`);
    runJson(`mentu submit ${inReviewCmt.id} --summary "ready" --tier tier_2 --json`);

    // reopened
    const reopenedMem = runJson('mentu capture "Reopen memory" --json');
    const reopenedCmt = runJson(`mentu commit "Reopened commitment" --source ${reopenedMem.id} --json`);
    runJson(`mentu claim ${reopenedCmt.id} --json`);
    runJson(`mentu submit ${reopenedCmt.id} --summary "ready" --tier tier_2 --json`);
    runJson(`mentu reopen ${reopenedCmt.id} --reason "needs more work" --json`);

    // closed (approved)
    const closedMem = runJson('mentu capture "Close memory" --json');
    const closedCmt = runJson(`mentu commit "Closed commitment" --source ${closedMem.id} --json`);
    runJson(`mentu claim ${closedCmt.id} --json`);
    runJson(`mentu submit ${closedCmt.id} --summary "done" --tier tier_2 --json`);
    runJson(`mentu approve ${closedCmt.id} --comment "ok" --json`);

    // closed (duplicate)
    const dupMem = runJson('mentu capture "Duplicate memory" --json');
    const dupCmt = runJson(`mentu commit "Duplicate commitment" --source ${dupMem.id} --json`);
    execSync(`mentu close ${dupCmt.id} --duplicate-of ${closedCmt.id}`, { encoding: 'utf-8' });

    const status = runJson('mentu status --json');

    expect(status.workspace).toBeDefined();
    expect(status.open.map((c: any) => c.id)).toContain(openCmt.id);
    expect(status.claimed.map((c: any) => c.id)).toContain(claimedCmt.id);
    expect(status.in_review.map((c: any) => c.id)).toContain(inReviewCmt.id);
    expect(status.reopened.map((c: any) => c.id)).toContain(reopenedCmt.id);
    expect(status.closed.map((c: any) => c.id)).toEqual(expect.arrayContaining([closedCmt.id, dupCmt.id]));

    const dupClosed = status.closed.find((c: any) => c.id === dupCmt.id);
    expect(dupClosed.evidence).toBeNull();

    const approvedClosed = status.closed.find((c: any) => c.id === closedCmt.id);
    expect(typeof approvedClosed.evidence).toBe('string');
  });
});
