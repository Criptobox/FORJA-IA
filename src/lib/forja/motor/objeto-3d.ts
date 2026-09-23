/** FORJA IA — OBJETO 3D CSS PARAMÉTRICO (v4.6.0, idea C del plan).
 *
 * El doc moderno-3D (§29) pide «central 3D object» en el hero. Hasta v4.5
 * el objeto lo dibujaba el MODELO — y variaba en calidad: a veces salía un
 * cubo roto, a veces no salía nada. Este módulo FORJA el objeto nosotros:
 *
 *   8 formas paramétricas (monolito, orbe, capas flotantes, tarjeta
 *   doblada, anillo, torre, cubo, constelación) en HTML+CSS 3D puro,
 *   sin three.js, ~2 KB cada una, ELEGIDAS por el Spatial Engine y
 *   animadas con los tokens del Motion Engine.
 *
 * Por qué: un objeto propio sale SIEMPRE bien (nace auditado), refuerza
 * «3D CSS, 0 librerías» (§10/§20: el 90% del efecto, 0 KB) y le da a la
 * página ese «central 3D object» que distingue una web premium de una
 * plantilla — incluso para un vertical sin señales (la panadería del
 * usuario ya merece un objeto forjado, no un hero de degradado).
 *
 * Reglas de la casa: sin red, sin React, TypeScript estricto, nunca lanza.
 * Todo el HTML es decorativo (aria-hidden) y respeta reduced-motion.
 */

import type { ExperienciaDna } from "./experience-dna";
import type { FamiliaExperiencia } from "./familias-experiencia";

/* -------------------------------- tipos ------------------------------------ */

export type Forma3d =
  | "MONOLITO"
  | "ORBE"
  | "CAPAS_FLOTANTES"
  | "TARJETA_DOBLADA"
  | "ANILLO_ORBITAL"
  | "TORRE_ISOMETRICA"
  | "CUBO_GIRATORIO"
  | "CONSTELACION";

export interface DefObjeto3d {
  id: Forma3d;
  nombre: string;
  descripcion: string;
  /** familias donde encaja de forma natural */
  familias: FamiliaExperiencia[];
  /** señales de petición que lo refuerzan */
  cuando?: RegExp;
  /** qué transmite (para el prompt y la traza) */
  transmite: string;
}

