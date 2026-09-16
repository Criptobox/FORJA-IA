/** FORJA IA — Exportadores del ADN Visual 2.0 (v4.0.0, fases 3 y 9 del plan).
 *
 * El plan exige que el ADN «pueda convertirse en»:
 *
 *   · DESIGN.md            → formato abierto (idea Stitch/OpenDesign),
 *                            legible por humanos y por herramientas;
 *   · tokens.css           → variables CSS listas para pegar en el proyecto;
 *   · contexto para skills → párrafo compacto para prompts de skills;
 *   · reglas de critique   → checks que el Revisor y los jueces aplican;
 *   · restricciones del Codificador → la lista dura de lo inamovible;
 *   · criterios de la Arena → qué auditará el juez.
 *
 * Todo es puro, determinista y sin red: el mismo ADN produce SIEMPRE el
 * mismo DESIGN.md y los mismos tokens, así el sistema es reproducible
 * (definición de éxito del plan) y auditable.
 */

import type { AdnVisual2 } from "./tipos-v4";
import { sanearAdn2 } from "./adn2";

/* ----------------------------- utilidades --------------------------------- */

/** Extrae el primer color hex de una lista de decisiones de color, o null. */
function primerHex(xs: string[]): string | null {
  for (const x of xs) {
    const m = x.match(/#[0-9a-f]{6}\b/i);
    if (m) return m[0].toLowerCase();
  }
  return null;
}

/** Nombre de fuente citado en las decisiones tipográficas (si lo hay). */
function primeraFuente(xs: string[]): string | null {
  for (const x of xs) {
    const m = x.match(/"([A-Za-zÀ-ÿ0-9 _-]{2,32})"/);
    if (m) return m[1];
  }
  return null;
}

/** Meta opcional del proyecto para DESIGN.md. */
export interface MetaDesign {
  nombreProyecto: string;
  fecha?: string;
}

/* ------------------------------ DESIGN.md --------------------------------- */

/** DESIGN.md: el contrato de diseño del proyecto. Formato estable, secciones
 * fijas, sin florituras: es un archivo de TRABAJO (viaja al repo, lo leen
 * otros agentes y herramientas compatibles con el formato abierto). */
export function designMdDesdeAdn2(adn: AdnVisual2, meta: MetaDesign): string {
  const a = sanearAdn2(adn);
  const lista = (xs: string[]): string => (xs.length ? xs.map((x) => `- ${x}`).join("\n") : "- (sin decisiones aún)");
  const sens = a.sensacion.length
    ? a.sensacion.map((e) => `| ${e.eje} | ${e.valor}/10 |`).join("\n")
    : "| — | — |";
  return [
    `# DESIGN.md — ${meta.nombreProyecto || "Proyecto FORJA"}`,
    meta.fecha ? `Generado por FORJA IA el ${meta.fecha}.` : "Generado por FORJA IA.",
    ``,
    `## Identidad`,
    a.identidad || "(sin definir)",
    ``,
    `## Personalidad`,
    lista(a.personalidad),
    ``,
    `## Sensación objetivo`,
    `| eje | valor |`,
    `| --- | ----- |`,
    sens,
    ``,
    `## Composición`,
    lista(a.composicion),
    ``,
    `## Tipografía`,
    lista(a.tipografia),
    ``,
    `## Color`,
    lista(a.color),
    ``,
    `## Espaciado`,
    lista(a.espaciado),
    ``,
    `## Movimiento`,
    lista(a.movimiento),
    ``,
    `## Representación de la información`,
    lista(a.representacion),
    ``,
    `## Interacción`,
    lista(a.interaccion),
    ``,
    `## Prohibiciones (reglas duras)`,
    lista([...a.prohibiciones, ...a.antiPatrones]),
    ``,
    `## Referencias (inspiración abstracta, NUNCA copiar)`,
    lista(a.referencias),
    ``,
    `## Accesibilidad mínima`,
    lista(a.accesibilidad),
  ].join("\n");
}

/* ------------------------------ tokens.css -------------------------------- */

/** tokens.css derivado del ADN. Estrategia determinista: si el ADN cita
 * hexes reales se usan; si no, se generan neutros anti-genéricos con el
 * acento marcado. La escala de espaciado es siempre la misma (4px) porque
 * el ADN 2.0 la exige por defecto. */
export function tokensCssDesdeAdn2(adn: AdnVisual2, nombreProyecto = "prisma"): string {
  const a = sanearAdn2(adn);
  const dominante = primerHex(a.color) ?? "#14181f";
  const acento = primerHex([...a.color].reverse()) ?? dominante;
  const fontDisplay = primeraFuente(a.tipografia) ?? "Georgia";
  const fontTexto = primeraFuente([...a.tipografia].reverse()) ?? "system-ui";
  const sensible = /\b(sobrio|fiable|calma|sereno)\b/i.test(a.personalidad.join(" "));
  const radio = sensible ? "4px" : "10px";
  const vars: string[] = [
    `  --color-dominante: ${dominante};`,
    `  --color-acento: ${acento};`,
    `  --font-display: "${fontDisplay}", serif;`,
    `  --font-texto: "${fontTexto}", sans-serif;`,
    `  --escala-modular: 1.25;`,
    `  --radio: ${radio};`,
  ];
  // escala de espaciado 4..96 (el ADN 2.0 pide múltiplos de 4)
  for (const px of [4, 8, 12, 16, 24, 32, 48, 64, 96]) {
    vars.push(`  --espacio-${px}: ${px}px;`);
  }
  vars.push(`  --dur-rapida: 150ms;`, `  --dur-base: 250ms;`, `  --ease-salida: cubic-bezier(0.2, 0.7, 0.3, 1);`);
  vars.push(`  --contraste-min: 4.5;`);
  return [
    `/* tokens.css — sistema de ${nombreProyecto}`,
    ` * Derivado automáticamente del ADN Visual 2.0 por FORJA IA.`,
    ` * Fuente de verdad: DESIGN.md. No editar a mano: regenerar. */`,
    `:root {`,
    ...vars,
    `}`,
  ].join("\n");
}

/* -------------------- reglas de critique (Revisor/jueces) ----------------- */

/** Reglas de critique derivadas del ADN: cada decisión del ADN se vuelve
 * una pregunta verificable que Revisor y jueces aplican sobre la entrega. */
export function reglasCritiqueDesdeAdn2(adn: AdnVisual2): string[] {
  const a = sanearAdn2(adn);
  const reglas: string[] = [];
  if (a.identidad) reglas.push(`¿La página es reconocible como «${a.identidad}»?`);
  for (const p of a.prohibiciones) reglas.push(`PROHIBIDO y verificado: ${p} — ¿aparece?`);
  for (const p of a.antiPatrones) reglas.push(`Anti-patrón del sector: ${p} — ¿aparece?`);
  for (const c of a.composicion) reglas.push(`¿Se cumple la decisión de composición «${c}»?`);
  if (a.tipografia.length) reglas.push(`¿La escala tipográfica respeta «${a.tipografia[0]}»?`);
  if (a.color.length) reglas.push(`¿El uso del color respeta «${a.color[0]}»?`);
  for (const acc of a.accesibilidad) reglas.push(`Accesibilidad: ${acc}`);
  for (const mv of a.movimiento) reglas.push(`Movimiento: ${mv}`);
  return reglas.slice(0, 16);
}

/* ---------------------- restricciones del Codificador --------------------- */

/** Bloque duro que viaja al Codificador: NO es consejo, es restricción. */
export function restriccionesCodificadorDesdeAdn2(adn: AdnVisual2): string[] {
  const a = sanearAdn2(adn);
  const out: string[] = [];
  for (const p of a.prohibiciones) out.push(`NO hacer: ${p}`);
  for (const p of a.antiPatrones) out.push(`NO usar el patrón: ${p}`);
  if (a.color.length) out.push(`Color: usar exclusivamente el sistema descrito (${primerHex(a.color) ?? "ver DESIGN.md"} como dominante; un solo acento por pantalla).`);
  if (a.tipografia.length) out.push(`Tipografía: ${a.tipografia[0]}.`);
  if (a.espaciado.length) out.push(`Espaciado: ${a.espaciado[0]}.`);
  if (a.accesibilidad.length) out.push(`Accesibilidad inamovible: ${a.accesibilidad.join("; ")}.`);
  return out.slice(0, 14);
}

/* ------------------------ criterios de la Arena --------------------------- */

/** Qué auditará el juez de coherencia de sistema (jueces2.ts). */
export function criteriosArenaDesdeAdn2(adn: AdnVisual2): string[] {
  const a = sanearAdn2(adn);
  return [
    `Identidad declarada: ${a.identidad || "—"}`,
    `Prohibiciones: ${a.prohibiciones.join("; ") || "—"}`,
    `Composición: ${a.composicion[0] ?? "—"}`,
    `Color: ${a.color[0] ?? "—"}`,
    `Tipografía: ${a.tipografia[0] ?? "—"}`,
    `Representación: ${a.representacion.join(" · ") || "—"}`,
  ];
}

/* --------------------- contexto compacto para skills ---------------------- */

/** Párrafo compacto para skills y prompts cortos (los límites de caracteres
 * de FORJA IA obligan a comprimir sin perder las prohibiciones). */
export function contextoSkillsDesdeAdn2(adn: AdnVisual2, maxCaracteres = 700): string {
  const a = sanearAdn2(adn);
  // las prohibiciones van PRIMERO: nunca se recortan por presupuesto
  const cabezas = [];
  if (a.prohibiciones.length) cabezas.push(`PROHIBIDO: ${a.prohibiciones.join("; ")}`);
  if (a.identidad) cabezas.push(`Identidad: ${a.identidad}`);
  if (a.personalidad.length) cabezas.push(`Rasgos: ${a.personalidad.join(", ")}`);
  if (a.composicion.length) cabezas.push(`Composición: ${a.composicion[0]}`);
  if (a.tipografia.length) cabezas.push(`Tipo: ${a.tipografia[0]}`);
  if (a.color.length) cabezas.push(`Color: ${a.color[0]}`);
  let texto = cabezas.join(" · ");
  if (texto.length > maxCaracteres) {
    texto = texto.slice(0, maxCaracteres);
  }
  return texto;
}
