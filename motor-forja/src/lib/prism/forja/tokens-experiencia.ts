/** FORJA IA — DESIGN TOKENS de experiencia (v4.5.0, corrección §18).
 *
 * El nuevo lenguaje necesita tokens propios para que las páginas modernas
 * tengan un lenguaje visual COHERENTE (y para que la parte repetible se
 * construya determinista, §17):
 *
 *   --radius-sm … --radius-2xl          (superficies)
 *   --depth-1 … --depth-4               (profundidad / translateZ)
 *   --perspective-low / medium / high   (escena 3D)
 *   --motion-fast / medium / slow       (timing §9)
 *   --shadow-soft / floating / deep     (elevación)
 *   --surface-floating / elevated / contrast
 *
 * Los VALORES se derivan del Experience DNA (determinista, gratis). El
 * bloque viaja al Codificador pegado al :root y el QA comprueba su uso.
 *
 * Reglas de la casa: sin red, sin React, TypeScript estricto, nunca lanza.
 */

import type { ExperienciaDna } from "./experience-dna";

/** Escala de radios por carácter de superficie (doc §18). */
function escalaRadios(radius: string): { sm: string; md: string; lg: string; xl: string; xl2: string } {
  const base = Number.parseInt((radius.match(/(\d+)\s*px/) ?? [])[1] ?? "16", 10) || 16;
  const b = Math.max(4, Math.min(32, base));
  return { sm: `${Math.round(b / 2)}px`, md: `${b}px`, lg: `${Math.round(b * 1.5)}px`, xl: `${Math.round(b * 2)}px`, xl2: `${Math.round(b * 2.5)}px` };
}

/** Profundidad en px por nivel (0..4) según la profundidad pedida. */
function escalaDepth(depth: number): [number, number, number, number] {
  const d = Math.max(0, Math.min(1, depth));
  const max = 24 + d * 76; // 24..100px de translateZ máximo
  return [Math.round(max * 0.25), Math.round(max * 0.5), Math.round(max * 0.75), Math.round(max)];
}

function perspectivaPx(p: number): string {
  const n = Math.max(0, Math.min(1, p));
  if (n < 0.34) return "800px";
  if (n < 0.67) return "1200px";
  return "1800px";
}

/** Las sombras en capas (acabado determinista, disciplina del Diseñador:
 * una difusa grande + una corta densa). */
function sombras(elevation: number): { soft: string; floating: string; deep: string } {
  const e = Math.max(0, Math.min(1, elevation));
  const alfa = (0.08 + e * 0.14).toFixed(2);
  const alfa2 = (0.1 + e * 0.2).toFixed(2);
  return {
    soft: `0 1px 2px rgba(2,6,23,${alfa}), 0 4px 12px rgba(2,6,23,${alfa})`,
    floating: `0 2px 4px rgba(2,6,23,${alfa}), 0 18px 40px rgba(2,6,23,${alfa2})`,
    deep: `0 4px 8px rgba(2,6,23,${alfa2}), 0 32px 64px rgba(2,6,23,${(Number(alfa2) + 0.08).toFixed(2)})`,
  };
}

/** El bloque :root completo de tokens de experiencia. "" si la experiencia
 * es plana y no aporta nada (ahorra tokens en peticiones simples). */
export function tokensExperienciaCss(e: ExperienciaDna): string {
  const r = escalaRadios(e.surface.radius);
  const d = escalaDepth(e.spatial.depth);
  const s = sombras(e.surface.elevation);
  const blur = e.surface.blur > 0.2 ? `\n  --surface-blur: ${Math.round(6 + e.surface.blur * 18)}px;` : "";
  return [
    `/* Design tokens de experiencia (FORJA §18) */`,
    `:root {`,
    `  --radius-sm: ${r.sm}; --radius-md: ${r.md}; --radius-lg: ${r.lg}; --radius-xl: ${r.xl}; --radius-2xl: ${r.xl2};`,
    `  --depth-1: ${d[0]}px; --depth-2: ${d[1]}px; --depth-3: ${d[2]}px; --depth-4: ${d[3]}px;`,
    `  --perspective-low: 800px; --perspective-medium: 1200px; --perspective-high: 1800px;`,
    `  --perspective: ${perspectivaPx(e.spatial.perspective)};`,
    `  --motion-fast: 180ms; --motion-medium: 420ms; --motion-slow: 900ms; --ease-out: cubic-bezier(.22,.61,.36,1);`,
    `  --shadow-soft: ${s.soft};`,
    `  --shadow-floating: ${s.floating};`,
    `  --shadow-deep: ${s.deep};`,
    `  --surface-floating: ${e.surface.elevation >= 0.6 ? "var(--shadow-floating)" : "var(--shadow-soft)"};`,
    `  --surface-elevated: ${e.surface.elevation >= 0.75 ? "var(--shadow-deep)" : "var(--shadow-floating)"};`,
    `  --surface-contrast: ${e.visual.contrast >= 0.7 ? "bordes 1px + elevación" : "bordes 1px"};${blur}`,
    `}`,
  ].join("\n");
}

/** Resumen de una línea para trazas. */
export function resumenTokens(e: ExperienciaDna): string {
  const r = escalaRadios(e.surface.radius);
  const d = escalaDepth(e.spatial.depth);
  return `tokens: radius ${r.sm}…${r.xl2} · depth ${d[0]}…${d[3]}px · sombra ${e.surface.elevation >= 0.6 ? "floating/deep" : "soft"}`;
}