const DEFS: ReadonlyArray<DefObjeto3d> = [
  {
    id: "MONOLITO",
    nombre: "Monolito",
    descripcion: "losa vertical giratoria con caras en degradado y arista luminosa",
    familias: ["spatial", "3d-showcase", "immersive", "minimal"],
    cuando: /\b(sólid|solid|roca|monolit|arquitectura|bloque|ladrill|pan|masa|horno|ceramic|cerám)\b/i,
    transmite: "peso y solidez: la marca es una presencia física",
  },
  {
    id: "ORBE",
    nombre: "Orbe",
    descripcion: "esfera luminosa con núcleo brillante y anillo orbital",
    familias: ["product", "interactive", "spatial", "cinematic"],
    cuando: /\b(ia|ai|inteligencia|datos?|nube|cloud|global|planeta|energ[ií]a|futurist|futurista)\b/i,
    transmite: "energía viva y continuidad: el sistema respira",
  },
  {
    id: "CAPAS_FLOTANTES",
    nombre: "Capas flotantes",
    descripcion: "planos apilados a distintas profundidades que respiran en desfase",
    familias: ["spatial", "product", "modular", "dashboard"],
    cuando: /\b(capas|layers|apilad|profundidad|secciones|organiza|estructura|panader[íi]a|carta|men[uú])\b/i,
    transmite: "jerarquía legible: cada capa explica una parte",
  },
  {
    id: "TARJETA_DOBLADA",
    nombre: "Tarjeta doblada",
    descripcion: "tarjeta doblada en dos planos como página de papel flotante",
    familias: ["editorial", "product", "minimal", "modular"],
    cuando: /\b(carta|men[uú]|dobl|papel|p[aá]gina|recet|noticia|revista|libro|historia)\b/i,
    transmite: "contenido tangible: lo digital con manos de papel",
  },
  {
    id: "ANILLO_ORBITAL",
    nombre: "Anillo orbital",
    descripcion: "anillo inclinado con satélite que orbita alrededor de un núcleo",
    familias: ["product", "interactive", "cinematic", "3d-showcase"],
    cuando: /\b([oó]rbita|anillo|ciclo|proceso|flujo|paso a paso|entrega|env[íi]o|ruta)\b/i,
    transmite: "proceso continuo: todo gira alrededor del cliente",
  },
  {
    id: "TORRE_ISOMETRICA",
    nombre: "Torre isométrica",
    descripcion: "tres losas apiladas en vista isométrica con brillo superior",
    familias: ["dashboard", "modular", "spatial", "product"],
    cuando: /\b(dashboard|panel|m[eé]tric|datos?|informe|estad[íi]stic|crecimient|escala|niveles)\b/i,
    transmite: "acumulación ordenada: nivel sobre nivel",
  },
  {
    id: "CUBO_GIRATORIO",
    nombre: "Cubo giratorio",
    descripcion: "cubo con tres caras visibles en rotación lenta y continua",
    familias: ["3d-showcase", "interactive", "modular", "immersive"],
    cuando: /\b(cubo|3d|rotar|girar|girator|giro|bloque|volumen)\b/i,
    transmite: "exploración: se puede mirar desde todos los lados",
  },
  {
    id: "CONSTELACION",
    nombre: "Constelación",
    descripcion: "piezas pequeñas dispersas a distintas profundidades que titilan",
    familias: ["immersive", "cinematic", "interactive", "minimal"],
    cuando: /\b(constelaci|red|comunidad|redes|conexi[óo]n|part[íi]cula|galer[ií]a|coleccion|variedad|sabores)\b/i,
    transmite: "diversidad con unidad: muchas piezas, un sistema",
  },
];

export function defObjeto3d(id: string): DefObjeto3d | undefined {
  return DEFS.find((d) => d.id === id);
}

export function catalogoObjetos3d(): DefObjeto3d[] {
  return [...DEFS];
}

/** El objeto elegido: forma + HTML + CSS completos, listos para el hero. */
export interface ObjetoElegido {
  id: Forma3d;
  nombre: string;
  descripcion: string;
  transmite: string;
  motivo: string;
  /** los que quedaron como plan B (la Arena puede explorarlos) */
  alternativas: Forma3d[];
  /** HTML completo (decorativo: aria-hidden="true") */
  html: string;
  /** CSS completo con tokens, responsive y reduced-motion ya resueltos */
  css: string;
}

/* ------------------------------- elección ---------------------------------- */

/** Elige la forma del objeto 3D. Orden de decisión:
 * 1. coincidencia de familia del Spatial/motor creativo;
 * 2. señales léxicas de la petición;
 * 3. profundidad y peso del objeto en el ADN;
 * 4. penalización por repetición (doc §13: rotar vocabulario);
 * 5. desempate estable por orden del catálogo. */
export function elegirObjeto3d(
  e: ExperienciaDna,
  familia: FamiliaExperiencia,
  mensaje: string = "",
  historial: string[] = []
): ObjetoElegido {
  const m = (mensaje || "").toLowerCase();
  const puntuados = DEFS.map((d, i) => {
    let puntos = 0;
    if (d.familias.includes(familia)) puntos += 3;
    if (d.cuando?.test(m)) puntos += 2.5;
    // el ADN decide el peso del objeto en la escena
    if (e.object.use3d && (d.id === "MONOLITO" || d.id === "CUBO_GIRATORIO" || d.id === "ORBE")) puntos += 1;
    if (e.spatial.depth >= 0.7 && (d.id === "CAPAS_FLOTANTES" || d.id === "TORRE_ISOMETRICA" || d.id === "CONSTELACION")) puntos += 0.5;
    if (e.surface.elevation >= 0.6 && (d.id === "ORBE" || d.id === "ANILLO_ORBITAL")) puntos += 0.5;
    // anti-repetición: usado en los últimos 2 objetos → penaliza FUERTE
    // (doc §13: la rotación del vocabulario es obligatoria, no opcional)
    const recientes = historial.slice(-2);
    puntos -= recientes.filter((h) => h === d.id).length * 5;
    return { d, puntos, i };
  });
  puntuados.sort((a, b) => b.puntos - a.puntos || a.i - b.i);
  const ganador = puntuados[0];
  const alternativas = puntuados.slice(1, 3).map((p) => p.d.id);
  const motivo = [
    `familia ${familia} → objeto natural de la familia`,
    ganador.d.cuando?.test(m) ? "señal léxica de la petición" : "",
    `transmite: ${ganador.d.transmite.toLowerCase()}`,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    id: ganador.d.id,
    nombre: ganador.d.nombre,
    descripcion: ganador.d.descripcion,
    transmite: ganador.d.transmite,
    motivo,
    alternativas,
    html: htmlObjeto3d(ganador.d.id),
    css: cssObjeto3d(ganador.d.id),
  };
}

