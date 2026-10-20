/** FORJA IA — MOTION QA MEDIDO (v4.6.0, idea D del plan).
 *
 * El QA estático v4.5 (§21) cuenta animaciones «en promedio» (¿cuántos
 * @keyframes hay?). El plan §9 exige MÁS: la escala de tiempos POR
 * CATEGORÍA es una regla medible — nada fuera de 150-1600ms salvo
 * ambiente (continuo), stagger presente cuando el plan lo pide y
 * reduced-motion que REALMENTE apague todo.
 *
 * Este módulo PARSEA el CSS del HTML generado (declarations de
 * transition/animation dentro de cada regla), mide cada duración,
 * la clasifica y verifica la escala. Lo que falla, se PARCHEA
 * determinista (append-only, capado, sin tocar contenido):
 *
 *   guard de reduced-motion ausente     → se inyecta
 *   duraciones fuera de escala          → override capado a la escala
 *   stagger pedido y ausente            → utilidad .forja-stagger + script
 *
 * Reglas de la casa: sin red, sin React, TypeScript estricto, nunca lanza.
 */

import type { PlanMovimiento } from "./motion-engine";

/* -------------------------------- tipos ------------------------------------ */

export type CategoriaMovimiento = "microinteraccion" | "componente" | "reveal" | "escena" | "ambiente" | "reduced";

export interface DuracionMedida {
  /** valor en ms (ya normalizado de s → ms) */
  ms: number;
  categoria: CategoriaMovimiento;
  /** la declaración original («transition: transform .4s») */
  declaracion: string;
  /** el selector de la regla donde vive */
  selector: string;
  /** ¿está dentro de la escala §9 para su categoría? */
  dentroEscala: boolean;
  /** es animation infinite → ambiente (exenta) */
  ambiente: boolean;
}

export type ChequeoMovimiento =
  | "escala-tiempos"
  | "reduced-motion-guard"
  | "stagger-ausente"
  | "ambiente-sin-guardia";

export interface HallazgoMovimiento {
  chequeo: ChequeoMovimiento;
  nivel: "info" | "aviso" | "critico";
  evidencia: string;
  /** corrección propuesta (texto para el LLM si no hay parche) */
  correccion: string;
}

export interface InformeMovimiento {
  duraciones: DuracionMedida[];
  totalAnimaciones: number;
  totalTransiciones: number;
  /** nº de animaciones infinite (ambiente continuo) */
  infinitas: number;
  staggerDetectado: boolean;
  /** ¿hay @media (prefers-reduced-motion: reduce) con overrides reales? */
  reducedMotionGuard: boolean;
  hallazgos: HallazgoMovimiento[];
  /** 0..100: proporción de duraciones en escala, penalizada por guardias */
  score: number;
  resumen: string;
}

export interface ParcheMovimiento {
  tipo: "reduced-motion-guard" | "normalizar-duraciones" | "stagger-utilidad";
  evidencia: string;
}

export interface ResultadoParchesMovimiento {
  html: string;
  parches: ParcheMovimiento[];
  sinParche: HallazgoMovimiento[];
  informe: InformeMovimiento;
}

/* -------------------------------- medición ---------------------------------- */

/** Los rangos §9 por categoría (en ms). Ambiente = infinite (exenta). */
const _ESCALA: Record<Exclude<CategoriaMovimiento, "ambiente" | "reduced">, [number, number]> = {
  microinteraccion: [150, 300],
  componente: [250, 600],
  reveal: [500, 1000],
  escena: [800, 1600],
};

/** Tolerancia de frontera (una transición de 320ms entre micro y
 * componente es legal: solapan por diseño del doc §9). */
function dentroDeEscala(ms: number): boolean {
  if (ms >= 150 && ms <= 1600) return true;
  // fuera de escala de verdad: < 120ms (invisible) o > 1700ms (lento)
  return false;
}

function clasificar(ms: number, _esAnimacion: boolean, contextoHover: boolean): CategoriaMovimiento {
  if (contextoHover && ms <= 400) return "microinteraccion";
  if (ms <= 300) return "microinteraccion";
  if (ms <= 600) return "componente";
  if (ms <= 1000) return "reveal";
  return "escena";
}

interface ReglaCss {
  selector: string;
  cuerpo: string;
  /** condición @media si la regla vive dentro de una ("reduce", "no-preference" o "") */
  media: string;
}

