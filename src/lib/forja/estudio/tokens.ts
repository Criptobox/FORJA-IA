/** FORJA IA — Estudio de diseño: el sistema de diseño como CSS.
 *
 * Todas las pantallas de un proyecto parten del MISMO bloque `:root`. Se le
 * pide al modelo que lo copie tal cual y use solo esas variables; si no lo
 * hace, se inyecta igualmente al guardar (`asegurarTokens`), así la paleta y
 * la tipografía no se pierden entre pantallas. */

import type { DireccionVisual } from "../design-directions";

/** Primer valor de longitud CSS de un texto descriptivo («0px (bordes rectos…)»). */
export function primeraLongitud(texto: string, porDefecto: string): string {
  const m = texto.match(/(\d+(?:\.\d+)?)(px|rem|em)\b/);
  return m ? `${m[1]}${m[2]}` : porDefecto;
}

const GENERICA: Record<"display" | "cuerpo" | "mono", string> = {
  display: "serif",
  cuerpo: "system-ui, sans-serif",
  mono: "ui-monospace, monospace",
};

function familia(nombre: string, generica: string): string {
  return `"${nombre.replace(/"/g, "")}", ${generica}`;
}

/** Bloque `:root { … }` del proyecto. Nombres fijos: el prompt los cita. */
export function tokensCss(d: DireccionVisual): string {
  const p = d.paleta;
  return [
    ":root {",
    `  --color-fondo: ${p.fondo};`,
    `  --color-superficie: ${p.superficie};`,
    `  --color-texto: ${p.texto};`,
    `  --color-texto-suave: ${p.textoSuave};`,
    `  --color-acento: ${p.acento};`,
    `  --color-acento-2: ${p.acento2};`,
    `  --fuente-display: ${familia(d.fuentes.display, GENERICA.display)};`,
    `  --fuente-cuerpo: ${familia(d.fuentes.cuerpo, GENERICA.cuerpo)};`,
    `  --fuente-mono: ${familia(d.fuentes.mono, GENERICA.mono)};`,
    `  --radio: ${primeraLongitud(d.radios, "12px")};`,
    "}",
  ].join("\n");
}

/** URL de Google Fonts con las tres familias de la dirección. */
export function urlFuentes(d: DireccionVisual): string {
  const fam = [d.fuentes.display, d.fuentes.cuerpo, d.fuentes.mono]
    .filter((f, i, a) => f && a.indexOf(f) === i)
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${fam}&display=swap`;
}

/** Marca con la que se reconoce el bloque inyectado (para no duplicarlo). */
export const MARCA_TOKENS = "data-forja-tokens";

/** Si el HTML no declara los tokens del proyecto, se los pone al abrir
 * `<head>` (antes que el CSS del modelo, que así puede redefinirlos). */
export function asegurarTokens(html: string, d: DireccionVisual): string {
  if (html.includes("--color-acento:") || html.includes(MARCA_TOKENS)) return html;
  const bloque =
    `<link rel="stylesheet" href="${urlFuentes(d)}">` +
    `<style ${MARCA_TOKENS}>${tokensCss(d)}\nbody{background:var(--color-fondo);color:var(--color-texto);font-family:var(--fuente-cuerpo)}</style>`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (h) => h + bloque);
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (h) => `${h}<head>${bloque}</head>`);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${bloque}</head><body>${html}</body></html>`;
}
