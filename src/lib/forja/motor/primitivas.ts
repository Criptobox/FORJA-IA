/** FORJA IA — PRIMITIVAS COMPILADAS (v4.6.0, idea A del plan: «el mayor
 * ahorro restante»).
 *
 * Cada primitiva que el modelo re-inventa paga tokens Y QA. Cada primitiva
 * reutilizada sale GRATIS y nace auditada. Esta biblioteca entrega 8
 * BLOQUES LISTOS — FloatingCard/Métrica, TiltCard, MagneticCTA,
 * SpotlightCard, ParallaxLayer, StickyStory, Marquee y RevealGroup — como
 * HTML+CSS completos (y un script CAPADO cuando hace falta), responsive y
 * a11y-auditados de fábrica:
 *
 *   noopener N/A (sin enlaces externos) · reduced-motion SIEMPRE ·
 *   foco visible · aria donde toca · toques ≥ 44px · 0 dependencias.
 *
 * El Codificador SELECCIONA contenido y parametriza; NO re-escribe la
 * mecánica. Es la continuación natural del §17 («determinista lo
 * repetible») y del catálogo §18/§42 del plan.
 *
 * Reglas de la casa: sin red, sin React, TypeScript estricto, nunca lanza.
 */

import type { ExperienciaDna } from "./experience-dna";
import type { RecetaExperiencia } from "./experience-recipes";
import type { HeroElegido } from "./hero-engine";

/* -------------------------------- tipos ------------------------------------ */

export type IdPrimitiva =
  | "REVEAL_GRUPO"
  | "TILT_CARD"
  | "MAGNETIC_CTA"
  | "FLOATING_METRIC"
  | "SPOTLIGHT_CARD"
  | "PARALLAX_LAYER"
  | "STICKY_STORY"
  | "MARQUEE";

export interface DefPrimitiva {
  id: IdPrimitiva;
  nombre: string;
  proposito: string;
  /** señales de petición/ADN que la sugieren */
  cuando?: RegExp;
  /** necesita script capado (pointer/observer) */
  conScript: boolean;
  /** coste aproximado en KB de la primitiva (css+html+js) */
  kb: number;
  /** qué audita el QA gratis porque nació auditada */
  a11y: string[];
}

export const PRIMITIVAS_BLOQUE: ReadonlyArray<DefPrimitiva> = [
  {
    id: "REVEAL_GRUPO",
    nombre: "Reveal con stagger",
    proposito: "grupo de piezas que entra al scroll con retardo escalonado",
    cuando: /\b(entradas?|aparec|reveal|animad|animated|modern|moderno)\b/i,
    conScript: true,
    kb: 1.1,
    a11y: ["solo transforma/opacity (sin layout shift)", "reduced-motion lo muestra directo"],
  },
  {
    id: "TILT_CARD",
    nombre: "Tilt card",
    proposito: "tarjeta que inclina en 3D (máx 8°) siguiendo al puntero",
    cuando: /\b(tilt|3d|interactiv|interactiva|profundidad|perspectiva)\b/i,
    conScript: true,
    kb: 1.3,
    a11y: ["inclinación desactivada con teclado y reduced-motion", "ángulo capado a 8°"],
  },
  {
    id: "MAGNETIC_CTA",
    nombre: "CTA magnético",
    proposito: "botón clave atraído suavemente hacia el puntero (≤12px)",
    cuando: /\b(cta|bot[oó]n|conversi[óo]n|llamada|magnetic|magn[eé]tic|contact)\b/i,
    conScript: true,
    kb: 1.0,
    a11y: ["retorno elástico con easing", "sin movimiento para reduced-motion"],
  },
  {
    id: "FLOATING_METRIC",
    nombre: "Métrica flotante",
    proposito: "tarjeta elevada con número tabular y delta, flota sobre la escena",
    cuando: /\b(m[eé]tric|datos?|n[uú]meros|resultados?|kpi|estad[íi]stic)\b/i,
    conScript: false,
    kb: 0.9,
    a11y: ["números tabulares", "contraste garantizado por tokens"],
  },
  {
    id: "SPOTLIGHT_CARD",
    nombre: "Spotlight card",
    proposito: "foco de luz que sigue al puntero dentro de UNA tarjeta destacada",
    cuando: /\b(destacad|premium|lujo|spotlight|foco|galer[ií]a|producto)\b/i,
    conScript: true,
    kb: 1.0,
    a11y: ["decoración ::after, no interfiere con el contenido", "se apaga sin puntero"],
  },
  {
    id: "PARALLAX_LAYER",
    nombre: "Capa parallax",
    proposito: "capa que se desplaza a velocidad distinta al scroll (profundidad)",
    cuando: /\b(parallax|profundidad|capas|scroll|inmersiv|escena)\b/i,
    conScript: true,
    kb: 0.8,
    a11y: ["transform únicamente (compositor, sin reflow)", "desactivada en reduced-motion"],
  },
  {
    id: "STICKY_STORY",
    nombre: "Sticky storytelling",
    proposito: "sección que se queda fija mientras el contenido avanza (relato)",
    cuando: /\b(historia|story|relato|narrativ|pasos?|proceso|c[óo]mo funciona|recorrido)\b/i,
    conScript: false,
    kb: 0.7,
    a11y: ["flujo normal del documento (sin capturar scroll)", "funciona con teclado"],
  },
  {
    id: "MARQUEE",
    nombre: "Marquee pausable",
    proposito: "banda continua de marcas/valores (logos, catas, ingredientes)",
    cuando: /\b(marcas?|logos?|aliados?|clientes?|ingredientes?|sabores|variedades|marquee|cinta)\b/i,
    conScript: false,
    kb: 0.8,
    a11y: ["pausa al hover/focus", "duplicado con aria-hidden"],
  },
];

