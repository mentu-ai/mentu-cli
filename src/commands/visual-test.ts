/**
 * Visual Test Command
 *
 * Execute visual tests for a commitment by reading the visual test spec
 * and running Puppeteer tests via VPS MCP to capture screenshot evidence.
 */

import type { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { MentuError } from '../types.js';
import { findWorkspace, readConfig } from '../core/config.js';
import { readLedger } from '../core/ledger.js';
import { getCommitment, computeCommitmentState } from '../core/state.js';

interface VisualTestOptions {
  dryRun?: boolean;         // Preview without executing
  workspaceId?: string;     // Override workspace ID
  baseUrl?: string;         // Override base URL (default from spec or localhost:3000)
  verbose?: boolean;        // Show detailed output
  async?: boolean;          // Spawn to mentu-bridge for async execution
}

interface VisualTestResult {
  commitment_id: string;
  feature: string;
  checkpoints_total: number;
  checkpoints_passed: number;
  checkpoints_failed: number;
  evidence_memories: string[];
  screenshots: Array<{
    checkpoint: string;
    url: string;
    status: 'success' | 'failed';
    error?: string;
  }>;
  summary: string;
}

export function registerVisualTestCommand(program: Command) {
  program
    .command('visual-test <commitment>')
    .description('Execute visual tests for a commitment')
    .option('--dry-run', 'Preview test plan without executing')
    .option('--workspace-id <id>', 'Override workspace ID from spec')
    .option('--base-url <url>', 'Override base URL for tests')
    .option('--verbose', 'Show detailed execution output')
    .option('--async', 'Spawn to mentu-bridge for async execution (fire-and-forget)')
    .action(async (commitmentId: string, options: VisualTestOptions) => {
      try {
        const workspace = findWorkspace(process.cwd());
        const config = readConfig(workspace);

        // Validate commitment exists
        const ops = readLedger(workspace);
        const commitment = getCommitment(ops, commitmentId);
        if (!commitment) {
          throw new MentuError('E_REF_NOT_FOUND', `Commitment ${commitmentId} not found`);
        }

        const state = computeCommitmentState(ops, commitmentId);

        // Find visual test spec
        const specPath = path.join(workspace, 'docs', 'visual-tests', `${commitmentId}-spec.yaml`);

        if (!fs.existsSync(specPath)) {
          throw new MentuError(
            'E_VISUAL_TEST_SPEC_NOT_FOUND',
            `Visual test spec not found at: ${specPath}\n\n` +
            `Create a spec first using: /visual-test-spec "Feature description"`
          );
        }

        // Read spec
        const specContent = fs.readFileSync(specPath, 'utf-8');

        if (options.dryRun) {
          // Dry run: show what would be executed
          console.log('Visual Test Plan:');
          console.log(`  Commitment: ${commitmentId}`);
          console.log(`  Feature: ${commitment.body}`);
          console.log(`  Spec: ${specPath}`);
          console.log(`  State: ${state.state}`);
          console.log(`  Mode: ${options.async ? 'async (bridge)' : 'sync (subagent)'}`);
          console.log('');
          console.log('Spec content:');
          console.log(specContent);
          console.log('');
          if (options.async) {
            console.log('Would spawn to mentu-bridge for async execution');
          } else {
            console.log('Would execute visual-test-executor SubAgent');
          }
          console.log('Run without --dry-run to execute');
          process.exit(0);
        }

        // Async mode: spawn to mentu-bridge
        if (options.async) {
          const proxyUrl = process.env.MENTU_API_URL || process.env.MENTU_PROXY_URL;
          const proxyToken = process.env.MENTU_PROXY_TOKEN;

          if (!proxyUrl || !proxyToken) {
            throw new MentuError(
              'E_UNAUTHORIZED',
              'MENTU_API_URL and MENTU_PROXY_TOKEN required for async spawn'
            );
          }

          const asyncPrompt = `Execute visual evidence capture for commitment ${commitmentId}.

Read the visual test spec at: ${specPath}

${options.workspaceId ? `Override workspace ID: ${options.workspaceId}` : ''}
${options.baseUrl ? `Override base URL: ${options.baseUrl}` : ''}

For each checkpoint in the spec:
1. Generate Puppeteer script with viewport, selectors, and actions
2. Copy script to VPS Docker container
3. Execute via: docker exec puppeteer-mcp node /project/script.js
4. Upload screenshot to visual-evidence bucket
5. Create evidence memory: mentu capture "Visual checkpoint..." --kind visual-evidence

After all checkpoints:
1. Annotate commitment with results
2. Return summary JSON

Evidence will be captured to the ledger asynchronously.`;

          const response = await fetch(`${proxyUrl}/bridge/spawn`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Proxy-Token': proxyToken,
            },
            body: JSON.stringify({
              commitment_id: commitmentId,
              prompt: asyncPrompt,
              working_directory: workspace,
              timeout_seconds: 600,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json() as { error: string };
            throw new MentuError('E_INVALID_OP', errorData.error || 'Async spawn failed');
          }

          const result = await response.json() as { command_id: string; status: string };
          console.log('Visual test spawned to mentu-bridge (async)');
          console.log(`  Command ID: ${result.command_id}`);
          console.log(`  Status: ${result.status}`);
          console.log(`  Commitment: ${commitmentId}`);
          console.log('');
          console.log('Evidence will be captured asynchronously.');
          console.log(`Check status: mentu spawn --status ${result.command_id}`);
          console.log(`Check evidence: grep "visual-evidence" .mentu/ledger.jsonl`);
          process.exit(0);
        }

        // Execute via Task tool (SubAgent)
        console.log(`Executing visual tests for commitment ${commitmentId}...`);
        console.log(`Spec: ${specPath}`);
        console.log('');

        // Build prompt for visual-test-executor SubAgent
        const prompt = `Execute visual tests for commitment ${commitmentId}.

Read the spec at: ${specPath}

${options.workspaceId ? `Override workspace ID: ${options.workspaceId}` : ''}
${options.baseUrl ? `Override base URL: ${options.baseUrl}` : ''}

Follow the Visual Test Executor workflow:
1. Read the visual test spec
2. Check if dev server is running
3. Execute each checkpoint via Puppeteer MCP on VPS
4. Upload screenshots to visual-evidence bucket
5. Capture Mentu evidence memories for each screenshot
6. Annotate the commitment with results
7. Return summary JSON

Be thorough and capture evidence for all checkpoints.`;

        console.log('Note: This will spawn a SubAgent to execute tests.');
        console.log('The SubAgent will:');
        console.log('  1. Read visual test spec');
        console.log('  2. Execute Puppeteer tests on VPS');
        console.log('  3. Capture screenshot evidence');
        console.log('  4. Create Mentu evidence memories');
        console.log('');
        console.log('To execute, use the Task tool with:');
        console.log(`  subagent_type: "visual-test-executor"`);
        console.log(`  prompt: "${prompt.substring(0, 100)}..."`);
        console.log('');
        console.log('Or spawn to bridge for persistent execution:');
        console.log(`  mentu spawn ${commitmentId} --directory ${workspace}`);
        console.log('');
        console.log('Implementation note:');
        console.log('This command provides the prompt - actual execution happens via SubAgent or bridge.');

      } catch (error: any) {
        if (error instanceof MentuError) {
          console.error(`Error: ${error.message}`);
          if (error.code === 'E_VISUAL_TEST_SPEC_NOT_FOUND') {
            console.error('');
            console.error('Visual Test Workflow:');
            console.error('  1. Create spec: /visual-test-spec "Feature description"');
            console.error('  2. Implement feature');
            console.error('  3. Run tests: mentu visual-test <commitment>');
            console.error('  4. Technical validator checks for visual evidence');
          }
          process.exit(1);
        }
        throw error;
      }
    });
}
