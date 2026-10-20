/** FORJA IA — MOTION ENGINE (v4.5.0, correcciones §8 y §9).
 *
 * ─── §8: el lenguaje de movimiento ───
 * La animación «sutil» es insuficiente. Debe existir un LENGUAJE:
 *
 *   fade · reveal · slide · scale · blur · parallax · magnetic · tilt
 *   float · orbit · morph · stagger · sticky · horizontal-scroll
 *   perspective · scene-transition
 *
 * con intensidades 0-4:
 *
 *   0 static · 1 microinteracción · 2 motion · 3 spatial motion · 4 immersive
 *
 * ─── §9: la regla 200-300ms era demasiado estrecha ───
 * Correcta para microinteracciones, restrictiva como filosofía global.
 * Se separa por CATEGORÍA:
 *
 *   microinteracción 150-300ms · componente 250-600ms · reveal 500-1000ms
 *   escena 800-1600ms · ambiente continuo
 *
 * Y SIEMPRE (sin excepción, en cualquier intensidad):
 *   @media (prefers-reduced-motion: reduce)
 *
 * Reglas de la casa: sin red, sin React, TypeScript estricto, nunca lanza.
 */

import type { ExperienciaDna } from "./experience-dna";
import type { RecetaExperiencia } from "./experience-recipes";

/* ------------------------------ catálogos ---------------------------------- */

export const PRIMITIVAS = [
  "fade",
  "reveal",
  "slide",
  "scale",
  "blur",
  "parallax",
  "magnetic",
  "tilt",
  "float",
  "orbit",
  "morph",
  "stagger",
  "sticky",
  "horizontal-scroll",
  "perspective",
  "scene-transition",
] as const;

export type PrimitivaMovimiento = (typeof PRIMITIVAS)[number];

export type IntensidadMovimiento = 0 | 1 | 2 | 3 | 4;

/** Qué habilita cada intensidad (el doc lo define explícitamente). */
export const CATALOGO_INTENSIDAD: ReadonlyArray<{
  nivel: IntensidadMovimiento;
  nombre: string;
  habilita: string[];
}> = [
  { nivel: 0, nombre: "static", habilita: ["nada se mueve: jerarquía y acabado"] },
  { nivel: 1, nombre: "microinteracción", habilita: ["hover", "focus", "feedback de acción (150-300ms)"] },
  { nivel: 2, nombre: "motion", habilita: ["reveal al scroll", "entradas escalonadas", "transiciones de componente (250-600ms)"] },
  { nivel: 3, nombre: "spatial motion", habilita: ["reveal", "parallax", "floating", "depth", "hover avanzado (500-1000ms)"] },
  { nivel: 4, nombre: "immersive", habilita: ["3D", "camera movement", "scene transitions", "scroll choreography (800-1600ms)"] },
];

/** La escala de tiempos por categoría (§9) — la filosofía global. */
export const ESCALA_TIEMPO: ReadonlyArray<{ categoria: string; rango: string; uso: string }> = [
  { categoria: "microinteracción", rango: "150-300ms", uso: "hover, focus, feedback de botones y enlaces" },
  { categoria: "componente", rango: "250-600ms", uso: "acordeones, modales, tarjetas que cambian de estado" },
  { categoria: "reveal", rango: "500-1000ms", uso: "secciones que entran al hacer scroll, hero que aparece" },
  { categoria: "escena", rango: "800-1600ms", uso: "transiciones entre escenas, coreografía de scroll" },
  { categoria: "ambiente", rango: "continuo", uso: "flotación lenta, rotación sutil, fondo vivo (bajo consumo)" },
];

export function intensidadDesdeFraccion(f: number): IntensidadMovimiento {
  const n = Math.max(0, Math.min(1, Number.isFinite(f) ? f : 0));
  if (n <= 0.02) return 0;
  if (n <= 0.3) return 1;
  if (n <= 0.6) return 2;
  if (n <= 0.85) return 3;
  return 4;
}

/* -------------------------------- plan ------------------------------------- */

export interface PlanMovimiento {
  intensidad: IntensidadMovimiento;
  nombre: string;
  primitivas: PrimitivaMovimiento[];
  /** la escala de tiempos, filtrada a las categorías que aplican */
  tiempos: { categoria: string; rango: string }[];
  /** SIEMPRE true: el plan nunca se entrega sin esta guardia */
  reducedMotion: true;
  /** frases de coreografía concretas para el Codificador */
  coreografia: string[];
}