export function defPrimitiva(id: string): DefPrimitiva | undefined {
  return PRIMITIVAS_BLOQUE.find((p) => p.id === id);
}

/* ------------------------------- elección ---------------------------------- */

export interface EleccionPrimitivas {
  primitivas: IdPrimitiva[];
  /** disciplina aplicada (por qué NO entraron otras) */
  disciplina: string[];
  /** KB totales estimados del material compilado */
  kbTotales: number;
}

/** Elige las primitivas para ESTA experiencia. Determinista, gratis.
 * Techo por intensidad de movimiento: intensidad 0-1 → 1 primitiva,
 * 2 → 3, 3 → 5, 4 → 6 (la disciplina manda: nada de saturar). */
export function elegirPrimitivas(
  e: ExperienciaDna,
  r: RecetaExperiencia,
  hero: HeroElegido,
  mensaje: string = "",
  max = 6
): EleccionPrimitivas {
  const m = (mensaje || "").toLowerCase();
  const nivel = e.motion.intensity <= 0.02 ? 0 : e.motion.intensity <= 0.3 ? 1 : e.motion.intensity <= 0.6 ? 2 : e.motion.intensity <= 0.85 ? 3 : 4;
  const techo = Math.min(max, nivel === 0 ? 1 : nivel === 1 ? 2 : nivel === 2 ? 3 : nivel === 3 ? 5 : 6);
  const elegidas: IdPrimitiva[] = [];
  const disciplina: string[] = [];

  const entra = (id: IdPrimitiva, _puntos = 0, motivo = ""): boolean => {
    if (elegidas.length >= techo) {
      disciplina.push(`${id} fuera de techo (${techo} por intensidad ${nivel})`);
      return false;
    }
    if (elegidas.includes(id)) return false;
    elegidas.push(id);
    if (motivo) disciplina.push(`${id}: ${motivo}`);
    return true;
  };

  // 1 · señales directas del ADN de interacción/movimiento (las más baratas de decidir)
  if (nivel >= 2) entra("REVEAL_GRUPO", 3, "el motion plan pide entradas escalonadas");
  if (e.interaction.tilt) entra("TILT_CARD", 3, "el ADN pide tilt");
  if (e.interaction.magnetic) entra("MAGNETIC_CTA", 3, "el ADN pide CTA magnético");
  if (e.motion.parallax) entra("PARALLAX_LAYER", 2, "el ADN pide parallax");

  // 2 · señales de la receta y del hero
  if (r.superficies.floatingCards || e.surface.elevation >= 0.6) entra("FLOATING_METRIC", 2, "superficies elevadas de la receta");
  if (hero.tipo === "HERO_SCROLL_REVEAL" || hero.tipo === "HERO_CINEMATIC") entra("STICKY_STORY", 2, "el hero vivía del scroll: el relato continúa");
  if (r.motion.scrollScenes && elegidas.length < techo) entra("STICKY_STORY", 1, "la receta coreografía el scroll");

  // 3 · señales léxicas de la petición
  const porSeñal = (p: DefPrimitiva): boolean => Boolean(p.cuando?.test(m));
  for (const p of PRIMITIVAS_BLOQUE) {
    if (elegidas.length >= techo) break;
    if (porSeñal(p)) entra(p.id, 2, `señal «${p.id.toLowerCase()}» en la petición`);
  }

  // 4 · SPOTLIGHT como comodín de riqueza (una pieza destacada, no todas)
  if (e.interaction.richness >= 0.65 && elegidas.length < techo) entra("SPOTLIGHT_CARD", 1, "riqueza de interacción alta");

  // disciplina del doc: el vidrio y el brillo no son sistema
  if (!elegidas.includes("SPOTLIGHT_CARD")) disciplina.push("spotlight reservado a UNA pieza destacada (no sistema)");

  const kbTotales = Number(elegidas.reduce((s, id) => s + (defPrimitiva(id)?.kb ?? 0), 0).toFixed(1));
  return { primitivas: elegidas, disciplina: disciplina.slice(0, 8), kbTotales };
}

