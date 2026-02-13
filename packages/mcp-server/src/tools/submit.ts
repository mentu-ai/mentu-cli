import { postOp } from '../lib/client.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export const submitTool = {
  name: 'mentu_submit',
  description: 'Submit a claimed commitment for review. Includes evidence of work done. Moves the commitment to "in_review" state.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      commitment: {
        type: 'string',
        description: 'The commitment ID to submit (cmt_xxx)',
      },
      evidence: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of evidence memory IDs (mem_xxx) documenting the work done',
      },
      summary: {
        type: 'string',
        description: 'Summary of what was done to fulfill the commitment',
      },
      tier: {
        type: 'string',
        description: 'Complexity tier: T1 (simple), T2 (multi-component), T3 (architectural)',
      },
      validation: {
        type: 'object',
        description: 'Validation results (e.g., { "build": { "passed": true }, "tests": { "passed": true } })',
      },
    },
    required: ['commitment', 'evidence'],
  },
};

export async function handleSubmit(args: Record<string, unknown>): Promise<CallToolResult> {
  try {
    const result = await postOp({
      op: 'submit',
      commitment: args.commitment as string,
      evidence: args.evidence as string[],
      summary: args.summary as string | undefined,
      tier: args.tier as string | undefined,
      validation: args.validation as Record<string, { passed: boolean; details?: string }> | undefined,
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          op_id: result.id,
          commitment: result.commitment,
          submitted_at: result.ts,
          evidence_count: (args.evidence as string[]).length,
        }, null, 2),
      }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error submitting commitment: ${(err as Error).message}` }],
      isError: true,
    };
  }
}
