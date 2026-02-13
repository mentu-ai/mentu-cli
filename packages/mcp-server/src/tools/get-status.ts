import { getStatus } from '../lib/client.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export const getStatusTool = {
  name: 'mentu_get_status',
  description: 'Get the current pipeline health summary for the Mentu workspace. Shows commitment counts by state, memory totals, and ledger info.',
  inputSchema: {
    type: 'object' as const,
    properties: {},
  },
};

export async function handleGetStatus(): Promise<CallToolResult> {
  try {
    const status = await getStatus();
    const c = status.commitments;

    const report = [
      `Workspace: ${status.workspace}`,
      ``,
      `Commitments: ${c.total} total`,
      `  Open:      ${c.open}`,
      `  Claimed:   ${c.claimed}`,
      `  In Review: ${c.in_review}`,
      `  Reopened:  ${c.reopened}`,
      `  Closed:    ${c.closed}`,
      ``,
      `Memories: ${status.memories.total}`,
      `Ledger:   ${status.ledger.operations} ops`,
      `Last op:  ${status.ledger.last_operation ?? 'none'}`,
    ];

    const throughput = c.total > 0
      ? Math.round((c.closed / c.total) * 100)
      : 0;
    report.push(``, `Throughput: ${throughput}% closed`);

    return {
      content: [{
        type: 'text',
        text: report.join('\n'),
      }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error getting status: ${(err as Error).message}` }],
      isError: true,
    };
  }
}