/** Extrae reglas `selector { cuerpo }` de los <style> del HTML (y de un
 * CSS suelto), con soporte de UN nivel de anidación @media: las reglas
 * dentro de @media se extraen con su condición en `media`. Sin esto, la
 * guard de reduced-motion y los overrides quedan invisibles para el QA. */
function reglasDe(html: string): ReglaCss[] {
  const out: ReglaCss[] = [];
  const bloques = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1] ?? "");
  const fuentes = bloques.length ? bloques : [html];
  for (const css of fuentes) procesarCss(css, out);
  return out;
}

function procesarCss(css: string, out: ReglaCss[]): void {
  // 1 · bloques @media (un nivel de anidación) → reglas internas con condición
  const sinMedia = css.replace(/@media([^{}]*)\{((?:[^{}]|\{[^{}]*\})*)\}/g, (_m, cond: string, cuerpo: string) => {
    const etiqueta = cond.trim();
    for (const m of cuerpo.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = (m[1] ?? "").trim();
      const c = (m[2] ?? "").trim();
      if (!selector || !c) continue;
      out.push({ selector: selector.slice(0, 80), cuerpo: c, media: etiqueta });
    }
    return ""; // el bloque se procesa: fuera del flujo top-level
  });
  // 2 · reglas top-level (se salta @keyframes: sus % no llevan duración)
  for (const m of sinMedia.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = (m[1] ?? "").trim();
    const cuerpo = (m[2] ?? "").trim();
    if (!cuerpo || !selector || selector.includes("@keyframes") || selector.startsWith("to") || /^\d+%$/.test(selector)) continue;
    out.push({ selector: selector.slice(0, 80), cuerpo, media: "" });
  }
}

/** Mide TODAS las duraciones de transición/animación del HTML.
 * v4.6.1: consciente de los OVERRIDES del propio QA (si un parche ya
 * normalizó `transition-duration` de un selector, la duración EFECTIVA es
 * la del override — la medición refleja el estado real de la página). */
