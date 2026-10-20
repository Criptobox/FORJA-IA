/** FORJA IA — LEARNING LOOP DEL GENOMA (v4.6.0, idea B del plan).
 *
 * El doc moderno-3D (§26) acaba en LEARNING, pero hasta v4.5 la huella
 * (`HuellaComposicion`) se registraba y NO se re-leía como conocimiento:
 * la anti-repetición penalizaba «lo reciente», nunca recomendaba «lo que
 * ganó». Este módulo cierra el circuito:
 *
 *   generación → huella + métricas + VEREDICTO → memoria aprendida
 *             → RECOMENDACIONES con evidencia (destacar/evitar)
 *             → la próxima selección empieza más lista (0 tokens).
 *
 * Con 20-30 generaciones el sistema sabe que «HERO_SPLIT funcionó para
 * restaurantes (media 91/100, n=5)» y que «HERO_MINIMAL falló para SaaS
 * (media 64/100, n=4)» — y ajusta la elección del hero, la familia y el
 * vocabulario con EVIDENCIA, no con heurística congelada.
 *
 * Estado COMPARTIDO a nivel de proceso (misma disciplina que la caché
 * multinivel v4.4 y el historial anti-repetición v4.5), inyectable y
 * serializable para que el host lo persista.
 *
 * Reglas de la casa: sin red, sin React, TypeScript estricto, nunca lanza.
 */

import type { HuellaComposicion } from "./anti-repetition";

/* -------------------------------- tipos ------------------------------------ */

export type VeredictoAprendizaje = "exito" | "regular" | "fallo";

/** Una entrada del libro de aprendizaje: lo que pasó Y cómo salió. */
export interface EntradaAprendizaje {
  /** cuando terminó la generación (epoch ms) */
  cuando: number;
  /** vertical/negocio detectado (para estadística por vertical) */
  vertical: string;
  /** familia de experiencia usada */
  familia: string;
  /** huella completa de la composición (la misma de anti-repetition) */
  huella: HuellaComposicion;
  /** score determinista final 0..100 (revisor visual) */
  score: number;
  veredicto: VeredictoAprendizaje;
  /** resumen de métricas de experiencia (opcional, para evidencia) */
  metricas?: string;
}

/** Una recomendación con evidencia (la salida del loop). */
export interface RecomendacionAprendida {
  /** dimensión aprendida: familia | hero | card | objeto | motion */
  dimension: string;
  /** valor concreto (HERO_SPLIT, spatial, CARD_FLOATING…) */
  valor: string;
  accion: "destacar" | "evitar";
  /** nº de generaciones con evidencia */
  muestras: number;
  /** score medio 0..100 de esas generaciones */
  scoreMedio: number;
  /** la frase accionable para el prompt */
  evidencia: string;
}

/* ------------------------------ memoria ------------------------------------ */

const TOPE_MEMORIA = 60;
const MIN_MUESTRAS_DEFECTO = 3;

/** Estado global del proceso (renta entre generaciones del mismo proceso). */
let memoria: EntradaAprendizaje[] = [];

/** Registra el resultado de una generación terminada (FIFO con tope). */
export function registrarResultadoAprendizaje(e: EntradaAprendizaje): void {
  try {
    const entrada: EntradaAprendizaje = {
      ...e,
      vertical: (e.vertical || "").slice(0, 80),
      familia: (e.familia || "").slice(0, 40),
      score: Number.isFinite(e.score) ? Math.max(0, Math.min(100, e.score)) : 0,
    };
    memoria = [...memoria.filter((x) => x.cuando !== entrada.cuando), entrada].slice(-TOPE_MEMORIA);
  } catch {
    /* nunca lanza */
  }
}

/** Copia de la memoria actual. */
export function obtenerMemoriaAprendizaje(): EntradaAprendizaje[] {
  return [...memoria];
}

/** Inyecta la memoria persistida por el host (al arrancar). */
export function cargarMemoriaAprendizaje(xs: EntradaAprendizaje[]): void {
  memoria = (Array.isArray(xs) ? xs : []).slice(-TOPE_MEMORIA);
}

/** Reinicia (pruebas / nuevo proyecto). */
export function reiniciarAprendizaje(): void {
  memoria = [];
}

/** Serialización para el host (JSON string). */
export function serializarAprendizaje(): string {
  return JSON.stringify(memoria);
}

/** Deserialización tolerante. */
export function deserializarAprendizaje(s: string | null | undefined): EntradaAprendizaje[] {
  if (!s) return [];
  try {
    const arr = JSON.parse(s);
    return Array.isArray(arr) ? (arr as EntradaAprendizaje[]).slice(-TOPE_MEMORIA) : [];
  } catch {
    return [];
  }
}

/* --------------------------- recomendaciones -------------------------------- */

interface Stat {
  valor: string;
  suma: number;
  n: number;
}

function estadisticas(extraer: (e: EntradaAprendizaje) => string[]): Map<string, Stat> {
  const mapa = new Map<string, Stat>();
  for (const e of memoria) {
    for (const v of extraer(e)) {
      if (!v) continue;
      const st = mapa.get(v) ?? { valor: v, suma: 0, n: 0 };
      st.suma += e.score;
      st.n += 1;
      mapa.set(v, st);
    }
  }
  return mapa;
}

/** Las recomendaciones con evidencia. `minMuestras` (defecto 3) evita
 * aprender de ruido; con menos datos devuelve recomendaciones informativas
 * marcadas con 1-2 muestras SOLO si el contraste es fuerte (≥ 15 puntos). */
