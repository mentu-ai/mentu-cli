// Document Registry for Mentu v1.0
// Tracks craft documents (PRD, HANDOFF, PROMPT, RESULT) in Supabase
//
// Supports two modes:
// 1. Autonomous mode: Uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + MENTU_WORKSPACE_ID
// 2. Interactive mode: Uses CloudClient with user authentication
//
// Environment variables for autonomous operation:
//   SUPABASE_URL - Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY - Service role key (bypasses RLS)
//   MENTU_WORKSPACE_ID - UUID of the workspace

import { readFile, writeFile } from 'fs/promises';
import matter from 'gray-matter';
import path from 'path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { CloudClient } from '../cloud/client.js';
import { loadSyncState } from './sync-state.js';
import { findWorkspace } from './config.js';

// Types
export type DocType = 'intent' | 'audit' | 'prd' | 'handoff' | 'prompt' | 'result';

export interface Document {
  id: string;
  workspace_id: string;
  doc_id: string;
  doc_type: DocType;
  parent_id: string | null;
  commitment_id: string | null;
  source_memory_id: string | null;
  file_path: string;
  tier: string | null;
  status: 'draft' | 'registered' | 'superseded';
  created_at: string;
  updated_at: string;
}

export interface RegisterOptions {
  path: string;
  parentDocUuid?: string;
  commitmentId?: string;
  workspaceId?: string; // Optional override for autonomous mode
}

/**
 * Check if running in autonomous mode (environment variables set)
 */
function isAutonomousMode(): boolean {
  return !!(
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.MENTU_WORKSPACE_ID
  );
}

/**
 * Extract doc_type from filename
 */
function extractDocType(filename: string): DocType {
  const typeMap: Record<string, DocType> = {
    'INTENT': 'intent',
    'AUDIT': 'audit',
    'PRD': 'prd',
    'HANDOFF': 'handoff',
    'PROMPT': 'prompt',
    'RESULT': 'result',
  };

  for (const [prefix, docType] of Object.entries(typeMap)) {
    if (filename.startsWith(prefix + '-')) {
      return docType;
    }
  }

  throw new Error(`Unknown document type: ${filename}. Expected prefix: INTENT-, AUDIT-, PRD-, HANDOFF-, PROMPT-, or RESULT-`);
}

/**
 * Get workspace ID - supports both autonomous and interactive modes
 */
async function getWorkspaceId(override?: string): Promise<string> {
  // 1. Explicit override
  if (override) {
    return override;
  }

  // 2. Environment variable for autonomous mode
  if (process.env.MENTU_WORKSPACE_ID) {
    return process.env.MENTU_WORKSPACE_ID;
  }

  // 3. Fall back to sync state for interactive mode
  try {
    const workspacePath = findWorkspace(process.cwd());
    const syncState = loadSyncState(workspacePath);

    if (syncState.workspaceId) {
      return syncState.workspaceId;
    }
  } catch {
    // No workspace found
  }

  throw new Error(
    'Workspace ID not found. Either:\n' +
    '  - Set MENTU_WORKSPACE_ID environment variable, or\n' +
    '  - Run: mentu workspace connect'
  );
}

/**
 * Get Supabase client - supports both autonomous and interactive modes
 */
async function getSupabaseClient(workspaceId?: string): Promise<{ client: SupabaseClient; workspaceId: string }> {
  const wsId = await getWorkspaceId(workspaceId);

  // Autonomous mode: use service role key
  if (isAutonomousMode()) {
    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
    return { client, workspaceId: wsId };
  }

  // Interactive mode: use CloudClient
  const cloudClient = await CloudClient.create(wsId);
  return { client: cloudClient.getSupabaseClient(), workspaceId: wsId };
}

/**
 * Register a document in Supabase and update YAML frontmatter
 */
