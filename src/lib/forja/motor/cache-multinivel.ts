/** FORJA IA — CACHÉ MULTINIVEL (v4.4, sección 24 del plan).
 *
 * ─── El problema ───
 * v4.2 trajo caché por hash para la FICHA y la MAQUETA (cache-fichas.ts,
 * hoy niveles L1/L2 de este sistema). Pero el pipeline repite MUCHO más
 * trabajo pagado: la misma corrección de hover, el mismo resultado de QA
 * sobre el mismo HTML, la misma decisión de ADN para la misma petición…
 * Cada acierto es dinero (o cuota) que no se gasta.
 *
 * ─── La solución ───
 * Los 6 niveles EXACTOS del plan, sobre la misma interfaz mínima de
 * cache-fichas.ts (CacheGeneracion: obtener/guardar/stats):
 *
 *   L1  Respuesta exacta   — la salida cruda de una llamada (por hash de
 *                            system+user+rol+config). La más valiosa.
 *   L2  Ficha de diseño    — la ficha del Diseñador (compat v4.2).
 *   L3  Decisión arquitectónica — el ADN/direcciones para una petición.
 *   L4  Patrón visual      — soluciones conocidas para problemas comunes
 *                            («card sin profundidad» → receta conocida).
 *   L5  Parche             — parches deterministas/LLM ya calculados para
 *                            un defecto concreto (hash del defecto+contexto).
 *   L6  Resultado de QA    — el veredicto del Revisor para un hash de HTML:
 *                            el mismo HTML no se paga dos veces.
 *
 * Regla del plan: «esta card necesita más profundidad» se resuelve con un
 * patrón conocido — no necesita otra generación creativa.
 *
 * Implementación: un LRU por nivel (mismos criterios que cache-fichas:
 * tope de entradas, tope de bytes por valor, stats por nivel con aciertos).
 * La capa persistente del host se enchufa con cacheEnCascada() por nivel.
 *
 * Reglas de la casa: sin red, sin React, TypeScript estricto, nunca lanza.
 */

import { hashTexto, type CacheGeneracion, type CacheStats } from "./cache-fichas";
import { VERSION_FORJA } from "./version";

/* -------------------------------- niveles ---------------------------------- */

export const NIVEL = {
  respuesta: 1,   // L1 exact response
  ficha: 2,       // L2 design sheet
  arquitectura: 3,// L3 architectural decision
  patron: 4,      // L4 visual pattern
  parche: 5,      // L5 patch
  qa: 6,          // L6 qa result
} as const;

export type NivelCache = (typeof NIVEL)[keyof typeof NIVEL];

export const NOMBRES_NIVEL: Record<NivelCache, string> = {
  1: "L1 respuesta",
  2: "L2 ficha",
  3: "L3 arquitectura",
  4: "L4 patrón",
  5: "L5 parche",
  6: "L6 QA",
};

export type StatsNivel = CacheStats & { nivel: NivelCache; nombre: string };

export interface StatsMultinivel {
  niveles: StatsNivel[];
  /** totales agregados */
  aciertos: number;
  escrituras: number;
  /** línea resumen «multinivel: 7 aciertos (L1×2, L6×4…)» */
  resumen(): string;
}

/* ------------------------------- claves ------------------------------------ */

/** Clave L1: la llamada completa (lo que cambiaría el resultado). */
export function claveRespuesta(args: {
  system: string;
  user: string;
  rol?: string;
  temperatura?: number;
  modelo?: string;
}): string {
  return `l1:${hashTexto(
    [VERSION_FORJA, args.rol ?? "-", args.modelo ?? "-", String(args.temperatura ?? "-"), args.system, args.user].join("\u0001")
  )}`;
}

/** Clave L3: decisión de ADN/arquitectura para una petición. */
export function claveArquitectura(mensaje: string, reglas: string[] = []): string {
  return `l3:${hashTexto([VERSION_FORJA, mensaje, ...reglas].join("\u0001"))}`;
}

