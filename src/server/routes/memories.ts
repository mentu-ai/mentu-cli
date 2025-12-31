import { Hono } from 'hono';
import { readLedger } from '../../core/ledger.js';
import { computeMemories, getMemory, getAnnotations } from '../../core/state.js';
import { MentuError, type Memory } from '../../types.js';
import type { MemoryQueryParams } from '../types.js';

/**
 * Parse query parameters for memories endpoint.
 */
function parseQueryParams(c: { req: { query: (key: string) => string | undefined } }): MemoryQueryParams {
  const limit = parseInt(c.req.query('limit') || '100', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);
  const kind = c.req.query('kind');
  const tagsParam = c.req.query('tags');
  const tags = tagsParam ? tagsParam.split(',').map((t) => t.trim()) : undefined;
  const since = c.req.query('since');

  return {
    limit: Math.min(Math.max(1, limit), 1000),
    offset: Math.max(0, offset),
    kind,
    tags,
    since,
  };
}

/**
 * Apply filters to memories list.
 */
function applyFilters(memories: Memory[], params: MemoryQueryParams): Memory[] {
  let filtered = memories;

  if (params.kind) {
    filtered = filtered.filter((m) => m.kind === params.kind);
  }

  if (params.since) {
    const sinceDate = new Date(params.since);
    filtered = filtered.filter((m) => new Date(m.ts) > sinceDate);
  }

  // Note: Memory type doesn't have tags in current schema,
  // but we filter based on refs or meta if needed
  // For now, skip tag filtering for memories

  return filtered;
}

/**
 * Find commitments that reference this memory as source.
 */
function findCommitmentsForMemory(workspacePath: string, memoryId: string): string[] {
  const ledger = readLedger(workspacePath);
  const commitmentIds: string[] = [];

  for (const op of ledger) {
    if (op.op === 'commit' && op.payload.source === memoryId) {
      commitmentIds.push(op.id);
    }
  }

  return commitmentIds;
}

/**
 * Memories routes.
 */
export function memoriesRoutes(workspacePath: string) {
  const router = new Hono();

  // GET /memories
  router.get('/', (c) => {
    const params = parseQueryParams(c);
    const ledger = readLedger(workspacePath);
    const allMemories = computeMemories(ledger);

    // Apply filters
    const filtered = applyFilters(allMemories, params);
    const total = filtered.length;

    // Apply pagination
    const paginated = filtered.slice(params.offset, params.offset + params.limit);

    return c.json({
      memories: paginated.map((m) => ({
        id: m.id,
        body: m.body,
        ts: m.ts,
        actor: m.actor,
        kind: m.kind,
        annotations: m.annotations,
      })),
      total,
      limit: params.limit,
      offset: params.offset,
    });
  });

  // GET /memories/:id
  router.get('/:id', (c) => {
    const id = c.req.param('id');
    const ledger = readLedger(workspacePath);

    const memory = getMemory(ledger, id);
    if (!memory) {
      throw new MentuError('E_REF_NOT_FOUND', `Memory ${id} not found`, { id });
    }

    const annotations = getAnnotations(ledger, id);
    const commitments = findCommitmentsForMemory(workspacePath, id);

    return c.json({
      id: memory.id,
      body: memory.body,
      ts: memory.ts,
      actor: memory.actor,
      kind: memory.kind,
      refs: memory.refs,
      meta: memory.meta,
      annotations,
      commitments,
    });
  });

  return router;
}