/* ------------------------------ HTML/CSS ----------------------------------- */

/** Colores comunes: el objeto hereda el acento del design system si existe
 * (var con fallback) y usa los tokens de profundidad del Motion/Spatial. */
const BASE_CSS = `/* Objeto 3D forjado por FORJA (0 librerías, ~2 KB) */
.f3d { --f3d-a: var(--acento, #6366f1); --f3d-a2: var(--acento-suave, color-mix(in srgb, var(--f3d-a) 55%, white)); --f3d-tinta: var(--foreground, #0f172a);
  position: relative; width: min(var(--f3d-tam, 320px), 88vw); aspect-ratio: 1 / 1; margin-inline: auto;
  perspective: var(--perspective, 1200px); display: grid; place-items: center; pointer-events: none; }
.f3d *, .f3d *::before, .f3d *::after { transform-style: preserve-3d; }
@media (prefers-reduced-motion: no-preference) {
  .f3d .f3d-flota { animation: f3d-flota 7s ease-in-out infinite; animation-delay: calc(var(--i, 0) * .45s); }
}
@keyframes f3d-flota { 0%,100% { transform: translateY(-7px); } 50% { transform: translateY(7px); } }`;

const REDUCED_GUARD = `@media (prefers-reduced-motion: reduce) {
  .f3d *, .f3d *::before, .f3d *::after { animation: none !important; transition: none !important; }
  .f3d { transform: none !important; }
}`;

function envolverHtml(interior: string, etiqueta: string): string {
  return `<!-- Objeto 3D FORJA · ${etiqueta} — decorativo, 0 JS, 0 librerías -->
<div class="f3d" role="presentation" aria-hidden="true">${interior}</div>`;
}

