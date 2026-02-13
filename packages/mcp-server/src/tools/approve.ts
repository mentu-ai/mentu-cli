import { postOp } from '../lib/client.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export const approveTool = {
  name: 'mentu_approve',
  description: 'Approve a submitted commitment, closing it as passed. Used after reviewing a submission to confirm the work meets requirements.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      commitment: {
        type: 'string',
        description: 'The commitment ID to approve (cmt_xxx)',
      },
      comment: {
        type: 'string',
        description: 'Optional approval comment',
      },
      auto: {
        type: 'boolean',
        description: 'Whether this is an auto-approval (e.g., all validations passed)',
      },
    },
    required: ['commitment'],
  },
};

export async function handleApprove(args: Record<string, unknown>): Promise<CallToolResult> {
  try {
    const result = await postOp({
      op: 'approve',
      commitment: args.commitment as string,
      comment: args.comment as string | undefined,
      auto: args.auto as boolean | undefined,
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          op_id: result.id,
          commitment: result.commitment,
          approved_at: result.ts,
          approved_by: result.actor,
          auto: result.auto ?? false,
        }, null, 2),
      }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error approving commitment: ${(err as Error).message}` }],
      isError: true,
    };
  }
}
