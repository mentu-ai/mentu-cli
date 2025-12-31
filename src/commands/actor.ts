import type { Command } from 'commander';
import type { AnnotateOperation } from '../types.js';
import { MentuError } from '../types.js';
import { generateId } from '../utils/id.js';
import { timestamp } from '../utils/time.js';
import { resolveActor } from '../utils/actor.js';
import { findWorkspace, readConfig, getWorkspaceName } from '../core/config.js';
import { readLedger, appendOperation } from '../core/ledger.js';
import { readGenesisKey } from '../core/genesis.js';
import { validateOperation } from '../core/validate.js';
import { loadActorMappings, type ActorMapping } from '../core/actor-mapping.js';

interface ActorMapOptions {
  actor?: string;
}

function outputResult(result: unknown, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result));
  } else if (typeof result === 'string') {
    console.log(result);
  } else if (Array.isArray(result)) {
    for (const item of result) {
      console.log(
        `${item.externalSystem}:${item.externalId} -> ${item.mentuActor}`
      );
    }
  }
}

function outputError(error: MentuError, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ ...error.toJSON(), op: 'actor' }));
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
}

export function registerActorCommand(program: Command): void {
  const actorCmd = program
    .command('actor')
    .description('Manage actor mappings between external systems and Mentu');

  // mentu actor map <external> <mentu-actor>
  actorCmd
    .command('map <external> <mentu_actor>')
    .description(
      'Map external identity to Mentu actor (e.g., github:rashidazarang rashid)'
    )
    .option('--actor <id>', 'Override actor identity')
    .action(async (external: string, mentuActor: string, options: ActorMapOptions) => {
      const json = program.opts().json || false;

      try {
        // Parse external identity
        const [externalSystem, externalId] = external.split(':');
        if (!externalSystem || !externalId) {
          throw new MentuError(
            'E_INVALID_OP',
            'External identity must be in format "system:id" (e.g., github:rashidazarang)'
          );
        }

        const workspacePath = findWorkspace(process.cwd());
        const config = readConfig(workspacePath);
        const genesis = readGenesisKey(workspacePath);
        const actor = resolveActor(options.actor, config ?? undefined);
        const workspace = getWorkspaceName(workspacePath);
        const ledger = readLedger(workspacePath);

        const mapping: ActorMapping = {
          externalSystem,
          externalId,
          mentuActor,
        };

        const id = generateId('op');
        const ts = timestamp();

        const operation: AnnotateOperation = {
          id,
          op: 'annotate',
          ts,
          actor,
          workspace,
          payload: {
            target: 'workspace',
            body: `Mapped ${external} to ${mentuActor}`,
            meta: {
              kind: 'actor_mapping',
              mapping,
            },
          },
        };

        // Validate with Genesis Key
        const validation = validateOperation(operation, ledger, genesis);
        if (!validation.valid && validation.error) {
          throw validation.error;
        }

        appendOperation(workspacePath, operation);

        outputResult(`Mapped ${external} -> ${mentuActor}`, json);
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

  // mentu actor unmap <external>
  actorCmd
    .command('unmap <external>')
    .description('Remove actor mapping')
    .option('--actor <id>', 'Override actor identity')
    .action(async (external: string, options: ActorMapOptions) => {
      const json = program.opts().json || false;

      try {
        const [externalSystem, externalId] = external.split(':');
        if (!externalSystem || !externalId) {
          throw new MentuError(
            'E_INVALID_OP',
            'External identity must be in format "system:id"'
          );
        }

        const workspacePath = findWorkspace(process.cwd());
        const config = readConfig(workspacePath);
        const genesis = readGenesisKey(workspacePath);
        const actor = resolveActor(options.actor, config ?? undefined);
        const workspace = getWorkspaceName(workspacePath);
        const ledger = readLedger(workspacePath);

        // Check if mapping exists
        const mappingConfig = loadActorMappings(ledger);
        const existing = mappingConfig.mappings.find(
          (m) => m.externalSystem === externalSystem && m.externalId === externalId
        );

        if (!existing) {
          throw new MentuError(
            'E_REF_NOT_FOUND',
            `No mapping found for ${external}`
          );
        }

        const id = generateId('op');
        const ts = timestamp();

        // Record removal as annotation with empty mapping
        const operation: AnnotateOperation = {
          id,
          op: 'annotate',
          ts,
          actor,
          workspace,
          payload: {
            target: 'workspace',
            body: `Removed mapping for ${external}`,
            meta: {
              kind: 'actor_mapping_removed',
              removed: { externalSystem, externalId },
            },
          },
        };

        const validation = validateOperation(operation, ledger, genesis);
        if (!validation.valid && validation.error) {
          throw validation.error;
        }

        appendOperation(workspacePath, operation);

        outputResult(`Removed mapping for ${external}`, json);
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

  // mentu actor list
  actorCmd
    .command('list')
    .description('List all actor mappings')
    .action(() => {
      const json = program.opts().json || false;

      try {
        const workspacePath = findWorkspace(process.cwd());
        const ledger = readLedger(workspacePath);
        const config = loadActorMappings(ledger);

        if (config.mappings.length === 0) {
          if (json) {
            console.log(JSON.stringify([]));
          } else {
            console.log('No actor mappings configured.');
          }
          return;
        }

        outputResult(config.mappings, json);
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
