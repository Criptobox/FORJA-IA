/** FORJA IA — TOKEN ROI (v4.4, sección 28 del plan).
 *
 * ─── El problema ───
 * Sin medir el RETORNO de cada operación, no hay forma de saber qué merece
 * tokens: ¿la 3ª iteración del bucle ganó algo? ¿los jueces 4 y 5 aportan?
 * ¿el Revisor aprueba siempre a la 1ª? El gasto se gestiona a ciegas.
 *
 * ─── La solución ───
 * El registro EXACTO del plan, por operación:
 *
 *   operation · tokens · cost · result · QA improvement
 *   → quality gain / tokens
 *
 * Con el tiempo FORJA aprende (las 5 consultas del plan):
 *  · qué operaciones MEREcen tokens (ROI alto)
 *  · qué modelos funcionan mejor para cada tarea
 *  · qué patches son repetitivos (→ deterministas, gratis)
 *  · qué patrones generan mejores resultados
 *  · qué pasos pueden ser determinísticos (→ enrutador)
 *
 * El «coste» se mide en TOKENS DE SALIDA (la moneda real: los de entrada
 * se abaratan aparte con el compilador de contexto). El «resultado» es el
 * score determinista antes/después de la operación — el mismo que usa el
 * bucle de mejora, así ROI y calidad hablan el mismo idioma.
 *
 * Persistencia: roiAJSON()/roiDesdeJSON() para que el host lo guarde entre
 * generaciones (el aprendizaje es acumulativo, no por ejecución).
 *
 * Reglas de la casa: sin red, sin React, TypeScript estricto, nunca lanza.
 */

/* -------------------------------- tipos ------------------------------------ */

/** Operaciones que el pipeline sabe medir. */
export type OperacionROI =
  | "adn"              // definir Experience DNA
  | "direcciones"      // Director/Arena: visiones
  | "ficha"            // ficha del Diseñador
  | "codificador"      // generación de código
  | "revisor"          // QA con modelo
  | "parche-det"       // parche determinista (coste 0 — aparece como control)
  | "parche-experiencia" // v4.5: parche del QA de experiencia (coste 0, doc §22)
  | "parche-motion-qa" // v4.6: parche del motion QA medido (coste 0, idea D)
  | "reparacion-detalle" // v4.7: ampliación quirúrgica del QA de detalle
  | "bucle-mejora"     // iteración del bucle
  | "jueces"           // panel de jueces
  | "fusion"           // fusión del Director
  | "otra";

export interface RegistroROI {
  id: string;
  operacion: OperacionROI;
  /** rol y modelo que ejecutó (para «qué modelos funcionan mejor») */
  rol: string;
  modelo: string;
  /** tokens de salida consumidos (0 en parches deterministas) */
  tokens: number;
  /** nº de llamadas que costó (0 en deterministas) */
  llamadas: number;
  /** score determinista ANTES de la operación (0 si no aplica) */
  scoreAntes: number;
  /** score determinista DESPUÉS */
  scoreDespues: number;
  /** ganancia de calidad = scoreDespues - scoreAntes (puede ser negativa) */
  readonly ganancia?: number;
  /** cuándo (iso) */
  cuando: string;
  /** acierto de caché: la operación no llamó al modelo */
  deCache?: boolean;
}

export interface RoiDeOperacion {
  operacion: OperacionROI;
  registros: number;
  tokensTotales: number;
  llamadasTotales: number;
  /** media de ganancia de score */
  gananciaMedia: number;
  /** ganancia de calidad media por 1.000 tokens (2 decimales) */
  roi: number;
  /** % de registros servidos de caché */
  tasaCache: number;
}

export interface RecomendacionAhorro {
  /** qué hacer */
  accion: string;
  /** por qué (evidencia medida) */
  evidencia: string;
  /** ahorro estimado en tokens por generación */
  ahorroTokens: number;
  prioridad: "alta" | "media" | "baja";
}

/* ------------------------------ el libro ROI ------------------------------- */

export interface LibroROI {
  /** registra una operación completada */
  registrar(r: Omit<RegistroROI, "id" | "cuando" | "ganancia"> & { id?: string; cuando?: string }): RegistroROI;
  /** ROI agregado por operación */
  roiPorOperacion(): RoiDeOperacion[];
  /** las 5 consultas del plan, como recomendaciones ACCIONABLES */
  recomendaciones(): RecomendacionAhorro[];
  /** totales de la sesión */
  totales(): { tokens: number; llamadas: number; ganancia: number; deCache: number; registros: number };
  resumen(): string;
}

