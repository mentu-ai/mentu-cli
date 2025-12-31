import type { Command } from 'commander';
import type { CaptureOperation, CaptureOutput } from '../types.js';
import { MentuError } from '../types.js';
import { generateId } from '../utils/id.js';
import { timestamp } from '../utils/time.js';
import { resolveActor } from '../utils/actor.js';
import { findWorkspace, readConfig, getWorkspaceName } from '../core/config.js';
import { readLedger, appendOperation, sourceKeyExists } from '../core/ledger.js';

interface CaptureOptions {
  kind?: string;
  path?: string;
  refs?: string;
  sourceKey?: string;
  actor?: string;
}

function outputResult(result: CaptureOutput, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result));
  } else {
    console.log(`Created memory ${result.id}`);
    if (result.kind) {
      console.log(`Kind: ${result.kind}`);
    }
  }
}

function outputError(error: MentuError, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ ...error.toJSON(), op: 'capture' }));
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
}

export function registerCaptureCommand(program: Command): void {
  program
    .command('capture <body>')
    .description('Record an observation')
    .option('-k, --kind <kind>', 'Type of observation (e.g., evidence, bug_report)')
    .option('-p, --path <path>', 'Document path (for kind=document)')
    .option('-r, --refs <refs>', 'Related IDs, comma-separated (e.g., cmt_xxx,mem_yyy)')
    .option('--source-key <key>', 'Idempotency key from origin system')
    .option('--actor <id>', 'Override actor identity')
    .action((body: string, options: CaptureOptions) => {
      const json = program.opts().json || false;

      try {
        const workspacePath = findWorkspace(process.cwd());
        const config = readConfig(workspacePath);
        const actor = resolveActor(options.actor, config ?? undefined);
        const workspace = getWorkspaceName(workspacePath);

        // Validate body
        if (!body || body.trim() === '') {
          throw new MentuError('E_EMPTY_BODY', 'Body cannot be empty', {
            field: 'body',
          });
        }

        // Check source_key uniqueness
        if (options.sourceKey) {
          const ledger = readLedger(workspacePath);
          if (sourceKeyExists(ledger, options.sourceKey)) {
            throw new MentuError(
              'E_DUPLICATE_SOURCE_KEY',
              `Source key "${options.sourceKey}" already exists`,
              { source_key: options.sourceKey }
            );
          }
        }

        const id = generateId('mem');
        const ts = timestamp();

        const operation: CaptureOperation = {
          id,
          op: 'capture',
          ts,
          actor,
          workspace,
          payload: {
            body: body.trim(),
          },
        };

        if (options.kind) {
          operation.payload.kind = options.kind;
        }

        // Validate and add path
        if (options.path) {
          // Path must be relative and start with docs/ or .claude/
          if (options.path.startsWith('/')) {
            throw new MentuError('E_INVALID_OP', 'Path must be relative, not absolute', {
              field: 'path',
              value: options.path,
            });
          }
          if (!options.path.startsWith('docs/') && !options.path.startsWith('.claude/')) {
            throw new MentuError('E_INVALID_OP', 'Path must start with docs/ or .claude/', {
              field: 'path',
              value: options.path,
            });
          }
          operation.payload.path = options.path;
        }

        // Validate and add refs
        if (options.refs) {
          const refs = options.refs.split(',').map(r => r.trim()).filter(r => r.length > 0);
          const idPattern = /^(cmt|mem|op)_[a-f0-9]{8}$/;
          for (const ref of refs) {
            if (!idPattern.test(ref)) {
              throw new MentuError('E_INVALID_OP', `Invalid ref format: ${ref}`, {
                field: 'refs',
                value: ref,
              });
            }
          }
          operation.payload.refs = refs;
        }

        if (options.sourceKey) {
          operation.source_key = options.sourceKey;
        }

        appendOperation(workspacePath, operation);

        const result: CaptureOutput = {
          id,
          op: 'capture',
          ts,
          actor,
          body: body.trim(),
        };

        if (options.kind) {
          result.kind = options.kind;
        }

        if (options.path) {
          result.path = options.path;
        }

        if (operation.payload.refs) {
          result.refs = operation.payload.refs;
        }

        if (options.sourceKey) {
          result.source_key = options.sourceKey;
        }

        outputResult(result, json);
      } catch (err) {
        if (err instanceof MentuError) {
          outputError(err, json);
        } else {
          const error = new MentuError(
            'E_INVALID_OP',
            err instanceof Error ? err.message : 'Unknown error'
          );
          outputError(error, json);
        }
      }
    });
}
