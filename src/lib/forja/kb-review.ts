/** Operaciones seguras para la cola de revisión visual.
 * Nunca borra el archivo remoto: solo cambia el índice local.
 */
import { kbGetResources, kbUpdateResource, kbRemoveResource, type KBResource } from "./kb-index";

export function getVisualReviewQueue(resources = kbGetResources()): KBResource[] {
  return resources
    .filter((r) => r.status === "revision-duplicado")
    .sort((a, b) => (b.visualSimilarity ?? 0) - (a.visualSimilarity ?? 0));
}

export function getVisualReviewPair(resource: KBResource, resources = kbGetResources()): { current: KBResource; original?: KBResource } {
  return { current: resource, original: resource.duplicateOf ? resources.find((r) => r.id === resource.duplicateOf) : undefined };
}

/** Conservar ambos recursos y cerrar la revisión. */
export function keepBothVisualResources(id: string): void {
  kbUpdateResource(id, { status: "clasificado" });
}

/** Marcar que el recurso nuevo era duplicado y retirarlo SOLO del índice. */
export function discardDuplicateFromIndex(id: string): void {
  kbRemoveResource(id);
}

/** Convertir la revisión en relación útil para recuperación futura. */
export function acceptAsRelated(id: string): void {
  const resources = kbGetResources();
  const item = resources.find((r) => r.id === id);
  if (!item) return;
  const original = item.duplicateOf ? resources.find((r) => r.id === item.duplicateOf) : undefined;
  if (!original) return;
  kbUpdateResource(id, { status: "clasificado", relatedResourceIds: Array.from(new Set([...(item.relatedResourceIds ?? []), original.id])) });
  kbUpdateResource(original.id, { relatedResourceIds: Array.from(new Set([...(original.relatedResourceIds ?? []), item.id])) });
}
