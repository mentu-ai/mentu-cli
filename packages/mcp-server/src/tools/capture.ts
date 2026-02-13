import { postOp } from '../lib/client.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export const captureTool = {
  name: 'mentu_capture',
  description: 'Capture a memory (evidence) in the Mentu ledger. Memories are immutable records of observations, bug reports, execution progress, validation results, or documents.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      body: {
        type: 'string',
        description: 'Content of the memory (bug description, progress note, validation result, etc.)',
      },
      kind: {
        type: 'string',
        description: 'Type of memory: "bug-report", "execution-progress", "validation", "document", or custom',
      },
      refs: {
        type: 'array',
        items: { type: 'string' },
        description: 'Related IDs (cmt_xxx, mem_xxx) to associate with this memory',
      },
      meta: {
        type: 'object',
        description: 'Optional metadata (e.g., { "page_url": "...", "priority": "high" })',
      },
      source_key: {
        type: 'string',
        description: 'Unique deduplication key to prevent duplicate captures',
      },
    },
    required: ['body'],
  },
};

export async function handleCapture(args: Record<string, unknown>): Promise<CallToolResult> {
  try {
    const result = await postOp({
      op: 'capture',
      body: args.body as string,
      kind: args.kind as string | undefined,
      refs: args.refs as string[] | undefined,
      meta: args.meta as Record<string, unknown> | undefined,
      source_key: args.source_key as string | undefined,
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          memory_id: result.id,
          body: (result.body as string)?.slice(0, 100),
          kind: result.kind ?? null,
          captured_at: result.ts,
        }, null, 2),
      }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error capturing memory: ${(err as Error).message}` }],
      isError: true,
    };
  }
}
