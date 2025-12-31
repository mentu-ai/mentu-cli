import { Hono } from 'hono';
import { getMentuVersion } from '../../utils/version.js';

const startTime = Date.now();

/**
 * Health check routes.
 * No authentication required.
 */
export function healthRoutes(workspacePath: string) {
  const router = new Hono();

  // GET /health - no authentication required
  router.get('/', (c) => {
    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

    return c.json({
      status: 'healthy',
      version: getMentuVersion(),
      uptime_seconds: uptimeSeconds,
      workspace: workspacePath,
    });
  });

  return router;
}
