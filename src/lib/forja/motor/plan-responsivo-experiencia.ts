/** FORJA IA — RESPONSIVE EXPERIENCE PLAN (v4.5.0, corrección §19).
 *
 * Responsive no es solo CSS:
 *
 *   @media (...) { width: 100%; }
 *
 * Una experiencia 3D de desktop puede necesitar convertirse en OTRA
 * composición en móvil. Ejemplo del doc:
 *
 *   Desktop: 3D object + 4 floating cards + parallax
 *   Tablet:  3D object + 2 cards + reduced parallax
 *   Mobile:  product object + 1 card + no camera movement
 *
 * El plan decide por breakpoint: qué se MANTIENE, qué se REDUCE, qué se
 * REORDENA, qué se ELIMINA y qué se TRANSFORMA. Viaja al prompt y el QA
 * de experiencia lo audita.
 *
 * Reglas de la casa: sin red, sin React, TypeScript estricto, nunca lanza.
 */

import type { ExperienciaDna } from "./experience-dna";
import type { RecetaExperiencia } from "./experience-recipes";

/* -------------------------------- tipos ------------------------------------ */

export interface PlanResponsivo {
  desktop: string[];
  tablet: string[];
  movil: string[];
  /** las cinco decisiones del doc, explícitas */
  decisiones: {
    mantiene: string[];
    reduce: string[];
    reordena: string[];
    elimina: string[];
    transforma: string[];
  };
}

export function construirPlanResponsivo(e: ExperienciaDna, r: RecetaExperiencia): PlanResponsivo {
  const capasDesktop = Math.max(2, Math.min(7, r.composicion.capas || e.spatial.layers));
  const capasTablet = Math.max(2, capasDesktop - 1);
  const cardsDesktop = r.superficies.floatingCards ? 4 : 2;
  const cardsTablet = Math.max(1, cardsDesktop - 2);
  const cardsMovil = 1;

  const mantiene: string[] = ["jerarquía del contenido y orden de lectura", "la acción principal visible en la primera pantalla", "contraste y accesibilidad (nunca se negocian)"];
  const reduce: string[] = [];
  const elimina: string[] = [];
  const transforma: string[] = [];
  const reordena: string[] = [];

  // profundidad y movimiento según modo
  if (e.spatial.mode === "3d" || e.spatial.mode === "immersive") {
    reduce.push(`parallax reducido en tablet (${capasTablet} capas) y anulado en móvil`);
    elimina.push("camera movement y scene transitions en móvil (peso + mareo)");
    transforma.push(`el objeto 3D pasa a objeto estático con rotación por gesto en móvil`);
    mantiene.push("el objeto focal (cambia de tratamiento, no desaparece)");
  } else if (e.spatial.mode === "2.5d") {
    reduce.push(`capas de ${capasDesktop} a ${capasTablet} en tablet y a 2 en móvil`);
    elimina.push(e.motion.parallax ? "parallax fuerte en móvil (se mantiene un desplazamiento sutil)" : "nada: sin parallax desde el origen");
    mantiene.push("cards flotantes con elevación (menos deriva ambiente)");
  } else {
    mantiene.push("composición plana coherente en los tres tamaños");
  }

  // cards flotantes
  if (r.superficies.floatingCards) {
    reduce.push(`cards flotantes: ${cardsDesktop} en desktop → ${cardsTablet} en tablet → ${cardsMovil} en móvil`);
    reordena.push("en móvil las cards pasan a flujo vertical bajo el objeto (sin overlap)");
  }

  // tipografía
  if (r.composicion.escalaTipografica === "enorme") {
    transforma.push("tipografía oversized usa clamp() para caer de escala de escena a escala de lectura");
  }

  // navegación
  if (r.navegacion.minimal) {
    mantiene.push("navegación mínima (logo + acción) idéntica en los tres tamaños");
  } else {
    transforma.push("navegación estándar se pliega a menú accesible en móvil");
  }

  // interacción puntero → táctil
  if (e.interaction.tilt || e.interaction.magnetic) {
    transforma.push("tilt/magnetic (puntero) se sustituyen por estados :active y feedback táctil en móvil");
    elimina.push("dependencia de hover para revelar contenido crítico");
  }

  const desktop = [
    `escena completa: ${capasDesktop} capas, parallax activo, ${cardsDesktop} cards flotantes`,
    e.object.use3d ? "objeto 3D con rotación ambiental" : "objeto con flotación sutil",
    "coreografía de scroll completa (si la intensidad lo pide)",
  ];
  const tablet = [`escena ${capasTablet} capas con parallax suave`, `${cardsTablet} cards flotantes`, "mismos breakpoints de tipografía (768px/1024px)"];
  const movil = [
    `escena simplificada a 2 capas, sin parallax`,
    `${cardsMovil} card flotante como máximo`,
    "objetivo táctil ≥ 44px y todo el contenido en flujo vertical legible",
  ];

  return { desktop, tablet, movil, decisiones: { mantiene, reduce, reordena, elimina, transforma } };
}

/* ------------------------------- salidas ----------------------------------- */

export function seccionPlanResponsivo(p: PlanResponsivo): string {
  const lista = (t: string, xs: string[]): string => (xs.length ? `${t}:\n${xs.map((x) => `  - ${x}`).join("\n")}` : `${t}: —`);
  return [
    `# RESPONSIVE EXPERIENCE PLAN (responsive como experiencia, corrección §19)`,
    `Desktop (≥1024px):`,
    ...p.desktop.map((d) => `  - ${d}`),
    `Tablet (768-1023px):`,
    ...p.tablet.map((d) => `  - ${d}`),
    `Móvil (<768px):`,
    ...p.movil.map((d) => `  - ${d}`),
    ``,
    lista("Se MANTIENE", p.decisiones.mantiene),
    lista("Se REDUCE", p.decisiones.reduce),
    lista("Se REORDENA", p.decisiones.reordena),
    lista("Se ELIMINA", p.decisiones.elimina),
    lista("Se TRANSFORMA", p.decisiones.transforma),
  ].join("\n");
}
