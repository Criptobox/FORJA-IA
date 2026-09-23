/** FORJA IA — CARD SYSTEM moderno (v4.5.0, corrección §7).
 *
 * Las cards dejan de ser «<div class="card">»: 14 variantes semánticas,
 * cada una con COMPORTAMIENTO y PROPÓSITO. Y la disciplina del doc:
 * no abusar de glassmorphism — el sistema debe producir superficies
 * modernas sin depender de blur + gradient + glass + shadow en todas partes.
 *
 * Reglas de la casa: sin red, sin React, TypeScript estricto, nunca lanza.
 */

import type { ExperienciaDna } from "./experience-dna";
import type { RecetaExperiencia } from "./experience-recipes";

/* -------------------------------- tipos ------------------------------------ */

export type VarianteCard =
  | "CARD_STATIC"
  | "CARD_FLOATING"
  | "CARD_MAGNETIC"
  | "CARD_TILT"
  | "CARD_GLASS"
  | "CARD_3D"
  | "CARD_EXPANDABLE"
  | "CARD_HORIZONTAL"
  | "CARD_STACKED"
  | "CARD_SPOTLIGHT"
  | "CARD_INTERACTIVE"
  | "CARD_PRODUCT"
  | "CARD_METRIC"
  | "CARD_MEDIA";

export interface DefCard {
  id: VarianteCard;
  /** qué HACE (no cómo se ve) */
  comportamiento: string;
  /** para qué sirve en la jerarquía del contenido */
  proposito: string;
  /** señales que la sugieren */
  cuando?: RegExp;
  /** CSS de referencia (el doc lo pide explícito por variante) */
  css: string;
}

export const CARDS: ReadonlyArray<DefCard> = [
  {
    id: "CARD_STATIC",
    comportamiento: "no reacciona salvo al foco de teclado",
    proposito: "contenido de referencia que no pide acción",
    css: `.card-static { border-radius: var(--radius-lg); border: 1px solid var(--linea); }`,
  },
  {
    id: "CARD_FLOATING",
    comportamiento: "flota sobre el lienzo con sombra propia y deriva ambiente",
    proposito: "datos y acciones sobre el objeto/escena",
    css: `.card-floating { border-radius: 28px; transform: translateZ(20px); box-shadow: var(--shadow-floating); }`,
  },
  {
    id: "CARD_MAGNETIC",
    comportamiento: "se atrae hacia el puntero dentro de su campo y regresa con easing",
    proposito: "CTA y acciones clave",
    css: `.card-magnetic { transition: transform 300ms var(--ease-out); }`,
  },
  {
    id: "CARD_TILT",
    comportamiento: "inclina en 3D según la posición del puntero (máx 8°)",
    proposito: "piezas visuales que ganan con la perspectiva",
    css: `.card-tilt { transform-style: preserve-3d; perspective: 1000px; }`,
  },
  {
    id: "CARD_GLASS",
    comportamiento: "superficie translúcida con blur SOLO sobre capas con contenido detrás",
    proposito: "UI flotante encima de escena u objeto",
    css: `.card-glass { background: color-mix(in srgb, var(--superficie) 72%, transparent); backdrop-filter: blur(14px); border-radius: 24px; border: 1px solid var(--linea); }`,
  },
  {
    id: "CARD_3D",
    comportamiento: "pieza de la escena con translateZ y reacción al scroll",
    proposito: "objetos dentro del plano espacial",
    css: `.card-3d { transform-style: preserve-3d; transform: translateZ(40px); }`,
  },
  {
    id: "CARD_EXPANDABLE",
    comportamiento: "se expande con detalle real al click/teclado (Enter/Espacio)",
    proposito: "listas que necesitan profundidad sin cambiar de página",
    css: `.card-expandable { cursor: pointer; } .card-expandable[aria-expanded="true"] { border-color: var(--acento); }`,
  },
  {
    id: "CARD_HORIZONTAL",
    comportamiento: "formato ancho: media a un lado, texto al otro",
    proposito: "listados con jerarquía fuerte (noticias, proyectos)",
    css: `.card-horizontal { display: grid; grid-template-columns: 2fr 3fr; gap: 20px; border-radius: 24px; }`,
  },
  {
    id: "CARD_STACKED",
    comportamiento: "pila con profundidad: cada capa translateZ distinta",
    proposito: "mostrar acumulación (planes, versiones, historial)",
    css: `.card-stack { position: relative; } .card-stack > * + * { transform: translateZ(calc(var(--n, 1) * -10px)); }`,
  },
  {
    id: "CARD_SPOTLIGHT",
    comportamiento: "un foco de luz sigue al puntero dentro de la card",
    proposito: "destacar UNA pieza sin saturar el resto",
    css: `.card-spotlight { position: relative; overflow: hidden; } .card-spotlight::after { content: ""; position: absolute; inset: -40%; background: radial-gradient(200px circle at var(--mx, 50%) var(--my, 50%), var(--acento-suave), transparent 60%); opacity: 0; transition: opacity 300ms; } .card-spotlight:hover::after { opacity: 1; }`,
  },
  {
    id: "CARD_INTERACTIVE",
    comportamiento: "toda la card es clicable con estado hover/active/focus visibles",
    proposito: "navegación por contenido (proyectos, artículos)",
    css: `.card-interactive { transition: transform 250ms var(--ease-out), border-color 250ms; } .card-interactive:hover { transform: translateY(-4px); border-color: var(--acento); }`,
  },
  {
    id: "CARD_PRODUCT",
    comportamiento: "ficha con media dominante, precio tabular y acción clara",
    proposito: "e-commerce y catálogos",
    css: `.card-product { border-radius: 20px; } .card-product .precio { font-variant-numeric: tabular-nums; }`,
  },
  {
    id: "CARD_METRIC",
    comportamiento: "número grande tabular + delta con color semántico",
    proposito: "métricas flotantes sobre la escena",
    css: `.card-metric { border-radius: 24px; padding: 20px 24px; } .card-metric .valor { font-variant-numeric: tabular-nums; font-weight: 700; }`,
  },
  {
    id: "CARD_MEDIA",
    comportamiento: "video/imagen con aspect-ratio fijo y reproducción con intención",
    proposito: "demos y showreels",
    css: `.card-media { aspect-ratio: 16/9; object-fit: cover; border-radius: 20px; }`,
  },
];

