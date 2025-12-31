import type { Command } from 'commander';
import type { LinkOperation, LinkOutput, LinkKind } from '../types.js';
import { MentuError } from '../types.js';
import { generateId } from '../utils/id.js';
import { timestamp } from '../utils/time.js';
import { resolveActor } from '../utils/actor.js';
import { findWorkspace, readConfig, getWorkspaceName } from '../core/config.js';
import { readLedger, appendOperation } from '../core/ledger.js';
import { readGenesisKey } from '../core/genesis.js';
import { validateOperation } from '../core/validate.js';

interface LinkOptions {
  kind?: string;
  reason?: string;
  actor?: string;
}

function outputResult(result: LinkOutput, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result));
  } else {
    console.log(`Linked ${result.source} to ${result.target}`);
    console.log(`Kind: ${result.kind}`);
  }
}

function outputError(error: MentuError, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ ...error.toJSON(), op: 'link' }));
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
}

export function registerLinkCommand(program: Command): void {
  program
    .command('link <source> <target>')
    .description('Link a memory or commitment to a commitment')
    .option('-k, --kind <type>', 'Link type: related|duplicate|caused_by|blocks|evidence', 'related')
    .option('-r, --reason <text>', 'Explanation for the link')
    .option('--actor <id>', 'Override actor identity')
    .action((source: string, target: string, options: LinkOptions) => {
      const json = program.opts().json || false;

      try {
        const workspacePath = findWorkspace(process.cwd());
        const config = readConfig(workspacePath);
        const genesis = readGenesisKey(workspacePath);
        const actor = resolveActor(options.actor, config ?? undefined);
        const workspace = getWorkspaceName(workspacePath);
        const ledger = readLedger(workspacePath);

        // Validate kind
        const validKinds: LinkKind[] = ['related', 'duplicate', 'caused_by', 'blocks', 'evidence'];
        const kind = (options.kind || 'related') as LinkKind;
        if (!validKinds.includes(kind)) {
          throw new MentuError(
            'E_INVALID_OP',
            `Invalid link kind: ${kind}. Valid kinds: ${validKinds.join(', ')}`
          );
        }

        const id = generateId('op');
        const ts = timestamp();

        const operation: LinkOperation = {
          id,
          op: 'link',
          ts,
          actor,
          workspace,
          payload: {
            source,
            target,
            kind,
            ...(options.reason && { reason: options.reason }),
          },
        };

        // Validate operation
        const validation = validateOperation(operation, ledger, genesis);
        if (!validation.valid && validation.error) {
          throw validation.error;
        }

        appendOperation(workspacePath, operation);

        const result: LinkOutput = {
          id,
          op: 'link',
          ts,
          actor,
          source,
          target,
          kind,
        };

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
