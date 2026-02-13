import { listCommitments } from '../lib/client.js';
import { stateLabel } from '../lib/state-machine.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export const listCommitmentsTool = {
  name: 'mentu_list_commitments',
  description: 'List commitments from the Mentu workspace. Supports filtering by state (open, claimed, in_review, closed, reopened), owner, and tags.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      state: {
        type: 'string',
        enum: ['open', 'claimed', 'in_review', 'closed', 'reopened'],
        description: 'Filter by commitment state',
      },
      owner: {
        type: 'string',
        description: 'Filter by owner (actor who claimed)',
      },
      tags: {
        type: 'string',
        description: 'Filter by tags (comma-separated)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of commitments to return (default: 50)',
      },
      offset: {
        type: 'number',
        description: 'Number of commitments to skip (for pagination)',
      },
      since: {
        type: 'string',
        description: 'Only return commitments created after this ISO timestamp',
      },
    },
  },
};

export async function handleListCommitments(args: Record<string, unknown>): Promise<CallToolResult> {
  try {
    const result = await listCommitments({
      state: args.state as string | undefined,
      owner: args.owner as string | undefined,
      tags: args.tags as string | undefined,
      limit: (args.limit as number) || 50,
      offset: args.offset as number | undefined,
      since: args.since as string | undefined,
    });

    const summary = result.commitments.map(c => ({
      id: c.id,
      body: c.body.slice(0, 100) + (c.body.length > 100 ? '...' : ''),
      state: c.state,
      state_label: stateLabel(c.state),
      owner: c.owner,
      source: c.source,
      tags: c.tags,
      created_at: c.created_at,
    }));

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          total: result.total,
          showing: summary.length,
          offset: result.offset,
          commitments: summary,
        }, null, 2),
      }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error listing commitments: ${(err as Error).message}` }],
      isError: true,
    };
  }
}
