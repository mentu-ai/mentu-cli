import type { Context } from 'hono';
import crypto from 'crypto';
import {
  extractCommitmentId,
  formatPREvidence,
  formatCloseWarning,
  determineAction,
  type GitHubWebhookPayload,
  type WebhookHandlerResult,
} from '../../integrations/github/webhooks.js';
import { GitHubClient, buildGitHubConfig } from '../../integrations/github/index.js';
import type { CaptureOperation, AnnotateOperation, Commitment } from '../../types.js';
import { generateId } from '../../utils/id.js';
import { timestamp } from '../../utils/time.js';

/**
 * Verify GitHub webhook signature.
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) {
    return false;
  }

  const [algorithm, hash] = signature.split('=');
  if (algorithm !== 'sha256') {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf-8')
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(expected, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Handle GitHub webhook events.
 */
export async function handleGitHubWebhook(
  c: Context,
  appendOperation: (op: CaptureOperation | AnnotateOperation) => Promise<void>,
  findCommitmentByExternalRef: (system: string, id: string) => Promise<Commitment | null>,
  webhookSecret?: string
): Promise<Response> {
  const signature = c.req.header('x-hub-signature-256');
  const event = c.req.header('x-github-event');
  const delivery = c.req.header('x-github-delivery');

  // Get raw body for signature verification
  const rawBody = await c.req.text();

  // Verify signature if secret is configured
  if (webhookSecret) {
    if (!verifyWebhookSignature(rawBody, signature ?? null, webhookSecret)) {
      return c.json({ error: 'Invalid signature' }, 401);
    }
  }

  // Parse payload
  let payload: GitHubWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  // Handle ping event
  if (event === 'ping') {
    return c.json({ message: 'pong', delivery });
  }

  // Find linked commitment for issues
  let linkedCommitment: Commitment | null = null;
  if (payload.issue) {
    linkedCommitment = await findCommitmentByExternalRef(
      'github',
      String(payload.issue.number)
    );
  }

  // Determine action
  const action = determineAction(payload, linkedCommitment);

  const result: WebhookHandlerResult = {
    action: 'ignored',
    message: `Event ${event}.${payload.action} ignored`,
  };

  const workspace = 'default'; // TODO: resolve from repository
  const actor = 'system:github';

  switch (action) {
    case 'capture_evidence': {
      // PR merged - capture as evidence
      const { body, meta } = formatPREvidence(payload.pull_request);
      const commitmentId = extractCommitmentId(
        (payload.pull_request?.body ?? '') + (payload.pull_request?.title ?? '')
      );

      const captureOp: CaptureOperation = {
        id: generateId('op'),
        op: 'capture',
        ts: timestamp(),
        actor,
        workspace,
        payload: {
          body,
          kind: 'evidence',
          meta: {
            ...meta,
            commitment_id: commitmentId,
          },
        },
      };

      await appendOperation(captureOp);

      // Annotate commitment if found
      if (commitmentId) {
        const annotateOp: AnnotateOperation = {
          id: generateId('op'),
          op: 'annotate',
          ts: timestamp(),
          actor,
          workspace,
          payload: {
            target: commitmentId,
            body: `Evidence available: ${captureOp.id}`,
            kind: 'evidence_ready',
            meta: { memory_id: captureOp.id },
          },
        };
        await appendOperation(annotateOp);
      }

      result.action = 'captured';
      result.message = `Captured PR evidence: ${captureOp.id}`;
      result.memoryId = captureOp.id;
      break;
    }

    case 'warn_and_reopen': {
      // Issue closed without evidence - warn and reopen
      if (!linkedCommitment || !payload.issue) break;

      const githubConfig = buildGitHubConfig(undefined);
      if (!githubConfig) {
        result.action = 'ignored';
        result.message = 'GitHub not configured, cannot reopen';
        break;
      }

      const client = new GitHubClient(githubConfig);

      // Add warning comment
      await client.addComment(
        payload.issue.number,
        formatCloseWarning(linkedCommitment.id)
      );

      // Reopen issue
      await client.updateIssue(payload.issue.number, { state: 'open' });

      // Annotate commitment
      const annotateOp: AnnotateOperation = {
        id: generateId('op'),
        op: 'annotate',
        ts: timestamp(),
        actor,
        workspace,
        payload: {
          target: linkedCommitment.id,
          body: `GitHub issue #${payload.issue.number} was closed without evidence. Reopened.`,
          kind: 'sync_warning',
        },
      };
      await appendOperation(annotateOp);

      result.action = 'warned';
      result.message = `Issue #${payload.issue.number} reopened with warning`;
      result.operationId = annotateOp.id;
      break;
    }

    case 'annotate': {
      // Issue comment - add as annotation
      if (!linkedCommitment || !payload.comment) break;

      const annotateOp: AnnotateOperation = {
        id: generateId('op'),
        op: 'annotate',
        ts: timestamp(),
        actor: `github:${payload.sender.login}`,
        workspace,
        payload: {
          target: linkedCommitment.id,
          body: `GitHub comment by ${payload.sender.login}: ${payload.comment.body}`,
          kind: 'external_comment',
          meta: {
            source: 'github',
            comment_url: payload.comment.html_url,
          },
        },
      };
      await appendOperation(annotateOp);

      result.action = 'annotated';
      result.message = `Added annotation from GitHub comment`;
      result.operationId = annotateOp.id;
      break;
    }

    case 'ignore':
    default:
      // No action needed
      break;
  }

  return c.json(result);
}
