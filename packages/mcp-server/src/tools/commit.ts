import { postOp } from '../lib/client.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export const commitTool = {
  name: 'mentu_commit',
  description: 'Create a new commitment in the Mentu ledger. A commitment is a promise to do work, typically linked to a memory (bug report) via the source field.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      body: {
        type: 'string',
        description: 'Description of the commitment (e.g., "Fix: Login button not working on mobile")',
      },
      source: {
        type: 'string',
        description: 'Source memory ID (mem_xxx) that this commitment addresses',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional tags for categorization (e.g., ["bug", "ui", "mobile"])',
      },
      meta: {
        type: 'object',
        description: 'Optional metadata to attach to the commitment',
      },
    },
    required: ['body', 'source'],
  },
};

export async function handleCommit(args: Record<string, unknown>): Promise<CallToolResult> {
  try {
    const result = await postOp({
      op: 'commit',
      body: args.body as string,
      source: args.source as string,
      tags: args.tags as string[] | undefined,
      meta: args.meta as Record<string, unknown> | undefined,
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          commitment_id: result.id,
          body: result.body,
          source: result.source,
          created_at: result.ts,
        }, null, 2),
      }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error creating commitment: ${(err as Error).message}` }],
      isError: true,
    };
  }
}