/* --------------------------- CSS compilado --------------------------------- */

const CABECERA_CSS = `/* Primitivas compiladas FORJA (nacen auditadas: reduced-motion + foco + toques ≥44px) */`;
const REDUCED = `@media (prefers-reduced-motion: reduce) {
  .f-pr, .f-pr *, .f-pr *::before, .f-pr *::after { animation: none !important; transition: none !important; }
  .f-reveal { opacity: 1 !important; transform: none !important; }
  .f-parallax { transform: none !important; }
}`;

/** La CSS completa de las primitivas elegidas. Determinista; el Codificador
 * la incluye tal cual (§17). */
export function cssPrimitivas(elegidas: IdPrimitiva[]): string {
  const bloques: string[] = [CABECERA_CSS];

  if (elegidas.includes("REVEAL_GRUPO")) {
    bloques.push(
      `/* Reveal con stagger */`,
      `@media (prefers-reduced-motion: no-preference) {
  .f-reveal { opacity: 0; transform: translateY(22px); transition: opacity var(--motion-slow, 900ms) var(--ease-out, cubic-bezier(.22,.61,.36,1)), transform var(--motion-slow, 900ms) var(--ease-out, cubic-bezier(.22,.61,.36,1)); transition-delay: calc(var(--i, 0) * 80ms); }
  .f-reveal.f-visible { opacity: 1; transform: none; }
}`
    );
  }
  if (elegidas.includes("TILT_CARD")) {
    bloques.push(
      `/* Tilt card (ángulo capado 8°, teclado y reduced-motion quietos) */`,
      `.f-tilt { transform: perspective(1000px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)); transition: transform var(--motion-medium, 420ms) var(--ease-out, cubic-bezier(.22,.61,.36,1)); transform-style: preserve-3d; will-change: transform; }
.f-tilt:hover, .f-tilt:focus-visible { box-shadow: var(--shadow-floating, 0 18px 40px rgba(2,6,23,.2)); }
.f-tilt:focus-visible { outline: 2px solid var(--acento, #6366f1); outline-offset: 3px; }`
    );
  }
  if (elegidas.includes("MAGNETIC_CTA")) {
    bloques.push(
      `/* CTA magnético (atracción ≤ 12px) */`,
      `.f-magnet { display: inline-block; min-height: 44px; padding: 12px 22px; border-radius: var(--radius-md, 14px); border: 0; cursor: pointer;
  background: linear-gradient(135deg, var(--acento, #6366f1), color-mix(in srgb, var(--acento, #6366f1) 72%, black));
  color: var(--background, #fff); font-weight: 600; letter-spacing: .01em;
  transform: translate(var(--mx, 0px), var(--my, 0px)); transition: transform 300ms var(--ease-out, cubic-bezier(.22,.61,.36,1)), box-shadow 300ms; }
.f-magnet:hover { box-shadow: var(--shadow-floating, 0 18px 40px rgba(2,6,23,.2)); }
.f-magnet:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }`
    );
  }
  if (elegidas.includes("FLOATING_METRIC")) {
    bloques.push(
      `/* Métrica flotante */`,
      `@media (prefers-reduced-motion: no-preference) { .f-metric { animation: f-flota 7s ease-in-out infinite; } }
@keyframes f-flota { 0%,100% { transform: translateY(-6px); } 50% { transform: translateY(6px); } }
.f-metric { border-radius: var(--radius-lg, 22px); background: color-mix(in srgb, var(--card, #fff) 88%, transparent);
  border: 1px solid var(--linea, rgba(15,23,42,.12)); box-shadow: var(--surface-floating, var(--shadow-floating, 0 18px 40px rgba(2,6,23,.2)));
  padding: 18px 22px; min-width: 9ch; }
.f-metric .valor { font-variant-numeric: tabular-nums; font-weight: 700; font-size: clamp(1.6rem, 3.4vw, 2.4rem); line-height: 1.05; }
.f-metric .delta { font-variant-numeric: tabular-nums; font-size: .82em; font-weight: 600; }
.f-metric .delta.sube { color: #059669; } .f-metric .delta.baja { color: #dc2626; }`
    );
  }
  if (elegidas.includes("SPOTLIGHT_CARD")) {
    bloques.push(
      `/* Spotlight card (una pieza, no sistema) */`,
      `.f-spotlight { position: relative; overflow: hidden; }
.f-spotlight::after { content: ""; position: absolute; inset: -40%; pointer-events: none;
  background: radial-gradient(220px circle at var(--mx, 50%) var(--my, 50%), color-mix(in srgb, var(--acento, #6366f1) 26%, transparent), transparent 62%);
  opacity: 0; transition: opacity var(--motion-medium, 420ms); }
@media (hover: hover) { .f-spotlight:hover::after { opacity: 1; } }
.f-spotlight > * { position: relative; z-index: 1; }`
    );
  }
  if (elegidas.includes("PARALLAX_LAYER")) {
    bloques.push(
      `/* Capa parallax (solo transform) */`,
      `@media (prefers-reduced-motion: no-preference) {
  .f-parallax { transform: translateY(calc(var(--py, 0) * var(--f-vel, .18))); will-change: transform; }
}`
    );
  }
  if (elegidas.includes("STICKY_STORY")) {
    bloques.push(
      `/* Sticky storytelling (flujo normal, sin capturar scroll) */`,
      `.f-sticky-wrap { display: grid; gap: 24px; }
@media (min-width: 900px) {
  .f-sticky { position: sticky; top: clamp(48px, 12vh, 120px); }
  .f-sticky-paso { min-height: 60vh; display: grid; align-content: center; }
}`
    );
  }
  if (elegidas.includes("MARQUEE")) {
    bloques.push(
      `/* Marquee pausable (hover/focus) */`,
      `.f-marquee { overflow: hidden; mask-image: linear-gradient(90deg, transparent, black 8%, black 92%, transparent); }
.f-marquee-cinta { display: flex; gap: clamp(24px, 4vw, 56px); width: max-content; padding-block: 6px; }
@media (prefers-reduced-motion: no-preference) { .f-marquee-cinta { animation: f-cinta 26s linear infinite; } }
.f-marquee:hover .f-marquee-cinta, .f-marquee:focus-within .f-marquee-cinta { animation-play-state: paused; }
@keyframes f-cinta { to { transform: translateX(-50%); } }
.f-marquee-item { white-space: nowrap; opacity: .78; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; font-size: .85em; }`
    );
  }

  bloques.push(REDUCED);
  return bloques.join("\n");
}

