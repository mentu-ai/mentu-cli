import { getStatus } from '../lib/client.js';
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';

export const statusResource = {
  uri: 'mentu://status',
  name: 'Mentu Pipeline Status',
  description: 'Current pipeline health: commitment counts by state, memory totals, ledger stats',
  mimeType: 'application/json',
};

export async function readStatusResource(): Promise<ReadResourceResult> {
  const status = await getStatus();

  return {
    contents: [{
      uri: 'mentu://status',
      mimeType: 'application/json',
      text: JSON.stringify(status, null, 2),
    }],
  };
}