/** Clave L4: patrón visual conocido (tipo de problema + rasgos). */
export function clavePatron(tipoProblema: string, rasgos: string[] = []): string {
  return `l4:${hashTexto([VERSION_FORJA, tipoProblema, ...rasgos.sort()].join("\u0001"))}`;
}

/** Clave L5: parche para un defecto concreto sobre un contexto dado. */
export function claveParche(tipoDefecto: string, contextoHash: string): string {
  return `l5:${hashTexto([VERSION_FORJA, tipoDefecto, contextoHash].join("\u0001"))}`;
}

/** Clave L6: QA de un HTML concreto (el mismo HTML no paga dos veces). */
export function claveQA(html: string, versionReglas = VERSION_FORJA): string {
  return `l6:${hashTexto([versionReglas, hashTexto(html)].join("\u0001"))}`;
}

/* ------------------------------ construcción ------------------------------- */

/** Crear un LRU para un nivel (misma lógica que crearCacheMemoria, con
 * etiqueta de nivel para stats y trazas). */
function crearLru(nivel: NivelCache, entradas: number, maxBytes: number): CacheGeneracion & { nivel: NivelCache } {
  const mapa = new Map<string, string>();
  const stats = { aciertos: 0, escrituras: 0, expulsiones: 0 };
  return {
    nivel,
    obtener(clave) {
      const v = mapa.get(clave);
      if (v == null) return null;
      mapa.delete(clave);
      mapa.set(clave, v);
      stats.aciertos++;
      return v;
    },
    guardar(clave, valor) {
      if (valor.length > maxBytes) return;
      if (mapa.has(clave)) mapa.delete(clave);
      mapa.set(clave, valor);
      stats.escrituras++;
      while (mapa.size > entradas) {
        const vieja = mapa.keys().next().value;
        if (vieja == null) break;
        mapa.delete(vieja);
        stats.expulsiones++;
      }
    },
    stats() {
      return { nivel, nombre: NOMBRES_NIVEL[nivel], entradas: mapa.size, ...stats };
    },
  };
}

export interface OpcionesMultinivel {
  /** entradas por nivel (defecto: L1 16, L2 8, L3 16, L4 24, L5 48, L6 32) */
  entradas?: Partial<Record<NivelCache, number>>;
  /** tope de bytes por valor (defecto 500.000, igual que cache-fichas) */
  maxBytesValor?: number;
  /** capa persistente opcional por nivel (cacheEnCascada del host) */
  persistentes?: Partial<Record<NivelCache, CacheGeneracion>>;
}

/** La cara pública del cache multinivel. */
export interface CacheMultinivel {
  obtener(nivel: NivelCache, clave: string): string | null;
  guardar(nivel: NivelCache, clave: string, valor: string): void;
  /** azúcar para valores JSON (objetos serializables: ADN, veredictos…) */
  obtenerJSON<T>(nivel: NivelCache, clave: string): T | null;
  guardarJSON(nivel: NivelCache, clave: string, valor: unknown): void;
  stats(): StatsMultinivel;
  /** adapta UN nivel a CacheGeneracion (para hosts que lo inyectan al núcleo) */
  comoCacheGeneracion(nivel: NivelCache): CacheGeneracion;
}

/** El cache multinivel completo. Los niveles son independientes: expulsar
 * en L5 no toca L1. Cada `obtener` primero mira la capa persistente (si la
 * hay) vía cascada, igual que el núcleo v4.2 hace con la ficha. */
