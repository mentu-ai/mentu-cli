import type { Operation } from '../types.js';

export interface ActorMapping {
  externalSystem: string;
  externalId: string;
  mentuActor: string;
}

export interface ActorMappingConfig {
  mappings: ActorMapping[];
}

/**
 * Resolve external identity to Mentu actor.
 * Returns the external ID prefixed with system if no mapping found.
 */
export function resolveToMentuActor(
  config: ActorMappingConfig,
  externalSystem: string,
  externalId: string
): string {
  const mapping = config.mappings.find(
    (m) => m.externalSystem === externalSystem && m.externalId === externalId
  );

  if (mapping) {
    return mapping.mentuActor;
  }

  // Default: prefix with system
  return `${externalSystem}:${externalId}`;
}

/**
 * Resolve Mentu actor to external identity for a system.
 * Returns null if no mapping found.
 */
export function resolveToExternalId(
  config: ActorMappingConfig,
  mentuActor: string,
  externalSystem: string
): string | null {
  const mapping = config.mappings.find(
    (m) => m.mentuActor === mentuActor && m.externalSystem === externalSystem
  );

  return mapping?.externalId ?? null;
}

/**
 * Load actor mappings from ledger (annotations with kind: actor_mapping).
 */
export function loadActorMappings(ledger: Operation[]): ActorMappingConfig {
  const mappings: ActorMapping[] = [];
  const removedMappings = new Set<string>();

  for (const op of ledger) {
    if (op.op === 'annotate') {
      const meta = op.payload.meta as Record<string, unknown> | undefined;

      // Handle removal annotations
      if (meta?.kind === 'actor_mapping_removed' && meta.removed) {
        const removed = meta.removed as { externalSystem: string; externalId: string };
        removedMappings.add(`${removed.externalSystem}:${removed.externalId}`);
        continue;
      }

      // Handle mapping annotations
      if (meta?.kind === 'actor_mapping' && meta.mapping) {
        const m = meta.mapping as ActorMapping;
        const key = `${m.externalSystem}:${m.externalId}`;

        // Skip if this mapping was later removed
        if (removedMappings.has(key)) {
          continue;
        }

        // Remove existing mapping for same external identity
        const existingIdx = mappings.findIndex(
          (existing) =>
            existing.externalSystem === m.externalSystem &&
            existing.externalId === m.externalId
        );
        if (existingIdx >= 0) {
          mappings.splice(existingIdx, 1);
        }
        mappings.push(m);
      }
    }
  }

  // Filter out removed mappings
  const finalMappings = mappings.filter((m) => {
    const key = `${m.externalSystem}:${m.externalId}`;
    return !removedMappings.has(key);
  });

  return { mappings: finalMappings };
}
