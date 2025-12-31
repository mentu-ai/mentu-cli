import type { Context, Next } from 'hono';
import { readGenesisKey } from '../../core/genesis.js';

/**
 * Genesis Key middleware.
 * Loads the Genesis Key and stores it in context for handlers.
 * Actual permission checking happens in the route handlers after parsing body.
 */
export function genesisMiddleware(workspacePath: string) {
  return async (c: Context, next: Next) => {
    // Only apply to POST /ops
    if (c.req.method !== 'POST' || !c.req.path.startsWith('/ops')) {
      return next();
    }

    const genesis = readGenesisKey(workspacePath);

    // Store genesis for later use in route handler
    c.set('genesis', genesis);

    await next();
  };
}