/** Crea el libro de una sesión (o continúa uno deserializado). */
export function crearLibroROI(previos: RegistroROI[] = []): LibroROI {
  const registros: RegistroROI[] = [...previos];
  let seq = registros.length;

  return {
    registrar(r) {
      seq++;
      const reg: RegistroROI = {
        id: r.id ?? `roi-${seq}`,
        operacion: r.operacion,
        rol: r.rol ?? "-",
        modelo: r.modelo ?? "-",
        tokens: Math.max(0, Math.round(r.tokens || 0)),
        llamadas: Math.max(0, Math.round(r.llamadas || 0)),
        scoreAntes: r.scoreAntes ?? 0,
        scoreDespues: r.scoreDespues ?? 0,
        cuando: r.cuando ?? new Date().toISOString(),
        deCache: r.deCache ?? false,
      };
      registros.push(reg);
      // tope de memoria: el libro por sesión no crece sin límite
      if (registros.length > 2_000) registros.shift();
      return reg;
    },
    roiPorOperacion() {
      const grupos = new Map<OperacionROI, RegistroROI[]>();
      for (const r of registros) {
        const g = grupos.get(r.operacion) ?? [];
        g.push(r);
        grupos.set(r.operacion, g);
      }
      const out: RoiDeOperacion[] = [];
      for (const [op, rs] of grupos) {
        const tokens = rs.reduce((s, r) => s + r.tokens, 0);
        const llamadas = rs.reduce((s, r) => s + r.llamadas, 0);
        const ganancia = rs.reduce((s, r) => s + (r.scoreDespues - r.scoreAntes), 0);
        const cache = rs.filter((r) => r.deCache).length;
        out.push({
          operacion: op,
          registros: rs.length,
          tokensTotales: tokens,
          llamadasTotales: llamadas,
          gananciaMedia: rs.length ? Math.round((ganancia / rs.length) * 10) / 10 : 0,
          roi: tokens > 0 ? Math.round((ganancia / tokens) * 1000 * 100) / 100 : ganancia > 0 ? Infinity : 0,
          tasaCache: rs.length ? Math.round((cache / rs.length) * 100) : 0,
        });
      }
      return out.sort((a, b) => (b.roi === Infinity ? 1 : b.roi) - (a.roi === Infinity ? 1 : a.roi));
    },
    recomendaciones() {
      const out: RecomendacionAhorro[] = [];
      const porOp = new Map(this.roiPorOperacion().map((r) => [r.operacion, r]));
      const tot = this.totales();

      /* 1 · bucle de mejora con ROI bajo: la 3ª iteración que gana <2 puntos
       * no merece sus tokens → activar salida temprana más agresiva */
      const bucle = porOp.get("bucle-mejora");
      if (bucle && bucle.registros >= 2 && bucle.gananciaMedia < 2) {
        out.push({
          accion: "salida temprana: cortar el bucle con umbral suficiente más bajo",
          evidencia: `bucle-mejora: ${bucle.registros} iteraciones ganando ${bucle.gananciaMedia} puntos de media por ${bucle.tokensTotales} tokens`,
          ahorroTokens: Math.round(bucle.tokensTotales / Math.max(1, bucle.registros) * 0.6),
          prioridad: "alta",
        });
      }

      /* 2 · jueces caros con ganancia nula → panel mínimo */
      const jueces = porOp.get("jueces");
      if (jueces && jueces.gananciaMedia <= 0 && jueces.tokensTotales > 0) {
        out.push({
          accion: "jueces: reducir panel (los jueces 4-5 no cambiaron el resultado)",
          evidencia: `jueces: ${jueces.llamadasTotales} llamadas, ganancia media ${jueces.gananciaMedia}`,
          ahorroTokens: jueces.tokensTotales / 2,
          prioridad: "media",
        });
      }

      /* 3 · parches repetitivos → ya deterministas (control positivo) */
      const det = porOp.get("parche-det");
      if (det && det.registros > 0) {
        out.push({
          accion: "parches deterministas: mantener el enrutador activo",
          evidencia: `${det.registros} corrección(es) mecánica(s) con 0 tokens`,
          ahorroTokens: det.registros * 6_000,
          prioridad: "baja",
        });
      }

      /* 4 · caché fría: si casi nada vino de caché, repetición de peticiones
       * está pagando de más → repasa claves y persistencia del host */
      const tasaCacheGlobal = tot.registros ? tot.deCache / tot.registros : 0;
      if (tot.registros >= 6 && tasaCacheGlobal < 0.1) {
        out.push({
          accion: "caché: tasa de acierto casi nula — revisar persistencia del host",
          evidencia: `${tot.deCache}/${tot.registros} operaciones servidas de caché`,
          ahorroTokens: Math.round(tot.tokens * 0.15),
          prioridad: "media",
        });
      }

      return out.sort((a, b) => b.ahorroTokens - a.ahorroTokens).slice(0, 6);
    },
    totales() {
      const tokens = registros.reduce((s, r) => s + r.tokens, 0);
      const llamadas = registros.reduce((s, r) => s + r.llamadas, 0);
      const ganancia = registros.reduce((s, r) => s + (r.scoreDespues - r.scoreAntes), 0);
      const deCache = registros.filter((r) => r.deCache).length;
      return { tokens, llamadas, ganancia, deCache, registros: registros.length };
    },
    resumen() {
      const t = this.totales();
      const roi = t.tokens > 0 ? Math.round((t.ganancia / t.tokens) * 1000 * 100) / 100 : t.ganancia > 0 ? Infinity : 0;
      return `ROI: ${t.registros} op · ${t.tokens} tok · ${t.llamadas} llamadas · ${t.ganancia > 0 ? "+" : ""}${t.ganancia} puntos → ${roi === Infinity ? "∞" : roi} puntos/1k tok` +
        (t.deCache ? ` · ${t.deCache} de caché` : "");
    },
  };
}

/* ------------------------------ persistencia ------------------------------- */

export function roiAJSON(registros: RegistroROI[]): string {
  return JSON.stringify(registros);
}

export function roiDesdeJSON(s: string): RegistroROI[] {
  try {
    const arr = JSON.parse(s);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (r): r is RegistroROI =>
        r && typeof r.operacion === "string" && typeof r.tokens === "number"
    );
  } catch {
    return [];
  }
}
