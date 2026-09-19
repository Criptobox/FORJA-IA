/** Forja IA — Índice de la Knowledge Base (Fase 2 del plan, §9.2).
 *
 * "El índice y la recuperación selectiva evitan cargar toda la
 * biblioteca" (regla 8 del plan): aquí solo vive METADATA (id, nombre,
 * categoría, etiquetas, origen, estado…) guardada en el dispositivo — los
 * archivos de verdad se quedan en Google Drive, que es quien hace de
 * almacenamiento. Por eso la biblioteca puede crecer a varios GB sin que
 * esto pese nada.
 *
 * Todavía no hay análisis automático (Fase 3) ni deduplicación (Fase 4):
 * categoría y etiquetas se ponen a mano. Fingir una clasificación
 * automática que no existe sería justo lo que "se mide, no se mira"
 * prohíbe.
 */

export type KBResourceStatus = "nuevo" | "clasificado" | "pendiente";

export interface KBResource {
  /** id del archivo en Drive: es el identificador natural, no hace falta inventar otro. */
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  /** cuenta de Drive de la que vino, para saber dónde volver a buscarlo. */
  accountEmail: string;
  webViewLink: string;
  category: string;
  tags: string[];
  technology: string;
  license: string;
  status: KBResourceStatus;
  /** ISO: cuándo se añadió al índice (no cuándo se creó el archivo). */
  indexedAt: string;
}

const INDEX_KEY = "forja-kb-index";
export const KB_INDEX_EVENT = "forja-kb-index";

function safeParse(raw: string | null): KBResource[] {
  if (!raw) return [];
  try {
    const j = JSON.parse(raw);
    return Array.isArray(j) ? (j as KBResource[]) : [];
  } catch {
    return [];
  }
}

export function kbGetResources(): KBResource[] {
  if (typeof localStorage === "undefined") return [];
  return safeParse(localStorage.getItem(INDEX_KEY));
}

function persist(resources: KBResource[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(INDEX_KEY, JSON.stringify(resources));
  try {
    window.dispatchEvent(new Event(KB_INDEX_EVENT));
  } catch {
    /* SSR o sin window */
  }
}

/** Reemplaza el recurso con el mismo id (mismo archivo de Drive), o lo añade si es nuevo. */
export function kbUpsertResource(resource: KBResource): void {
  const resources = kbGetResources();
  const i = resources.findIndex((r) => r.id === resource.id);
  if (i === -1) resources.push(resource);
  else resources[i] = resource;
  persist(resources);
}

export function kbRemoveResource(id: string): void {
  persist(kbGetResources().filter((r) => r.id !== id));
}

/** Solo toca los campos que se editan a mano; conserva el resto tal cual. */
export function kbUpdateResource(id: string, patch: Partial<Pick<KBResource, "category" | "tags" | "technology" | "license" | "status">>): void {
  const resources = kbGetResources();
  const i = resources.findIndex((r) => r.id === id);
  if (i === -1) return;
  resources[i] = { ...resources[i]!, ...patch };
  persist(resources);
}

export interface KBStats {
  total: number;
  nuevo: number;
  clasificado: number;
  pendiente: number;
}

/** Solo cuenta lo que de verdad hay en el índice — nada de cifras de una
 * canalización de análisis que todavía no existe. */
export function kbStats(resources: KBResource[]): KBStats {
  const stats: KBStats = { total: resources.length, nuevo: 0, clasificado: 0, pendiente: 0 };
  for (const r of resources) stats[r.status]++;
  return stats;
}

/** true si ese archivo de Drive (por id) ya está en el índice — para no
 * añadir el mismo recurso dos veces sin querer al elegirlo otra vez. */
export function kbHasResource(id: string): boolean {
  return kbGetResources().some((r) => r.id === id);
}
