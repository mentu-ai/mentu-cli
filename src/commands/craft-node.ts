/**
 * craft-node command - Manage Craft Nodes for Headless Triad
 *
 * Usage:
 *   mentu craft-node init <name> [--tier T2]
 *   mentu craft-node status <path>
 *   mentu craft-node link <path> <target> [--type commitment|evidence|node]
 *   mentu craft-node list [--status pending|completed] [--tier T2]
 */

import type { Command } from 'commander';
import path from 'path';
import {
  initCraftNode,
  linkCraftNode,
  listCraftNodes,
  getNodeStatus,
  type CraftTier,
  type CraftStatus,
} from '../core/craft-node.js';

export function registerCraftNodeCommand(program: Command): void {
  const craftNode = program
    .command('craft-node')
    .description('Manage Craft Nodes for Headless Triad executions');

  // craft-node init
  craftNode
    .command('init <name>')
    .description('Initialize a new craft node')
    .option('--tier <tier>', 'Task tier (T1|T2|T3|T4)', 'T2')
    .option('--actor <actor>', 'Actor identity')
    .option('--json', 'Output as JSON')
    .action(async (name: string, options: { tier: string; actor?: string; json?: boolean }) => {
      try {
        const workspaceRoot = process.cwd();
        const tier = options.tier as CraftTier;

        const { nodeDir, metadata } = await initCraftNode(
          workspaceRoot,
          name,
          tier,
          options.actor
        );

        if (options.json) {
          console.log(JSON.stringify({ nodeDir, metadata }, null, 2));
        } else {
          console.log(`Created craft node: ${metadata.id}`);
          console.log(`  Path: ${nodeDir}`);
          console.log(`  Tier: ${metadata.tier}`);
          console.log(`  Status: ${metadata.status}`);
          console.log('');
          console.log('Next steps:');
          console.log('  1. Create PRD.md in the node directory');
          console.log('  2. Run auditor to create INSTRUCTION.md');
          console.log('  3. Run executor to create RESULT.md');
          console.log('  4. Link to commitment: mentu craft-node link <path> <cmt_id>');
        }
      } catch (error) {
        console.error(`Error: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  // craft-node status
  craftNode
    .command('status <path>')
    .description('Show craft node status')
    .option('--json', 'Output as JSON')
    .action((nodePath: string, options: { json?: boolean }) => {
      try {
        const absolutePath = path.resolve(process.cwd(), nodePath);
        const status = getNodeStatus(absolutePath);

        if (!status.metadata) {
          console.error(`Node not found: ${nodePath}`);
          process.exit(1);
        }

        if (options.json) {
          console.log(JSON.stringify(status, null, 2));
        } else {
          const m = status.metadata;
          console.log(`Craft Node: ${m.name} (${m.id})`);
          console.log('');
          console.log('Identity:');
          console.log(`  Version: ${m.version}`);
          console.log(`  Tier: ${m.tier}`);
          console.log(`  Status: ${m.status}`);
          console.log(`  Created: ${m.created}`);
          console.log(`  Updated: ${m.updated}`);
          console.log('');
          console.log('Artifacts:');
          console.log(`  PRD.md: ${status.artifacts.prd ? 'exists' : 'missing'}`);
          console.log(`  INSTRUCTION.md: ${status.artifacts.instruction ? 'exists' : 'missing'}`);
          console.log(`  RESULT.md: ${status.artifacts.result ? 'exists' : 'missing'}`);
          console.log('');
          console.log('Relationships:');
          console.log(`  Commitment: ${m.relationships.commitment || 'not linked'}`);
          console.log(`  Evidence: ${(m.relationships.evidence || []).join(', ') || 'none'}`);
          console.log(`  Linked Nodes: ${(m.relationships.linked_nodes || []).join(', ') || 'none'}`);
          console.log('');
          console.log('Provenance:');
          console.log(`  Architect: ${m.provenance.architect || 'unknown'}`);
          console.log(`  Auditor: ${m.provenance.auditor || 'unknown'}`);
          console.log(`  Executor: ${m.provenance.executor || 'unknown'}`);
          console.log('');
          console.log(`Complete: ${status.complete ? 'yes' : 'no'}`);
        }
      } catch (error) {
        console.error(`Error: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  // craft-node link
  craftNode
    .command('link <path> <target>')
    .description('Link craft node to a commitment or another node')
    .option('--type <type>', 'Link type (commitment|evidence|node)', 'commitment')
    .option('--json', 'Output as JSON')
    .action(
      (
        nodePath: string,
        target: string,
        options: { type: string; json?: boolean }
      ) => {
        try {
          const absolutePath = path.resolve(process.cwd(), nodePath);
          const linkType = options.type as 'commitment' | 'evidence' | 'node';

          const updated = linkCraftNode(absolutePath, target, linkType);

          if (options.json) {
            console.log(JSON.stringify(updated, null, 2));
          } else {
            console.log(`Linked ${linkType}: ${target}`);
            console.log(`  Node: ${updated.id}`);
            console.log(`  Updated: ${updated.updated}`);
          }
        } catch (error) {
          console.error(`Error: ${(error as Error).message}`);
          process.exit(1);
        }
      }
    );

  // craft-node list
  craftNode
    .command('list')
    .description('List all craft nodes')
    .option('--status <status>', 'Filter by status')
    .option('--tier <tier>', 'Filter by tier')
    .option('--json', 'Output as JSON')
    .action((options: { status?: string; tier?: string; json?: boolean }) => {
      try {
        const workspaceRoot = process.cwd();
        const filter: { status?: CraftStatus; tier?: CraftTier } = {};

        if (options.status) filter.status = options.status as CraftStatus;
        if (options.tier) filter.tier = options.tier as CraftTier;

        const nodes = listCraftNodes(workspaceRoot, filter);

        if (options.json) {
          console.log(JSON.stringify(nodes, null, 2));
        } else if (nodes.length === 0) {
          console.log('No craft nodes found.');
        } else {
          console.log('Craft Nodes:');
          console.log('');
          for (const node of nodes) {
            const commitment = node.relationships.commitment || 'unlinked';
            console.log(`  ${node.id} (${node.tier})`);
            console.log(`    Status: ${node.status}`);
            console.log(`    Commitment: ${commitment}`);
            console.log(`    Updated: ${node.updated}`);
            console.log('');
          }
          console.log(`Total: ${nodes.length} node(s)`);
        }
      } catch (error) {
        console.error(`Error: ${(error as Error).message}`);
        process.exit(1);
      }
    });
}
