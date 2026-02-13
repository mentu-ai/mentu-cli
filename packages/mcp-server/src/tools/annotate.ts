import { postOp } from '../lib/client.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export const annotateTool = {
  name: 'mentu_annotate',
  description: 'Add an annotation (comment/note) to an existing memory or commitment. Annotations are append-only and cannot be edited.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      target: {
        type: 'string',
        description: 'ID of the memory (mem_xxx) or commitment (cmt_xxx) to annotate',
      },
      body: {
        type: 'string',
        description: 'The annotation text',
      },
      kind: {
        type: 'string',
        description: 'Optional kind/type of annotation (e.g., "investigation", "workaround", "note")',
      },
    },
    required: ['target', 'body'],
  },
};

export async function handleAnnotate(args: Record<string, unknown>): Promise<CallToolResult> {
  try {
    const result = await postOp({
      op: 'annotate',
      target: args.target as string,
      body: args.body as string,
      kind: args.kind as string | undefined,
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          op_id: result.id,
          target: result.target,
          annotated_at: result.ts,
        }, null, 2),
      }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error annotating: ${(err as Error).message}` }],
      isError: true,
    };
  }
}
