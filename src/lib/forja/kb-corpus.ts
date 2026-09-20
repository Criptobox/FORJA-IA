/** Forja IA — manifiesto compacto del corpus de Knowledge Base.
 *
 * El manifiesto contiene únicamente metadata: permite al Cerebro conocer el
 * tamaño y la composición de la biblioteca sin cargar sus archivos.
 */
import type { KBResource } from "./kb-index";

export interface KBCorpusManifest {
  version: 1;
  generatedAt: string;
  total: number;
  byCategory: Record<string, number>;
  byTechnology: Record<string, number>;
  /** Recuento por `sourceKind` de importación (upload/folder/zip/drive/url),
   * no por proveedor de almacenamiento (Drive/MEGA) — ese ya tiene su
   * propio concepto en `storage-providers.ts` y reutilizar el nombre aquí
   * habría confundido los dos. */
  bySourceKind: Record<string, number>;
  byStatus: Record<string, number>;
  visualReviewCount: number;
  textResources: number;
  imageResources: number;
  totalBytes: number;
}

function inc(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

export function buildKBCorpusManifest(resources: KBResource[]): KBCorpusManifest {
  const out: KBCorpusManifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    total: resources.length,
    byCategory: {},
    byTechnology: {},
    bySourceKind: {},
    byStatus: {},
    visualReviewCount: 0,
    textResources: 0,
    imageResources: 0,
    totalBytes: 0,
  };
  for (const r of resources) {
    inc(out.byCategory, r.category || "sin-categoria");
    inc(out.byTechnology, r.technology || "sin-tecnologia");
    inc(out.bySourceKind, r.sourceKind || "desconocido");
    inc(out.byStatus, r.status);
    if (r.status === "revision-duplicado") out.visualReviewCount++;
    if (r.mimeType.startsWith("image/")) out.imageResources++;
    else if (r.mimeType.startsWith("text/") || /json|javascript|typescript|css|html|xml/.test(r.mimeType)) out.textResources++;
    out.totalBytes += r.sizeBytes || 0;
  }
  return out;
}

export function renderKBCorpusManifest(manifest: KBCorpusManifest, maxChars = 2600): string {
  const lines = [
    "[FORJA KNOWLEDGE CORPUS]",
    `Recursos: ${manifest.total}`,
    `Tamaño indexado: ${manifest.totalBytes} bytes`,
    `Imágenes: ${manifest.imageResources} | texto/código: ${manifest.textResources}`,
    `En revisión visual: ${manifest.visualReviewCount}`,
    `Estados: ${Object.entries(manifest.byStatus).map(([k, v]) => `${k}=${v}`).join(", ") || "ninguno"}`,
    `Categorías: ${Object.entries(manifest.byCategory).map(([k, v]) => `${k}=${v}`).join(", ") || "ninguna"}`,
    `Tecnologías: ${Object.entries(manifest.byTechnology).map(([k, v]) => `${k}=${v}`).join(", ") || "ninguna"}`,
  ];
  const text = lines.join("\n");
  return text.length <= maxChars ? text : text.slice(0, maxChars - 1) + "…";
}
