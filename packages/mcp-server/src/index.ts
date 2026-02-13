#!/usr/bin/env node

/**
 * @mentu/mcp — Mentu MCP Server
 *
 * Model Context Protocol server for the Mentu commitment ledger.
 * Provides tools, resources, and prompts for AI-native IDEs.
 *
 * Usage:
 *   npx @mentu/mcp                          # stdio transport
 *   claude mcp add mentu -- npx @mentu/mcp  # register with Claude Code
 *
 * Configuration (env vars or .mentu.json):
 *   MENTU_API_URL       — Mentu proxy API URL
 *   MENTU_API_TOKEN     — Authentication token
 *   MENTU_WORKSPACE_ID  — Workspace ID
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// Tool handlers
import { handleCommit } from './tools/commit.js';
import { handleClaim } from './tools/claim.js';
import { handleSubmit } from './tools/submit.js';
import { handleClose } from './tools/close.js';
import { handleCapture } from './tools/capture.js';
import { handleTriage } from './tools/triage.js';
import { handleDismiss } from './tools/dismiss.js';
import { handleApprove } from './tools/approve.js';
import { handleAnnotate } from './tools/annotate.js';
import { handleListMemories } from './tools/list-memories.js';
import { handleListCommitments } from './tools/list-commitments.js';
import { handleGetStatus } from './tools/get-status.js';

// Resources
import { readCommitmentsResource, readCommitmentResource } from './resources/commitments.js';
import { readMemoriesResource, readMemoryResource } from './resources/memories.js';
import { readStatusResource } from './resources/status.js';

// Prompts
import { getTriagePrompt } from './prompts/triage.js';
import { getFixPrompt } from './prompts/fix.js';
import { getBatchPrompt } from './prompts/batch.js';

const server = new McpServer({
  name: 'mentu',
  version: '0.1.0',
});

// ── Register Tools ──

server.tool(
  'mentu_commit',
  'Create a new commitment in the Mentu ledger. A commitment is a promise to do work, typically linked to a memory (bug report) via the source field.',
  {
    body: z.string().describe('Description of the commitment'),
    source: z.string().describe('Source memory ID (mem_xxx) that this commitment addresses'),
    tags: z.array(z.string()).optional().describe('Optional tags for categorization'),
    meta: z.record(z.string(), z.unknown()).optional().describe('Optional metadata'),
  },
  async (args) => handleCommit(args),
);

server.tool(
  'mentu_claim',
  'Claim a commitment for execution. Only open or reopened commitments can be claimed.',
  {
    commitment: z.string().describe('The commitment ID to claim (cmt_xxx)'),
  },
  async (args) => handleClaim(args),
);

server.tool(
  'mentu_submit',
  'Submit a claimed commitment for review with evidence. Moves to "in_review" state.',
  {
    commitment: z.string().describe('The commitment ID to submit (cmt_xxx)'),
    evidence: z.array(z.string()).describe('Evidence memory IDs (mem_xxx) documenting work done'),
    summary: z.string().optional().describe('Summary of what was done'),
    tier: z.string().optional().describe('Complexity tier: T1, T2, or T3'),
    validation: z.record(z.string(), z.object({ passed: z.boolean(), details: z.string().optional() })).optional().describe('Validation results'),
  },
  async (args) => handleSubmit(args),
);

server.tool(
  'mentu_close',
  'Close a commitment directly. For standard workflow, prefer mentu_submit + mentu_approve.',
  {
    commitment: z.string().describe('The commitment ID to close (cmt_xxx)'),
    evidence: z.string().optional().describe('Evidence memory ID for normal close'),
    duplicate_of: z.string().optional().describe('Commitment ID if closing as duplicate'),
  },
  async (args) => handleClose(args),
);

server.tool(
  'mentu_capture',
  'Capture a memory (evidence) in the ledger. Bug reports, progress notes, validation results, documents.',
  {
    body: z.string().describe('Content of the memory'),
    kind: z.string().optional().describe('Type: "bug-report", "execution-progress", "validation", "document"'),
    refs: z.array(z.string()).optional().describe('Related IDs (cmt_xxx, mem_xxx)'),
    meta: z.record(z.string(), z.unknown()).optional().describe('Optional metadata'),
    source_key: z.string().optional().describe('Unique deduplication key'),
  },
  async (args) => handleCapture(args),
);

server.tool(
  'mentu_triage',
  'Record a triage session. After reviewing memories, record decisions: create, link, dismiss, or defer.',
  {
    reviewed: z.array(z.string()).describe('Memory IDs reviewed in this session'),
    summary: z.string().describe('Summary of the triage session'),
    decisions: z.array(z.object({
      memory: z.string().describe('Memory ID'),
      action: z.enum(['create', 'link', 'dismiss', 'defer']).describe('Decision'),
      target: z.string().optional().describe('Commitment ID if linked/created'),
      reason: z.string().optional().describe('Explanation'),
    })).describe('Decisions for each reviewed memory'),
  },
  async (args) => handleTriage(args),
);

server.tool(
  'mentu_dismiss',
  'Dismiss a memory (junk, test, duplicate). Requires a reason.',
  {
    memory: z.string().describe('Memory ID to dismiss (mem_xxx)'),
    reason: z.string().describe('Reason for dismissal'),
    tags: z.array(z.string()).optional().describe('Categorization tags'),
  },
  async (args) => handleDismiss(args),
);

server.tool(
  'mentu_approve',
  'Approve a submitted commitment, closing it as passed.',
  {
    commitment: z.string().describe('The commitment ID to approve (cmt_xxx)'),
    comment: z.string().optional().describe('Optional approval comment'),
    auto: z.boolean().optional().describe('Whether this is an auto-approval'),
  },
  async (args) => handleApprove(args),
);

server.tool(
  'mentu_annotate',
  'Add an annotation (comment/note) to a memory or commitment.',
  {
    target: z.string().describe('ID of memory (mem_xxx) or commitment (cmt_xxx)'),
    body: z.string().describe('The annotation text'),
    kind: z.string().optional().describe('Kind of annotation'),
  },
  async (args) => handleAnnotate(args),
);

server.tool(
  'mentu_list_memories',
  'List memories (bug reports, evidence) from the workspace.',
  {
    limit: z.number().optional().describe('Max memories to return (default: 50)'),
    offset: z.number().optional().describe('Skip N memories for pagination'),
    kind: z.string().optional().describe('Filter by kind'),
    since: z.string().optional().describe('Only after this ISO timestamp'),
  },
  async (args) => handleListMemories(args),
);

server.tool(
  'mentu_list_commitments',
  'List commitments with their lifecycle state.',
  {
    state: z.enum(['open', 'claimed', 'in_review', 'closed', 'reopened']).optional().describe('Filter by state'),
    owner: z.string().optional().describe('Filter by owner'),
    tags: z.string().optional().describe('Filter by tags (comma-separated)'),
    limit: z.number().optional().describe('Max to return (default: 50)'),
    offset: z.number().optional().describe('Skip N for pagination'),
    since: z.string().optional().describe('Only after this ISO timestamp'),
  },
  async (args) => handleListCommitments(args),
);

server.tool(
  'mentu_get_status',
  'Get pipeline health: commitment counts by state, memory totals, ledger stats.',
  {},
  async () => handleGetStatus(),
);

// ── Register Resources ──

server.resource(
  'commitments',
  'mentu://commitments',
  { description: 'All commitments with lifecycle state', mimeType: 'application/json' },
  async () => readCommitmentsResource(),
);

server.resource(
  'memories',
  'mentu://memories',
  { description: 'All memories (bug reports, evidence)', mimeType: 'application/json' },
  async () => readMemoriesResource(),
);

server.resource(
  'status',
  'mentu://status',
  { description: 'Pipeline health summary', mimeType: 'application/json' },
  async () => readStatusResource(),
);

server.resource(
  'commitment-detail',
  'mentu://commitments/{id}',
  { description: 'Single commitment with history and annotations', mimeType: 'application/json' },
  async (uri) => {
    const id = uri.pathname.split('/').pop() || '';
    return readCommitmentResource(id);
  },
);

server.resource(
  'memory-detail',
  'mentu://memories/{id}',
  { description: 'Single memory with annotations', mimeType: 'application/json' },
  async (uri) => {
    const id = uri.pathname.split('/').pop() || '';
    return readMemoryResource(id);
  },
);

// ── Register Prompts ──

server.prompt(
  'mentu_triage',
  'Triage bug memories with 5-gate garbage filter',
  {
    project_name: z.string().optional().describe('Project name for domain matching'),
    batch_size: z.string().optional().describe('Max tickets to show (default: 10)'),
  },
  async (args) => getTriagePrompt(args),
);

server.prompt(
  'mentu_fix',
  'Fix a single bug ticket end-to-end',
  {
    memory_id: z.string().describe('Memory ID (mem_xxx) of the bug to fix'),
  },
  async (args) => getFixPrompt(args),
);

server.prompt(
  'mentu_batch',
  'Batch fix multiple bug tickets in a wave',
  {
    batch_size: z.string().optional().describe('Tickets to fix (default: 3)'),
    dry_run: z.string().optional().describe('If "true", triage only'),
  },
  async (args) => getBatchPrompt(args),
);

// ── Start Server ──

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Mentu MCP server running on stdio');
}

main().catch((err) => {
  console.error('Failed to start Mentu MCP server:', err);
  process.exit(1);
});
