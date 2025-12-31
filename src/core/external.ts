import type { Operation, ExternalRef, AnnotateOperation } from '../types.js';

/**
 * Check if an annotate operation contains an external_ref.
 */
function isExternalRefAnnotation(op: AnnotateOperation): boolean {
  return op.payload.meta?.kind === 'external_ref' &&
         op.payload.meta?.external_ref !== undefined;
}

/**
 * Extract external ref from an annotate operation.
 */
function extractExternalRef(op: AnnotateOperation): ExternalRef | null {
  const meta = op.payload.meta as Record<string, unknown> | undefined;
  if (meta?.kind === 'external_ref' && meta?.external_ref) {
    return meta.external_ref as ExternalRef;
  }
  return null;
}

/**
 * Get all external refs for a commitment.
 */
export function getExternalRefs(
  ledger: Operation[],
  commitmentId: string
): ExternalRef[] {
  const refs: ExternalRef[] = [];

  for (const op of ledger) {
    if (op.op === 'annotate' && op.payload.target === commitmentId) {
      const annotateOp = op as AnnotateOperation;
      if (isExternalRefAnnotation(annotateOp)) {
        const ref = extractExternalRef(annotateOp);
        if (ref) {
          refs.push(ref);
        }
      }
    }
  }

  return refs;
}

/**
 * Check if commitment has a ref for a specific system.
 */
export function hasExternalRef(
  ledger: Operation[],
  commitmentId: string,
  system: string
): boolean {
  const refs = getExternalRefs(ledger, commitmentId);
  return refs.some((ref) => ref.system === system);
}

/**
 * Get the external ref for a specific system.
 */
export function getExternalRef(
  ledger: Operation[],
  commitmentId: string,
  system: string
): ExternalRef | null {
  const refs = getExternalRefs(ledger, commitmentId);
  return refs.find((ref) => ref.system === system) ?? null;
}

/**
 * Find all commitments that have an external ref for a system.
 */
export function getCommitmentsWithExternalRef(
  ledger: Operation[],
  system: string
): Array<{ commitmentId: string; ref: ExternalRef }> {
  const result: Array<{ commitmentId: string; ref: ExternalRef }> = [];
  const seen = new Set<string>();

  for (const op of ledger) {
    if (op.op === 'annotate') {
      const annotateOp = op as AnnotateOperation;
      if (isExternalRefAnnotation(annotateOp)) {
        const ref = extractExternalRef(annotateOp);
        if (ref && ref.system === system) {
          const commitmentId = annotateOp.payload.target;
          if (!seen.has(commitmentId)) {
            seen.add(commitmentId);
            result.push({ commitmentId, ref });
          }
        }
      }
    }
  }

  return result;
}
