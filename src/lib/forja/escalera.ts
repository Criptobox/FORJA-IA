/** Forja IA — Escalera de recuperación del bucle autónomo (Plan Maestro 2026 §39 y §65, Sprint 7).
 *
 * La revisión automática ya corregía sola lo que medía (errores de consola,
 * botones, móvil, página genérica, contenido). Lo hacía siempre igual:
 * mandaba el problema al MISMO modelo, hasta el tope de intentos. Si ese
 * modelo no supo arreglarlo la primera vez, la segunda vez recibía lo mismo
 * y solía fallar igual. Era un intento (y sus tokens) gastado en repetir.
 *
 * El plan pide una escalera, no un bucle:
 *
 *   1. Corregir con el mismo modelo.
 *   2. Si el MISMO problema vuelve después de corregirlo → otro modelo.
 *   3. Si ya se probó otro modelo y sigue → parar y decirlo, con la evidencia.
 *
 * «El mismo problema» se decide con una firma: el tipo de hallazgo y sus
 * detalles normalizados. Si la firma se repite, el modelo no avanzó, que es
 * justo la señal de un ciclo (§39 «detección de ciclos»).
 *
 * El recorte de contexto (peldaño 2 del §65) ya lo hacen los niveles L0–L5 y
 * el grafo de archivos: una corrección es un retoque, viaja por parche y sin
 * los archivos que no tienen que ver. Aquí no se repite.
 *
 * Funciones puras: se prueban sin navegador.
 */

export interface PasoRevision {
  /** firma del problema que se mandó corregir */
  firma: string;
  /** modelo (proveedor::modelo) que recibió la corrección */
  modelo: string;
}

export type Peldano =
  /** primera vez que sale este problema: se corrige con el mismo modelo */
  | "mismo"
  /** el problema volvió tras corregirlo: se prueba con otro modelo */
  | "otro-modelo"
  /** ya se probó con otro modelo, o no hay otro: se para y se dice */
  | "parar";

/** Firma estable de un problema: tipo + detalles normalizados y ordenados.
 *  Números y comillas fuera: «3 errores» y «4 errores» del mismo fallo son
 *  el mismo problema. */
export function firmaDe(tipo: string, detalles: readonly string[]): string {
  const norm = detalles
    .map((d) =>
      (d ?? "")
        .toLowerCase()
        .replace(/[«»"'`]/g, "")
        .replace(/\d+(?:[.,]\d+)?/g, "#")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean)
    .sort();
  return `${tipo}:${[...new Set(norm)].slice(0, 6).join("|")}`;
}

/**
 * Qué hacer con un problema a punto de mandarse a corregir.
 *
 * `historial`: las correcciones ya pedidas en ESTA tarea, en orden.
 */
export function decidirPeldano(
  historial: readonly PasoRevision[],
  firma: string,
  modeloActual: string,
  hayOtroModelo: boolean
): Peldano {
  const previos = historial.filter((p) => p.firma === firma);
  if (!previos.length) return "mismo";
  // Ya se probó con otro modelo distinto al primero y sigue igual: parar.
  const modelos = new Set(previos.map((p) => p.modelo));
  modelos.add(modeloActual);
  if (modelos.size > 1) return "parar";
  return hayOtroModelo ? "otro-modelo" : "parar";
}

/** El aviso cuando se para: qué no se pudo arreglar y qué se probó. */
export function avisoParada(historial: readonly PasoRevision[], firma: string): string {
  const intentos = historial.filter((p) => p.firma === firma);
  const modelos = [...new Set(intentos.map((p) => p.modelo.split("::").pop()))];
  return `Se acabaron los intentos automáticos: el mismo problema volvió tras ${intentos.length} ${
    intentos.length === 1 ? "corrección" : "correcciones"
  }${modelos.length ? ` (${modelos.join(", ")})` : ""} sin que se arreglara. Paro aquí para no gastar más: dime qué cambiar o pídeme que lo intente de otra forma.`;
}