/** HTML paramétrico de cada forma (estructura fija; el color viaja por CSS). */
export function htmlObjeto3d(id: Forma3d): string {
  switch (id) {
    case "MONOLITO":
      return envolverHtml(
        `<div class="f3d-flota f3d-mono">
  <div class="f3d-mono-cara f3d-mono-frontal"></div>
  <div class="f3d-mono-cara f3d-mono-lateral"></div>
  <div class="f3d-mono-cara f3d-mono-top"></div>
</div>`,
        "monolito"
      );
    case "ORBE":
      return envolverHtml(
        `<div class="f3d-flota f3d-orbe-wrap">
  <div class="f3d-orbe"></div>
  <div class="f3d-orbe-anillo"></div>
  <div class="f3d-orbe-satelita"></div>
</div>`,
        "orbe"
      );
    case "CAPAS_FLOTANTES":
      return envolverHtml(
        `<div class="f3d-capas">
  <div class="f3d-capa f3d-flota" style="--i:0"></div>
  <div class="f3d-capa f3d-flota" style="--i:1"></div>
  <div class="f3d-capa f3d-flota" style="--i:2"></div>
  <div class="f3d-capa f3d-capa-top f3d-flota" style="--i:3"></div>
</div>`,
        "capas flotantes"
      );
    case "TARJETA_DOBLADA":
      return envolverHtml(
        `<div class="f3d-flota f3d-tarj">
  <div class="f3d-tarj-mitad f3d-tarj-izq"><span class="f3d-tarj-linea"></span><span class="f3d-tarj-linea"></span><span class="f3d-tarj-linea"></span></div>
  <div class="f3d-tarj-mitad f3d-tarj-der"><span class="f3d-tarj-linea"></span><span class="f3d-tarj-linea"></span></div>
</div>`,
        "tarjeta doblada"
      );
    case "ANILLO_ORBITAL":
      return envolverHtml(
        `<div class="f3d-anillo-wrap">
  <div class="f3d-anillo"></div>
  <div class="f3d-anillo-nucleo"></div>
  <div class="f3d-anillo-satelita"></div>
</div>`,
        "anillo orbital"
      );
    case "TORRE_ISOMETRICA":
      return envolverHtml(
        `<div class="f3d-torre">
  <div class="f3d-losa f3d-flota" style="--i:0"></div>
  <div class="f3d-losa f3d-flota" style="--i:1"></div>
  <div class="f3d-losa f3d-losa-top f3d-flota" style="--i:2"></div>
</div>`,
        "torre isométrica"
      );
    case "CUBO_GIRATORIO":
      return envolverHtml(
        `<div class="f3d-cubo">
  <div class="f3d-cubo-cara f3d-cubo-top"></div>
  <div class="f3d-cubo-cara f3d-cubo-frontal"></div>
  <div class="f3d-cubo-cara f3d-cubo-lateral"></div>
</div>`,
        "cubo giratorio"
      );
    case "CONSTELACION":
      return envolverHtml(
        `<div class="f3d-cons">
  <div class="f3d-cons-pieza f3d-flota" style="--i:0"></div>
  <div class="f3d-cons-pieza f3d-flota" style="--i:1"></div>
  <div class="f3d-cons-pieza f3d-flota" style="--i:2"></div>
  <div class="f3d-cons-pieza f3d-cons-mayor f3d-flota" style="--i:3"></div>
  <div class="f3d-cons-punto" style="--i:0"></div>
  <div class="f3d-cons-punto" style="--i:1"></div>
  <div class="f3d-cons-punto" style="--i:2"></div>
</div>`,
        "constelación"
      );
    default:
      return "";
  }
}

/** CSS completo de cada forma: usa los tokens de experiencia si existen
 * (--depth-*, --perspective, --motion-*) con valores de respaldo propios.
 * NUNCA depende de JS: la rotación es animation, la profundidad translateZ. */
