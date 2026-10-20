/** Forja IA — Firma visual de una página para la regresión.
 *
 * La regresión comparaba consola, QA y peso: un cambio que movía todo el
 * hero de sitio sin romper nada salía «sin cambios medidos». Aquí la captura
 * de la página (la misma de `screenshot.ts`) se reduce a una rejilla de
 * grises de 32×48 y dos rejillas se comparan celda a celda: qué porcentaje
 * de la página cambió y en qué zona (arriba, en medio, abajo).
 *
 * No dice si el cambio es bueno o malo —eso no se puede medir—, dice QUE
 * cambió y dónde, para que un «solo toqué el pie» que movió la cabecera no
 * pase desapercibido.
 */

export interface FirmaVisual {
  cols: number;
  filas: number;
  /** luminancia 0-255 por celda, fila a fila */
  gris: number[];
}

export const COLS_FIRMA = 32;
export const FILAS_FIRMA = 48;
/** diferencia de gris a partir de la cual una celda cuenta como cambiada */
export const UMBRAL_CELDA = 24;

export interface DiferenciaVisual {
  /** fracción de celdas que cambiaron, 0-1 */
  cambio: number;
  /** zonas con más del 5 % de sus celdas cambiadas */
  zonas: ("arriba" | "en medio" | "abajo")[];
}

/** Compara dos firmas del mismo tamaño. null si no son comparables. */
export function compararFirmas(a: FirmaVisual | null | undefined, b: FirmaVisual | null | undefined): DiferenciaVisual | null {
  if (!a || !b || a.cols !== b.cols || a.filas !== b.filas) return null;
  const n = a.cols * a.filas;
  if (a.gris.length !== n || b.gris.length !== n) return null;
  let cambiadas = 0;
  const porTercio = [0, 0, 0];
  const tercio = Math.ceil(a.filas / 3);
  for (let i = 0; i < n; i++) {
    if (Math.abs(a.gris[i] - b.gris[i]) >= UMBRAL_CELDA) {
      cambiadas++;
      porTercio[Math.min(2, Math.floor(Math.floor(i / a.cols) / tercio))]++;
    }
  }
  const celdasTercio = tercio * a.cols;
  const nombres = ["arriba", "en medio", "abajo"] as const;
  const zonas = nombres.filter((_, t) => porTercio[t] / celdasTercio > 0.05);
  return { cambio: cambiadas / n, zonas };
}

/** Una línea para el resumen de la regresión. */
export function lineaVisual(d: DiferenciaVisual | null, hubo: { antes: boolean; despues: boolean }): string {
  if (!d) {
    return hubo.antes && hubo.despues
      ? "Aspecto: sin comparación (las capturas no son del mismo tamaño)."
      : "Aspecto: sin comparación (no hubo captura en alguna de las dos ejecuciones).";
  }
  const pct = Math.round(d.cambio * 100);
  if (pct === 0) return "Aspecto: sin cambios visibles.";
  const donde = d.zonas.length ? ` (sobre todo ${d.zonas.join(" y ")})` : "";
  return `Aspecto: cambió un ${pct} % de la página${donde}.`;
}

/** Calcula la firma de una captura (dataURL). Solo navegador. */
export async function firmaDeCaptura(dataUrl: string): Promise<FirmaVisual | null> {
  if (typeof document === "undefined" || !dataUrl) return null;
  try {
    const img = new Image();
    await new Promise<void>((ok, mal) => {
      img.onload = () => ok();
      img.onerror = () => mal(new Error("captura ilegible"));
      img.src = dataUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = COLS_FIRMA;
    canvas.height = FILAS_FIRMA;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, COLS_FIRMA, FILAS_FIRMA);
    const px = ctx.getImageData(0, 0, COLS_FIRMA, FILAS_FIRMA).data;
    const gris: number[] = [];
    for (let i = 0; i < px.length; i += 4) gris.push(Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]));
    return { cols: COLS_FIRMA, filas: FILAS_FIRMA, gris };
  } catch {
    return null;
  }
}