/* --------------------------- HTML paramétrico ------------------------------ */

/** HTML de UNA primitiva con el contenido ya parametrizado. `items` alimenta
 * las piezas repetibles (cards, pasos, marcas). Nunca lanza. */
export function htmlPrimitiva(id: IdPrimitiva, items: string[] = [], titulo = ""): string {
  const xs = items.length ? items.slice(0, 12) : ["Pieza uno", "Pieza dos", "Pieza tres"];
  switch (id) {
    case "REVEAL_GRUPO":
      return `<div class="f-pr f-reveal-grupo">
${xs.map((x, i) => `  <div class="f-pr f-reveal" style="--i:${i}">${x}</div>`).join("\n")}
</div>`;
    case "TILT_CARD":
      return `<article class="f-pr f-tilt" tabindex="0">${xs[0]}</article>`;
    case "MAGNETIC_CTA":
      return `<button class="f-pr f-magnet" type="button">${titulo || xs[0]}</button>`;
    case "FLOATING_METRIC":
      return `<div class="f-pr f-metric" role="group" aria-label="${titulo || "Métrica"}">
  <div class="valor">${xs[0]}</div>
  <div class="delta ${/^-|−|-/.test(xs[1] ?? "") ? "baja" : "sube"}">${xs[1] ?? "+100%"}</div>
</div>`;
    case "SPOTLIGHT_CARD":
      return `<article class="f-pr f-spotlight">${xs[0]}</article>`;
    case "PARALLAX_LAYER":
      return `<div class="f-pr f-parallax" style="--f-vel:.18">${xs[0]}</div>`;
    case "STICKY_STORY":
      return `<section class="f-pr f-sticky-wrap" aria-label="${titulo || "Cómo funciona"}">
  <div class="f-pr f-sticky"><h2>${titulo || "El proceso"}</h2></div>
${xs.map((x) => `  <div class="f-pr f-sticky-paso">${x}</div>`).join("\n")}
</section>`;
    case "MARQUEE":
      return `<div class="f-pr f-marquee" aria-label="${titulo || "Marcas"}">
  <div class="f-marquee-cinta">
${xs.map((x) => `    <span class="f-marquee-item">${x}</span>`).join("\n")}
${xs.map((x) => `    <span class="f-marquee-item" aria-hidden="true">${x}</span>`).join("\n")}
  </div>
</div>`;
    default:
      return "";
  }
}

