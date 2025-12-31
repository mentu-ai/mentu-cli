import { Hono } from 'hono';
import { readLedger } from '../../core/ledger.js';
import { computeCommitmentState, computeCommitments, getCommitment, getAnnotations } from '../../core/state.js';
import { getExternalRefs } from '../../core/external.js';
import { MentuError, type Commitment, type Operation } from '../../types.js';
import type { CommitmentQueryParams } from '../types.js';

/**
 * Parse query parameters for commitments endpoint.
 */
function parseQueryParams(c: { req: { query: (key: string) => string | undefined } }): CommitmentQueryParams {
  const limit = parseInt(c.req.query('limit') || '100', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);
  const state = c.req.query('state') as
    | 'open'
    | 'claimed'
    | 'in_review'
    | 'reopened'
    | 'closed'
    | undefined;
  const owner = c.req.query('owner');
  const tagsParam = c.req.query('tags');
  const tags = tagsParam ? tagsParam.split(',').map((t) => t.trim()) : undefined;
  const since = c.req.query('since');

  return {
    limit: Math.min(Math.max(1, limit), 1000),
    offset: Math.max(0, offset),
    state: state && ['open', 'claimed', 'in_review', 'reopened', 'closed'].includes(state) ? state : undefined,
    owner,
    tags,
    since,
  };
}

/**
 * Apply filters to commitments list.
 */
function applyFilters(commitments: Commitment[], params: CommitmentQueryParams): Commitment[] {
  let filtered = commitments;

  if (params.state) {
    filtered = filtered.filter((c) => c.state === params.state);
  }

  if (params.owner) {
    filtered = filtered.filter((c) => c.owner === params.owner);
  }

  if (params.tags && params.tags.length > 0) {
    filtered = filtered.filter((c) => {
      const cmtTags = c.tags || [];
      return params.tags!.every((tag) => cmtTags.includes(tag));
    });
  }

  if (params.since) {
    const sinceDate = new Date(params.since);
    filtered = filtered.filter((c) => new Date(c.ts) > sinceDate);
  }

  return filtered;
}

/**
 * Build history for a commitment from ledger.
 */
function buildHistory(ledger: Operation[], commitmentId: string): Array<{ op: string; ts: string; actor: string }> {
  const history: Array<{ op: string; ts: string; actor: string }> = [];

  for (const op of ledger) {
    // Include the commit operation itself
    if (op.op === 'commit' && op.id === commitmentId) {
      history.push({ op: 'commit', ts: op.ts, actor: op.actor });
    }
    // Include claim/release/close operations that reference this commitment
    if (op.op === 'claim' && op.payload.commitment === commitmentId) {
      history.push({ op: 'claim', ts: op.ts, actor: op.actor });
    }
    if (op.op === 'release' && op.payload.commitment === commitmentId) {
      history.push({ op: 'release', ts: op.ts, actor: op.actor });
    }
    if (op.op === 'submit' && op.payload.commitment === commitmentId) {
      history.push({ op: 'submit', ts: op.ts, actor: op.actor });
    }
    if (op.op === 'approve' && op.payload.commitment === commitmentId) {
      history.push({ op: 'approve', ts: op.ts, actor: op.actor });
    }
    if (op.op === 'reopen' && op.payload.commitment === commitmentId) {
      history.push({ op: 'reopen', ts: op.ts, actor: op.actor });
    }
    if (op.op === 'close' && op.payload.commitment === commitmentId) {
      history.push({ op: 'close', ts: op.ts, actor: op.actor });
    }
  }

  return history;
}

/**
 * Commitments routes.
 */
export function commitmentsRoutes(workspacePath: string) {
  const router = new Hono();

  // GET /commitments
  router.get('/', (c) => {
    const params = parseQueryParams(c);
    const ledger = readLedger(workspacePath);
    const allCommitments = computeCommitments(ledger);

    // Apply filters
    const filtered = applyFilters(allCommitments, params);
    const total = filtered.length;

    // Apply pagination
    const paginated = filtered.slice(params.offset, params.offset + params.limit);

    return c.json({
      commitments: paginated.map((cmt) => ({
        id: cmt.id,
        body: cmt.body,
        source: cmt.source,
        state: cmt.state,
        owner: cmt.owner,
        created_at: cmt.ts,
        created_by: cmt.actor,
        tags: cmt.tags || [],
      })),
      total,
      limit: params.limit,
      offset: params.offset,
    });
  });

  // GET /commitments/:id
  router.get('/:id', (c) => {
    const id = c.req.param('id');
    const ledger = readLedger(workspacePath);

    const commitment = getCommitment(ledger, id);
    if (!commitment) {
      throw new MentuError('E_REF_NOT_FOUND', `Commitment ${id} not found`, { id });
    }

    const annotations = getAnnotations(ledger, id);
    const externalRefs = getExternalRefs(ledger, id);
    const history = buildHistory(ledger, id);

    const state = computeCommitmentState(ledger, id);
    const closeEvent = history.filter((h) => h.op === 'close' || h.op === 'approve').at(-1);

    return c.json({
      id: commitment.id,
      body: commitment.body,
      source: commitment.source,
      state: commitment.state,
      owner: commitment.owner,
      created_at: commitment.ts,
      created_by: commitment.actor,
      closed_at: closeEvent?.ts ?? null,
      closed_by: commitment.closed_by,
      evidence: commitment.evidence,
      duplicate_of: state.duplicate_of ?? null,
      tags: commitment.tags || [],
      annotations,
      external_refs: externalRefs,
      history,
    });
  });

  return router;
}
