import type { Command } from 'commander';
import type { AnnotateOperation, AnnotateOutput } from '../types.js';
import { MentuError } from '../types.js';
import { generateId } from '../utils/id.js';
import { timestamp } from '../utils/time.js';
import { resolveActor } from '../utils/actor.js';
import { findWorkspace, readConfig, getWorkspaceName } from '../core/config.js';
import { readLedger, appendOperation } from '../core/ledger.js';
import { recordExists } from '../core/state.js';
import { readGenesisKey } from '../core/genesis.js';
import { validateOperation } from '../core/validate.js';

interface AnnotateOptions {
  kind?: string;
  actor?: string;
}

function outputResult(result: AnnotateOutput, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result));
  } else {
    console.log(`Created annotation ${result.id} on ${result.target}`);
    if (result.kind) {
      console.log(`Kind: ${result.kind}`);
    }
  }
}

function outputError(error: MentuError, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ ...error.toJSON(), op: 'annotate' }));
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
}

export function registerAnnotateCommand(program: Command): void {
  program
    .command('annotate <target> <body>')
    .description('Attach a note to a record')
    .option('-k, --kind <kind>', 'Type of annotation')
    .option('--actor <id>', 'Override actor identity')
    .action((target: string, body: string, options: AnnotateOptions) => {
      const json = program.opts().json || false;

      try {
        const workspacePath = findWorkspace(process.cwd());
        const config = readConfig(workspacePath);
        const genesis = readGenesisKey(workspacePath);
        const actor = resolveActor(options.actor, config ?? undefined);
        const workspace = getWorkspaceName(workspacePath);
        const ledger = readLedger(workspacePath);

        // Validate body
        if (!body || body.trim() === '') {
          throw new MentuError('E_EMPTY_BODY', 'Body cannot be empty', {
            field: 'body',
          });
        }

        // Validate target exists
        if (!recordExists(ledger, target)) {
          throw new MentuError(
            'E_REF_NOT_FOUND',
            `Target ${target} does not exist`,
            { field: 'target', value: target }
          );
        }

        const id = generateId('op');
        const ts = timestamp();

        const operation: AnnotateOperation = {
          id,
          op: 'annotate',
          ts,
          actor,
          workspace,
          payload: {
            target,
            body: body.trim(),
          },
        };

        if (options.kind) {
          operation.payload.kind = options.kind;
        }

        // Validate with Genesis Key
        const validation = validateOperation(operation, ledger, genesis);
        if (!validation.valid && validation.error) {
          throw validation.error;
        }

        appendOperation(workspacePath, operation);

        const result: AnnotateOutput = {
          id,
          op: 'annotate',
          ts,
          actor,
          target,
          body: body.trim(),
        };

        if (options.kind) {
          result.kind = options.kind;
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
