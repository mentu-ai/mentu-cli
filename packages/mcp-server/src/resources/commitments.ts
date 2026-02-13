import { listCommitments, getCommitment } from '../lib/client.js';
import { stateLabel } from '../lib/state-machine.js';
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';

export const commitmentsResource = {
  uri: 'mentu://commitments',
  name: 'Mentu Commitments',
  description: 'All commitments in the workspace with their current lifecycle state',
  mimeType: 'application/json',
};

export const commitmentResourceTemplate = {
  uriTemplate: 'mentu://commitments/{id}',
  name: 'Mentu Commitment Detail',
  description: 'Detailed view of a single commitment including history and annotations',
  mimeType: 'application/json',
};

export async function readCommitmentsResource(): Promise<ReadResourceResult> {
  const result = await listCommitments({ limit: 200 });

  const formatted = result.commitments.map(c => ({
    id: c.id,
    body: c.body,
    state: c.state,
    state_label: stateLabel(c.state),
    owner: c.owner,
    source: c.source,
    tags: c.tags,
    created_at: c.created_at,
  }));

  return {
    contents: [{
      uri: 'mentu://commitments',
      mimeType: 'application/json',
      text: JSON.stringify({ commitments: formatted, total: result.total }, null, 2),
    }],
  };
}

export async function readCommitmentResource(id: string): Promise<ReadResourceResult> {
  const commitment = await getCommitment(id);

  return {
    contents: [{
      uri: `mentu://commitments/${id}`,
      mimeType: 'application/json',
      text: JSON.stringify(commitment, null, 2),
    }],
  };
}