export function defCard(id: string): DefCard | undefined {
  return CARDS.find((c) => c.id === id);
}

/* ------------------------------- elección ---------------------------------- */

export interface EleccionCards {
  variantes: VarianteCard[];
  /** disciplinas aplicadas (para la traza: por qué NO se eligió glass, etc.) */
  disciplina: string[];
}

/** Elige las variantes para ESTA experiencia. Determinista. Disciplina del
 * doc: glass máximo UNA variante y solo si el ADN pide blur; el resto de
 * superficies se diferencia por elevación/borde/tono, no por más blur. */
export function elegirCards(e: ExperienciaDna, r: RecetaExperiencia, max = 5): EleccionCards {
  const out: VarianteCard[] = [];
  const disciplina: string[] = [];

  if (r.superficies.floatingCards) out.push("CARD_FLOATING");
  if (e.interaction.tilt) out.push("CARD_TILT");
  if (e.interaction.magnetic) out.push("CARD_MAGNETIC");
  if (e.object.use3d || e.spatial.mode === "3d" || e.spatial.mode === "immersive") out.push("CARD_3D");
  if (r.interaccion.projectReveal || r.interaccion.hoverTransform) out.push("CARD_INTERACTIVE");
  if (r.id === "spatial_product" || r.id === "3d_showcase") out.push("CARD_METRIC");
  if (/\b(portfolio|proyectos?|galeria|galer[ií]a|blog|noticias?)\b/i.test(`${r.id} ${r.nombre}`) || r.composicion.reticula === "técnica") out.push("CARD_HORIZONTAL");
  if (e.interaction.expandable) out.push("CARD_EXPANDABLE");
  if (r.objeto.tipo === "escena") out.push("CARD_MEDIA");
  out.push("CARD_STATIC");

  if (e.surface.blur >= 0.4 && out.length < max) {
    out.unshift("CARD_GLASS");
    disciplina.push("glass permitido: el ADN pide blur y hay capas con contenido detrás");
  } else {
    disciplina.push("glass limitado (doc §7): se diferencia por elevación, borde y tono, no por blur en todas partes");
  }

  const uniq = [...new Set(out)];
  return { variantes: uniq.slice(0, Math.max(2, max)), disciplina };
}

/** La CSS de las variantes elegidas, lista para el <style> del Codificador.
 * Determinista (§17): radios, sombras y timing ya coherentes con tokens. */
export function cssCards(variantes: VarianteCard[]): string {
  const bloques = variantes.map((v) => defCard(v)?.css ?? "").filter(Boolean);
  return [`/* Card System (FORJA, ${variantes.length} variantes) */`, ...bloques].join("\n");
}

/** Bloque de texto para prompts. */
export function seccionCards(eleccion: EleccionCards): string {
  const defs = eleccion.variantes.map((v) => {
    const d = defCard(v)!;
    return `- ${v}: ${d.comportamiento} — para ${d.proposito}`;
  });
  return [
    `# CARD SYSTEM (variantes semánticas con comportamiento, corrección §7)`,
    ...defs,
    ...eleccion.disciplina.map((d) => `Disciplina: ${d}`),
  ].join("\n");
}
