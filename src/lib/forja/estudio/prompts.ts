/** FORJA IA — Estudio de diseño: los prompts.
 *
 * Cortos a propósito: tienen que funcionar con modelos gratis. La dirección
 * visual (`promptDireccion`, con sus reglas de contenido y el checklist
 * anti-slop) es la misma que usa el chat, para no tener dos criterios. */

import { promptDireccion, type DireccionVisual } from "../design-directions";
import { tokensCss, urlFuentes } from "./tokens";
import { bloqueSkills, skillsDePantalla } from "./skills";
import type { Pantalla, PantallaPlan, ProyectoDiseno } from "./tipos";

const FORMATO =
  "Entrega UN solo archivo: el documento HTML completo (<!doctype html> … </html>) dentro de UN bloque ```html. CSS dentro de <style>, JS (si hace falta) dentro de <script>. Antes del bloque, como mucho una frase. Nada de explicaciones después.";

function marco(p: ProyectoDiseno): string {
  return p.tipo === "app"
    ? "Es una PANTALLA DE APP MÓVIL: diseñada a 390px de ancho, barra superior propia de la pantalla, contenido en una columna, zonas táctiles de 44px y una barra de navegación inferior fija con las secciones principales de la app. Nada de cabeceras ni pies de página web."
    : "Es una PÁGINA WEB: móvil primero y adaptable hasta escritorio (1280px), con cabecera de navegación y pie coherentes entre páginas.";
}

/** System prompt de cualquier generación de pantalla del proyecto. */
export function promptSistema(p: ProyectoDiseno, d: DireccionVisual, referencias = ""): string {
  const otras = p.pantallas.map((s) => `- ${s.nombre}: ${s.proposito || "—"}`).join("\n");
  return [
    "Eres el diseñador de FORJA Estudio. Diseñas pantallas reales, listas para enseñar a un cliente, que forman UN producto coherente.",
    marco(p),
    "",
    "## Sistema de diseño del proyecto (OBLIGATORIO en todas las pantallas)",
    "Empieza tu <style> con este bloque EXACTO y usa SOLO estas variables para color, tipografía y radios:",
    "```css",
    tokensCss(d),
    "```",
    `Carga las fuentes con: <link rel="stylesheet" href="${urlFuentes(d)}">`,
    "",
    promptDireccion({ direccion: d, origen: "proyecto" }),
    "",
    otras ? `## Pantallas del producto (usa los mismos nombres en la navegación)\n${otras}` : "",
    referencias,
    "",
    "## Formato",
    FORMATO,
  ]
    .filter((l) => l !== "")
    .join("\n");
}

/** Pedido de una pantalla nueva. Lleva las skills de patrón de ESA pantalla
 * (formulario, listado, acceso…): van aquí y no en el system prompt porque
 * cambian de una pantalla a otra y el system prompt es del proyecto. */
export function pedidoPantalla(p: ProyectoDiseno, s: Pick<Pantalla, "nombre" | "proposito" | "skills">): string {
  return [
    `Producto: ${p.brief}`,
    `Diseña la pantalla «${s.nombre}»${s.proposito ? `: ${s.proposito}` : ""}.`,
    "Contenido realista y específico de este producto (nombres, cifras plausibles marcadas como [DATO] si no las conoces).",
    bloqueSkills(skillsDePantalla(s, p.tipo)),
  ]
    .filter(Boolean)
    .join("\n");
}

/** Pedido de un cambio sobre la pantalla actual: cambio quirúrgico, no rehacer. */
export function pedidoIterar(s: Pick<Pantalla, "nombre">, codigoActual: string, cambio: string): string {
  return [
    `Este es el HTML actual de la pantalla «${s.nombre}»:`,
    "```html",
    codigoActual,
    "```",
    `Aplica SOLO este cambio: ${cambio}`,
    "Conserva todo lo demás tal cual (contenido, estructura, sistema de diseño). Devuelve el documento completo actualizado.",
  ].join("\n");
}

/** Pedido de una variante: misma marca, otra composición. */
export function pedidoVariante(p: ProyectoDiseno, s: Pick<Pantalla, "nombre" | "proposito" | "skills">, codigoActual: string): string {
  return [
    pedidoPantalla(p, s),
    "Ya existe una versión (abajo). Diseña una VARIANTE claramente distinta: otra composición, otra jerarquía y otro gesto memorable, con el mismo sistema de diseño y el mismo contenido.",
    "```html",
    codigoActual.slice(0, 12_000),
    "```",
  ].join("\n");
}

/** Pedido de corrección a partir de la crítica. */
export function pedidoCorregir(s: Pick<Pantalla, "nombre">, codigoActual: string, problemas: string[]): string {
  return pedidoIterar(
    s,
    codigoActual,
    `corrige estos problemas detectados por la revisión:\n${problemas.map((x) => `- ${x}`).join("\n")}`
  );
}

/* ------------------------------ plan de pantallas ------------------------------ */

export function promptPlan(brief: string, tipo: ProyectoDiseno["tipo"]): string {
  return [
    `Encargo: ${brief}`,
    tipo === "app"
      ? "Es una app móvil. Propón entre 3 y 6 pantallas clave para enseñar el producto."
      : "Es una web. Propón entre 2 y 5 páginas clave.",
    "Responde SOLO con la lista, una por línea, con este formato exacto:",
    "Nombre de la pantalla | para qué sirve (una frase)",
  ].join("\n");
}

const PLAN_POR_DEFECTO: Record<ProyectoDiseno["tipo"], PantallaPlan[]> = {
  app: [
    { nombre: "Inicio", proposito: "resumen de lo importante y acceso a las acciones principales" },
    { nombre: "Detalle", proposito: "ficha completa de un elemento con su acción principal" },
    { nombre: "Perfil", proposito: "datos del usuario, preferencias y ajustes" },
  ],
  web: [
    { nombre: "Inicio", proposito: "presenta la propuesta de valor y lleva a la acción principal" },
    { nombre: "Contacto", proposito: "formas de contacto y formulario" },
  ],
};

/** Lee la lista del modelo. Tolera viñetas, numeración y «—» en vez de «|». */
export function leerPlan(texto: string, tipo: ProyectoDiseno["tipo"]): PantallaPlan[] {
  const vistos = new Set<string>();
  const out: PantallaPlan[] = [];
  for (const cruda of texto.split("\n")) {
    const linea = cruda
      .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "")
      .replace(/\*\*/g, "")
      .trim();
    if (!linea || linea.startsWith("```")) continue;
    const m = linea.match(/^(.{2,40}?)\s*(?:\||—|–|:|-)\s+(.{3,})$/);
    if (!m) continue;
    const nombre = m[1].trim().replace(/^["«]|["»]$/g, "");
    const clave = nombre.toLowerCase();
    if (!nombre || vistos.has(clave) || /^nombre( de la pantalla)?$/i.test(nombre)) continue;
    vistos.add(clave);
    out.push({ nombre, proposito: m[2].trim().slice(0, 160) });
    if (out.length >= 6) break;
  }
  return out.length ? out : PLAN_POR_DEFECTO[tipo].map((x) => ({ ...x }));
}
