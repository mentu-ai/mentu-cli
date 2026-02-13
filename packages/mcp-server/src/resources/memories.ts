import { listMemories, getMemory } from '../lib/client.js';
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';

export const memoriesResource = {
  uri: 'mentu://memories',
  name: 'Mentu Memories',
  description: 'All memories (bug reports, evidence, observations) in the workspace',
  mimeType: 'application/json',
};

export const memoryResourceTemplate = {
  uriTemplate: 'mentu://memories/{id}',
  name: 'Mentu Memory Detail',
  description: 'Detailed view of a single memory including annotations and linked commitments',
  mimeType: 'application/json',
};

export async function readMemoriesResource(): Promise<ReadResourceResult> {
  const result = await listMemories({ limit: 200 });

  const formatted = result.memories.map(m => ({
    id: m.id,
    body: m.body.slice(0, 200) + (m.body.length > 200 ? '...' : ''),
    kind: m.kind,
    ts: m.ts,
    actor: m.actor,
    annotations_count: m.annotations?.length ?? 0,
  }));

  return {
    contents: [{
      uri: 'mentu://memories',
      mimeType: 'application/json',
      text: JSON.stringify({ memories: formatted, total: result.total }, null, 2),
    }],
  };
}

export async function readMemoryResource(id: string): Promise<ReadResourceResult> {
  const memory = await getMemory(id);

  return {
    contents: [{
      uri: `mentu://memories/${id}`,
      mimeType: 'application/json',
      text: JSON.stringify(memory, null, 2),
    }],
  };
}
