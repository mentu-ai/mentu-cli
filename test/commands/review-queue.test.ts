import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

function runJson(cmd: string) {
  return JSON.parse(execSync(cmd, { encoding: 'utf-8' }));
}

describe('review-queue command', () => {
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

  it('lists in_review submissions and supports --mine and tier filters', () => {
    // Alice submits tier_3
    const memAlice = runJson('mentu capture "Alice memory" --actor alice --json');
    const cmtAlice = runJson(`mentu commit "Alice work" --source ${memAlice.id} --actor alice --json`);
    runJson(`mentu claim ${cmtAlice.id} --actor alice --json`);
    runJson(`mentu submit ${cmtAlice.id} --summary "done" --tier tier_3 --actor alice --json`);

    // Bob submits tier_2
    const memBob = runJson('mentu capture "Bob memory" --actor bob --json');
    const cmtBob = runJson(`mentu commit "Bob work" --source ${memBob.id} --actor bob --json`);
    runJson(`mentu claim ${cmtBob.id} --actor bob --json`);
    runJson(`mentu submit ${cmtBob.id} --summary "done" --tier tier_2 --actor bob --json`);

    const queueAll = runJson('mentu review-queue --json');
    expect(queueAll.map((i: any) => i.id)).toEqual(expect.arrayContaining([cmtAlice.id, cmtBob.id]));

    const queueMineAlice = runJson('mentu review-queue --mine --actor alice --json');
    expect(queueMineAlice.map((i: any) => i.id)).toEqual([cmtAlice.id]);
    expect(queueMineAlice[0].tier).toBe('tier_3');
    expect(queueMineAlice[0].actor).toBe('alice');
    expect(queueMineAlice[0].state).toBe('in_review');

    const queueTier2 = runJson('mentu review-queue --tier tier_2 --json');
    expect(queueTier2.map((i: any) => i.id)).toEqual([cmtBob.id]);
  });

  it('includes auto-approved tier_1 when --all is set', () => {
    const mem = runJson('mentu capture "Tier1 memory" --actor alice --json');
    const cmt = runJson(`mentu commit "Tier1 work" --source ${mem.id} --actor alice --json`);
    runJson(`mentu claim ${cmt.id} --actor alice --json`);
    runJson(`mentu submit ${cmt.id} --summary "done" --tier tier_1 --actor alice --json`);

    const queueDefault = runJson('mentu review-queue --json');
    expect(queueDefault.map((i: any) => i.id)).not.toContain(cmt.id);

    const queueAll = runJson('mentu review-queue --all --json');
    expect(queueAll.map((i: any) => i.id)).toContain(cmt.id);
    const item = queueAll.find((i: any) => i.id === cmt.id);
    expect(item.tier).toBe('tier_1');
    expect(item.state).toBe('closed');
  });
});