export function cssObjeto3d(id: Forma3d): string {
  const formas: Record<Forma3d, string> = {
    MONOLITO: `.f3d-mono { width: 34%; height: 62%; position: relative; transform: rotateX(-8deg) rotateY(26deg); }
@media (prefers-reduced-motion: no-preference) { .f3d-mono { animation: f3d-giro 14s ease-in-out infinite; } }
@keyframes f3d-giro { 0%,100% { transform: rotateX(-8deg) rotateY(14deg); } 50% { transform: rotateX(-8deg) rotateY(38deg); } }
.f3d-mono-cara { position: absolute; inset: 0; border-radius: 10px; }
.f3d-mono-frontal { background: linear-gradient(160deg, color-mix(in srgb, var(--f3d-a) 82%, black) 0%, var(--f3d-a) 58%, var(--f3d-a2) 100%); box-shadow: var(--shadow-deep, 0 24px 48px rgba(2,6,23,.28)); }
.f3d-mono-lateral { width: 22%; left: auto; right: -22%; border-radius: 0 10px 10px 0; background: linear-gradient(180deg, color-mix(in srgb, var(--f3d-a) 60%, black), color-mix(in srgb, var(--f3d-a) 78%, black)); transform-origin: left center; transform: rotateY(78deg); }
.f3d-mono-top { height: 12%; bottom: auto; top: -12%; border-radius: 10px 10px 2px 2px; background: linear-gradient(90deg, color-mix(in srgb, white 62%, var(--f3d-a2)), var(--f3d-a2)); transform-origin: center bottom; transform: rotateX(-84deg); }
.f3d-mono::after { content: ""; position: absolute; left: 0; top: 8%; bottom: 8%; width: 3px; border-radius: 3px; background: linear-gradient(180deg, transparent, color-mix(in srgb, white 85%, var(--f3d-a2)), transparent); filter: blur(.4px); }`,
    ORBE: `.f3d-orbe-wrap { width: 52%; aspect-ratio: 1; position: relative; }
.f3d-orbe { width: 100%; aspect-ratio: 1; border-radius: 50%;
  background: radial-gradient(circle at 32% 28%, white 0%, var(--f3d-a2) 26%, var(--f3d-a) 62%, color-mix(in srgb, var(--f3d-a) 55%, black) 100%);
  box-shadow: inset -18px -22px 48px color-mix(in srgb, black 32%, transparent), var(--shadow-deep, 0 24px 48px rgba(2,6,23,.28)); }
.f3d-orbe::after { content: ""; position: absolute; inset: 12%; border-radius: 50%; background: radial-gradient(circle at 34% 30%, color-mix(in srgb, white 80%, transparent) 0%, transparent 42%); }
.f3d-orbe-anillo { position: absolute; inset: -16%; border-radius: 50%; border: 2px solid color-mix(in srgb, var(--f3d-a) 55%, transparent); border-top-color: var(--f3d-a2); transform: rotateX(72deg); }
@media (prefers-reduced-motion: no-preference) { .f3d-orbe-anillo { animation: f3d-orbita 9s linear infinite; } }
@keyframes f3d-orbita { from { transform: rotateX(72deg) rotateZ(0deg); } to { transform: rotateX(72deg) rotateZ(360deg); } }
.f3d-orbe-satelita { position: absolute; top: 4%; left: 50%; width: 12%; aspect-ratio: 1; margin-left: -6%; border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, white, var(--f3d-a2)); box-shadow: var(--shadow-soft, 0 4px 12px rgba(2,6,23,.18)); }`,
    CAPAS_FLOTANTES: `.f3d-capas { width: 62%; aspect-ratio: 4 / 3; position: relative; transform: rotateX(56deg) rotateZ(-32deg); transform-style: preserve-3d; }
.f3d-capa { position: absolute; inset: 0; border-radius: 24px;
  background: color-mix(in srgb, var(--f3d-a) 26%, var(--f3d-tinta) 6%); border: 1.5px solid color-mix(in srgb, var(--f3d-a) 45%, transparent); }
.f3d-capa:nth-child(1) { transform: translateZ(calc(-1 * var(--depth-3, 60px))); }
.f3d-capa:nth-child(2) { transform: translateZ(calc(-1 * var(--depth-2, 40px))); inset: 4%; }
.f3d-capa:nth-child(3) { transform: translateZ(calc(-1 * var(--depth-1, 20px))); inset: 8%; }
.f3d-capa-top { background: linear-gradient(135deg, var(--f3d-a2), var(--f3d-a)); border-color: transparent; box-shadow: var(--shadow-floating, 0 18px 40px rgba(2,6,23,.2)); }`,
    TARJETA_DOBLADA: `.f3d-tarj { width: 58%; aspect-ratio: 16 / 10; position: relative; transform: rotateX(10deg) rotateY(-14deg); }
.f3d-tarj-mitad { position: absolute; top: 0; bottom: 0; width: 50%; border-radius: 14px;
  background: color-mix(in srgb, white 92%, var(--f3d-a2)); box-shadow: var(--shadow-floating, 0 18px 40px rgba(2,6,23,.2)); padding: 9% 7%; display: grid; gap: 12%; align-content: start; }
.f3d-tarj-izq { left: 0; border-radius: 14px 4px 4px 14px; }
.f3d-tarj-der { left: 50%; border-radius: 4px 14px 14px 4px; transform-origin: left center; transform: rotateY(-24deg); }
.f3d-tarj-linea { display: block; height: 7%; border-radius: 99px; background: color-mix(in srgb, var(--f3d-tinta) 22%, transparent); }
.f3d-tarj-linea:first-child { width: 46%; height: 16%; background: linear-gradient(90deg, var(--f3d-a), var(--f3d-a2)); }`,
    ANILLO_ORBITAL: `.f3d-anillo-wrap { width: 56%; aspect-ratio: 1; position: relative; transform: rotateX(16deg); }
.f3d-anillo { position: absolute; inset: 0; border-radius: 50%;
  border: calc(var(--f3d-tam, 320px) * .035) solid transparent;
  background: conic-gradient(from 120deg, var(--f3d-a), var(--f3d-a2), white, var(--f3d-a)) border-box;
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - var(--f3d-tam, 320px) * .05), black calc(100% - var(--f3d-tam, 320px) * .045));
  mask: radial-gradient(farthest-side, transparent calc(100% - var(--f3d-tam, 320px) * .05), black calc(100% - var(--f3d-tam, 320px) * .045));
  transform: rotateX(68deg); }
@media (prefers-reduced-motion: no-preference) { .f3d-anillo-wrap { animation: f3d-inclina 8s ease-in-out infinite; } }
@keyframes f3d-inclina { 0%,100% { transform: rotateX(10deg); } 50% { transform: rotateX(22deg); } }
.f3d-anillo-nucleo { position: absolute; inset: 34%; border-radius: 50%;
  background: radial-gradient(circle at 34% 30%, white, var(--f3d-a2) 40%, var(--f3d-a) 100%); box-shadow: var(--shadow-deep, 0 24px 48px rgba(2,6,23,.28)); }
.f3d-anillo-satelita { position: absolute; inset: 0; border-radius: 50%; transform: rotateX(68deg); }
.f3d-anillo-satelita::before { content: ""; position: absolute; top: 3%; left: 50%; width: 11%; aspect-ratio: 1; margin-left: -5.5%; border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, white, var(--f3d-a2)); box-shadow: var(--shadow-soft, 0 4px 12px rgba(2,6,23,.18)); }
@media (prefers-reduced-motion: no-preference) { .f3d-anillo-satelita { animation: f3d-orbita 11s linear infinite; } }`,
    TORRE_ISOMETRICA: `.f3d-torre { width: 54%; aspect-ratio: 1; position: relative; transform: rotateX(58deg) rotateZ(45deg); transform-style: preserve-3d; }
.f3d-losa { position: absolute; inset: 0; border-radius: 20px;
  background: color-mix(in srgb, var(--f3d-a) 30%, var(--f3d-tinta) 4%); border: 1.5px solid color-mix(in srgb, var(--f3d-a) 40%, transparent); }
.f3d-losa:nth-child(1) { transform: translateZ(calc(-1.6 * var(--depth-2, 40px))); }
.f3d-losa:nth-child(2) { transform: translateZ(calc(-0.8 * var(--depth-2, 40px))); inset: 5%; }
.f3d-losa-top { inset: 10%; background: linear-gradient(135deg, var(--f3d-a2), var(--f3d-a)); border-color: transparent; box-shadow: var(--shadow-floating, 0 18px 40px rgba(2,6,23,.2)); }
.f3d-losa-top::after { content: ""; position: absolute; inset: 18%; border-radius: 10px; background: color-mix(in srgb, white 24%, transparent); }`,
    CUBO_GIRATORIO: `.f3d-cubo { width: 38%; aspect-ratio: 1; position: relative; transform-style: preserve-3d; }
@media (prefers-reduced-motion: no-preference) { .f3d-cubo { animation: f3d-giro-cubo 16s linear infinite; } }
@keyframes f3d-giro-cubo { from { transform: rotateX(-18deg) rotateY(0deg); } to { transform: rotateX(-18deg) rotateY(360deg); } }
.f3d-cubo-cara { position: absolute; inset: 0; }
.f3d-cubo-frontal { background: linear-gradient(160deg, color-mix(in srgb, var(--f3d-a) 84%, black), var(--f3d-a) 60%, var(--f3d-a2)); border-radius: 12px; box-shadow: var(--shadow-deep, 0 24px 48px rgba(2,6,23,.28)); }
.f3d-cubo-lateral { width: 34%; left: auto; right: -34%; border-radius: 0 12px 12px 0; transform-origin: left center; transform: rotateY(90deg); background: linear-gradient(180deg, color-mix(in srgb, var(--f3d-a) 58%, black), color-mix(in srgb, var(--f3d-a) 76%, black)); }
.f3d-cubo-top { height: 34%; bottom: auto; top: -34%; border-radius: 12px 12px 2px 2px; transform-origin: center bottom; transform: rotateX(90deg); background: linear-gradient(90deg, color-mix(in srgb, white 60%, var(--f3d-a2)), var(--f3d-a2)); }
.f3d-cubo-frontal::after { content: ""; position: absolute; inset: 22%; border-radius: 8px; background: color-mix(in srgb, white 16%, transparent); border: 1px solid color-mix(in srgb, white 30%, transparent); }`,
    CONSTELACION: `.f3d-cons { width: 70%; aspect-ratio: 1; position: relative; transform: rotateX(24deg); }
.f3d-cons-pieza { position: absolute; width: 22%; aspect-ratio: 1; border-radius: 26%;
  background: color-mix(in srgb, var(--f3d-a) 34%, transparent); border: 1.5px solid color-mix(in srgb, var(--f3d-a) 55%, transparent);
  transform: translateZ(calc(var(--i, 0) * 22px - 20px)); }
.f3d-cons-pieza:nth-child(1) { top: 4%; left: 8%; }
.f3d-cons-pieza:nth-child(2) { top: 44%; left: 62%; }
.f3d-cons-pieza:nth-child(3) { top: 66%; left: 18%; }
.f3d-cons-mayor { width: 30%; top: 24%; left: 36%; background: linear-gradient(135deg, var(--f3d-a2), var(--f3d-a)); border-color: transparent; box-shadow: var(--shadow-floating, 0 18px 40px rgba(2,6,23,.2)); }
.f3d-cons-punto { position: absolute; top: calc(14% + var(--i, 0) * 24%); left: calc(40% + var(--i, 0) * 14%); width: 6%; aspect-ratio: 1; border-radius: 50%; background: var(--f3d-a2); }
@media (prefers-reduced-motion: no-preference) { .f3d-cons-punto { animation: f3d-titila 3.2s ease-in-out infinite; animation-delay: calc(var(--i, 0) * .5s); } }
@keyframes f3d-titila { 0%,100% { opacity: .45; } 50% { opacity: 1; } }`,
  };
  return [BASE_CSS, formas[id] ?? "", REDUCED_GUARD].filter(Boolean).join("\n");
}

