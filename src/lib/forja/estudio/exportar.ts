/** FORJA IA — Estudio de diseño: descargar el proyecto.
 *
 * Un ZIP que se abre con doble clic: `index.html` con el índice de pantallas
 * (enlaces), cada pantalla autónoma en `pantallas/`, y el sistema de diseño
 * (`DESIGN.md` + `tokens.css`) para pasarlo a quien lo vaya a programar. */

import { aDesignMd } from "../design-directions";
import { encodeText } from "../sandbox";
import { writeZip } from "../zip";
import { htmlDeVersion } from "./html";
import { direccionDe, slug, versionActual } from "./proyecto";
import { tokensCss } from "./tokens";
import type { ProyectoDiseno } from "./tipos";

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}

/** Nombre de archivo de cada pantalla, en orden y sin colisiones. */
export function rutasPantallas(p: ProyectoDiseno): Map<string, string> {
  const usadas = new Set<string>();
  const out = new Map<string, string>();
  p.pantallas.forEach((s, i) => {
    let base = `${String(i + 1).padStart(2, "0")}-${slug(s.nombre)}`;
    while (usadas.has(base)) base += "-b";
    usadas.add(base);
    out.set(s.id, `pantallas/${base}.html`);
  });
  return out;
}

export function indiceHtml(p: ProyectoDiseno, rutas: Map<string, string>): string {
  const d = direccionDe(p);
  const items = p.pantallas
    .filter((s) => versionActual(s))
    .map((s) => `<li><a href="${rutas.get(s.id)}">${esc(s.nombre)}</a><span>${esc(s.proposito)}</span></li>`)
    .join("\n");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.nombre)}</title>
<style>${tokensCss(d)}
body{margin:0;padding:48px 24px;background:var(--color-fondo);color:var(--color-texto);font-family:var(--fuente-cuerpo)}
main{max-width:720px;margin:auto}h1{font-family:var(--fuente-display);font-size:2.2rem;margin:0 0 .3em}
p{color:var(--color-texto-suave)}ul{list-style:none;padding:0}li{padding:14px 0;border-bottom:1px solid color-mix(in oklch,var(--color-texto) 15%,transparent)}
a{color:var(--color-acento);font-weight:600;text-decoration:none;font-size:1.1rem}span{display:block;color:var(--color-texto-suave);font-size:.95rem;margin-top:2px}</style></head>
<body><main><h1>${esc(p.nombre)}</h1><p>${esc(p.brief)}</p><p>Dirección visual: ${esc(d.nombre)} · ${p.pantallas.length} pantallas · hecho con FORJA Estudio</p><ul>
${items}
</ul></main></body></html>`;
}

/** ZIP del proyecto completo (solo pantallas que ya tienen una versión). */
export function zipProyecto(p: ProyectoDiseno): Uint8Array {
  const d = direccionDe(p);
  const rutas = rutasPantallas(p);
  const files: { path: string; data: Uint8Array }[] = [
    { path: "index.html", data: encodeText(indiceHtml(p, rutas)) },
    { path: "DESIGN.md", data: encodeText(aDesignMd(d, p.nombre)) },
    { path: "tokens.css", data: encodeText(tokensCss(d) + "\n") },
  ];
  for (const s of p.pantallas) {
    const v = versionActual(s);
    if (!v) continue;
    files.push({ path: rutas.get(s.id) as string, data: encodeText(htmlDeVersion(v, d)) });
  }
  return writeZip(files);
}
