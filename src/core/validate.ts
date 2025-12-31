import type {
  Operation,
  ValidationResult,
  GenesisKey,
  Commitment,
} from '../types.js';
import { MentuError } from '../types.js';
import { idExists, sourceKeyExists } from './ledger.js';
import {
  memoryExists,
  commitmentExists,
  recordExists,
  getCommitment,
  computeCommitmentState,
  isMemorySourceOfCommitment,
} from './state.js';
import { hasPermission, checkConstraints } from './genesis.js';

/**
 * Validate a document path for capture operations.
 * Path must be relative and start with docs/ or .claude/
 */
export function isValidPath(path: string): boolean {
  if (path.startsWith('/')) return false;
  return path.startsWith('docs/') || path.startsWith('.claude/');
}

/**
 * Validate a ref ID format.
 * Must match ID pattern: prefix_8chars where prefix is cmt, mem, or op
 */
export function isValidRef(ref: string): boolean {
  return /^(cmt|mem|op)_[a-f0-9]{8}$/.test(ref);
}

/**
 * Validate an operation before appending to the ledger.
 *
 * Validation order:
 * 1. Envelope completeness
 * 2. Payload completeness
 * 3. Referential integrity
 * 4. State constraints
 * 5. Genesis Key permissions
 * 6. Genesis Key constraints
 */
