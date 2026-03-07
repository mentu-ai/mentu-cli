import type { Command } from 'commander';
import {
  registerDocument,
  findDocument,
  getDocumentChain,
  listDocuments,
  updateDocumentMemory,
  getDocumentMode,
  type DocType,
} from '../core/documents.js';
import { MentuError } from '../types.js';
import { generateId } from '../utils/id.js';
import { timestamp } from '../utils/time.js';
import { resolveActor } from '../utils/actor.js';
import { findWorkspace, readConfig, getWorkspaceName } from '../core/config.js';
import { appendOperation } from '../core/ledger.js';
import type { CaptureOperation } from '../types.js';

interface RegisterOptions {
  parent?: string;
  commitment?: string;
  workspaceId?: string;
  json?: boolean;
}

interface FindOptions {
  workspaceId?: string;
  json?: boolean;
}

interface ChainOptions {
  workspaceId?: string;
  json?: boolean;
}

interface ListOptions {
  type?: string;
  orphaned?: boolean;
  workspaceId?: string;
  json?: boolean;
}

interface ModeOptions {
  json?: boolean;
}

function outputError(error: Error | MentuError, json: boolean): void {
  if (json) {
    const errorObj = error instanceof MentuError
      ? { ...error.toJSON(), op: 'doc' }
      : { code: 'E_DOC_ERROR', message: error.message, op: 'doc' };
    console.log(JSON.stringify(errorObj));
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
}

export function registerDocCommand(program: Command): void {
  const doc = program
    .command('doc')
    .description('Document registry operations');

  // mentu doc mode - show current mode
  doc
    .command('mode')
    .description('Show current document registry mode (autonomous vs interactive)')
    .action((_options: ModeOptions) => {
      const json = program.opts().json || false;
      const mode = getDocumentMode();

      if (json) {
        console.log(JSON.stringify(mode));
      } else {
        console.log(`Mode: ${mode.mode}`);
        console.log(`  ${mode.details}`);
        if (mode.mode === 'interactive') {
          console.log('\nFor autonomous operation, set:');
          console.log('  SUPABASE_URL=<url>');
          console.log('  SUPABASE_SERVICE_ROLE_KEY=<key>');
          console.log('  MENTU_WORKSPACE_ID=<uuid>');
        }
      }
    });

  // mentu doc register <path>
  doc
    .command('register <path>')
    .description('Register a document and update YAML frontmatter')
    .option('-p, --parent <uuid>', 'Parent document UUID')
    .option('-c, --commitment <id>', 'Linked commitment ID')
    .option('-w, --workspace-id <uuid>', 'Override workspace ID')
    .action(async (filePath: string, options: RegisterOptions) => {
      const json = program.opts().json || false;

      try {
        const document = await registerDocument({
          path: filePath,
          parentDocUuid: options.parent,
          commitmentId: options.commitment,
          workspaceId: options.workspaceId,
        });

        // Capture registration evidence (only if we have a local workspace)
        let memId: string | null = null;
        try {
          const workspacePath = findWorkspace(process.cwd());
          const config = readConfig(workspacePath);
          const actor = resolveActor(undefined, config ?? undefined);
          const workspace = getWorkspaceName(workspacePath);

          memId = generateId('mem');
          const ts = timestamp();

          const captureOp: CaptureOperation = {
            id: memId,
            op: 'capture',
            ts,
            actor,
            workspace,
            payload: {
              body: `Registered document: ${document.doc_id}`,
              kind: 'doc-register',
              refs: [document.id],
            },
          };

          appendOperation(workspacePath, captureOp);

          // Update document with source memory
          await updateDocumentMemory(document.id, memId, options.workspaceId);
        } catch {
          // No local workspace - skip local capture
        }

        if (json) {
          console.log(JSON.stringify({ document, memory: memId ? { id: memId } : null }, null, 2));
        } else {
          console.log('\u2713 Registered:', document.doc_id);
          console.log('  doc_uuid:', document.id);
          if (memId) {
            console.log('  memory:', memId);
          }
          console.log('  YAML frontmatter updated');
        }
      } catch (error) {
        outputError(error as Error, json);
      }
    });

  // mentu doc find <doc_id>
  doc
    .command('find <doc_id>')
    .description('Find document by human-readable ID')
    .option('-w, --workspace-id <uuid>', 'Override workspace ID')
    .action(async (docId: string, options: FindOptions) => {
      const json = program.opts().json || false;

      try {
        const document = await findDocument({
          docId,
          workspaceId: options.workspaceId,
        });

        if (!document) {
          console.error('Not found:', docId);
          process.exit(1);
        }

        if (json) {
          console.log(JSON.stringify(document, null, 2));
        } else {
          console.log(document.doc_id);
          console.log('  uuid:', document.id);
          console.log('  type:', document.doc_type);
          console.log('  parent:', document.parent_id || '(none)');
          console.log('  commitment:', document.commitment_id || '(none)');
          console.log('  path:', document.file_path);
        }
      } catch (error) {
        outputError(error as Error, json);
      }
    });

  // mentu doc chain <doc_id>
  doc
    .command('chain <doc_id>')
    .description('Show document ancestry chain')
    .option('-w, --workspace-id <uuid>', 'Override workspace ID')
    .action(async (docId: string, options: ChainOptions) => {
      const json = program.opts().json || false;

      try {
        const chain = await getDocumentChain(docId, options.workspaceId);

        if (chain.length === 0) {
          console.error('Not found:', docId);
          process.exit(1);
        }

        if (json) {
          console.log(JSON.stringify(chain, null, 2));
        } else {
          console.log('Document Chain:');
          chain.forEach((doc, i) => {
            const prefix = i === chain.length - 1 ? '\u2514\u2500\u2500' : '\u251C\u2500\u2500';
            const indent = '   '.repeat(i);
            const marker = doc.doc_id === docId ? '\u2190 you are here' : '';
            console.log(`${indent}${prefix} ${doc.doc_id} (${doc.doc_type}) ${marker}`);
          });
        }
      } catch (error) {
        outputError(error as Error, json);
      }
    });

  // mentu doc list
  doc
    .command('list')
    .description('List registered documents')
    .option('-t, --type <type>', 'Filter by document type')
    .option('--orphaned', 'Show only orphaned documents')
    .option('-w, --workspace-id <uuid>', 'Override workspace ID')
    .action(async (options: ListOptions) => {
      const json = program.opts().json || false;

      try {
        const documents = await listDocuments({
          type: options.type as DocType,
          orphaned: options.orphaned,
          workspaceId: options.workspaceId,
        });

        if (json) {
          console.log(JSON.stringify(documents, null, 2));
        } else {
          if (documents.length === 0) {
            console.log('No documents found');
            return;
          }

          console.log(`Documents (${documents.length}):`);
          documents.forEach(doc => {
            const parent = doc.parent_id ? `\u2192 ${doc.parent_id.slice(0, 8)}` : '';
            console.log(`  ${doc.doc_type.padEnd(8)} ${doc.doc_id} ${parent}`);
          });
        }
      } catch (error) {
        outputError(error as Error, json);
      }
    });
}
