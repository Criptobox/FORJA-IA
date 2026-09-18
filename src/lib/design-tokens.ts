/** Forja IA — Tokens de diseño: la fuente única de verdad del lenguaje visual.
 *
 * Los colores viven aquí como valores concretos y las paletas de acento se
 * reexportan de `lib/prism/accent.ts` (que ya existía y mueve el CSS real).
 * La razón de este módulo no es estética sino medida: un token que no se puede
 * comparar numéricamente no se puede auditar. Por eso aquí viven también las
 * funciones de contraste WCAG — la QA de accesibilidad (unit + Inspector
 * Visual) las usa para juzgar con números, no a ojo.
 *
 * Reglas del módulo:
 *  - Solo datos y funciones puras: cero React, cero DOM, cero "use client".
 *  - Si un valor existe ya en otro sitio (acentos), se reexporta; no se copia.
 *  - Todo lo que exige WCAG está nombrado con su número, para que un fallo de
 *    test apunte al criterio exacto y no a un número mágico suelto.
 */
import { ACCENTS, ACCENT_DEFAULT, type AccentPreset } from "@/lib/prism/accent";

export { ACCENTS, ACCENT_DEFAULT };
export type { AccentPreset };

/* ── Paleta semántica de estado ──────────────────────────────────────────
 * Dos variantes por estado: una para superficie clara, otra para oscura.
 * Los tonos no son arbitrarios: cada variante «texto» supera AA 4.5:1 contra
 * la superficie para la que está pensada (lo comprueban los tests de
 * design-tokens). Son las familias que la app ya usa en sus badges
 * (red-600/red-400, emerald, amber, cyan): aquí queda fijo el matiz exacto. */

export interface ColorSemantico {
  /** id estable: nunca renombrar (lo usan el Inspector y los tests) */
  readonly id: "exito" | "aviso" | "peligro" | "info";
  readonly etiqueta: string;
  /** texto sobre superficie clara (Tailwind ~*-700/600) */
  readonly claro: string;
  /** texto sobre superficie oscura (Tailwind ~*-400) */
  readonly oscuro: string;
}

export const COLORES_SEMANTICOS: readonly ColorSemantico[] = [
  { id: "exito", etiqueta: "Éxito", claro: "#047857", oscuro: "#34d399" },
  { id: "aviso", etiqueta: "Aviso", claro: "#b45309", oscuro: "#fbbf24" },
  { id: "peligro", etiqueta: "Peligro", claro: "#dc2626", oscuro: "#f87171" },
  { id: "info", etiqueta: "Info", claro: "#0e7490", oscuro: "#22d3ee" },
] as const;

/* ── Umbrales WCAG 2.1 (criterio 1.4.3, 1.4.11 y 1.4.6) ─────────────────── */

export const WCAG = {
  /** 1.4.3 AA — texto normal */
  AA_TEXTO: 4.5,
  /** 1.4.3 AA — texto grande (≥24px normal o ≥18.66px negrita) */
  AA_TEXTO_GRANDE: 3,
  /** 1.4.6 AAA — texto normal */
  AAA_TEXTO: 7,
  /** 1.4.6 AAA — texto grande */
  AAA_TEXTO_GRANDE: 4.5,
  /** 1.4.11 AA — componentes de interfaz y elementos gráficos */
  AA_COMPONENTE: 3,
} as const;

/** Superficies de referencia para auditar sin depender del CSS compilado.
 *  Son las que el tema ya pinta: página clara, página oscura y tarjeta. */
export const SUPERFICIES = {
  clara: "#ffffff",
  oscura: "#0a0a0a",
  tarjeta: "#18181b",
} as const;

/* ── Medidas de layout ───────────────────────────────────────────────────── */

/** El suelo de la app: a 320 px todo tiene que caber (lo fija responsive.spec). */
export const ANCHO_MINIMO = 320;

/** Breakpoints Tailwind v4 en px (los del CSS compilado, no los nombres). */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

/** Capas z de la app, de abajo arriba. Documenta el orden de apilamiento
 *  que antes vivía repartido en clases sueltas. */
export const CAPAS_Z = {
  base: 0,
  fijo: 10,
  desplegable: 50,
  hoja: 60,
  dialogo: 70,
  aviso: 80,
} as const;

