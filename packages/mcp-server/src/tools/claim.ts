import { postOp } from '../lib/client.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export const claimTool = {
  name: 'mentu_claim',
  description: 'Claim a commitment for execution. Only open or reopened commitments can be claimed. This signals that work is about to begin.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      commitment: {
        type: 'string',
        description: 'The commitment ID to claim (cmt_xxx)',
      },
    },
    required: ['commitment'],
  },
};

export async function handleClaim(args: Record<string, unknown>): Promise<CallToolResult> {
  try {
    const result = await postOp({
      op: 'claim',
      commitment: args.commitment as string,
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          op_id: result.id,
          commitment: result.commitment,
          claimed_at: result.ts,
          claimed_by: result.actor,
        }, null, 2),
      }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error claiming commitment: ${(err as Error).message}` }],
      isError: true,
    };
  }
}
