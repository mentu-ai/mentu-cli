import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import type { Operation, GenesisKey } from '../src/types.js';
import { computeMemories, computeCommitments } from '../src/core/state.js';
import { validateOperation } from '../src/core/validate.js';

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

function loadLedger(fixturePath: string): Operation[] {
  const ledgerPath = path.join(fixturePath, 'ledger.jsonl');
  if (!fs.existsSync(ledgerPath)) {
    return [];
  }
  const content = fs.readFileSync(ledgerPath, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim());
  return lines.map((line) => JSON.parse(line) as Operation);
}

function loadState(fixturePath: string): Record<string, unknown> | null {
  const statePath = path.join(fixturePath, 'state.json');
  if (!fs.existsSync(statePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(statePath, 'utf-8'));
}

function loadErrors(fixturePath: string): Record<string, unknown> | null {
  const errorsPath = path.join(fixturePath, 'errors.json');
  if (!fs.existsSync(errorsPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(errorsPath, 'utf-8'));
}

function loadGenesis(fixturePath: string): GenesisKey | null {
  const genesisPath = path.join(fixturePath, 'genesis.key');
  if (!fs.existsSync(genesisPath)) {
    return null;
  }
  return YAML.parse(fs.readFileSync(genesisPath, 'utf-8')) as GenesisKey;
}

function loadDuplicate(fixturePath: string): Operation | null {
  const duplicatePath = path.join(fixturePath, 'duplicate.jsonl');
  if (!fs.existsSync(duplicatePath)) {
    return null;
  }
  const content = fs.readFileSync(duplicatePath, 'utf-8').trim();
  return JSON.parse(content) as Operation;
}

describe('Valid Fixtures', () => {
  describe('001-minimal-lifecycle', () => {
    it('should compute correct state for minimal lifecycle', () => {
      const fixturePath = path.join(FIXTURES_DIR, '001-minimal-lifecycle');
      const ledger = loadLedger(fixturePath);
      const expectedState = loadState(fixturePath);

      const memories = computeMemories(ledger);
      const commitments = computeCommitments(ledger);

      // Check memories
      expect(memories).toHaveLength(2);
      expect(memories[0].id).toBe('mem_001');
      expect(memories[0].body).toBe('Bug reported');
      expect(memories[0].kind).toBeNull();
      expect(memories[1].id).toBe('mem_002');
      expect(memories[1].body).toBe('Fixed');
      expect(memories[1].kind).toBe('evidence');

      // Check commitment
      expect(commitments).toHaveLength(1);
      expect(commitments[0].id).toBe('cmt_001');
      expect(commitments[0].body).toBe('Fix bug');
      expect(commitments[0].state).toBe('closed');
      expect(commitments[0].owner).toBeNull();
      expect(commitments[0].evidence).toBe('mem_002');
      expect(commitments[0].closed_by).toBe('alice');
    });
  });

  describe('002-claim-release-reclaim', () => {
    it('should compute correct state for ownership transfer', () => {
      const fixturePath = path.join(FIXTURES_DIR, '002-claim-release-reclaim');
      const ledger = loadLedger(fixturePath);

      const commitments = computeCommitments(ledger);

      expect(commitments).toHaveLength(1);
      expect(commitments[0].state).toBe('closed');
      expect(commitments[0].owner).toBeNull();
      expect(commitments[0].evidence).toBe('mem_002');
      expect(commitments[0].closed_by).toBe('bob');
    });
  });

  describe('003-multiple-commitments', () => {
    it('should compute correct state for multiple commitments from single memory', () => {
      const fixturePath = path.join(FIXTURES_DIR, '003-multiple-commitments');
      const ledger = loadLedger(fixturePath);

      const commitments = computeCommitments(ledger);

      expect(commitments).toHaveLength(2);
      expect(commitments[0].id).toBe('cmt_001');
      expect(commitments[0].state).toBe('open');
      expect(commitments[0].source).toBe('mem_001');
      expect(commitments[1].id).toBe('cmt_002');
      expect(commitments[1].state).toBe('open');
      expect(commitments[1].source).toBe('mem_001');
    });
  });

  describe('004-annotations', () => {
    it('should compute correct state with annotations', () => {
      const fixturePath = path.join(FIXTURES_DIR, '004-annotations');
      const ledger = loadLedger(fixturePath);

      const memories = computeMemories(ledger);
      const commitments = computeCommitments(ledger);

      expect(memories).toHaveLength(1);
      expect(memories[0].annotations).toHaveLength(1);
      expect(memories[0].annotations[0].id).toBe('op_001');
      expect(memories[0].annotations[0].body).toBe('This is critical');
      expect(memories[0].annotations[0].kind).toBe('flag');

      expect(commitments).toHaveLength(1);
      expect(commitments[0].state).toBe('open');
      expect(commitments[0].annotations).toHaveLength(1);
      expect(commitments[0].annotations[0].id).toBe('op_002');
      expect(commitments[0].annotations[0].body).toBe('Blocked on API access');
      expect(commitments[0].annotations[0].kind).toBe('blocked');
    });
  });

  describe('005-idempotency', () => {
    it('should reject duplicate source_key', () => {
      const fixturePath = path.join(FIXTURES_DIR, '005-idempotency');
      const ledger = loadLedger(fixturePath);
      const duplicate = loadDuplicate(fixturePath);
      const expectedErrors = loadErrors(fixturePath);

      expect(duplicate).not.toBeNull();

      const result = validateOperation(duplicate!, ledger, null);

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(expectedErrors?.error);
    });
  });
});

describe('Invalid Fixtures', () => {
  describe('101-missing-source', () => {
    it('should reject commit with nonexistent source', () => {
      const fixturePath = path.join(FIXTURES_DIR, '101-missing-source');
      const ledger = loadLedger(fixturePath);
      const expectedErrors = loadErrors(fixturePath);

      // Validate the last operation (the invalid one)
      const invalidOp = ledger[ledger.length - 1];
      const validLedger = ledger.slice(0, -1);

      const result = validateOperation(invalidOp, validLedger, null);

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(expectedErrors?.error);
    });
  });

  describe('102-claim-closed', () => {
    it('should reject claim on closed commitment', () => {
      const fixturePath = path.join(FIXTURES_DIR, '102-claim-closed');
      const ledger = loadLedger(fixturePath);
      const expectedErrors = loadErrors(fixturePath);

      const invalidOp = ledger[ledger.length - 1];
      const validLedger = ledger.slice(0, -1);

      const result = validateOperation(invalidOp, validLedger, null);

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(expectedErrors?.error);
    });
  });

  describe('103-release-not-owner', () => {
    it('should reject release from non-owner', () => {
      const fixturePath = path.join(FIXTURES_DIR, '103-release-not-owner');
      const ledger = loadLedger(fixturePath);
      const expectedErrors = loadErrors(fixturePath);

      const invalidOp = ledger[ledger.length - 1];
      const validLedger = ledger.slice(0, -1);

      const result = validateOperation(invalidOp, validLedger, null);

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(expectedErrors?.error);
    });
  });

  describe('104-claim-already-claimed', () => {
    it('should reject claim when another owns', () => {
      const fixturePath = path.join(FIXTURES_DIR, '104-claim-already-claimed');
      const ledger = loadLedger(fixturePath);
      const expectedErrors = loadErrors(fixturePath);

      const invalidOp = ledger[ledger.length - 1];
      const validLedger = ledger.slice(0, -1);

      const result = validateOperation(invalidOp, validLedger, null);

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(expectedErrors?.error);
    });
  });

  describe('105-close-already-closed', () => {
    it('should reject double close', () => {
      const fixturePath = path.join(FIXTURES_DIR, '105-close-already-closed');
      const ledger = loadLedger(fixturePath);
      const expectedErrors = loadErrors(fixturePath);

      const invalidOp = ledger[ledger.length - 1];
      const validLedger = ledger.slice(0, -1);

      const result = validateOperation(invalidOp, validLedger, null);

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(expectedErrors?.error);
    });
  });

  describe('106-empty-body', () => {
    it('should reject empty body', () => {
      const fixturePath = path.join(FIXTURES_DIR, '106-empty-body');
      const ledger = loadLedger(fixturePath);
      const expectedErrors = loadErrors(fixturePath);

      const invalidOp = ledger[ledger.length - 1];
      const validLedger = ledger.slice(0, -1);

      const result = validateOperation(invalidOp, validLedger, null);

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(expectedErrors?.error);
    });
  });
});

describe('Genesis Key Fixtures', () => {
  describe('201-permission-denied', () => {
    it('should reject operation blocked by permissions', () => {
      const fixturePath = path.join(FIXTURES_DIR, '201-permission-denied');
      const ledger = loadLedger(fixturePath);
      const genesis = loadGenesis(fixturePath);
      const expectedErrors = loadErrors(fixturePath);

      expect(genesis).not.toBeNull();

      const invalidOp = ledger[ledger.length - 1];
      const validLedger = ledger.slice(0, -1);

      const result = validateOperation(invalidOp, validLedger, genesis);

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(expectedErrors?.error);
    });
  });

  describe('202-require-claim', () => {
    it('should reject close without claim', () => {
      const fixturePath = path.join(FIXTURES_DIR, '202-require-claim');
      const ledger = loadLedger(fixturePath);
      const genesis = loadGenesis(fixturePath);
      const expectedErrors = loadErrors(fixturePath);

      expect(genesis).not.toBeNull();

      const invalidOp = ledger[ledger.length - 1];
      const validLedger = ledger.slice(0, -1);

      const result = validateOperation(invalidOp, validLedger, genesis);

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(expectedErrors?.error);
    });
  });

  describe('203-require-human', () => {
    it('should reject agent closing financial commitment', () => {
      const fixturePath = path.join(FIXTURES_DIR, '203-require-human');
      const ledger = loadLedger(fixturePath);
      const genesis = loadGenesis(fixturePath);
      const expectedErrors = loadErrors(fixturePath);

      expect(genesis).not.toBeNull();

      const invalidOp = ledger[ledger.length - 1];
      const validLedger = ledger.slice(0, -1);

      const result = validateOperation(invalidOp, validLedger, genesis);

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(expectedErrors?.error);
    });
  });
});