export function construirPlanMovimiento(e: ExperienciaDna, r: RecetaExperiencia): PlanMovimiento {
  const nivel = intensidadDesdeFraccion(e.motion.intensity);
  const activas = new Set<PrimitivaMovimiento>();

  // base por intensidad (el catálogo manda)
  if (nivel >= 1) ["fade", "scale"].forEach((p) => activas.add(p as PrimitivaMovimiento));
  if (nivel >= 2) ["reveal", "slide", "stagger"].forEach((p) => activas.add(p as PrimitivaMovimiento));
  if (nivel >= 3) ["parallax", "blur", "perspective"].forEach((p) => activas.add(p as PrimitivaMovimiento));
  if (nivel >= 4) ["scene-transition", "orbit"].forEach((p) => activas.add(p as PrimitivaMovimiento));

  // la receta suma las suyas
  if (r.motion.hover) activas.add("fade");
  if (r.motion.parallax) activas.add("parallax");
  if (r.motion.float) activas.add("float");
  if (r.motion.stagger) activas.add("stagger");
  if (r.motion.scrollScenes) activas.add("scene-transition");
  if (e.interaction.magnetic) activas.add("magnetic");
  if (e.interaction.tilt) activas.add("tilt");
  if (e.object.use3d && nivel >= 3) activas.add("perspective");

  // la intensidad manda: nada fuera de su techo (consistencia > decoración)
  const techo: Record<IntensidadMovimiento, number> = { 0: 0, 1: 2, 2: 5, 3: 9, 4: PRIMITIVAS.length };
  const primitivas = [...activas].filter((p) => PRIMITIVAS.indexOf(p) < techo[nivel]).slice(0, techo[nivel]);

  const tiempos = ESCALA_TIEMPO.filter((t) => {
    if (t.categoria === "microinteracción") return nivel >= 1;
    if (t.categoria === "componente") return nivel >= 2;
    if (t.categoria === "reveal") return nivel >= 2;
    if (t.categoria === "escena") return nivel >= 4 || r.motion.scrollScenes;
    return nivel >= 3 || r.motion.float; // ambiente
  }).map((t) => ({ categoria: t.categoria, rango: t.rango }));

  const coreografia: string[] = [];
  if (nivel >= 2) coreografia.push("entrada del hero: título y objeto con stagger de 80ms entre piezas (reveal 600-800ms)");
  if (nivel >= 3 && e.motion.parallax) coreografia.push("capas del plan espacial se desplazan a velocidades distintas (depth px del Spatial Plan)");
  if (r.motion.float) coreografia.push("objeto y cards flotantes: oscilación continua ±6px, 6-8s, ease-in-out");
  if (e.interaction.tilt) coreografia.push("tilt máx 8° en cards y objeto con perspective 1000px");
  if (e.interaction.magnetic) coreografia.push("CTA magnético: atracción ≤ 12px hacia el puntero, retorno elástico 300ms");
  if (nivel >= 4) coreografia.push("transición de escena al cruzar secciones: fade+scale 1000ms con contenido que ancla");
  if (nivel === 0) coreografia.push("nada se mueve salvo estados hover/focus mínimos y feedback de acción");
  coreografia.push("SIEMPRE: @media (prefers-reduced-motion: reduce) desactiva parallax, float, escenas y deja fades ≤ 200ms");

  return {
    intensidad: nivel,
    nombre: CATALOGO_INTENSIDAD[nivel].nombre,
    primitivas,
    tiempos,
    reducedMotion: true,
    coreografia,
  };
}

/* ------------------------------- salidas ----------------------------------- */

export function seccionPlanMovimiento(p: PlanMovimiento): string {
  return [
    `# MOTION PLAN (lenguaje de movimiento con propósito, correcciones §8/§9)`,
    `Intensidad ${p.intensidad}/4 — «${p.nombre}»: ${CATALOGO_INTENSIDAD[p.intensidad].habilita.join(", ")}`,
    `Primitivas activas: ${p.primitivas.join(", ") || "ninguna (estático deliberado)"}`,
    `Tiempos por categoría: ${p.tiempos.map((t) => `${t.categoria} ${t.rango}`).join(" · ")}`,
    `Coreografía:`,
    ...p.coreografia.map((c) => `- ${c}`),
  ].join("\n");
}

/** CSS base determinista del plan (§17): timing + reduced-motion ya hechos.
 * El Codificador lo incluye tal cual y añade lo suyo ENCIMA. */
export function cssMovimiento(p: PlanMovimiento): string {
  const reveal = p.primitivas.includes("reveal");
  const float = p.primitivas.includes("float");
  const parallax = p.primitivas.includes("parallax");
  return [
    `/* Motion base (FORJA Motion Engine, ${p.nombre}) */`,
    `:root { --motion-fast: 180ms; --motion-medium: 420ms; --motion-slow: 900ms; --ease-out: cubic-bezier(.22,.61,.36,1); }`,
    reveal
      ? `@media (prefers-reduced-motion: no-preference) {\n  .reveal { opacity: 0; transform: translateY(24px); transition: opacity var(--motion-slow) var(--ease-out), transform var(--motion-slow) var(--ease-out); }\n  .reveal.visible { opacity: 1; transform: none; }\n  .stagger > * { transition-delay: calc(var(--i, 0) * 80ms); }\n}`
      : "",
    float
      ? `@keyframes forja-float { 0%,100% { transform: translateY(-6px); } 50% { transform: translateY(6px); } }\n@media (prefers-reduced-motion: no-preference) { .flota { animation: forja-float 7s ease-in-out infinite; } }`
      : "",
    parallax
      ? `@media (prefers-reduced-motion: no-preference) { .parallax { will-change: transform; transform: translateY(calc(var(--py, 0) * 1px)); } }`
      : "",
    `@media (prefers-reduced-motion: reduce) {\n  *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }\n}`,
  ]
    .filter(Boolean)
    .join("\n");
}
