import { postOp } from '../lib/client.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export const closeTool = {
  name: 'mentu_close',
  description: 'Close a commitment. Can close with evidence (normal close) or as a duplicate of another commitment. For the standard workflow, use mentu_submit + mentu_approve instead.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      commitment: {
        type: 'string',
        description: 'The commitment ID to close (cmt_xxx)',
      },
      evidence: {
        type: 'string',
        description: 'Evidence memory ID (mem_xxx) for normal close',
      },
      duplicate_of: {
        type: 'string',
        description: 'Commitment ID (cmt_xxx) if closing as duplicate',
      },
    },
    required: ['commitment'],
  },
};

export async function handleClose(args: Record<string, unknown>): Promise<CallToolResult> {
  try {
    const result = await postOp({
      op: 'close',
      commitment: args.commitment as string,
      evidence: args.evidence as string | undefined,
      duplicate_of: args.duplicate_of as string | undefined,
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          op_id: result.id,
          commitment: result.commitment,
          closed_at: result.ts,
          closed_by: result.actor,
          duplicate_of: result.duplicate_of ?? null,
        }, null, 2),
      }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error closing commitment: ${(err as Error).message}` }],
      isError: true,
    };
  }
}
