import type { Command } from 'commander';
import type { AnnotateOperation } from '../types.js';
import { MentuError } from '../types.js';
import { generateId } from '../utils/id.js';
import { timestamp } from '../utils/time.js';
import { resolveActor } from '../utils/actor.js';
import { findWorkspace, readConfig, getWorkspaceName } from '../core/config.js';
import { readLedger, appendOperation } from '../core/ledger.js';
import { commitmentExists } from '../core/state.js';
import { getExternalRef } from '../core/external.js';
import { readGenesisKey } from '../core/genesis.js';
import { validateOperation } from '../core/validate.js';

interface UnlinkOptions {
  github?: string;
  actor?: string;
}

interface UnlinkOutput {
  id: string;
  op: 'annotate';
  commitment: string;
  unlinked: {
    system: string;
    external_id: string;
  };
}

function outputResult(result: UnlinkOutput, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result));
  } else {
    console.log(
      `Unlinked commitment ${result.commitment} from ${result.unlinked.system} #${result.unlinked.external_id}`
    );
  }
}

function outputError(error: MentuError, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ ...error.toJSON(), op: 'unlink' }));
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
}

export function registerUnlinkCommand(program: Command): void {
  program
    .command('unlink <commitment>')
    .description('Remove external system link from a commitment')
    .option('--github <issue_number>', 'GitHub issue number to unlink')
    .option('--actor <id>', 'Override actor identity')
    .action(async (commitmentId: string, options: UnlinkOptions) => {
      const json = program.opts().json || false;

      try {
        if (!options.github) {
          throw new MentuError(
            'E_MISSING_FIELD',
            'Must specify --github <issue_number>',
            { field: 'github' }
          );
        }

        const workspacePath = findWorkspace(process.cwd());
        const config = readConfig(workspacePath);
        const genesis = readGenesisKey(workspacePath);
        const actor = resolveActor(options.actor, config ?? undefined);
        const workspace = getWorkspaceName(workspacePath);
        const ledger = readLedger(workspacePath);

        // Validate commitment exists
        if (!commitmentExists(ledger, commitmentId)) {
          throw new MentuError(
            'E_REF_NOT_FOUND',
            `Commitment ${commitmentId} does not exist`,
            { field: 'commitment', value: commitmentId }
          );
        }

        // Check if linked
        const existingRef = getExternalRef(ledger, commitmentId, 'github');
        if (!existingRef || existingRef.id !== options.github) {
          throw new MentuError(
            'E_EXTERNAL_REF_NOT_FOUND',
            `Commitment ${commitmentId} is not linked to GitHub issue #${options.github}`,
            { commitment: commitmentId, system: 'github', issue: options.github }
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
            target: commitmentId,
            body: `Unlinked from GitHub issue #${options.github}`,
            meta: {
              kind: 'external_ref_removed',
              removed: {
                system: 'github',
                type: 'issue',
                id: options.github,
              },
            },
          },
        };

        // Validate with Genesis Key
        const validation = validateOperation(operation, ledger, genesis);
        if (!validation.valid && validation.error) {
          throw validation.error;
        }

        appendOperation(workspacePath, operation);

        const result: UnlinkOutput = {
          id,
          op: 'annotate',
          commitment: commitmentId,
          unlinked: {
            system: 'github',
            external_id: options.github,
          },
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
