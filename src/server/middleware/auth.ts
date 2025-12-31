import type { Context, Next } from 'hono';
import { MentuError } from '../../types.js';
import { readConfig } from '../../core/config.js';
import { hashApiKey, type ApiKeyStored } from '../types.js';

/**
 * Auth middleware for API key validation.
 * Compares hashed keys for security.
 * Skips /health endpoint.
 */
export function authMiddleware(workspacePath: string) {
  return async (c: Context, next: Next) => {
    // Skip auth for health endpoint
    if (c.req.path === '/health') {
      return next();
    }

    const authHeader = c.req.header('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      throw new MentuError('E_UNAUTHORIZED', 'Missing or invalid Authorization header');
    }

    const token = authHeader.slice(7); // Remove 'Bearer '
    const tokenHash = hashApiKey(token);

    // Read config and find API key
    const config = readConfig(workspacePath) as Record<string, unknown> | null;
    const apiKeys = (config?.api as Record<string, unknown> | undefined)?.keys as ApiKeyStored[] | undefined;

    // Find key by comparing hashes (not plain text)
    const apiKey = apiKeys?.find((k: ApiKeyStored) => k.key_hash === tokenHash);
    if (!apiKey) {
      throw new MentuError('E_UNAUTHORIZED', 'Invalid API key');
    }

    // Check read permission for GET requests
    if (c.req.method === 'GET' && !apiKey.permissions.includes('read')) {
      throw new MentuError('E_FORBIDDEN', 'API key does not have read permission');
    }

    // Check write permission for POST/PUT/DELETE requests
    if (['POST', 'PUT', 'DELETE'].includes(c.req.method) && !apiKey.permissions.includes('write')) {
      throw new MentuError('E_FORBIDDEN', 'API key does not have write permission');
    }

    // Store in context for later use
    // IMPORTANT: Actor comes from API key, not from request body
    c.set('apiKey', apiKey);
    c.set('actor', apiKey.actor);
    c.set('workspacePath', workspacePath);

    await next();
  };
}