export function medirMovimiento(html: string): InformeMovimiento {
  const h = html || "";
  const reglas = reglasDe(h);
  const duraciones: DuracionMedida[] = [];
  let totalAnimaciones = 0;
  let totalTransiciones = 0;
  let infinitas = 0;

  // overrides declarados por el QA (transition/animation-duration con !important)
  const overrides = new Map<string, { anim?: number; trans?: number }>();
  for (const r of reglas) {
    if (/prefers-reduced-motion\s*:\s*reduce/i.test(r.media)) continue;
    for (const m of r.cuerpo.matchAll(/(animation|transition)-duration\s*:\s*([\d.]+m?s)\s*!important/gi)) {
      const ms = extraerTodasDuraciones(m[2] ?? "")[0];
      if (ms == null) continue;
      const prev = overrides.get(r.selector) ?? {};
      if ((m[1] ?? "").toLowerCase() === "animation") prev.anim = ms;
      else prev.trans = ms;
      overrides.set(r.selector, prev);
    }
  }
  for (const r of reglas) {
    const esReduced = /prefers-reduced-motion\s*:\s*reduce/i.test(r.media);
    const contextoHover = /(:hover|:focus|:active)/i.test(r.selector);
    // animaciones: animation | animation-duration
    for (const m of r.cuerpo.matchAll(/animation(?:-duration)?\s*:\s*([^;]+)/gi)) {
      const decl = (m[0] ?? "").trim();
      const val = (m[1] ?? "").trim();
      if (esReduced) continue; // la guardia reduce a .01ms: no es movimiento real
      const esInfinita = /infinite/i.test(val);
      let dur = extraerPrimeraDuracion(val);
      totalAnimaciones += 1;
      if (esInfinita) infinitas += 1;
      if (dur == null) continue;
      // duración EFECTIVA: si el QA ya normalizó este selector, manda el override
      const ov = overrides.get(r.selector);
      if (ov?.anim != null && ov.anim !== dur) dur = ov.anim;
      duraciones.push({
        ms: dur,
        categoria: esInfinita ? "ambiente" : clasificar(dur, true, contextoHover),
        declaracion: decl.slice(0, 90),
        selector: r.selector.slice(0, 60),
        dentroEscala: esInfinita ? true : dentroDeEscala(dur),
        ambiente: esInfinita,
      });
    }
    // transiciones: transition | transition-duration
    for (const m of r.cuerpo.matchAll(/transition(?:-duration)?\s*:\s*([^;]+)/gi)) {
      const decl = (m[0] ?? "").trim();
      const val = (m[1] ?? "").trim();
      if (esReduced) continue;
      // transition admite varias duraciones (a, b): medir todas
      const durs = extraerTodasDuraciones(val);
      totalTransiciones += 1;
      const ov = overrides.get(r.selector);
      for (const durOrig of durs) {
        const dur = ov?.trans != null && ov.trans !== durOrig ? ov.trans : durOrig;
        duraciones.push({
          ms: dur,
          categoria: clasificar(dur, false, contextoHover),
          declaracion: decl.slice(0, 90),
          selector: r.selector.slice(0, 60),
          dentroEscala: dentroDeEscala(dur),
          ambiente: false,
        });
      }
    }
  }

  // stagger: delays con calc/var o listas de delays (no 0)
  const staggerDetectado = /(?:transition|animation)-delay\s*:[^;]*(?:calc\(|var\(|,\s*\d|(?:\.\d+|[1-9]\d*)m?s)/i.test(h);

  // guard de reduced-motion REAL: media query con overrides de duración
  const guardMatch = /@media[^{]*prefers-reduced-motion\s*:\s*reduce[^{]*\{([\s\S]*?)\n?\}/i.exec(h);
  const guardCuerpo = guardMatch?.[1] ?? "";
  const reducedMotionGuard =
    /prefers-reduced-motion\s*:\s*reduce/i.test(h) &&
    /(animation(?:-duration)?|transition(?:-duration)?)\s*:\s*[^;]*\.0?0?1?m?s|animation\s*:\s*none|transition\s*:\s*none/i.test(guardCuerpo);

  const hallazgos: HallazgoMovimiento[] = [];

  // 1 · escala de tiempos §9
  const fuera = duraciones.filter((d) => !d.dentroEscala);
  if (fuera.length) {
    const muestra = fuera.slice(0, 3).map((d) => `${d.ms}ms (${d.selector})`).join(", ");
    hallazgos.push({
      chequeo: "escala-tiempos",
      nivel: fuera.length > 3 ? "aviso" : "info",
      evidencia: `${fuera.length} duración(es) fuera de la escala §9 (150-1600ms): ${muestra}`,
      correccion: "normalizar a la categoría más cercana (micro 150-300 · componente 250-600 · reveal 500-1000 · escena 800-1600ms)",
    });
  }

  // 2 · guard de reduced-motion real
  const necesitaGuard = infinitas > 0 || duraciones.length > 0;
  if (necesitaGuard && !reducedMotionGuard) {
    hallazgos.push({
      chequeo: "reduced-motion-guard",
      nivel: "critico",
      evidencia: `${infinitas} animación(es) infinite y ${duraciones.length} duración(es) sin @media (prefers-reduced-motion: reduce) que las apague`,
      correccion: "inyectar la guardia: animation/transition a .01ms e iteration-count 1 en reduce",
    });
  }

  // 3 · ambiente sin guardia (redundante con 2 pero clasificado aparte)
  if (infinitas > 0 && !reducedMotionGuard) {
    hallazgos.push({
      chequeo: "ambiente-sin-guardia",
      nivel: "aviso",
      evidencia: `${infinitas} animación(es) ambiente(s) (infinite) sin guardia de reduced-motion`,
      correccion: "la guardia reduce/elimina las ambientales: mismo parche que reduced-motion-guard",
    });
  }

  // score: proporción en escala, con 20 pts de castigo si falta la guardia
  const base = duraciones.length ? duraciones.filter((d) => d.dentroEscala).length / duraciones.length : 1;
  const score = Math.round(Math.max(0, Math.min(1, base - (reducedMotionGuard ? 0 : 0.2))) * 100);

  const resumen = [
    `${totalAnimaciones} animación(es) · ${totalTransiciones} transición(es) · ${infinitas} ambiente(s)`,
    `${duraciones.length - fuera.length}/${duraciones.length || 0} duraciones en escala §9`,
    `stagger ${staggerDetectado ? "presente" : "ausente"} · reduced-motion ${reducedMotionGuard ? "OK" : "FALTA"}`,
    `score ${score}/100`,
  ].join(" · ");

  return {
    duraciones: duraciones.slice(0, 40),
    totalAnimaciones,
    totalTransiciones,
    infinitas,
    staggerDetectado,
    reducedMotionGuard,
    hallazgos,
    score,
    resumen,
  };
}

function extraerPrimeraDuracion(val: string): number | null {
  const durs = extraerTodasDuraciones(val);
  return durs.length ? durs[0] : null;
}

/** Extrae duraciones en ms/s de una declaración (tolera `0.4s`, `400ms`,
 * `.4s`, `2s`). Devuelve ms. Ignora delays? NO: `animation: flota 6s …`
 * — la primera duración es la duración; en `transition: a .4s b 0s`,
 * ambas duraciones cuentan (el delay 0s también se mide, es inofensivo). */
function extraerTodasDuraciones(val: string): number[] {
  const out: number[] = [];
  for (const m of val.matchAll(/(\d*\.?\d+)(m?s)\b/gi)) {
    const n = Number(m[1]);
    if (!Number.isFinite(n)) continue;
    out.push(m[2]?.toLowerCase() === "s" ? Math.round(n * 1000) : Math.round(n));
  }
  return out;
}

/* -------------------------------- parches ----------------------------------- */

const MARCA_CSS_MOTION = "/* FORJA · Motion QA medido (v4.6) */";
const MARCA_JS_MOTION = "/* FORJA · Motion QA: utilidades de stagger (capadas) */";

function inyectarCssMotion(html: string, css: string): string {
  const bloque = `\n<style id="forja-motion-qa">\n${MARCA_CSS_MOTION}\n${css}\n</style>`;
  const re = /<style id="forja-motion-qa">[\s\S]*?<\/style>/i;
  if (re.test(html)) return html.replace(re, bloque);
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${bloque}\n</head>`);
  return `${html}${bloque}`;
}

function inyectarScriptMotion(html: string, js: string): string {
  const bloque = `\n<script id="forja-motion-qa-js">\n${MARCA_JS_MOTION}\n(function(){\n${js}\n})();\n</script>`;
  const re = /<script id="forja-motion-qa-js">[\s\S]*?<\/script>/i;
  if (re.test(html)) return html.replace(re, bloque);
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${bloque}\n</body>`);
  return `${html}${bloque}`;
}

/** La guardia canónica de reduced-motion (la misma que usa el Motion
 * Engine, inyectada como último recurso). */
export function guardReducedMotion(): string {
  return [
    `@media (prefers-reduced-motion: reduce) {`,
    `  *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }`,
    `}`,
  ].join("\n");
}

/** Normaliza UNA duración a la escala §9 (categoría más cercana). */
export function normalizarDuracion(ms: number): number {
  if (ms < 150) return ms < 80 ? 150 : Math.max(150, Math.round(ms / 10) * 10);
  if (ms > 1600) return ms > 4000 ? 900 : 900; // lo lento se lleva a «reveal/escena» sano
  return ms;
}

/** Aplica los parches de movimiento (append-only, capados). v4.6.1: TODO
 * el CSS del parche se ACUMULA y se inyecta UNA vez — inyectar por pasos
 * con el mismo id hacía que el último bloque REEMPLAZARA al anterior
 * (la guard moría cuando llegaban los overrides). */
export function parchesMovimiento(
  html: string,
  informe: InformeMovimiento,
  planMovimiento?: PlanMovimiento
): ResultadoParchesMovimiento {
  let h = html || "";
  const parches: ParcheMovimiento[] = [];
  const pendientes = new Set(informe.hallazgos.map((x) => x.chequeo));
  const cssBloques: string[] = [];
  let jsPendiente = "";

  // 1 · guard de reduced-motion (crítico, el parche más importante)
  if (pendientes.has("reduced-motion-guard") || pendientes.has("ambiente-sin-guardia")) {
    cssBloques.push(guardReducedMotion());
    parches.push({ tipo: "reduced-motion-guard", evidencia: "guardia inyectada: todo animation/transition a .01ms con reduce" });
    pendientes.delete("reduced-motion-guard");
    pendientes.delete("ambiente-sin-guardia");
  }

  // 2 · duraciones fuera de escala → overrides con !important (capado a 8 reglas)
  const fuera = informe.duraciones.filter((d) => !d.dentroEscala && !d.ambiente);
  if (fuera.length && pendientes.has("escala-tiempos")) {
    const vistos = new Set<string>();
    const reglasOverride: string[] = [];
    for (const d of fuera) {
      if (reglasOverride.length >= 8) break;
      const clave = `${d.selector}|${d.declaracion}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      const esAnim = /animation/i.test(d.declaracion);
      const nuevo = normalizarDuracion(d.ms);
      // el override re-declara SOLO la duración, dentro de no-preference
      reglasOverride.push(`  ${d.selector} { ${esAnim ? "animation-duration" : "transition-duration"}: ${nuevo}ms !important; }`);
    }
    if (reglasOverride.length) {
      cssBloques.push(
        [`@media (prefers-reduced-motion: no-preference) {`, ...reglasOverride, `}`].join("\n")
      );
      parches.push({ tipo: "normalizar-duraciones", evidencia: `${reglasOverride.length} duración(es) fuera de la escala §9 normalizadas con overrides capados` });
      pendientes.delete("escala-tiempos");
    }
  }

  // 3 · stagger pedido por el plan y ausente → utilidad + script capado
  const staggerPedido = planMovimiento ? planMovimiento.primitivas.includes("stagger") : false;
  if (staggerPedido && !informe.staggerDetectado && !/forja-stagger/i.test(h)) {
    cssBloques.push([
      `@media (prefers-reduced-motion: no-preference) {`,
      `  .forja-stagger > * { transition-delay: calc(var(--i, 0) * 80ms); animation-delay: calc(var(--i, 0) * 80ms); }`,
      `}`,
    ].join("\n"));
    jsPendiente = [
      `"use strict";`,
      `try {`,
      `  var grupos = document.querySelectorAll("[class*=grid], [class*=cards], [class*=lista], ul");`,
      `  var n = 0;`,
      `  for (var i = 0; i < grupos.length && n < 3; i++) {`,
      `    var hijos = grupos[i].children;`,
      `    if (hijos.length > 1) { grupos[i].classList.add("forja-stagger");`,
      `      for (var j = 0; j < Math.min(hijos.length, 10); j++) hijos[j].style.setProperty("--i", String(j)); n++; }`,
      `  }`,
      `} catch (e) {}`,
    ].join("\n");
    parches.push({ tipo: "stagger-utilidad", evidencia: "stagger pedido por el MOTION PLAN: utilidad .forja-stagger aplicada a máx 3 grupos" });
    pendientes.delete("stagger-ausente");
  }

  // inyección ÚNICA de todo el CSS acumulado (append-only, idempotente)
  if (cssBloques.length) {
    const h2 = inyectarCssMotion(h, cssBloques.join("\n\n"));
    if (h2 !== h) h = h2;
  }
  if (jsPendiente) {
    const h3 = inyectarScriptMotion(h, jsPendiente);
    if (h3 !== h) h = h3;
  }

  // re-medir tras parchear (para el ROI y el registro)
  const informeFinal = medirMovimiento(h);
  return {
    html: h,
    parches,
    sinParche: informe.hallazgos.filter((x) => pendientes.has(x.chequeo)),
    informe: informeFinal,
  };
}

/* ------------------------------- salidas ----------------------------------- */

/** Bloque para la traza/registro: el QA medido en una línea por chequeo. */
export function resumenMovimiento(i: InformeMovimiento): string {
  if (!i.totalAnimaciones && !i.totalTransiciones) return "Motion QA: sin movimiento que medir";
  const partes = [`Motion QA ${i.score}/100`, i.resumen];
  if (i.hallazgos.length) partes.push(`hallazgos: ${i.hallazgos.map((h) => `${h.chequeo}(${h.nivel})`).join(", ")}`);
  return partes.join(" · ");
}

/** Conveniencia: medir + parchear de una pieza (la usa el núcleo). */
export function auditarYparchearMovimiento(html: string, planMovimiento?: PlanMovimiento): ResultadoParchesMovimiento {
  const informe = medirMovimiento(html);
  if (!informe.hallazgos.length) return { html, parches: [], sinParche: [], informe };
  return parchesMovimiento(html, informe, planMovimiento);
}
