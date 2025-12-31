import { Hono } from 'hono';
import { readLedger } from '../../core/ledger.js';
import type { LedgerQueryParams } from '../types.js';

/**
 * Parse query parameters for ledger endpoint.
 */
function parseQueryParams(c: { req: { query: (key: string) => string | undefined } }): LedgerQueryParams {
  const limit = parseInt(c.req.query('limit') || '100', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);
  const since = c.req.query('since');
  const op = c.req.query('op');
  const actor = c.req.query('actor');

  return {
    limit: Math.min(Math.max(1, limit), 1000),
    offset: Math.max(0, offset),
    since,
    op,
    actor,
  };
}

/**
 * Ledger routes - raw ledger access.
 */
export function ledgerRoutes(workspacePath: string) {
  const router = new Hono();

  // GET /ledger
  router.get('/', (c) => {
    const params = parseQueryParams(c);
    let operations = readLedger(workspacePath);

    // Apply filters
    if (params.since) {
      const sinceDate = new Date(params.since);
      operations = operations.filter((op) => new Date(op.ts) > sinceDate);
    }

    if (params.op) {
      operations = operations.filter((op) => op.op === params.op);
    }

    if (params.actor) {
      operations = operations.filter((op) => op.actor === params.actor);
    }

    const total = operations.length;

    // Apply pagination
    const paginated = operations.slice(params.offset, params.offset + params.limit);

    return c.json({
      operations: paginated,
      total,
      limit: params.limit,
      offset: params.offset,
    });
  });

  return router;
}
