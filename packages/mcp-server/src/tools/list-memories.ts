import { listMemories } from '../lib/client.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export const listMemoriesTool = {
  name: 'mentu_list_memories',
  description: 'List memories (bug reports, evidence, observations) from the Mentu workspace. Supports filtering by kind and pagination.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of memories to return (default: 50, max: 1000)',
      },
      offset: {
        type: 'number',
        description: 'Number of memories to skip (for pagination)',
      },
      kind: {
        type: 'string',
        description: 'Filter by memory kind (e.g., "bug-report", "validation", "document")',
      },
      since: {
        type: 'string',
        description: 'Only return memories created after this ISO timestamp',
      },
    },
  },
};

export async function handleListMemories(args: Record<string, unknown>): Promise<CallToolResult> {
  try {
    const result = await listMemories({
      limit: (args.limit as number) || 50,
      offset: args.offset as number | undefined,
      kind: args.kind as string | undefined,
      since: args.since as string | undefined,
    });

    const summary = result.memories.map(m => ({
      id: m.id,
      body: m.body.slice(0, 120) + (m.body.length > 120 ? '...' : ''),
      kind: m.kind,
      ts: m.ts,
      annotations_count: m.annotations?.length ?? 0,
    }));

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          total: result.total,
          showing: summary.length,
          offset: result.offset,
          memories: summary,
        }, null, 2),
      }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error listing memories: ${(err as Error).message}` }],
      isError: true,
    };
  }
}
