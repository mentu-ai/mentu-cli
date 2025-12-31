import { Hono } from 'hono';
import type {
  Operation,
  CaptureOperation,
  CommitOperation,
  ClaimOperation,
  ReleaseOperation,
  CloseOperation,
  AnnotateOperation,
  LinkOperation,
  DismissOperation,
  TriageOperation,
  SubmitOperation,
  ApproveOperation,
  ReopenOperation,
} from '../../types.js';
import { MentuError } from '../../types.js';
import { readLedger, appendOperation } from '../../core/ledger.js';
import { validateOperation } from '../../core/validate.js';
import { readGenesisKey } from '../../core/genesis.js';
import { getWorkspaceName } from '../../core/config.js';
import { generateId } from '../../utils/id.js';
import { timestamp } from '../../utils/time.js';

interface OpRequestBody {
  op: string;
  body?: string;
  source?: string;
  commitment?: string;
  evidence?: string | string[];
  target?: string;
  tags?: string[];
  kind?: string;
  source_key?: string;
  meta?: Record<string, unknown>;
  reason?: string;
  duplicate_of?: string;
  refs?: string[];
  path?: string;
  memory?: string;
  reviewed?: string[];
  summary?: string;
  decisions?: unknown[];
  validation?: Record<string, { passed: boolean; details?: string }>;
  tier?: string;
  comment?: string;
  auto?: boolean;
  from_state?: 'in_review' | 'closed';
}

/**
 * Build an operation from request body.
 * Actor comes from context (API key), not from request body.
 */
function buildOperation(body: OpRequestBody, actor: string, workspacePath: string): Operation {
  const ts = timestamp();
  const workspace = getWorkspaceName(workspacePath);

  switch (body.op) {
    case 'capture': {
      const id = generateId('mem');
      const op: CaptureOperation = {
        id,
        op: 'capture',
        ts,
        actor,
        workspace,
        payload: {
          body: body.body || '',
          kind: body.kind,
          path: body.path,
          refs: body.refs,
          meta: body.meta,
        },
      };
      if (body.source_key) {
        op.source_key = body.source_key;
      }
      return op;
    }

    case 'commit': {
      const id = generateId('cmt');
      const op: CommitOperation = {
        id,
        op: 'commit',
        ts,
        actor,
        workspace,
        payload: {
          body: body.body || '',
          source: body.source || '',
          tags: body.tags,
          meta: body.meta,
        },
      };
      return op;
    }

    case 'claim': {
      const id = generateId('op');
      const op: ClaimOperation = {
        id,
        op: 'claim',
        ts,
        actor,
        workspace,
        payload: {
          commitment: body.commitment || '',
        },
      };
      return op;
    }

    case 'release': {
      const id = generateId('op');
      const op: ReleaseOperation = {
        id,
        op: 'release',
        ts,
        actor,
        workspace,
        payload: {
          commitment: body.commitment || '',
          reason: body.reason,
        },
      };
      return op;
    }

    case 'close': {
      const id = generateId('op');
      const op: CloseOperation = {
        id,
        op: 'close',
        ts,
        actor,
        workspace,
        payload: {
          commitment: body.commitment || '',
          ...(typeof body.evidence === 'string' ? { evidence: body.evidence } : {}),
          ...(typeof body.duplicate_of === 'string' ? { duplicate_of: body.duplicate_of } : {}),
        },
      };
      return op;
    }

    case 'annotate': {
      const id = generateId('op');
      const op: AnnotateOperation = {
        id,
        op: 'annotate',
        ts,
        actor,
        workspace,
        payload: {
          target: body.target || '',
          body: body.body || '',
          kind: body.kind,
          refs: body.refs,
          meta: body.meta,
        },
      };
      return op;
    }

    case 'link': {
      const id = generateId('op');
      const op: LinkOperation = {
        id,
        op: 'link',
        ts,
        actor,
        workspace,
        payload: {
          source: body.source || '',
          target: body.target || '',
          kind: (body.kind || 'related') as LinkOperation['payload']['kind'],
          ...(body.reason && { reason: body.reason }),
        },
      };
      return op;
    }

    case 'dismiss': {
      const id = generateId('op');
      const op: DismissOperation = {
        id,
        op: 'dismiss',
        ts,
        actor,
        workspace,
        payload: {
          memory: body.memory || '',
          reason: body.reason || '',
          tags: body.tags,
        },
      };
      return op;
    }

    case 'triage': {
      const id = generateId('op');
      const op: TriageOperation = {
        id,
        op: 'triage',
        ts,
        actor,
        workspace,
        payload: {
          reviewed: body.reviewed ?? [],
          summary: body.summary ?? '',
          decisions: (body.decisions ?? []) as TriageOperation['payload']['decisions'],
        },
      };
      return op;
    }

    case 'submit': {
      const id = generateId('op');
      const evidence =
        typeof body.evidence === 'string'
          ? [body.evidence]
          : Array.isArray(body.evidence)
            ? body.evidence
            : [];

      const op: SubmitOperation = {
        id,
        op: 'submit',
        ts,
        actor,
        workspace,
        payload: {
          commitment: body.commitment || '',
          evidence,
          summary: body.summary,
          validation: body.validation,
          tier: body.tier,
        },
      };
      return op;
    }

    case 'approve': {
      const id = generateId('op');
      const op: ApproveOperation = {
        id,
        op: 'approve',
        ts,
        actor,
        workspace,
        payload: {
          commitment: body.commitment || '',
          comment: body.comment,
          auto: body.auto,
          tier: body.tier,
        },
      };
      return op;
    }

    case 'reopen': {
      const id = generateId('op');
      const op: ReopenOperation = {
        id,
        op: 'reopen',
        ts,
        actor,
        workspace,
        payload: {
          commitment: body.commitment || '',
          reason: body.reason || '',
          from_state: body.from_state || 'in_review',
        },
      };
      return op;
    }

    default:
      throw new MentuError('E_INVALID_OP', `Unknown operation type: ${body.op}`);
  }
}

