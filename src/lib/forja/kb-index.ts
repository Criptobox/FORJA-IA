/** Forja IA — Índice de la Knowledge Base (Fase 2 del plan, §9.2).
 *
 * "El índice y la recuperación selectiva evitan cargar toda la
 * biblioteca" (regla 8 del plan): aquí solo vive METADATA (id, nombre,
 * categoría, etiquetas, origen, estado…) guardada en el dispositivo — los
 * archivos de verdad se quedan en Google Drive, que es quien hace de
 * almacenamiento. Por eso la biblioteca puede crecer a varios GB sin que
 * esto pese nada.
 *
 * "Importar recursos" (`kb-import.tsx`) sí clasifica con el modelo activo
 * de la conversación (`kb-classify.ts`) al subir un archivo nuevo — pero
 * si esa llamada falla o no hay modelo configurado, el recurso queda
 * "pendiente" con categoría vacía en vez de fingir una clasificación que
 * no ocurrió. La deduplicación real (Fase 4, comparación visual lado a
 * lado) sigue sin existir; lo único que hay aquí es un aviso de "archivo
 * idéntico" por hash de contenido antes de subir dos veces lo mismo.
 */

export type KBResourceStatus = "nuevo" | "clasificado" | "pendiente" | "revision-duplicado";

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
  /** SHA-256 del contenido, hexadecimal. */
  contentHash?: string;
  /** Huella visual local (aHash 8x8), solo para imágenes/capturas. */
  visualHash?: string;
  visualHashAlgorithm?: "ahash-8x8";
  /** Ruta relativa cuando el recurso provino de una carpeta/repositorio local. */
  relativePath?: string;
  sourceKind?: "upload" | "folder" | "zip" | "drive" | "url";
  sourceUrl?: string;
  licenseUrl?: string;
  duplicateOf?: string;
  /** score de similitud visual guardado para la cola de revisión. */
  visualSimilarity?: number;
  /** relaciones explícitas entre recursos del corpus. */
  relatedResourceIds?: string[];
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

/** Solo toca los campos que se editan a mano o desde la cola de revisión
 * visual (`kb-review.ts`); conserva el resto tal cual. */
export function kbUpdateResource(id: string, patch: Partial<Pick<KBResource, "category" | "tags" | "technology" | "license" | "status" | "relatedResourceIds">>): void {
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
  revisionDuplicado: number;
}

/** Solo cuenta lo que de verdad hay en el índice — nada de cifras de una
 * canalización de análisis que todavía no existe. */
export function kbStats(resources: KBResource[]): KBStats {
  const stats: KBStats = { total: resources.length, nuevo: 0, clasificado: 0, pendiente: 0, revisionDuplicado: 0 };
  for (const r of resources) {
    if (r.status === "revision-duplicado") stats.revisionDuplicado++;
    else stats[r.status]++;
  }
  return stats;
}

/** true si ese archivo de Drive (por id) ya está en el índice — para no
 * añadir el mismo recurso dos veces sin querer al elegirlo otra vez. */
export function kbHasResource(id: string): boolean {
  return kbGetResources().some((r) => r.id === id);
}

/** El recurso con ESE contenido exacto, si ya está indexado — para avisar
 * antes de subir dos veces el mismo archivo (con otro nombre incluso). */
export function kbFindByHash(hash: string): KBResource | undefined {
  return kbGetResources().find((r) => r.contentHash === hash);
}

/** SHA-256 del contenido de un archivo, en hexadecimal. `crypto.subtle` es
 * nativo del navegador: no hace falta ninguna librería para esto. */
export async function kbHashFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Categorías que ya existen en el índice, sin repetir — para que la
 * clasificación automática reutilice una en vez de inventar una parecida
 * (p.ej. "componentes" y "componentes-ui" como si fueran distintas). */
export function kbExistingCategories(resources: KBResource[]): string[] {
  return Array.from(new Set(resources.map((r) => r.category).filter(Boolean)));
}

/** Normaliza para comparar: minúsculas y sin tildes. */
function normalizarKB(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function terminosDeKB(q: string): string[] {
  return [...new Set(normalizarKB(q).split(/[^a-z0-9ñ.\-_]+/).filter((t) => t.length >= 2))];
}

/** Busca en el índice por nombre, categoría, etiquetas, tecnología o
 * licencia. Ordenado por relevancia (cuántos términos distintos casan, no
 * cuántas veces se repite uno). Vacío sin términos válidos, sin recursos, o
 * si ninguno casa — nunca inventa un resultado que no esté en el índice. */
export function kbSearch(resources: KBResource[], q: string, limit = 8): KBResource[] {
  const terminos = terminosDeKB(q);
  if (!terminos.length || !resources.length) return [];
  const puntuados = resources
    .map((r) => {
      const texto = normalizarKB(
        [r.name, r.category, r.tags.join(" "), r.technology, r.license].join(" ")
      );
      const puntos = terminos.reduce((acc, t) => acc + (texto.includes(t) ? 10 : 0), 0);
      return { r, puntos };
    })
    .filter((x) => x.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos);
  return puntuados.slice(0, limit).map((x) => x.r);
}

/** El texto que recibe el modelo tras `kb_search`: distingue "no hay nada
 * indexado" de "hay cosas, pero ninguna casa con la búsqueda" — son avisos
 * distintos y confundirlos empuja al modelo a inventar o a rendirse de más. */
export function renderKbSearch(results: KBResource[], q: string, total: number): string {
  if (total === 0) {
    return "Todavía no hay ningún recurso en la Knowledge Base. Conecta Google Drive y sube o elige algo desde «Conocimiento» antes de buscar aquí.";
  }
  if (!results.length) {
    return `Hay ${total} recurso(s) indexados, pero ninguno casa con «${q}». Prueba otra palabra o revisa qué hay indexado en «Conocimiento» antes de asumir que no existe.`;
  }
  const out = [`${results.length} recurso(s) de la Knowledge Base para «${q}»:`, ""];
  for (const r of results) {
    const detalle = [r.category || "sin categoría", r.technology, r.tags.join(", ")]
      .filter(Boolean)
      .join(" · ");
    out.push(`· ${r.name} — ${detalle} (${r.accountEmail})`);
    if (r.webViewLink) out.push(`    ${r.webViewLink}`);
  }
  return out.join("\n");
}
