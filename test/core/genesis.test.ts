import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import YAML from 'yaml';
import type { GenesisKey, Operation, Commitment } from '../../src/types.js';
import {
  getGenesisPath,
  readGenesisKey,
  hasPermission,
  checkConstraints,
} from '../../src/core/genesis.js';

describe('Genesis', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mentu-test-'));
    fs.mkdirSync(path.join(testDir, '.mentu'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('getGenesisPath', () => {
    it('should return correct genesis path', () => {
      const genesisPath = getGenesisPath(testDir);
      expect(genesisPath).toBe(path.join(testDir, '.mentu', 'genesis.key'));
    });
  });

  describe('readGenesisKey', () => {
    it('should return null when genesis does not exist', () => {
      const genesis = readGenesisKey(testDir);
      expect(genesis).toBeNull();
    });

    it('should parse valid genesis key', () => {
      const genesisPath = getGenesisPath(testDir);
      const genesisData: GenesisKey = {
        genesis: {
          version: '0.1.0',
          created: '2025-01-01T00:00:00.000Z',
        },
        identity: {
          workspace: 'test-workspace',
          owner: 'alice',
        },
      };

      fs.writeFileSync(genesisPath, YAML.stringify(genesisData), 'utf-8');

      const genesis = readGenesisKey(testDir);
      expect(genesis).not.toBeNull();
      expect(genesis?.genesis.version).toBe('0.1.0');
      expect(genesis?.identity.workspace).toBe('test-workspace');
      expect(genesis?.identity.owner).toBe('alice');
    });

    it('should return null on invalid YAML', () => {
      const genesisPath = getGenesisPath(testDir);
      fs.writeFileSync(genesisPath, 'invalid: yaml: syntax:', 'utf-8');

      const genesis = readGenesisKey(testDir);
      expect(genesis).toBeNull();
    });

    it('should parse genesis with permissions', () => {
      const genesisPath = getGenesisPath(testDir);
      const genesisData: GenesisKey = {
        genesis: {
          version: '0.1.0',
          created: '2025-01-01T00:00:00.000Z',
        },
        identity: {
          workspace: 'test-workspace',
          owner: 'alice',
        },
        permissions: {
          actors: {
            'alice': { operations: ['capture', 'commit', 'claim', 'release', 'close', 'annotate'] },
            'agent:*': { operations: ['capture', 'commit', 'annotate'] },
          },
        },
      };

      fs.writeFileSync(genesisPath, YAML.stringify(genesisData), 'utf-8');

      const genesis = readGenesisKey(testDir);
      expect(genesis?.permissions?.actors).toBeDefined();
      expect(genesis?.permissions?.actors?.['alice']).toBeDefined();
    });

    it('should parse genesis with constraints', () => {
      const genesisPath = getGenesisPath(testDir);
      const genesisData: GenesisKey = {
        genesis: {
          version: '0.1.0',
          created: '2025-01-01T00:00:00.000Z',
        },
        identity: {
          workspace: 'test-workspace',
          owner: 'alice',
        },
        constraints: {
          require_claim: [{ match: 'all' }],
        },
      };

      fs.writeFileSync(genesisPath, YAML.stringify(genesisData), 'utf-8');

      const genesis = readGenesisKey(testDir);
      expect(genesis?.constraints?.require_claim).toBeDefined();
    });
  });

  describe('hasPermission', () => {
    it('should allow all operations when no permissions defined', () => {
      const genesis: GenesisKey = {
        genesis: {
          version: '0.1.0',
          created: '2025-01-01T00:00:00.000Z',
        },
        identity: {
          workspace: 'test-workspace',
          owner: 'alice',
        },
      };

      expect(hasPermission(genesis, 'alice', 'capture')).toBe(true);
      expect(hasPermission(genesis, 'bob', 'commit')).toBe(true);
      expect(hasPermission(genesis, 'agent:test', 'close')).toBe(true);
    });

    it('should check exact actor match', () => {
      const genesis: GenesisKey = {
        genesis: {
          version: '0.1.0',
          created: '2025-01-01T00:00:00.000Z',
        },
        identity: {
          workspace: 'test-workspace',
          owner: 'alice',
        },
        permissions: {
          actors: {
            'alice': { operations: ['capture', 'commit'] },
          },
        },
      };

      expect(hasPermission(genesis, 'alice', 'capture')).toBe(true);
      expect(hasPermission(genesis, 'alice', 'commit')).toBe(true);
      expect(hasPermission(genesis, 'alice', 'close')).toBe(false);
    });

    it('should check wildcard pattern', () => {
      const genesis: GenesisKey = {
        genesis: {
          version: '0.1.0',
          created: '2025-01-01T00:00:00.000Z',
        },
        identity: {
          workspace: 'test-workspace',
          owner: 'alice',
        },
        permissions: {
          actors: {
            'agent:*': { operations: ['capture'] },
          },
        },
      };

      expect(hasPermission(genesis, 'agent:test', 'capture')).toBe(true);
      expect(hasPermission(genesis, 'agent:claude', 'capture')).toBe(true);
      expect(hasPermission(genesis, 'agent:test', 'commit')).toBe(false);
      expect(hasPermission(genesis, 'alice', 'capture')).toBe(false);
    });

    it('should prioritize exact match over pattern', () => {
      const genesis: GenesisKey = {
        genesis: {
          version: '0.1.0',
          created: '2025-01-01T00:00:00.000Z',
        },
        identity: {
          workspace: 'test-workspace',
          owner: 'alice',
        },
        permissions: {
          actors: {
            'agent:*': { operations: ['capture'] },
            'agent:test': { operations: ['capture', 'commit'] },
          },
        },
      };

      expect(hasPermission(genesis, 'agent:test', 'capture')).toBe(true);
      expect(hasPermission(genesis, 'agent:test', 'commit')).toBe(true);
      expect(hasPermission(genesis, 'agent:other', 'capture')).toBe(true);
      expect(hasPermission(genesis, 'agent:other', 'commit')).toBe(false);
    });

    it('should use default authenticated permissions', () => {
      const genesis: GenesisKey = {
        genesis: {
          version: '0.1.0',
          created: '2025-01-01T00:00:00.000Z',
        },
        identity: {
          workspace: 'test-workspace',
          owner: 'alice',
        },
        permissions: {
          defaults: {
            authenticated: { operations: ['capture', 'annotate'] },
          },
        },
      };

      expect(hasPermission(genesis, 'bob', 'capture')).toBe(true);
      expect(hasPermission(genesis, 'bob', 'annotate')).toBe(true);
      expect(hasPermission(genesis, 'bob', 'commit')).toBe(false);
    });

    it('should prioritize actor permissions over defaults', () => {
      const genesis: GenesisKey = {
        genesis: {
          version: '0.1.0',
          created: '2025-01-01T00:00:00.000Z',
        },
        identity: {
          workspace: 'test-workspace',
          owner: 'alice',
        },
        permissions: {
          actors: {
            'alice': { operations: ['capture', 'commit', 'close'] },
          },
          defaults: {
            authenticated: { operations: ['capture'] },
          },
        },
      };

      expect(hasPermission(genesis, 'alice', 'capture')).toBe(true);
      expect(hasPermission(genesis, 'alice', 'commit')).toBe(true);
      expect(hasPermission(genesis, 'alice', 'close')).toBe(true);
      expect(hasPermission(genesis, 'bob', 'capture')).toBe(true);
      expect(hasPermission(genesis, 'bob', 'commit')).toBe(false);
    });

    it('should handle longer patterns correctly', () => {
      const genesis: GenesisKey = {
        genesis: {
          version: '0.1.0',
          created: '2025-01-01T00:00:00.000Z',
        },
        identity: {
          workspace: 'test-workspace',
          owner: 'alice',
        },
        permissions: {
          actors: {
            'agent:*': { operations: ['capture'] },
            'agent:claude:*': { operations: ['capture', 'commit'] },
          },
        },
      };

      expect(hasPermission(genesis, 'agent:claude:code', 'capture')).toBe(true);
      expect(hasPermission(genesis, 'agent:claude:code', 'commit')).toBe(true);
      expect(hasPermission(genesis, 'agent:other', 'capture')).toBe(true);
      expect(hasPermission(genesis, 'agent:other', 'commit')).toBe(false);
    });

    it('should handle wildcards in middle of pattern', () => {
      const genesis: GenesisKey = {
        genesis: {
          version: '0.1.0',
          created: '2025-01-01T00:00:00.000Z',
        },
        identity: {
          workspace: 'test-workspace',
          owner: 'alice',
        },
        permissions: {
          actors: {
            'agent:*:code': { operations: ['capture'] },
          },
        },
      };

      expect(hasPermission(genesis, 'agent:claude:code', 'capture')).toBe(true);
      expect(hasPermission(genesis, 'agent:test:code', 'capture')).toBe(true);
      expect(hasPermission(genesis, 'agent:claude:other', 'capture')).toBe(false);
    });

    it('should deny by default when permissions exist but no match', () => {
      const genesis: GenesisKey = {
        genesis: {
          version: '0.1.0',
          created: '2025-01-01T00:00:00.000Z',
        },
        identity: {
          workspace: 'test-workspace',
          owner: 'alice',
        },
        permissions: {
          actors: {
            'alice': { operations: ['capture'] },
          },
        },
      };

      expect(hasPermission(genesis, 'bob', 'capture')).toBe(false);
    });
  });

  describe('checkConstraints', () => {
    it('should pass when no constraints defined', () => {
      const genesis: GenesisKey = {
        genesis: {
          version: '0.1.0',
          created: '2025-01-01T00:00:00.000Z',
        },
        identity: {
          workspace: 'test-workspace',
          owner: 'alice',
        },
      };

      const commitment: Commitment = {
        id: 'cmt_001',
        body: 'Test',
        source: 'mem_001',
        state: 'open',
        owner: null,
        evidence: null,
        closed_by: null,
        actor: 'alice',
        ts: '2025-01-01T00:00:00.000Z',
        annotations: [],
      };

      const result = checkConstraints(genesis, commitment, 'alice', []);
      expect(result.satisfied).toBe(true);
    });

    it('should enforce require_claim for all', () => {
      const genesis: GenesisKey = {
        genesis: {
          version: '0.1.0',
          created: '2025-01-01T00:00:00.000Z',
        },
        identity: {
          workspace: 'test-workspace',
          owner: 'alice',
        },
        constraints: {
          require_claim: [{ match: 'all' }],
        },
      };

      const commitment: Commitment = {
        id: 'cmt_001',
        body: 'Test',
        source: 'mem_001',
        state: 'open',
        owner: null,
        evidence: null,
        closed_by: null,
        actor: 'alice',
        ts: '2025-01-01T00:00:00.000Z',
        annotations: [],
      };

      const ops: Operation[] = [
        {
          id: 'mem_001',
          op: 'capture',
          ts: '2025-01-01T00:00:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test memory' },
        },
        {
          id: 'cmt_001',
          op: 'commit',
          ts: '2025-01-01T00:01:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test', source: 'mem_001' },
        },
      ];

      const result = checkConstraints(genesis, commitment, 'alice', ops);
      expect(result.satisfied).toBe(false);
      expect(result.constraint).toBe('require_claim');
      expect(result.message).toBe('Must claim commitment before closing');
    });

    it('should pass require_claim when claimed by actor', () => {
      const genesis: GenesisKey = {
        genesis: {
          version: '0.1.0',
          created: '2025-01-01T00:00:00.000Z',
        },
        identity: {
          workspace: 'test-workspace',
          owner: 'alice',
        },
        constraints: {
          require_claim: [{ match: 'all' }],
        },
      };

      const commitment: Commitment = {
        id: 'cmt_001',
        body: 'Test',
        source: 'mem_001',
        state: 'claimed',
        owner: 'alice',
        evidence: null,
        closed_by: null,
        actor: 'alice',
        ts: '2025-01-01T00:00:00.000Z',
        annotations: [],
      };

      const ops: Operation[] = [
        {
          id: 'mem_001',
          op: 'capture',
          ts: '2025-01-01T00:00:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test memory' },
        },
        {
          id: 'cmt_001',
          op: 'commit',
          ts: '2025-01-01T00:01:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test', source: 'mem_001' },
        },
        {
          id: 'op_001',
          op: 'claim',
          ts: '2025-01-01T00:02:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { commitment: 'cmt_001' },
        },
      ];

      const result = checkConstraints(genesis, commitment, 'alice', ops);
      expect(result.satisfied).toBe(true);
    });

    it('should enforce require_claim with tag match', () => {
      const genesis: GenesisKey = {
        genesis: {
          version: '0.1.0',
          created: '2025-01-01T00:00:00.000Z',
        },
        identity: {
          workspace: 'test-workspace',
          owner: 'alice',
        },
        constraints: {
          require_claim: [{ match: { tags: ['urgent'] } }],
        },
      };

      const urgentCommitment: Commitment = {
        id: 'cmt_001',
        body: 'Test',
        source: 'mem_001',
        state: 'open',
        owner: null,
        evidence: null,
        closed_by: null,
        actor: 'alice',
        ts: '2025-01-01T00:00:00.000Z',
        tags: ['urgent'],
        annotations: [],
      };

      const normalCommitment: Commitment = {
        id: 'cmt_002',
        body: 'Test',
        source: 'mem_001',
        state: 'open',
        owner: null,
        evidence: null,
        closed_by: null,
        actor: 'alice',
        ts: '2025-01-01T00:00:00.000Z',
        annotations: [],
      };

      const ops: Operation[] = [];

      const result1 = checkConstraints(genesis, urgentCommitment, 'alice', ops);
      expect(result1.satisfied).toBe(false);

      const result2 = checkConstraints(genesis, normalCommitment, 'alice', ops);
      expect(result2.satisfied).toBe(true);
    });

    it('should enforce require_human for agents', () => {
      const genesis: GenesisKey = {
        genesis: {
          version: '0.1.0',
          created: '2025-01-01T00:00:00.000Z',
        },
        identity: {
          workspace: 'test-workspace',
          owner: 'alice',
        },
        constraints: {
          require_human: [
            {
              operation: 'close',
              match: { tags: ['financial'] },
            },
          ],
        },
      };

      const commitment: Commitment = {
        id: 'cmt_001',
        body: 'Test',
        source: 'mem_001',
        state: 'open',
        owner: null,
        evidence: null,
        closed_by: null,
        actor: 'alice',
        ts: '2025-01-01T00:00:00.000Z',
        tags: ['financial'],
        annotations: [],
      };

      const ops: Operation[] = [];

      const result1 = checkConstraints(genesis, commitment, 'agent:test', ops);
      expect(result1.satisfied).toBe(false);
      expect(result1.constraint).toBe('require_human');
      expect(result1.message).toBe('Financial commitments require human to close');

      const result2 = checkConstraints(genesis, commitment, 'alice', ops);
      expect(result2.satisfied).toBe(true);
    });

    it('should match actor pattern in constraints', () => {
      const genesis: GenesisKey = {
        genesis: {
          version: '0.1.0',
          created: '2025-01-01T00:00:00.000Z',
        },
        identity: {
          workspace: 'test-workspace',
          owner: 'alice',
        },
        constraints: {
          require_claim: [{ match: { actor: 'alice' } }],
        },
      };

      const aliceCommitment: Commitment = {
        id: 'cmt_001',
        body: 'Test',
        source: 'mem_001',
        state: 'open',
        owner: null,
        evidence: null,
        closed_by: null,
        actor: 'alice',
        ts: '2025-01-01T00:00:00.000Z',
        annotations: [],
      };

      const bobCommitment: Commitment = {
        id: 'cmt_002',
        body: 'Test',
        source: 'mem_001',
        state: 'open',
        owner: null,
        evidence: null,
        closed_by: null,
        actor: 'bob',
        ts: '2025-01-01T00:00:00.000Z',
        annotations: [],
      };

      const ops: Operation[] = [];

      const result1 = checkConstraints(genesis, aliceCommitment, 'alice', ops);
      expect(result1.satisfied).toBe(false);

      const result2 = checkConstraints(genesis, bobCommitment, 'bob', ops);
      expect(result2.satisfied).toBe(true);
    });

    it('should match source_kind in constraints', () => {
      const genesis: GenesisKey = {
        genesis: {
          version: '0.1.0',
          created: '2025-01-01T00:00:00.000Z',
        },
        identity: {
          workspace: 'test-workspace',
          owner: 'alice',
        },
        constraints: {
          require_claim: [{ match: { source_kind: 'bug' } }],
        },
      };

      const commitment: Commitment = {
        id: 'cmt_001',
        body: 'Test',
        source: 'mem_001',
        state: 'open',
        owner: null,
        evidence: null,
        closed_by: null,
        actor: 'alice',
        ts: '2025-01-01T00:00:00.000Z',
        annotations: [],
      };

      const ops: Operation[] = [
        {
          id: 'mem_001',
          op: 'capture',
          ts: '2025-01-01T00:00:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Bug report', kind: 'bug' },
        },
        {
          id: 'cmt_001',
          op: 'commit',
          ts: '2025-01-01T00:01:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test', source: 'mem_001' },
        },
      ];

      const result = checkConstraints(genesis, commitment, 'alice', ops);
      expect(result.satisfied).toBe(false);
    });

    it('should enforce require_validation', () => {
      const genesis: GenesisKey = {
        genesis: {
          version: '0.1.0',
          created: '2025-01-01T00:00:00.000Z',
        },
        identity: {
          workspace: 'test-workspace',
          owner: 'alice',
        },
        constraints: {
          require_validation: [
            {
              match: { tags: ['financial'] },
            },
          ],
        },
      };

      const commitment: Commitment = {
        id: 'cmt_001',
        body: 'Test',
        source: 'mem_001',
        state: 'open',
        owner: null,
        evidence: null,
        closed_by: null,
        actor: 'alice',
        ts: '2025-01-01T00:00:00.000Z',
        tags: ['financial'],
        annotations: [],
      };

      const ops: Operation[] = [
        {
          id: 'mem_001',
          op: 'capture',
          ts: '2025-01-01T00:00:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test memory' },
        },
        {
          id: 'cmt_001',
          op: 'commit',
          ts: '2025-01-01T00:01:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test', source: 'mem_001', tags: ['financial'] },
        },
      ];

      const result = checkConstraints(genesis, commitment, 'alice', ops);
      expect(result.satisfied).toBe(false);
      expect(result.constraint).toBe('require_validation');
      expect(result.message).toBe('Commitment requires validation before close');
    });

    it('should pass require_validation when validation exists', () => {
      const genesis: GenesisKey = {
        genesis: {
          version: '0.1.0',
          created: '2025-01-01T00:00:00.000Z',
        },
        identity: {
          workspace: 'test-workspace',
          owner: 'alice',
        },
        constraints: {
          require_validation: [
            {
              match: { tags: ['financial'] },
              validator: 'alice',
            },
          ],
        },
      };

      const commitment: Commitment = {
        id: 'cmt_001',
        body: 'Test',
        source: 'mem_001',
        state: 'open',
        owner: null,
        evidence: null,
        closed_by: null,
        actor: 'bob',
        ts: '2025-01-01T00:00:00.000Z',
        tags: ['financial'],
        annotations: [],
      };

      const ops: Operation[] = [
        {
          id: 'mem_001',
          op: 'capture',
          ts: '2025-01-01T00:00:00.000Z',
          actor: 'bob',
          workspace: 'test',
          payload: { body: 'Test memory' },
        },
        {
          id: 'cmt_001',
          op: 'commit',
          ts: '2025-01-01T00:01:00.000Z',
          actor: 'bob',
          workspace: 'test',
          payload: { body: 'Test', source: 'mem_001', tags: ['financial'] },
        },
        {
          id: 'mem_002',
          op: 'capture',
          ts: '2025-01-01T00:02:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: {
            body: 'Approved',
            kind: 'validation',
            refs: ['cmt_001'],
            meta: { approved: true },
          },
        },
      ];

      const result = checkConstraints(genesis, commitment, 'bob', ops);
      expect(result.satisfied).toBe(true);
    });

    it('should handle empty match (matches nothing)', () => {
      const genesis: GenesisKey = {
        genesis: {
          version: '0.1.0',
          created: '2025-01-01T00:00:00.000Z',
        },
        identity: {
          workspace: 'test-workspace',
          owner: 'alice',
        },
        constraints: {
          require_claim: [{ match: {} }],
        },
      };

      const commitment: Commitment = {
        id: 'cmt_001',
        body: 'Test',
        source: 'mem_001',
        state: 'open',
        owner: null,
        evidence: null,
        closed_by: null,
        actor: 'alice',
        ts: '2025-01-01T00:00:00.000Z',
        annotations: [],
      };

      const ops: Operation[] = [];

      const result = checkConstraints(genesis, commitment, 'alice', ops);
      expect(result.satisfied).toBe(true);
    });

    it('should match multiple tags', () => {
      const genesis: GenesisKey = {
        genesis: {
          version: '0.1.0',
          created: '2025-01-01T00:00:00.000Z',
        },
        identity: {
          workspace: 'test-workspace',
          owner: 'alice',
        },
        constraints: {
          require_claim: [{ match: { tags: ['urgent', 'bug'] } }],
        },
      };

      const commitment1: Commitment = {
        id: 'cmt_001',
        body: 'Test',
        source: 'mem_001',
        state: 'open',
        owner: null,
        evidence: null,
        closed_by: null,
        actor: 'alice',
        ts: '2025-01-01T00:00:00.000Z',
        tags: ['urgent', 'bug', 'critical'],
        annotations: [],
      };

      const commitment2: Commitment = {
        id: 'cmt_002',
        body: 'Test',
        source: 'mem_001',
        state: 'open',
        owner: null,
        evidence: null,
        closed_by: null,
        actor: 'alice',
        ts: '2025-01-01T00:00:00.000Z',
        tags: ['urgent'],
        annotations: [],
      };

      const ops: Operation[] = [];

      const result1 = checkConstraints(genesis, commitment1, 'alice', ops);
      expect(result1.satisfied).toBe(false);

      const result2 = checkConstraints(genesis, commitment2, 'alice', ops);
      expect(result2.satisfied).toBe(true);
    });

    it('should handle validation with meta.validates field', () => {
      const genesis: GenesisKey = {
        genesis: {
          version: '0.1.0',
          created: '2025-01-01T00:00:00.000Z',
        },
        identity: {
          workspace: 'test-workspace',
          owner: 'alice',
        },
        constraints: {
          require_validation: [
            {
              match: 'all',
            },
          ],
        },
      };

      const commitment: Commitment = {
        id: 'cmt_001',
        body: 'Test',
        source: 'mem_001',
        state: 'open',
        owner: null,
        evidence: null,
        closed_by: null,
        actor: 'alice',
        ts: '2025-01-01T00:00:00.000Z',
        annotations: [],
      };

      const ops: Operation[] = [
        {
          id: 'mem_001',
          op: 'capture',
          ts: '2025-01-01T00:00:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test memory' },
        },
        {
          id: 'cmt_001',
          op: 'commit',
          ts: '2025-01-01T00:01:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test', source: 'mem_001' },
        },
        {
          id: 'mem_002',
          op: 'capture',
          ts: '2025-01-01T00:02:00.000Z',
          actor: 'bob',
          workspace: 'test',
          payload: {
            body: 'Validated',
            kind: 'validation',
            meta: { validates: 'cmt_001', passed: true },
          },
        },
      ];

      const result = checkConstraints(genesis, commitment, 'alice', ops);
      expect(result.satisfied).toBe(true);
    });

    it('should reject validation without approval flag', () => {
      const genesis: GenesisKey = {
        genesis: {
          version: '0.1.0',
          created: '2025-01-01T00:00:00.000Z',
        },
        identity: {
          workspace: 'test-workspace',
          owner: 'alice',
        },
        constraints: {
          require_validation: [
            {
              match: 'all',
            },
          ],
        },
      };

      const commitment: Commitment = {
        id: 'cmt_001',
        body: 'Test',
        source: 'mem_001',
        state: 'open',
        owner: null,
        evidence: null,
        closed_by: null,
        actor: 'alice',
        ts: '2025-01-01T00:00:00.000Z',
        annotations: [],
      };

      const ops: Operation[] = [
        {
          id: 'mem_001',
          op: 'capture',
          ts: '2025-01-01T00:00:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test memory' },
        },
        {
          id: 'cmt_001',
          op: 'commit',
          ts: '2025-01-01T00:01:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test', source: 'mem_001' },
        },
        {
          id: 'mem_002',
          op: 'capture',
          ts: '2025-01-01T00:02:00.000Z',
          actor: 'bob',
          workspace: 'test',
          payload: {
            body: 'Not approved',
            kind: 'validation',
            meta: { validates: 'cmt_001' },
          },
        },
      ];

      const result = checkConstraints(genesis, commitment, 'alice', ops);
      expect(result.satisfied).toBe(false);
    });

    it('should respect validator pattern', () => {
      const genesis: GenesisKey = {
        genesis: {
          version: '0.1.0',
          created: '2025-01-01T00:00:00.000Z',
        },
        identity: {
          workspace: 'test-workspace',
          owner: 'alice',
        },
        constraints: {
          require_validation: [
            {
              match: 'all',
              validator: 'manager:*',
            },
          ],
        },
      };

      const commitment: Commitment = {
        id: 'cmt_001',
        body: 'Test',
        source: 'mem_001',
        state: 'open',
        owner: null,
        evidence: null,
        closed_by: null,
        actor: 'alice',
        ts: '2025-01-01T00:00:00.000Z',
        annotations: [],
      };

      const opsInvalid: Operation[] = [
        {
          id: 'mem_001',
          op: 'capture',
          ts: '2025-01-01T00:00:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test memory' },
        },
        {
          id: 'cmt_001',
          op: 'commit',
          ts: '2025-01-01T00:01:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test', source: 'mem_001' },
        },
        {
          id: 'mem_002',
          op: 'capture',
          ts: '2025-01-01T00:02:00.000Z',
          actor: 'bob',
          workspace: 'test',
          payload: {
            body: 'Validated',
            kind: 'validation',
            meta: { validates: 'cmt_001', approved: true },
          },
        },
      ];

      const opsValid: Operation[] = [
        {
          id: 'mem_001',
          op: 'capture',
          ts: '2025-01-01T00:00:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test memory' },
        },
        {
          id: 'cmt_001',
          op: 'commit',
          ts: '2025-01-01T00:01:00.000Z',
          actor: 'alice',
          workspace: 'test',
          payload: { body: 'Test', source: 'mem_001' },
        },
        {
          id: 'mem_002',
          op: 'capture',
          ts: '2025-01-01T00:02:00.000Z',
          actor: 'manager:alice',
          workspace: 'test',
          payload: {
            body: 'Validated',
            kind: 'validation',
            meta: { validates: 'cmt_001', approved: true },
          },
        },
      ];

      const result1 = checkConstraints(genesis, commitment, 'alice', opsInvalid);
      expect(result1.satisfied).toBe(false);

      const result2 = checkConstraints(genesis, commitment, 'alice', opsValid);
      expect(result2.satisfied).toBe(true);
    });
  });
});
