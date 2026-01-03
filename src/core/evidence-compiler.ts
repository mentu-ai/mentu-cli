import type { Memory, CompiledEvidence } from '../types.js';

export type { CompiledEvidence };

export function compileEvidence(memory: Memory): CompiledEvidence {
  const body = memory.body;
  const artifacts: CompiledEvidence['artifacts'] = {};

  // Extract PR number
  const prMatch = body.match(/PR\s*[#:]?\s*(\d+)|#(\d+)/i);
  if (prMatch) artifacts.pr_number = parseInt(prMatch[1] || prMatch[2], 10);

  // Extract PR URL
  const prUrlMatch = body.match(/https:\/\/github\.com\/[^\/]+\/[^\/]+\/pull\/(\d+)/);
  if (prUrlMatch) {
    artifacts.pr_url = prUrlMatch[0];
    artifacts.pr_number = artifacts.pr_number || parseInt(prUrlMatch[1], 10);
  }

  // Extract commit SHA
  const shaMatch = body.match(/\b([a-f0-9]{7,40})\b/i);
  if (shaMatch) artifacts.commit_sha = shaMatch[1];

  // Extract file paths
  const fileMatches = body.match(/[\w\-\/]+\.\w+/g);
  if (fileMatches) artifacts.files = [...new Set(fileMatches)];

  // Extract URLs
  const urlMatches = body.match(/https?:\/\/[^\s]+/g);
  if (urlMatches) artifacts.urls = urlMatches.filter(u => u !== artifacts.pr_url);

  return {
    type: inferType(memory, artifacts),
    artifacts,
    summary: body.split('\n')[0].substring(0, 100),
    compiled_at: new Date().toISOString(),
  };
}

function inferType(memory: Memory, artifacts: CompiledEvidence['artifacts']): CompiledEvidence['type'] {
  if (memory.kind === 'test_result') return 'test_result';
  if (memory.kind === 'deployment') return 'deployment';
  if (memory.kind === 'document') return 'document';
  if (artifacts.pr_number || artifacts.commit_sha) return 'code_change';
  if (memory.body.toLowerCase().includes('test')) return 'test_result';
  if (memory.body.toLowerCase().includes('deploy')) return 'deployment';
  return 'attestation';
}