export function recomendacionesAprendidas(opts: { minMuestras?: number; max?: number } = {}): RecomendacionAprendida[] {
  const min = Math.max(1, opts.minMuestras ?? MIN_MUESTRAS_DEFECTO);
  const max = opts.max ?? 6;
  if (memoria.length < 2) return [];

  const dims: { dimension: string; extraer: (e: EntradaAprendizaje) => string[] }[] = [
    { dimension: "familia", extraer: (e) => [e.familia] },
    { dimension: "hero", extraer: (e) => [e.huella.hero] },
    { dimension: "card", extraer: (e) => e.huella.cards.slice(0, 3) },
    { dimension: "motion", extraer: (e) => e.huella.motion.slice(0, 4) },
  ];

  const out: RecomendacionAprendida[] = [];
  for (const dim of dims) {
    const stats = [...estadisticas(dim.extraer).values()];
    const validas = stats.filter((s) => s.n >= min);
    if (!validas.length) continue;
    const conMedia = validas.map((s) => ({ ...s, media: s.suma / s.n }));
    const mejor = conMedia.reduce((a, b) => (b.media > a.media ? b : a));
    const peor = conMedia.reduce((a, b) => (b.media < a.media ? b : a));
    if (mejor.media >= 78 && mejor.n >= min) {
      out.push({
        dimension: dim.dimension,
        valor: mejor.valor,
        accion: "destacar",
        muestras: mejor.n,
        scoreMedio: Math.round(mejor.media),
        evidencia: `«${mejor.valor}» ganó ${Math.round(mejor.media)}/100 de media en ${mejor.n} generación(es)`,
      });
    }
    if (peor.media < 72 && peor.valor !== mejor.valor && peor.n >= min && conMedia.length > 1) {
      out.push({
        dimension: dim.dimension,
        valor: peor.valor,
        accion: "evitar",
        muestras: peor.n,
        scoreMedio: Math.round(peor.media),
        evidencia: `«${peor.valor}» quedó en ${Math.round(peor.media)}/100 de media en ${peor.n} generación(es)`,
      });
    }
  }
  // orden estable: destacados primero por scoreMedio, evitados después
  return out
    .sort((a, b) => (a.accion === b.accion ? b.scoreMedio - a.scoreMedio : a.accion === "destacar" ? -1 : 1))
    .slice(0, max);
}

/** Ajustes de puntos para `elegirHero` (hero-engine): +2 destacado con
 * evidencia, -2 evitado. Determinista, 0 tokens. */
export function ajustesHeroAprendidos(minMuestras = 3): Record<string, number> {
  const ajustes: Record<string, number> = {};
  for (const r of recomendacionesAprendidas({ minMuestras, max: 12 })) {
    if (r.dimension !== "hero") continue;
    ajustes[r.valor] = r.accion === "destacar" ? 2 : -2;
  }
  return ajustes;
}

/** Ajustes de puntos para la elección de familia (arena-familias y motor
 * creativo): misma disciplina que el hero. */
export function ajustesFamiliaAprendidos(minMuestras = 3): Record<string, number> {
  const ajustes: Record<string, number> = {};
  for (const r of recomendacionesAprendidas({ minMuestras, max: 12 })) {
    if (r.dimension !== "familia") continue;
    ajustes[r.valor] = r.accion === "destacar" ? 1.5 : -1.5;
  }
  return ajustes;
}

/* ------------------------------- salidas ----------------------------------- */

/** Bloque para prompts: lo que el Genoma aprendió, con evidencia. */
export function seccionAprendizaje(recs: RecomendacionAprendida[]): string {
  if (!recs.length) return "";
  return [
    `# LEARNING LOOP DEL GENOMA (evidencia de tus propias generaciones)`,
    ...recs.map((r) => `- ${r.accion.toUpperCase()} ${r.dimension} «${r.valor}»: ${r.evidencia}.`),
    `Úsalo: lo DESTACADO tiene prioridad en empates; lo EVITADO necesita causa explícita para volver.`,
  ].join("\n");
}

/** Resumen de una línea para la traza. */
export function resumenAprendizaje(recs: RecomendacionAprendida[]): string {
  if (!memoria.length) return "aprendizaje: sin generaciones registradas todavía";
  const d = recomendarPorVertical();
  const base = `aprendizaje: ${memoria.length} generación(es) · ${recs.length} recomendación(es) con evidencia`;
  return d ? `${base} · ${d}` : base;
}

/** La lección por vertical más clara (para el panel): «spatial funcionó
 * para restaurantes: media 91/100, n=5». */
export function recomendarPorVertical(): string {
  if (memoria.length < 2) return "";
  const porVertical = new Map<string, Stat>();
  for (const e of memoria) {
    const clave = (e.vertical || "general").slice(0, 40).toLowerCase();
    const st = porVertical.get(clave) ?? { valor: clave, suma: 0, n: 0 };
    st.suma += e.score;
    st.n += 1;
    porVertical.set(clave, st);
  }
  const mejor = [...porVertical.values()]
    .filter((s) => s.n >= 2)
    .map((s) => ({ ...s, media: s.suma / s.n }))
    .sort((a, b) => b.media - a.media)[0];
  if (!mejor) return "";
  const deMejor = memoria.filter((e) => (e.vertical || "general").slice(0, 40).toLowerCase() === mejor.valor);
  const familiaTop = deMejor.length
    ? deMejor.reduce((acc, e) => { acc[e.familia] = (acc[e.familia] ?? 0) + 1; return acc; }, {} as Record<string, number>)
    : {};
  const familiaGanadora = Object.entries(familiaTop).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  return `mejor vertical: «${mejor.valor}» ${Math.round(mejor.media)}/100 (n=${mejor.n})${familiaGanadora ? ` · familia dominante ${familiaGanadora}` : ""}`;
}
