import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { opsRoutes } from './routes/ops.js';
import { memoriesRoutes } from './routes/memories.js';
import { commitmentsRoutes } from './routes/commitments.js';
import { ledgerRoutes } from './routes/ledger.js';
import { statusRoutes } from './routes/status.js';
import { healthRoutes } from './routes/health.js';
import { authMiddleware } from './middleware/auth.js';
import { genesisMiddleware } from './middleware/genesis.js';
import { MentuError } from '../types.js';
import { handleGitHubWebhook } from './webhooks/github.js';

/**
 * Map error codes to HTTP status codes.
 */
function getStatusCode(errorCode: string): number {
  switch (errorCode) {
    case 'E_UNAUTHORIZED':
      return 401;
    case 'E_PERMISSION_DENIED':
    case 'E_CONSTRAINT_VIOLATED':
    case 'E_FORBIDDEN':
      return 403;
    case 'E_REF_NOT_FOUND':
    case 'E_NOT_FOUND':
      return 404;
    case 'E_INVALID_STATE':
    case 'E_EXTERNAL_REF_EXISTS':
    case 'E_ALREADY_CLOSED':
    case 'E_ALREADY_CLAIMED':
    case 'E_DUPLICATE_ID':
    case 'E_DUPLICATE_SOURCE_KEY':
      return 409;
    case 'E_MISSING_FIELD':
    case 'E_EMPTY_BODY':
    case 'E_INVALID_OP':
      return 400;
    default:
      return 500;
  }
}

/**
 * Create and configure the Hono application.
 */
export function createApp(workspacePath: string, enableCors: boolean) {
  const app = new Hono();

  // Global error handler using Hono's onError
  app.onError((err, c) => {
    // Check for MentuError by name and code property (handles ES module issues)
    if (err.name === 'MentuError' && 'code' in err) {
      const mentuErr = err as MentuError;
      const status = getStatusCode(mentuErr.code);
      return c.json(mentuErr.toJSON(), status as 400 | 401 | 403 | 404 | 409 | 500);
    }

    // Handle JSON parse errors
    if (err instanceof SyntaxError && 'body' in err) {
      return c.json({ error: 'E_INVALID_OP', message: 'Invalid JSON in request body' }, 400);
    }

    console.error('Unexpected error:', err);
    return c.json({ error: 'E_INTERNAL', message: 'Internal server error' }, 500);
  });

  // Global middleware
  if (enableCors) {
    app.use('*', cors());
  }

  // Auth middleware (skips /health)
  app.use('*', authMiddleware(workspacePath));

  // Genesis Key middleware (only for POST /ops)
  app.use('*', genesisMiddleware(workspacePath));

  // Routes - health is unauthenticated (handled by auth middleware skip)
  app.route('/health', healthRoutes(workspacePath));
  app.route('/ops', opsRoutes(workspacePath));
  app.route('/memories', memoriesRoutes(workspacePath));
  app.route('/commitments', commitmentsRoutes(workspacePath));
  app.route('/ledger', ledgerRoutes(workspacePath));
  app.route('/status', statusRoutes(workspacePath));

  // GitHub webhook endpoint (no auth required - uses signature verification)
  app.post('/webhooks/github', async (c) => {
    // TODO: Implement appendOperation and findCommitmentByExternalRef
    // These should use the cloud sync service
    return handleGitHubWebhook(
      c,
      async (op) => {
        // Append to cloud ledger via API
        console.log('Would append:', op);
      },
      async (_system, _id) => {
        // Find commitment by external ref
        // TODO: Implement lookup
        return null;
      },
      process.env.GITHUB_WEBHOOK_SECRET
    );
  });

  return app;
}
