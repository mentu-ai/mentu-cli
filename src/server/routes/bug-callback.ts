/**
 * Bug Callback System
 *
 * Delivers completion notifications to external systems when bug workflows complete.
 *
 * Callbacks are stored in the bug memory payload:
 *   payload.callback_url: URL to POST to
 *   payload.callback_secret: HMAC-SHA256 signing key (optional)
 *
 * Called by workflow orchestrator when workflow reaches terminal state.
 */

import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

interface CallbackPayload {
  commitmentId: string;
  memoryId: string;
  state: 'closed' | 'failed';
  prUrl?: string;
  summary?: string;
  error?: string;
  timestamp: string;
}

interface MemoryPayload {
  source?: string;
  callback_url?: string;
  callback_secret?: string;
  [key: string]: unknown;
}

/**
 * Sign payload with HMAC-SHA256
 */
function signPayload(payload: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return `sha256=${hmac.digest('hex')}`;
}

/**
 * Deliver callback to external system
 */
async function deliverCallback(
  url: string,
  payload: CallbackPayload,
  secret?: string
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mentu-Bug-Callback/1.0',
  };

  if (secret) {
    headers['X-Mentu-Signature'] = signPayload(body, secret);
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });

    return {
      success: response.ok,
      statusCode: response.status,
      error: response.ok ? undefined : await response.text(),
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Generate a random operation ID
 */
function generateOpId(): string {
  return `op_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Bug callback routes.
 */
export function bugCallbackRoutes(_workspacePath: string) {
  const router = new Hono();

  /**
   * POST /bug-callback/deliver
   *
   * Called internally when a bug workflow completes.
   * Looks up callback URL from memory and delivers notification.
   *
   * Body: { commitmentId, state, prUrl?, summary?, error? }
   */
  router.post('/deliver', async (c) => {
    const body = await c.req.json() as {
      commitmentId: string;
      state: 'closed' | 'failed';
      prUrl?: string;
      summary?: string;
      error?: string;
    };

    const { commitmentId, state, prUrl, summary, error } = body;

    if (!commitmentId || !state) {
      return c.json({
        error: 'Missing required fields: commitmentId, state',
      }, 400);
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return c.json({
        error: 'Server configuration error',
      }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
      // 1. Find commitment and its source memory
      const { data: commitment } = await supabase
        .from('operations')
        .select('payload')
        .eq('id', commitmentId)
        .single();

      if (!commitment) {
        return c.json({ error: 'Commitment not found' }, 404);
      }

      const commitmentPayload = commitment.payload as MemoryPayload;
      const sourceMemoryId = commitmentPayload?.source;
      if (!sourceMemoryId) {
        return c.json({ error: 'Source memory not found' }, 404);
      }

      // 2. Get memory with callback info
      const { data: memory } = await supabase
        .from('operations')
        .select('payload')
        .eq('id', sourceMemoryId)
        .single();

      if (!memory) {
        return c.json({ error: 'Memory not found' }, 404);
      }

      const memoryPayload = memory.payload as MemoryPayload;

      if (!memoryPayload.callback_url) {
        return c.json({
          delivered: false,
          reason: 'No callback URL registered',
        });
      }

      // 3. Build and deliver callback
      const callbackPayload: CallbackPayload = {
        commitmentId,
        memoryId: sourceMemoryId,
        state,
        prUrl,
        summary,
        error,
        timestamp: new Date().toISOString(),
      };

      const result = await deliverCallback(
        memoryPayload.callback_url,
        callbackPayload,
        memoryPayload.callback_secret
      );

      // 4. Record delivery attempt as annotation
      const annotationBody = result.success
        ? `Callback delivered to ${memoryPayload.callback_url}`
        : `Callback failed to ${memoryPayload.callback_url}: ${result.error}`;

      await supabase.from('operations').insert({
        id: generateOpId(),
        kind: 'annotate',
        timestamp: new Date().toISOString(),
        actor: 'system:callback',
        workspace_id: process.env.WORKSPACE_ID,
        payload: {
          target: commitmentId,
          body: annotationBody,
          callback_result: result,
        },
      });

      return c.json({
        delivered: result.success,
        statusCode: result.statusCode,
        error: result.error,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  /**
   * POST /bug-callback/test
   *
   * Test callback delivery to a URL.
   *
   * Body: { url, secret? }
   */
  router.post('/test', async (c) => {
    const body = await c.req.json() as { url: string; secret?: string };
    const { url, secret } = body;

    if (!url) {
      return c.json({ error: 'Missing required field: url' }, 400);
    }

    const testPayload: CallbackPayload = {
      commitmentId: 'cmt_test',
      memoryId: 'mem_test',
      state: 'closed',
      summary: 'Test callback from Mentu',
      timestamp: new Date().toISOString(),
    };

    const result = await deliverCallback(url, testPayload, secret);

    return c.json({
      success: result.success,
      statusCode: result.statusCode,
      error: result.error,
      sentPayload: testPayload,
    });
  });

  return router;
}