/* ------------------------- Script capado (opcional) ------------------------ */

const GUARD_JS = `"use strict";
var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var fino = window.matchMedia && window.matchMedia("(hover: none)").matches;`;

/** El script capado de las primitivas que lo necesitan. Un IIFE pequeño,
 * idempotente, con guard de reduced-motion y sin hover en táctil. */
export function scriptPrimitivas(elegidas: IdPrimitiva[]): string {
  const partes: string[] = [];
  if (elegidas.includes("REVEAL_GRUPO")) {
    partes.push(
      `/* Reveal: IntersectionObserver (una vez, capado a 24 nodos) */`,
      `var rev = document.querySelectorAll(".f-reveal");`,
      `if ("IntersectionObserver" in window) {`,
      `  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("f-visible"); io.unobserve(e.target); } }); }, { threshold: .18 });`,
      `  for (var i = 0; i < Math.min(rev.length, 24); i++) io.observe(rev[i]);`,
      `} else { for (var j = 0; j < rev.length; j++) rev[j].classList.add("f-visible"); }`
    );
  }
  if (elegidas.includes("TILT_CARD")) {
    partes.push(
      `/* Tilt: capado a 8°, sin reduced-motion, sin táctil */`,
      `document.querySelectorAll(".f-tilt").forEach(function (el) {`,
      `  el.addEventListener("pointermove", function (ev) {`,
      `    if (reduce || fino) return;`,
      `    var r = el.getBoundingClientRect();`,
      `    var px = (ev.clientX - r.left) / r.width - .5, py = (ev.clientY - r.top) / r.height - .5;`,
      `    el.style.setProperty("--ry", (px * 16).toFixed(2) + "deg");`,
      `    el.style.setProperty("--rx", (-py * 16).toFixed(2) + "deg");`,
      `  });`,
      `  el.addEventListener("pointerleave", function () { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); });`,
      `});`
    );
  }
  if (elegidas.includes("MAGNETIC_CTA")) {
    partes.push(
      `/* Magnético: atracción ≤ 12px */`,
      `document.querySelectorAll(".f-magnet").forEach(function (el) {`,
      `  el.addEventListener("pointermove", function (ev) {`,
      `    if (reduce || fino) return;`,
      `    var r = el.getBoundingClientRect();`,
      `    var dx = (ev.clientX - (r.left + r.width / 2)) / r.width;`,
      `    var dy = (ev.clientY - (r.top + r.height / 2)) / r.height;`,
      `    el.style.setProperty("--mx", (dx * 24 > 12 ? 12 : dx * 24 < -12 ? -12 : (dx * 24).toFixed(1)) + "px");`,
      `    el.style.setProperty("--my", (dy * 18 > 9 ? 9 : dy * 18 < -9 ? -9 : (dy * 18).toFixed(1)) + "px");`,
      `  });`,
      `  el.addEventListener("pointerleave", function () { el.style.setProperty("--mx", "0px"); el.style.setProperty("--my", "0px"); });`,
      `});`
    );
  }
  if (elegidas.includes("SPOTLIGHT_CARD")) {
    partes.push(
      `/* Spotlight: posición del foco */`,
      `document.querySelectorAll(".f-spotlight").forEach(function (el) {`,
      `  el.addEventListener("pointermove", function (ev) {`,
      `    var r = el.getBoundingClientRect();`,
      `    el.style.setProperty("--mx", ((ev.clientX - r.left) / r.width * 100).toFixed(1) + "%");`,
      `    el.style.setProperty("--my", ((ev.clientY - r.top) / r.height * 100).toFixed(1) + "%");`,
      `  });`,
      `});`
    );
  }
  if (elegidas.includes("PARALLAX_LAYER")) {
    partes.push(
      `/* Parallax: rAF-throttled, solo capas visibles (máx 8) */`,
      `var caps = document.querySelectorAll(".f-parallax");`,
      `if (caps.length && !reduce) {`,
      `  var pend = false;`,
      `  var aplicar = function () {`,
      `    pend = false;`,
      `    for (var i = 0; i < Math.min(caps.length, 8); i++) {`,
      `      var r = caps[i].getBoundingClientRect();`,
      `      var rel = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;`,
      `      caps[i].style.setProperty("--py", (rel * -60).toFixed(1));`,
      `    }`,
      `  };`,
      `  window.addEventListener("scroll", function () { if (!pend) { pend = true; requestAnimationFrame(aplicar); } }, { passive: true });`,
      `  aplicar();`,
      `}`
    );
  }
  if (!partes.length) return "";
  return [
    `/* FORJA · scripts de primitivas compiladas (capados, idempotentes) */`,
    `(function () {`,
    GUARD_JS,
    `try {`,
    partes.join("\n"),
    `} catch (e) {}`,
    `})();`,
  ].join("\n");
}

