import { postOp } from '../lib/client.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export const dismissTool = {
  name: 'mentu_dismiss',
  description: 'Dismiss a memory (e.g., a bug report that is junk, a test submission, or a duplicate). Requires a reason explaining why it was dismissed.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      memory: {
        type: 'string',
        description: 'Memory ID to dismiss (mem_xxx)',
      },
      reason: {
        type: 'string',
        description: 'Reason for dismissal (e.g., "Test submission", "Duplicate of mem_xxx", "Unintelligible")',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional categorization tags (e.g., ["junk", "test", "duplicate"])',
      },
    },
    required: ['memory', 'reason'],
  },
};

export async function handleDismiss(args: Record<string, unknown>): Promise<CallToolResult> {
  try {
    const result = await postOp({
      op: 'dismiss',
      memory: args.memory as string,
      reason: args.reason as string,
      tags: args.tags as string[] | undefined,
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          op_id: result.id,
          memory: result.memory,
          reason: result.reason,
          dismissed_at: result.ts,
        }, null, 2),
      }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error dismissing memory: ${(err as Error).message}` }],
      isError: true,
    };
  }
}