export function validateOperation(
  op: Operation,
  ledger: Operation[],
  genesis: GenesisKey | null
): ValidationResult {
  // 1. Envelope completeness
  if (!op.id) {
    return {
      valid: false,
      error: new MentuError('E_MISSING_FIELD', 'Missing field: id', { field: 'id' }),
    };
  }
  if (!op.op) {
    return {
      valid: false,
      error: new MentuError('E_MISSING_FIELD', 'Missing field: op', { field: 'op' }),
    };
  }
  if (!op.ts) {
    return {
      valid: false,
      error: new MentuError('E_MISSING_FIELD', 'Missing field: ts', { field: 'ts' }),
    };
  }
  if (!op.actor) {
    return {
      valid: false,
      error: new MentuError('E_MISSING_FIELD', 'Missing field: actor', { field: 'actor' }),
    };
  }

  // Check for duplicate ID
  if (idExists(ledger, op.id)) {
    return {
      valid: false,
      error: new MentuError('E_DUPLICATE_ID', `ID ${op.id} already exists`, { id: op.id }),
    };
  }

  // Check for duplicate source_key
  if (op.source_key && sourceKeyExists(ledger, op.source_key)) {
    return {
      valid: false,
      error: new MentuError(
        'E_DUPLICATE_SOURCE_KEY',
        `Source key ${op.source_key} already exists`,
        { source_key: op.source_key }
      ),
    };
  }

  // 5. Genesis Key permissions (check before operation-specific validation)
  if (genesis) {
    if (!hasPermission(genesis, op.actor, op.op)) {
      return {
        valid: false,
        error: new MentuError(
          'E_PERMISSION_DENIED',
          `Actor ${op.actor} is not permitted to perform ${op.op}`,
          { actor: op.actor, operation: op.op }
        ),
      };
    }
  }

  // 2. Payload completeness and 3. Referential integrity
  switch (op.op) {
    case 'capture': {
      if (!op.payload.body || op.payload.body.trim() === '') {
        return {
          valid: false,
          error: new MentuError('E_EMPTY_BODY', 'Body cannot be empty', { field: 'body' }),
        };
      }
      // Validate path if provided
      if (op.payload.path && !isValidPath(op.payload.path)) {
        return {
          valid: false,
          error: new MentuError('E_INVALID_OP', 'Path must be relative and start with docs/ or .claude/', {
            field: 'path',
            value: op.payload.path,
          }),
        };
      }
      // Validate refs if provided
      if (op.payload.refs) {
        for (const ref of op.payload.refs) {
          if (!isValidRef(ref)) {
            return {
              valid: false,
              error: new MentuError('E_INVALID_OP', `Invalid ref format: ${ref}`, {
                field: 'refs',
                value: ref,
              }),
            };
          }
        }
      }
      break;
    }

    case 'commit': {
      if (!op.payload.body || op.payload.body.trim() === '') {
        return {
          valid: false,
          error: new MentuError('E_EMPTY_BODY', 'Body cannot be empty', { field: 'body' }),
        };
      }
      if (!op.payload.source) {
        return {
          valid: false,
          error: new MentuError('E_MISSING_FIELD', 'Missing field: source', { field: 'source' }),
        };
      }
      if (!memoryExists(ledger, op.payload.source)) {
        return {
          valid: false,
          error: new MentuError(
            'E_REF_NOT_FOUND',
            `Source memory ${op.payload.source} does not exist`,
            { field: 'source', value: op.payload.source }
          ),
        };
      }
      break;
    }

    case 'claim': {
      if (!op.payload.commitment) {
        return {
          valid: false,
          error: new MentuError('E_MISSING_FIELD', 'Missing field: commitment', {
            field: 'commitment',
          }),
        };
      }
      if (!commitmentExists(ledger, op.payload.commitment)) {
        return {
          valid: false,
          error: new MentuError(
            'E_REF_NOT_FOUND',
            `Commitment ${op.payload.commitment} does not exist`,
            { field: 'commitment', value: op.payload.commitment }
          ),
        };
      }

      // 4. State constraints
      const claimState = computeCommitmentState(ledger, op.payload.commitment);
      if (claimState.state === 'closed') {
        return {
          valid: false,
          error: new MentuError('E_ALREADY_CLOSED', `Commitment ${op.payload.commitment} is closed`, {
            commitment: op.payload.commitment,
          }),
        };
      }
      if (claimState.owner && claimState.owner !== op.actor) {
        return {
          valid: false,
          error: new MentuError(
            'E_ALREADY_CLAIMED',
            `Commitment ${op.payload.commitment} is claimed by ${claimState.owner}`,
            { commitment: op.payload.commitment, owner: claimState.owner }
          ),
        };
      }
      break;
    }

    case 'release': {
      if (!op.payload.commitment) {
        return {
          valid: false,
          error: new MentuError('E_MISSING_FIELD', 'Missing field: commitment', {
            field: 'commitment',
          }),
        };
      }
      if (!commitmentExists(ledger, op.payload.commitment)) {
        return {
          valid: false,
          error: new MentuError(
            'E_REF_NOT_FOUND',
            `Commitment ${op.payload.commitment} does not exist`,
            { field: 'commitment', value: op.payload.commitment }
          ),
        };
      }

      // 4. State constraints
      const releaseState = computeCommitmentState(ledger, op.payload.commitment);
      if (releaseState.state === 'closed') {
        return {
          valid: false,
          error: new MentuError('E_ALREADY_CLOSED', `Commitment ${op.payload.commitment} is closed`, {
            commitment: op.payload.commitment,
          }),
        };
      }
      if (releaseState.owner !== op.actor) {
        return {
          valid: false,
          error: new MentuError(
            'E_NOT_OWNER',
            `Actor ${op.actor} is not the owner of commitment ${op.payload.commitment}`,
            { commitment: op.payload.commitment, owner: releaseState.owner, actor: op.actor }
          ),
        };
      }
      break;
    }

    case 'close': {
      if (!op.payload.commitment) {
        return {
          valid: false,
          error: new MentuError('E_MISSING_FIELD', 'Missing field: commitment', {
            field: 'commitment',
          }),
        };
      }

      // Must have exactly one of: evidence OR duplicate_of
      const hasEvidence = !!op.payload.evidence;
      const hasDuplicateOf = !!op.payload.duplicate_of;

      if (!hasEvidence && !hasDuplicateOf) {
        return {
          valid: false,
          error: new MentuError('E_MISSING_FIELD', 'Missing field: evidence or duplicate_of', {
            field: 'evidence',
          }),
        };
      }

      if (hasEvidence && hasDuplicateOf) {
        return {
          valid: false,
          error: new MentuError('E_INVALID_OP', 'Cannot specify both evidence and duplicate_of'),
        };
      }

      if (!commitmentExists(ledger, op.payload.commitment)) {
        return {
          valid: false,
          error: new MentuError(
            'E_REF_NOT_FOUND',
            `Commitment ${op.payload.commitment} does not exist`,
            { field: 'commitment', value: op.payload.commitment }
          ),
        };
      }

      // Check state constraints
      const closeState = computeCommitmentState(ledger, op.payload.commitment);
      if (closeState.state === 'closed' || closeState.state === 'duplicate') {
        return {
          valid: false,
          error: new MentuError('E_ALREADY_CLOSED', `Commitment ${op.payload.commitment} is closed`, {
            commitment: op.payload.commitment,
          }),
        };
      }

      if (hasEvidence) {
        // Normal close with evidence
        if (!memoryExists(ledger, op.payload.evidence!)) {
          return {
            valid: false,
            error: new MentuError(
              'E_REF_NOT_FOUND',
              `Evidence memory ${op.payload.evidence} does not exist`,
              { field: 'evidence', value: op.payload.evidence }
            ),
          };
        }
      }

      if (hasDuplicateOf) {
        // Duplicate close
        if (!commitmentExists(ledger, op.payload.duplicate_of!)) {
          return {
            valid: false,
            error: new MentuError(
              'E_REF_NOT_FOUND',
              `Duplicate target commitment ${op.payload.duplicate_of} does not exist`,
              { field: 'duplicate_of', value: op.payload.duplicate_of }
            ),
          };
        }

        // Cannot close as duplicate if claimed by someone else
        if (closeState.owner && closeState.owner !== op.actor) {
          return {
            valid: false,
            error: new MentuError(
              'E_NOT_OWNER',
              `Cannot close as duplicate: commitment is claimed by ${closeState.owner}`,
              { commitment: op.payload.commitment, owner: closeState.owner }
            ),
          };
        }
      }

      // 6. Genesis Key constraints (for close operation)
      if (genesis) {
        const commitment = getCommitment(ledger, op.payload.commitment);
        if (commitment) {
          const constraintResult = checkConstraints(genesis, commitment, op.actor, ledger);
          if (!constraintResult.satisfied) {
            return {
              valid: false,
              error: new MentuError(
                'E_CONSTRAINT_VIOLATED',
                constraintResult.message || 'Constraint violated',
                { constraint: constraintResult.constraint }
              ),
            };
          }
        }
      }
      break;
    }

    case 'annotate': {
      if (!op.payload.target) {
        return {
          valid: false,
          error: new MentuError('E_MISSING_FIELD', 'Missing field: target', { field: 'target' }),
        };
      }
      if (!op.payload.body || op.payload.body.trim() === '') {
        return {
          valid: false,
          error: new MentuError('E_EMPTY_BODY', 'Body cannot be empty', { field: 'body' }),
        };
      }
      if (!recordExists(ledger, op.payload.target)) {
        return {
          valid: false,
          error: new MentuError(
            'E_REF_NOT_FOUND',
            `Target ${op.payload.target} does not exist`,
            { field: 'target', value: op.payload.target }
          ),
        };
      }
      break;
    }

    case 'link': {
      if (!op.payload.source) {
        return {
          valid: false,
          error: new MentuError('E_MISSING_FIELD', 'Missing field: source', { field: 'source' }),
        };
      }
      if (!op.payload.target) {
        return {
          valid: false,
          error: new MentuError('E_MISSING_FIELD', 'Missing field: target', { field: 'target' }),
        };
      }

      // Source must be memory or commitment
      const sourceIsMemory = memoryExists(ledger, op.payload.source);
      const sourceIsCommitment = commitmentExists(ledger, op.payload.source);

      if (!sourceIsMemory && !sourceIsCommitment) {
        return {
          valid: false,
          error: new MentuError(
            'E_REF_NOT_FOUND',
            `Source ${op.payload.source} does not exist`,
            { field: 'source', value: op.payload.source }
          ),
        };
      }

      // Target must be commitment
      if (!commitmentExists(ledger, op.payload.target)) {
        return {
          valid: false,
          error: new MentuError(
            'E_REF_NOT_FOUND',
            `Target commitment ${op.payload.target} does not exist`,
            { field: 'target', value: op.payload.target }
          ),
        };
      }

      // Cannot link to self
      if (op.payload.source === op.payload.target) {
        return {
          valid: false,
          error: new MentuError('E_INVALID_OP', 'Cannot link to self'),
        };
      }

      // Validate link kind if provided
      const validKinds = ['related', 'duplicate', 'caused_by', 'blocks', 'evidence'];
      if (op.payload.kind && !validKinds.includes(op.payload.kind)) {
        return {
          valid: false,
          error: new MentuError(
            'E_INVALID_OP',
            `Invalid link kind: ${op.payload.kind}. Valid kinds: ${validKinds.join(', ')}`,
            { field: 'kind', value: op.payload.kind }
          ),
        };
      }
      break;
    }

    case 'dismiss': {
      if (!op.payload.memory) {
        return {
          valid: false,
          error: new MentuError('E_MISSING_FIELD', 'Missing field: memory', { field: 'memory' }),
        };
      }
      if (!op.payload.reason || op.payload.reason.trim() === '') {
        return {
          valid: false,
          error: new MentuError('E_MISSING_FIELD', 'Dismiss requires a reason', { field: 'reason' }),
        };
      }

      // Memory must exist
      if (!memoryExists(ledger, op.payload.memory)) {
        return {
          valid: false,
          error: new MentuError(
            'E_REF_NOT_FOUND',
            `Memory ${op.payload.memory} does not exist`,
            { field: 'memory', value: op.payload.memory }
          ),
        };
      }

      // Cannot dismiss memory that is source of a commitment
      if (isMemorySourceOfCommitment(ledger, op.payload.memory)) {
        return {
          valid: false,
          error: new MentuError(
            'E_CONSTRAINT_VIOLATED',
            `Cannot dismiss ${op.payload.memory}: it is the source of a commitment`,
            { memory: op.payload.memory }
          ),
        };
      }
      break;
    }

    case 'triage': {
      if (!op.payload.reviewed || op.payload.reviewed.length === 0) {
        return {
          valid: false,
          error: new MentuError('E_MISSING_FIELD', 'Missing field: reviewed', { field: 'reviewed' }),
        };
      }
      if (!op.payload.summary || op.payload.summary.trim() === '') {
        return {
          valid: false,
          error: new MentuError('E_MISSING_FIELD', 'Missing field: summary', { field: 'summary' }),
        };
      }

      // All reviewed memories must exist
      for (const memId of op.payload.reviewed) {
        if (!memoryExists(ledger, memId)) {
          return {
            valid: false,
            error: new MentuError(
              'E_REF_NOT_FOUND',
              `Reviewed memory ${memId} does not exist`,
              { field: 'reviewed', value: memId }
            ),
          };
        }
      }
      break;
    }

    case 'submit': {
      const payload = op.payload as { commitment?: string; evidence?: string[] };
      if (!payload.commitment) {
        return { valid: false, error: new MentuError('E_MISSING_FIELD', 'submit requires commitment') };
      }
      if (!payload.evidence || payload.evidence.length === 0) {
        return { valid: false, error: new MentuError('E_MISSING_FIELD', 'submit requires evidence') };
      }
      // Verify commitment exists and is claimed
      const commitment = getCommitment(ledger, payload.commitment);
      if (!commitment) {
        return { valid: false, error: new MentuError('E_REF_NOT_FOUND', `Commitment ${payload.commitment} not found`) };
      }
      const submitState = computeCommitmentState(ledger, payload.commitment);
      if (submitState.state !== 'claimed') {
        return { valid: false, error: new MentuError('E_INVALID_OP', `Commitment must be claimed to submit (current: ${submitState.state})`) };
      }
      if (submitState.owner !== op.actor) {
        return { valid: false, error: new MentuError('E_NOT_OWNER', `Only owner ${submitState.owner} can submit`) };
      }
      // Verify evidence exists
      for (const evidenceId of payload.evidence) {
        const evidence = ledger.find(o => o.id === evidenceId && o.op === 'capture');
        if (!evidence) {
          return { valid: false, error: new MentuError('E_REF_NOT_FOUND', `Evidence ${evidenceId} not found`) };
        }
      }
      break;
    }

    case 'approve': {
      const payload = op.payload as { commitment?: string };
      if (!payload.commitment) {
        return { valid: false, error: new MentuError('E_MISSING_FIELD', 'approve requires commitment') };
      }
      const commitment = getCommitment(ledger, payload.commitment);
      if (!commitment) {
        return { valid: false, error: new MentuError('E_REF_NOT_FOUND', `Commitment ${payload.commitment} not found`) };
      }
      const approveState = computeCommitmentState(ledger, payload.commitment);
      if (approveState.state !== 'in_review') {
        return { valid: false, error: new MentuError('E_INVALID_OP', `Commitment must be in_review to approve (current: ${approveState.state})`) };
      }
      // TODO: Check approve permission from genesis
      break;
    }

    case 'reopen': {
      const payload = op.payload as { commitment?: string; reason?: string };
      if (!payload.commitment) {
        return { valid: false, error: new MentuError('E_MISSING_FIELD', 'reopen requires commitment') };
      }
      if (!payload.reason) {
        return { valid: false, error: new MentuError('E_MISSING_FIELD', 'reopen requires reason') };
      }
      const commitment = getCommitment(ledger, payload.commitment);
      if (!commitment) {
        return { valid: false, error: new MentuError('E_REF_NOT_FOUND', `Commitment ${payload.commitment} not found`) };
      }
      const reopenState = computeCommitmentState(ledger, payload.commitment);
      if (reopenState.state !== 'in_review' && reopenState.state !== 'closed') {
        return { valid: false, error: new MentuError('E_INVALID_OP', `Commitment must be in_review or closed to reopen (current: ${reopenState.state})`) };
      }
      // TODO: Check reopen permission from genesis
      break;
    }

    default:
      return {
        valid: false,
        error: new MentuError('E_INVALID_OP', `Unknown operation type: ${(op as Operation).op}`),
      };
  }

  return { valid: true };
}