export function crearCacheMultinivel(opts: OpcionesMultinivel = {}): CacheMultinivel {
  const entradasDefecto: Record<NivelCache, number> = { 1: 16, 2: 8, 3: 16, 4: 24, 5: 48, 6: 32 };
  const maxBytes = opts.maxBytesValor ?? 500_000;
  const lrus = new Map<NivelCache, CacheGeneracion>();
  for (const n of [1, 2, 3, 4, 5, 6] as NivelCache[]) {
    const base = crearLru(n, opts.entradas?.[n] ?? entradasDefecto[n], maxBytes);
    const persistente = opts.persistentes?.[n];
    lrus.set(n, persistente ? cascadea(persistente, base) : base);
  }

  function de(n: NivelCache): CacheGeneracion {
    return lrus.get(n)!;
  }

  const resultado: CacheMultinivel = {
    obtener(nivel, clave) {
      try {
        return de(nivel).obtener(clave);
      } catch {
        return null;
      }
    },
    guardar(nivel, clave, valor) {
      try {
        de(nivel).guardar(clave, valor);
      } catch {
        /* el caché jamás rompe una generación */
      }
    },
    obtenerJSON<T>(nivel: NivelCache, clave: string): T | null {
      const s = this.obtener(nivel, clave);
      if (s == null) return null;
      try {
        return JSON.parse(s) as T;
      } catch {
        return null;
      }
    },
    guardarJSON(nivel, clave, valor) {
      try {
        this.guardar(nivel, clave, JSON.stringify(valor));
      } catch {
        /* valores no serializables no se cachean */
      }
    },
    stats() {
      const niveles = ([1, 2, 3, 4, 5, 6] as NivelCache[]).map((n) => de(n).stats() as StatsNivel);
      const aciertos = niveles.reduce((s, n) => s + n.aciertos, 0);
      const escrituras = niveles.reduce((s, n) => s + n.escrituras, 0);
      const detalle = niveles
        .filter((n) => n.aciertos > 0)
        .map((n) => `${n.nombre}×${n.aciertos}`)
        .join(", ");
      return {
        niveles,
        aciertos,
        escrituras,
        resumen: () => `multinivel: ${aciertos} acierto(s)` + (detalle ? ` (${detalle})` : ""),
      };
    },
    comoCacheGeneracion(nivel) {
      const d = de(nivel);
      return {
        obtener: (k) => d.obtener(k),
        guardar: (k, v) => d.guardar(k, v),
        stats: () => d.stats(),
      };
    },
  };
  return resultado;
}

/** cascada local (evita importar cacheEnCascada y sus reglas de stats):
 * consulta persistente primero, repuebla el LRU en acierto. */
function cascadea(persistente: CacheGeneracion, base: CacheGeneracion): CacheGeneracion {
  return {
    obtener(clave) {
      const vb = base.obtener(clave);
      if (vb != null) return vb;
      const vp = persistente.obtener(clave);
      if (vp != null) base.guardar(clave, vp);
      return vp;
    },
    guardar(clave, valor) {
      base.guardar(clave, valor);
      persistente.guardar(clave, valor);
    },
    stats() {
      return base.stats();
    },
  };
}

/* ────────────────────── caché COMPARTIDO del proceso ─────────────────── */

/** El L3 (decisión de ADN) y el L4 (patrones) solo rentan ENTRE
 * generaciones: una caché nueva por ejecución no recuerda nada y la
 * «misma petición no paga dos veces» se vuelve mentira. Este compartido
 * vive a nivel de módulo (igual que la salud de proveedores v4.2) y lo
 * usa el núcleo v4.4 por defecto. El persistente del host se inyecta en
 * la PRIMERA llamada (L1/L2 en cascada); luego ya queda montado. */
let compartido: CacheMultinivel | null = null;

export function cacheMultinivelCompartido(persistente?: CacheGeneracion): CacheMultinivel {
  if (!compartido) {
    compartido = crearCacheMultinivel(
      persistente ? { persistentes: { [NIVEL.respuesta]: persistente, [NIVEL.ficha]: persistente } } : {}
    );
  }
  return compartido;
}

/** Para pruebas y para el escape hatch del host: olvida todo el caché
 * compartido (la próxima generación empieza fría). */
export function reiniciarCacheMultinivel(): void {
  compartido = null;
}
