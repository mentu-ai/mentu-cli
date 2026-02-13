import { postOp } from '../lib/client.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { TriageDecision } from '../lib/types.js';

export const triageTool = {
  name: 'mentu_triage',
  description: 'Record a triage session. After reviewing memories (bugs), record what was decided for each: create a commitment, link to existing, dismiss, or defer. This is the 5-gate filter result.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      reviewed: {
        type: 'array',
        items: { type: 'string' },
        description: 'Memory IDs (mem_xxx) that were reviewed in this triage session',
      },
      summary: {
        type: 'string',
        description: 'Human-readable summary of the triage session',
      },
      decisions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            memory: { type: 'string', description: 'Memory ID (mem_xxx)' },
            action: { type: 'string', enum: ['create', 'link', 'dismiss', 'defer'], description: 'Decision for this memory' },
            target: { type: 'string', description: 'Commitment ID (cmt_xxx) if action is "link" or "create"' },
            reason: { type: 'string', description: 'Explanation for the decision' },
          },
          required: ['memory', 'action'],
        },
        description: 'Decisions made for each reviewed memory',
      },
    },
    required: ['reviewed', 'summary', 'decisions'],
  },
};

export async function handleTriage(args: Record<string, unknown>): Promise<CallToolResult> {
  try {
    const result = await postOp({
      op: 'triage',
      reviewed: args.reviewed as string[],
      summary: args.summary as string,
      decisions: args.decisions as TriageDecision[],
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          op_id: result.id,
          reviewed_count: (args.reviewed as string[]).length,
          decisions_count: (args.decisions as TriageDecision[]).length,
          summary: args.summary,
          triaged_at: result.ts,
        }, null, 2),
      }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error recording triage: ${(err as Error).message}` }],
      isError: true,
    };
  }
}
