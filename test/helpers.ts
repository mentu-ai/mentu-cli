import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type {
  Operation,
  CaptureOperation,
  CommitOperation,
  ClaimOperation,
  ReleaseOperation,
  CloseOperation,
  LinkOperation,
  DismissOperation,
  AnnotateOperation
} from '../src/types.js';

export function createTestWorkspace(): { path: string; cleanup: () => void } {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mentu-test-'));
  const mentuDir = path.join(testDir, '.mentu');
  fs.mkdirSync(mentuDir, { recursive: true });
  return {
    path: testDir,
    cleanup: () => fs.rmSync(testDir, { recursive: true, force: true }),
  };
}

export function createCapture(overrides: Partial<CaptureOperation> = {}): CaptureOperation {
  return {
    id: `mem_${Math.random().toString(16).slice(2, 10)}`,
    op: 'capture',
    ts: new Date().toISOString(),
    actor: 'test',
    workspace: 'test-workspace',
    payload: { body: 'Test memory', ...overrides.payload },
    ...overrides,
  };
}

export function createCommit(sourceId: string, overrides: Partial<CommitOperation> = {}): CommitOperation {
  return {
    id: `cmt_${Math.random().toString(16).slice(2, 10)}`,
    op: 'commit',
    ts: new Date().toISOString(),
    actor: 'test',
    workspace: 'test-workspace',
    payload: { body: 'Test commitment', source: sourceId, ...overrides.payload },
    ...overrides,
  };
}

export function createClaim(commitmentId: string, overrides: Partial<ClaimOperation> = {}): ClaimOperation {
  return {
    id: `op_${Math.random().toString(16).slice(2, 10)}`,
    op: 'claim',
    ts: new Date().toISOString(),
    actor: 'test',
    workspace: 'test-workspace',
    payload: { commitment: commitmentId, ...overrides.payload },
    ...overrides,
  };
}

export function createRelease(commitmentId: string, overrides: Partial<ReleaseOperation> = {}): ReleaseOperation {
  return {
    id: `op_${Math.random().toString(16).slice(2, 10)}`,
    op: 'release',
    ts: new Date().toISOString(),
    actor: 'test',
    workspace: 'test-workspace',
    payload: { commitment: commitmentId, ...overrides.payload },
    ...overrides,
  };
}

export function createClose(commitmentId: string, evidenceId: string, overrides: Partial<CloseOperation> = {}): CloseOperation {
  return {
    id: `op_${Math.random().toString(16).slice(2, 10)}`,
    op: 'close',
    ts: new Date().toISOString(),
    actor: 'test',
    workspace: 'test-workspace',
    payload: { commitment: commitmentId, evidence: evidenceId, ...overrides.payload },
    ...overrides,
  };
}

export function createLink(source: string, target: string, overrides: Partial<LinkOperation> = {}): LinkOperation {
  return {
    id: `op_${Math.random().toString(16).slice(2, 10)}`,
    op: 'link',
    ts: new Date().toISOString(),
    actor: 'test',
    workspace: 'test-workspace',
    payload: { source, target, kind: 'related', ...overrides.payload },
    ...overrides,
  };
}

export function createDismiss(memoryId: string, reason: string, overrides: Partial<DismissOperation> = {}): DismissOperation {
  return {
    id: `op_${Math.random().toString(16).slice(2, 10)}`,
    op: 'dismiss',
    ts: new Date().toISOString(),
    actor: 'test',
    workspace: 'test-workspace',
    payload: { memory: memoryId, reason, ...overrides.payload },
    ...overrides,
  };
}

export function createAnnotate(targetId: string, body: string, overrides: Partial<AnnotateOperation> = {}): AnnotateOperation {
  return {
    id: `op_${Math.random().toString(16).slice(2, 10)}`,
    op: 'annotate',
    ts: new Date().toISOString(),
    actor: 'test',
    workspace: 'test-workspace',
    payload: { target: targetId, body, ...overrides.payload },
    ...overrides,
  };
}

export function writeLedger(workspacePath: string, operations: Operation[]): void {
  const ledgerPath = path.join(workspacePath, '.mentu', 'ledger.jsonl');
  const content = operations.map(op => JSON.stringify(op)).join('\n') + '\n';
  fs.writeFileSync(ledgerPath, content);
}

export function readTestLedger(workspacePath: string): Operation[] {
  const ledgerPath = path.join(workspacePath, '.mentu', 'ledger.jsonl');
  if (!fs.existsSync(ledgerPath)) return [];
  const content = fs.readFileSync(ledgerPath, 'utf-8');
  return content.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
}

export function writeConfig(workspacePath: string, config: Record<string, unknown>): void {
  const configPath = path.join(workspacePath, '.mentu', 'config.yaml');
  const YAML = require('yaml');
  fs.writeFileSync(configPath, YAML.stringify(config));
}

export function writeGenesis(workspacePath: string, genesis: Record<string, unknown>): void {
  const genesisPath = path.join(workspacePath, '.mentu', 'genesis.key');
  const YAML = require('yaml');
  fs.writeFileSync(genesisPath, YAML.stringify(genesis));
}