/* ------------------------------ salidas ------------------------------------ */

/** Bloque para prompts: las primitivas DECIDIDAS con su regla dura. */
export function seccionPrimitivas(e: EleccionPrimitivas): string {
  if (!e.primitivas.length) {
    return [
      `# PRIMITIVAS COMPILADAS (biblioteca v4.6)`,
      `Ninguna primitiva elegida: la experiencia es deliberadamente estática. No añadas animación por tu cuenta.`,
    ].join("\n");
  }
  const lineas = [
    `# PRIMITIVAS COMPILADAS (biblioteca v4.6 — usa estas, NO re-inventes)`,
    `El mensaje del usuario lleva la CSS «Primitivas compiladas FORJA» y los scripts capados: INCLUYELOS tal cual.`,
    ...e.primitivas.map((id) => {
      const d = defPrimitiva(id)!;
      return `- ${id} (${d.nombre}): ${d.proposito} · estructura HTML con clase .f-${id.split("_")[0].toLowerCase()}… viaja en el mensaje · a11y: ${d.a11y.join("; ")}`;
    }),
    `Para construir cada pieza usa el HTML de ejemplo del mensaje (htmlPrimitiva): cambia SOLO textos/contenido, nunca la mecánica ni las clases.`,
    `Material compilado: ${e.kbTotales} KB — coste marginal 0 tokens frente a re-inventarlo.`,
    ...e.disciplina.map((d) => `Disciplina: ${d}`),
  ];
  return lineas.join("\n");
}

/** Resumen de una línea para trazas y registro. */
export function resumenPrimitivas(e: EleccionPrimitivas): string {
  return e.primitivas.length ? `primitivas=[${e.primitivas.join(",")}] (${e.kbTotales} KB)` : "primitivas=ninguna";
}
