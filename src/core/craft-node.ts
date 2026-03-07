/**
 * CraftNode - Epistemic infrastructure for Headless Triad executions
 *
 * Each craft node is a directory under .mentu/craft/ containing:
 * - node.yaml: Identity and relationships
 * - PRD.md: Architect output
 * - INSTRUCTION.md: Auditor output
 * - RESULT.md: Executor output
 */

import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

// Types
export type CraftTier = 'T1' | 'T2' | 'T3' | 'T4';
export type CraftStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface CraftNodeRelationships {
  commitment?: string;
  evidence?: string[];
  parent_intent?: string;
  audit?: string;
  linked_nodes?: string[];
}

export interface CraftNodeProvenance {
  architect?: string;
  auditor?: string;
  executor?: string;
}

export interface CraftNodeMetadata {
  id: string;
  name: string;
  version: string;
  created: string;
  updated: string;
  tier: CraftTier;
  status: CraftStatus;
  relationships: CraftNodeRelationships;
  provenance: CraftNodeProvenance;
  artifacts: {
    prd?: string;
    instruction?: string;
    result?: string;
  };
}

// Constants
const CRAFT_DIR = '.mentu/craft';
const NODE_YAML = 'node.yaml';

/**
 * Get the craft directory path
 */
export function getCraftDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, CRAFT_DIR);
}

/**
 * Get a specific node directory path
 */
export function getNodeDir(workspaceRoot: string, nodeId: string): string {
  return path.join(getCraftDir(workspaceRoot), nodeId.toLowerCase());
}

/**
 * Initialize a new craft node
 */
export async function initCraftNode(
  workspaceRoot: string,
  name: string,
  tier: CraftTier = 'T2',
  actor?: string
): Promise<{ nodeDir: string; metadata: CraftNodeMetadata }> {
  const nodeId = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const nodeDir = getNodeDir(workspaceRoot, nodeId);
  const craftDir = getCraftDir(workspaceRoot);

  // Ensure craft directory exists
  if (!fs.existsSync(craftDir)) {
    fs.mkdirSync(craftDir, { recursive: true });
  }

  // Check if node already exists
  if (fs.existsSync(nodeDir)) {
    throw new Error(`Craft node already exists: ${nodeId}`);
  }

  // Create node directory
  fs.mkdirSync(nodeDir, { recursive: true });

  // Create metadata
  const now = new Date().toISOString();
  const metadata: CraftNodeMetadata = {
    id: nodeId,
    name: name,
    version: '1.0',
    created: now,
    updated: now,
    tier: tier,
    status: 'pending',
    relationships: {
      evidence: [],
      linked_nodes: [],
    },
    provenance: {
      executor: actor,
    },
    artifacts: {},
  };

  // Write node.yaml
  const yamlPath = path.join(nodeDir, NODE_YAML);
  fs.writeFileSync(yamlPath, YAML.stringify(metadata), 'utf8');

  return { nodeDir, metadata };
}

/**
 * Read craft node metadata
 */
export function readCraftNode(nodeDir: string): CraftNodeMetadata | null {
  const yamlPath = path.join(nodeDir, NODE_YAML);

  if (!fs.existsSync(yamlPath)) {
    return null;
  }

  const content = fs.readFileSync(yamlPath, 'utf8');
  return YAML.parse(content) as CraftNodeMetadata;
}

/**
 * Update craft node metadata
 */
export function updateCraftNode(
  nodeDir: string,
  updates: Partial<CraftNodeMetadata>
): CraftNodeMetadata {
  const current = readCraftNode(nodeDir);
  if (!current) {
    throw new Error(`Node not found: ${nodeDir}`);
  }

  const updated: CraftNodeMetadata = {
    ...current,
    ...updates,
    updated: new Date().toISOString(),
    relationships: {
      ...current.relationships,
      ...updates.relationships,
    },
    provenance: {
      ...current.provenance,
      ...updates.provenance,
    },
    artifacts: {
      ...current.artifacts,
      ...updates.artifacts,
    },
  };

  const yamlPath = path.join(nodeDir, NODE_YAML);
  fs.writeFileSync(yamlPath, YAML.stringify(updated), 'utf8');

  return updated;
}

/**
 * Link a craft node to a commitment or another node
 */
export function linkCraftNode(
  nodeDir: string,
  targetId: string,
  linkType: 'commitment' | 'evidence' | 'node' = 'commitment'
): CraftNodeMetadata {
  const current = readCraftNode(nodeDir);
  if (!current) {
    throw new Error(`Node not found: ${nodeDir}`);
  }

  const relationships = { ...current.relationships };

  switch (linkType) {
    case 'commitment':
      relationships.commitment = targetId;
      break;
    case 'evidence':
      relationships.evidence = [...(relationships.evidence || []), targetId];
      break;
    case 'node':
      relationships.linked_nodes = [...(relationships.linked_nodes || []), targetId];
      break;
  }

  return updateCraftNode(nodeDir, { relationships });
}

/**
 * List all craft nodes
 */
export function listCraftNodes(
  workspaceRoot: string,
  filter?: { status?: CraftStatus; tier?: CraftTier }
): CraftNodeMetadata[] {
  const craftDir = getCraftDir(workspaceRoot);

  if (!fs.existsSync(craftDir)) {
    return [];
  }

  const entries = fs.readdirSync(craftDir, { withFileTypes: true });
  const nodes: CraftNodeMetadata[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const nodeDir = path.join(craftDir, entry.name);
      const metadata = readCraftNode(nodeDir);

      if (metadata) {
        // Apply filters
        if (filter?.status && metadata.status !== filter.status) continue;
        if (filter?.tier && metadata.tier !== filter.tier) continue;

        nodes.push(metadata);
      }
    }
  }

  return nodes.sort((a, b) => b.updated.localeCompare(a.updated));
}

/**
 * Get node status summary
 */
export function getNodeStatus(nodeDir: string): {
  metadata: CraftNodeMetadata | null;
  artifacts: {
    prd: boolean;
    instruction: boolean;
    result: boolean;
  };
  complete: boolean;
} {
  const metadata = readCraftNode(nodeDir);

  const artifacts = {
    prd: fs.existsSync(path.join(nodeDir, 'PRD.md')),
    instruction: fs.existsSync(path.join(nodeDir, 'INSTRUCTION.md')),
    result: fs.existsSync(path.join(nodeDir, 'RESULT.md')),
  };

  const complete = artifacts.prd && artifacts.instruction && artifacts.result;

  return { metadata, artifacts, complete };
}