/**
 * Format operation response based on operation type.
 */
function formatOperationResponse(op: Operation): Record<string, unknown> {
  const base = {
    id: op.id,
    op: op.op,
    ts: op.ts,
    actor: op.actor,
  };

  switch (op.op) {
    case 'capture':
      return {
        ...base,
        body: op.payload.body,
        kind: op.payload.kind,
        path: op.payload.path,
        refs: op.payload.refs,
      };
    case 'commit':
      return {
        ...base,
        body: op.payload.body,
        source: op.payload.source,
        tags: op.payload.tags,
      };
    case 'claim':
      return {
        ...base,
        commitment: op.payload.commitment,
      };
    case 'release':
      return {
        ...base,
        commitment: op.payload.commitment,
        reason: op.payload.reason,
      };
    case 'close':
      return {
        ...base,
        commitment: op.payload.commitment,
        evidence: op.payload.evidence,
        duplicate_of: op.payload.duplicate_of,
      };
    case 'annotate':
      return {
        ...base,
        target: op.payload.target,
        body: op.payload.body,
        kind: op.payload.kind,
        refs: op.payload.refs,
      };
    case 'link':
      return {
        ...base,
        source: op.payload.source,
        target: op.payload.target,
        kind: op.payload.kind,
        reason: op.payload.reason,
      };
    case 'dismiss':
      return {
        ...base,
        memory: op.payload.memory,
        reason: op.payload.reason,
        tags: op.payload.tags,
      };
    case 'triage':
      return {
        ...base,
        reviewed: op.payload.reviewed,
        summary: op.payload.summary,
        decisions: op.payload.decisions,
      };
    case 'submit':
      return {
        ...base,
        commitment: op.payload.commitment,
        evidence: op.payload.evidence,
        summary: op.payload.summary,
        tier: op.payload.tier,
        validation: op.payload.validation,
      };
    case 'approve':
      return {
        ...base,
        commitment: op.payload.commitment,
        comment: op.payload.comment,
        auto: op.payload.auto,
        tier: op.payload.tier,
      };
    case 'reopen':
      return {
        ...base,
        commitment: op.payload.commitment,
        reason: op.payload.reason,
        from_state: op.payload.from_state,
      };
    default:
      return base;
  }
}

/**
 * Operations routes - POST /ops handler.
 */
export function opsRoutes(workspacePath: string) {
  const router = new Hono();

  router.post('/', async (c) => {
    const body = (await c.req.json()) as OpRequestBody;
    // Actor comes from auth middleware, stored in context
    const actor = (c as unknown as { get: (key: string) => string }).get('actor');
    const genesis = readGenesisKey(workspacePath);
    const ledger = readLedger(workspacePath);

    // Validate operation type is provided
    if (!body.op) {
      throw new MentuError('E_MISSING_FIELD', 'Missing field: op', { field: 'op' });
    }

    // Build operation (actor from API key, not request)
    const operation = buildOperation(body, actor, workspacePath);

    // Validate with Genesis Key
    const validation = validateOperation(operation, ledger, genesis);
    if (!validation.valid && validation.error) {
      throw validation.error;
    }

    // Append to ledger
    appendOperation(workspacePath, operation);

    // Return the created operation
    return c.json(formatOperationResponse(operation), 201);
  });

  return router;
}