export async function registerDocument(options: RegisterOptions): Promise<Document> {
  const { path: filePath, parentDocUuid, commitmentId, workspaceId: overrideWsId } = options;

  // Read file and parse frontmatter
  const content = await readFile(filePath, 'utf-8');
  const { data: frontmatter, content: body } = matter(content);

  // Extract document info
  const filename = path.basename(filePath).replace('.md', '');
  const docId = frontmatter.id || filename;
  const docType = extractDocType(filename);
  const tier = frontmatter.tier || null;

  // Get Supabase client
  const { client: supabase, workspaceId } = await getSupabaseClient(overrideWsId);

  const { data, error } = await supabase
    .from('documents')
    .insert({
      workspace_id: workspaceId,
      doc_id: docId,
      doc_type: docType,
      parent_id: parentDocUuid || null,
      commitment_id: commitmentId || frontmatter.mentu?.commitment || null,
      file_path: filePath,
      tier,
      status: 'registered',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to register document: ${error.message}`);
  }

  const document = data as Document;

  // Update YAML frontmatter
  const updatedFrontmatter: Record<string, unknown> = {
    ...frontmatter,
    doc_uuid: document.id,
    mentu: {
      ...(frontmatter.mentu as Record<string, unknown> || {}),
      document_id: document.id,
    },
  };

  // If parent provided, update parent field
  if (parentDocUuid) {
    const parentDoc = await findDocument({ uuid: parentDocUuid, workspaceId });
    if (parentDoc) {
      updatedFrontmatter.parent = {
        doc_id: parentDoc.doc_id,
        doc_uuid: parentDoc.id,
      };
    }
  }

  // Write updated file
  const updatedContent = matter.stringify(body, updatedFrontmatter);
  await writeFile(filePath, updatedContent);

  return document;
}

/**
 * Find document by doc_id or UUID
 */
export async function findDocument(
  query: { docId?: string; uuid?: string; workspaceId?: string }
): Promise<Document | null> {
  const { client: supabase, workspaceId } = await getSupabaseClient(query.workspaceId);

  let queryBuilder = supabase
    .from('documents')
    .select('*')
    .eq('workspace_id', workspaceId);

  if (query.docId) {
    queryBuilder = queryBuilder.eq('doc_id', query.docId);
  } else if (query.uuid) {
    queryBuilder = queryBuilder.eq('id', query.uuid);
  } else {
    throw new Error('Must provide docId or uuid');
  }

  const { data, error } = await queryBuilder.single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to find document: ${error.message}`);
  }

  return data as Document;
}

/**
 * Get document chain (ancestry from this document to root)
 */
export async function getDocumentChain(docId: string, workspaceId?: string): Promise<Document[]> {
  // Build chain iteratively
  const chain: Document[] = [];
  let currentDoc = await findDocument({ docId, workspaceId });

  while (currentDoc) {
    chain.push(currentDoc);
    if (!currentDoc.parent_id) break;
    currentDoc = await findDocument({ uuid: currentDoc.parent_id, workspaceId });
  }

  return chain.reverse(); // Root first
}

/**
 * List documents with optional filters
 */
export async function listDocuments(filters?: {
  type?: DocType;
  orphaned?: boolean;
  unregistered?: boolean;
  workspaceId?: string;
}): Promise<Document[]> {
  const { client: supabase, workspaceId } = await getSupabaseClient(filters?.workspaceId);

  let query = supabase
    .from('documents')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (filters?.type) {
    query = query.eq('doc_type', filters.type);
  }

  if (filters?.orphaned) {
    query = query.is('parent_id', null).neq('doc_type', 'intent');
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list documents: ${error.message}`);
  }

  return data as Document[];
}

/**
 * Update document source_memory_id after capture
 */
export async function updateDocumentMemory(
  docUuid: string,
  sourceMemoryId: string,
  workspaceId?: string
): Promise<void> {
  const { client: supabase } = await getSupabaseClient(workspaceId);

  const { error } = await supabase
    .from('documents')
    .update({ source_memory_id: sourceMemoryId })
    .eq('id', docUuid);

  if (error) {
    throw new Error(`Failed to update document memory: ${error.message}`);
  }
}

/**
 * Check mode and return status for CLI output
 */
export function getDocumentMode(): { mode: 'autonomous' | 'interactive'; details: string } {
  if (isAutonomousMode()) {
    return {
      mode: 'autonomous',
      details: `Using SUPABASE_SERVICE_ROLE_KEY with workspace ${process.env.MENTU_WORKSPACE_ID?.slice(0, 8)}...`,
    };
  }
  return {
    mode: 'interactive',
    details: 'Using CloudClient with user authentication',
  };
}