/* ------------------------------- salidas ----------------------------------- */

/** Bloque para prompts (maqueta y Codificador): el objeto DECIDIDO, con la
 * regla dura de no re-inventarlo. */
export function seccionObjeto3d(o: ObjetoElegido | null): string {
  if (!o) {
    return [
      `# OBJETO 3D (decisión del Spatial Engine)`,
      `Sin objeto 3D: la experiencia es plana o el foco es tipográfico (el HTML/CSS del objeto no viaja).`,
      `No inventes un objeto 3D por tu cuenta: los objetos forjados viajan completos desde el motor.`,
    ].join("\n");
  }
  return [
    `# OBJETO 3D FORJADO (¡INCLUYE EL HTML Y LA CSS TAL CUAL!)`,
    `Forma: ${o.nombre} — ${o.descripcion}. Transmite: ${o.transmite.toLowerCase()}.`,
    `Por qué: ${o.motivo}.`,
    `El mensaje del usuario lleva el bloque <div class="f3d">…</div> y su CSS «Objeto 3D forjado por FORJA»: cópialos LITERALMENTE dentro del hero (parametriza solo el color por los tokens).`,
    `El objeto es decorativo (role="presentation" aria-hidden="true"): NUNCA lo conviertas en imagen, canvas ni lo simplifiques a un div con border-radius.`,
    `Alternativas explorables: ${o.alternativas.join(", ")}`,
  ].join("\n");
}

/** Resumen de una línea para trazas y registro. */
export function resumenObjeto3d(o: ObjetoElegido | null): string {
  return o ? `objeto3d=${o.id.toLowerCase()} (${o.nombre.toLowerCase()})` : "objeto3d=ninguno";
}