/* ── Matemática de contraste (WCAG 2.1, definiciones relativas) ─────────── */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** "#rrggbb", "#rgb" o "rgb(r, g, b)" → {r,g,b} 0..255. null si no parsea. */
export function hexARgb(color: string): Rgb | null {
  const c = color.trim().toLowerCase();
  const hex3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(c);
  if (hex3) {
    const [r, g, b] = [1, 2, 3].map((i) => parseInt(hex3[i] + hex3[i], 16));
    return { r, g, b };
  }
  const hex6 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(c);
  if (hex6) {
    const [r, g, b] = [1, 2, 3].map((i) => parseInt(hex6[i], 16));
    return { r, g, b };
  }
  const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)$/.exec(c);
  if (rgb) {
    const [r, g, b] = [1, 2, 3].map((i) => Number(rgb[i]));
    if ([r, g, b].every((v) => v >= 0 && v <= 255)) return { r, g, b };
  }
  return null;
}

/** Componente lineal sRGB → luminancia (WCAG 2.1, fórmula oficial). */
function canalLineal(v8bit: number): number {
  const v = v8bit / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** Luminancia relativa 0..1 (WCAG 2.1). */
export function luminanciaRelativa(color: string): number | null {
  const rgb = hexARgb(color);
  if (!rgb) return null;
  return (
    0.2126 * canalLineal(rgb.r) + 0.7152 * canalLineal(rgb.g) + 0.0722 * canalLineal(rgb.b)
  );
}

/** Ratio de contraste 1..21 (WCAG 2.1). null si algún color no se entiende. */
export function ratioContraste(frente: string, fondo: string): number | null {
  const lf = luminanciaRelativa(frente);
  const lb = luminanciaRelativa(fondo);
  if (lf === null || lb === null) return null;
  const [claro, oscuro] = lf >= lb ? [lf, lb] : [lb, lf];
  return (claro + 0.05) / (oscuro + 0.05);
}

/** ¿Es «texto grande» según WCAG? ≥24px normal, o ≥18.66px en negrita. */
export function esTextoGrande(px: number, negrita: boolean): boolean {
  if (negrita) return px >= 18.66;
  return px >= 24;
}

/** Nivel WCAG alcanzado por un ratio, o "falla" si no llega a AA. */
export function nivelWcag(ratio: number, textoGrande: boolean): "AAA" | "AA" | "falla" {
  const aa = textoGrande ? WCAG.AA_TEXTO_GRANDE : WCAG.AA_TEXTO;
  const aaa = textoGrande ? WCAG.AAA_TEXTO_GRANDE : WCAG.AAA_TEXTO;
  if (ratio >= aaa) return "AAA";
  if (ratio >= aa) return "AA";
  return "falla";
}

/** El mejor texto legible sobre un fondo: negro o blanco, medido y elegido.
 *  Devuelve el hex que MÁS contraste da, no el primero que pasa: sobre un
 *  ámbar medio, blanco «aprueba» 3:1 pero negro da 10:1 — se elige negro. */
export function textoLegibleSobre(fondo: string): "#000000" | "#ffffff" {
  const conNegro = ratioContraste("#000000", fondo) ?? 0;
  const conBlanco = ratioContraste("#ffffff", fondo) ?? 0;
  return conBlanco > conNegro ? "#ffffff" : "#000000";
}

/** Audita una pareja frente/fondo: nivel alcanzado y por qué falla. */
export function auditarContraste(
  frente: string,
  fondo: string,
  px: number,
  negrita: boolean
): { ratio: number; nivel: "AAA" | "AA" | "falla"; textoGrande: boolean } | null {
  const ratio = ratioContraste(frente, fondo);
  if (ratio === null) return null;
  const textoGrande = esTextoGrande(px, negrita);
  return { ratio, nivel: nivelWcag(ratio, textoGrande), textoGrande };
}

/** Cada acento con su texto emparejado y el ratio real, para badges y botones
 *  rellenos. El emparejado es medido: si mañana se añade un acento y ninguno
 *  de los dos negros llega a AA grande 3:1, el test de tokens lo tira. */
export function acentosAuditados(): Array<{
  acento: AccentPreset;
  texto: "#000000" | "#ffffff";
  ratio: number;
  llegaAAComponente: boolean;
}> {
  return ACCENTS.map((acento) => {
    const texto = textoLegibleSobre(acento.hex);
    const ratio = ratioContraste(texto, acento.hex) ?? 1;
    return {
      acento,
      texto,
      ratio,
      llegaAAComponente: ratio >= WCAG.AA_COMPONENTE,
    };
  });
}
