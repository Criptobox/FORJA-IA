/** FORJA IA — GENOMA VISUAL de FORJA IA (v4.0.0, sección 20 del plan).
 *
 * «Cada Arena debe generar lecciones» y «el Genoma Visual es la memoria
 * evolutiva». Este módulo cierra el ciclo evolutivo del sistema:
 *
 *   Arena → Lecciones → Memoria → Nueva generación → Arena → Lecciones → …
 *
 * Las lecciones nacen con tres etiquetas del plan:
 *
 *   DESTACAR → qué funcionó
 *   CONSERVAR → qué tenía valor aunque perdió
 *   EVITAR   → qué produjo un resultado inferior
 *
 * y cada lección debe poder CONVERTIRSE en: patrón, anti-patrón,
 * experimento, regla o referencia. La conversión es la parte que hace que
 * el sistema EVOLUCIONE de verdad: una lección sin conversión es un
 * apunte muerto.
 *
 * Reglas de consolidación (evitar apuntes muertos y ruido):
 *  - una lección se CONFIRMA cuando reaparece en otra generación;
 *  - 3 confirmaciones de EVITAR → anti-patrón (prohibición dura);
 *  - 3 confirmaciones de DESTACAR → patrón (regla que viaja al ADN);
 *  - CONSERVAR pasa a EXPERIMENTO (hay que probarlo, no creerlo).
 */

import type { LeccionGenoma, TipoLeccionGenoma, ConversionLeccion } from "./tipos-v4";
import { idV4 } from "./tipos-v4";
import { leccionArenaAGenoma } from "./tipos-v4";
import type { LeccionArena } from "./conocimiento-global";

/* -------------------------------- tipos ------------------------------------ */

/** El genoma completo de FORJA en una instalación. */
export interface GenomaVisual {
  /** generación actual (crece con cada Arena que aporta) */
  generacion: number;
  lecciones: LeccionGenoma[];
  /** patrones consolidados (viajan al ADN como lenguaje) */
  patrones: { texto: string; desdeGeneracion: number; confirmaciones: number }[];
  /** anti-patrones consolidados (viajan como prohibiciones duras) */
  antiPatrones: { texto: string; desdeGeneracion: number; confirmaciones: number }[];
  /** referencias consolidadas (inspiración abstracta) */
  referencias: { texto: string; origen: string }[];
}

export const CONFIRMACIONES_PARA_CONSOLIDAR = 3;
export const MAX_LECCIONES_GENOMA = 120;

/** Genoma vacío. */
export function genomaVacio(): GenomaVisual {
  return { generacion: 0, lecciones: [], patrones: [], antiPatrones: [], referencias: [] };
}

/* ----------------------------- entrada de lecciones ------------------------- */

/** Incorpora las lecciones crudas de una Arena (v3 o v4). Cada lección
 * nueva entra con confirmaciones=1; si ya existía (mismo texto), se
 * CONFIRMA (+1) y puede consolidarse. */
export function incorporarLeccionesArena(
  genoma: GenomaVisual,
  lecciones: LeccionArena[],
  origenPorDefecto = ""
): GenomaVisual {
  const generacion = genoma.generacion + 1;
  const nuevas: LeccionGenoma[] = lecciones.map((l) => leccionArenaAGenoma(l, generacion));
  if (!nuevas.length) return { ...genoma, generacion };

  const leccionesAct = [...genoma.lecciones];
  for (const l of nuevas) {
    const clave = l.texto.trim().toLowerCase();
    const idx = leccionesAct.findIndex((x) => x.texto.trim().toLowerCase() === clave);
    if (idx >= 0) {
      leccionesAct[idx] = {
        ...leccionesAct[idx],
        confirmaciones: leccionesAct[idx].confirmaciones + 1,
        generacion: l.generacion,
      };
    } else {
      leccionesAct.push({ ...l, origen: l.origen || origenPorDefecto });
    }
  }
  const recortadas = leccionesAct.slice(-MAX_LECCIONES_GENOMA);
  return consolidar({ ...genoma, generacion, lecciones: recortadas });
}

/** Incorpora directamente lecciones 2.0 (con origen de equipo). */
export function incorporarLeccionesGenoma(
  genoma: GenomaVisual,
  lecciones: { tipo: TipoLeccionGenoma; texto: string; equipo: string }[]
): GenomaVisual {
  const generacion = genoma.generacion + 1;
  const actuales = [...genoma.lecciones];
  for (const l of lecciones) {
    const clave = l.texto.trim().toLowerCase();
    const idx = actuales.findIndex((x) => x.texto.trim().toLowerCase() === clave);
    if (idx >= 0) {
      actuales[idx] = { ...actuales[idx], confirmaciones: actuales[idx].confirmaciones + 1, generacion };
    } else {
      actuales.push({
        id: idV4("lec"),
        tipo: l.tipo,
        texto: l.texto.slice(0, 200),
        conversion: null,
        origen: l.equipo,
        generacion,
        confirmaciones: 1,
      });
    }
  }
  return consolidar({ ...genoma, generacion, lecciones: actuales.slice(-MAX_LECCIONES_GENOMA) });
}

/* ------------------------------- consolidación ------------------------------ */

/** Aplica las reglas de consolidación: confirmaciones → conversión. */
function consolidar(g: GenomaVisual): GenomaVisual {
  const lecciones = g.lecciones.map((l) => {
    if (l.conversion) return l;
    if (l.confirmaciones < CONFIRMACIONES_PARA_CONSOLIDAR) return l;
    const conversion: ConversionLeccion | null =
      l.tipo === "evitar" ? "anti-patron" : l.tipo === "destacar" ? "patron" : l.tipo === "conservar" ? "experimento" : null;
    return conversion ? { ...l, conversion } : l;
  });
  const patrones = [...g.patrones];
  const antiPatrones = [...g.antiPatrones];
  const experimentosNuevos: string[] = [];
  for (const l of lecciones) {
    if (l.conversion === "patron" && !patrones.some((p) => p.texto === l.texto)) {
      patrones.push({ texto: l.texto, desdeGeneracion: l.generacion, confirmaciones: l.confirmaciones });
    }
    if (l.conversion === "anti-patron" && !antiPatrones.some((p) => p.texto === l.texto)) {
      antiPatrones.push({ texto: l.texto, desdeGeneracion: l.generacion, confirmaciones: l.confirmaciones });
    }
    if (l.conversion === "experimento") {
      experimentosNuevos.push(l.texto);
    }
  }
  return { ...g, lecciones, patrones, antiPatrones };
}

/* ------------------------- salida hacia el resto del motor ------------------ */

/** Qué el genoma aporta al ADN 2.0 de la PRÓXIMA generación: los patrones
 * consolidados entran como lenguaje, los anti-patrones como prohibiciones. */
export function aporteAlAdn(genoma: GenomaVisual): { lenguaje: string[]; prohibiciones: string[] } {
  return {
    lenguaje: genoma.patrones.slice(0, 4).map((p) => p.texto),
    prohibiciones: genoma.antiPatrones.slice(0, 4).map((p) => p.texto),
  };
}

/** Resumen evolutivo para el panel de aprendizaje. */
export function resumenGenoma(genoma: GenomaVisual): string {
  const porTipo = { destacar: 0, conservar: 0, evitar: 0 } as Record<TipoLeccionGenoma, number>;
  for (const l of genoma.lecciones) porTipo[l.tipo] += 1;
  const convertidas = genoma.lecciones.filter((l) => l.conversion).length;
  return [
    `Generación ${genoma.generacion} — ${genoma.lecciones.length} lecciones (${porTipo.destacar} destacadas, ${porTipo.conservar} por conservar, ${porTipo.evitar} a evitar)`,
    `Consolidadas: ${convertidas} → ${genoma.patrones.length} patrones, ${genoma.antiPatrones.length} anti-patrones`,
  ].join("\n");
}

/** Texto del genoma para el prompt del Director (las lecciones viajan). */
export function seccionGenoma(genoma: GenomaVisual): string {
  const destacadas = genoma.lecciones.filter((l) => l.tipo === "destacar").slice(-3);
  const evitadas = genoma.lecciones.filter((l) => l.tipo === "evitar").slice(-3);
  const lineas: string[] = [`# Genoma Visual (generación ${genoma.generacion})`];
  if (destacadas.length) lineas.push(`FUNCIONÓ antes: ${destacadas.map((l) => l.texto).join("; ")}`);
  if (evitadas.length) lineas.push(`FALLÓ antes (no repetir): ${evitadas.map((l) => l.texto).join("; ")}`);
  if (genoma.antiPatrones.length) lineas.push(`PROHIBIDO consolidado: ${genoma.antiPatrones.map((p) => p.texto).join("; ")}`);
  if (lineas.length === 1) lineas.push("(sin lecciones todavía: primera generación)");
  return lineas.join("\n");
}

/** Serialización simple para persistir el genoma (JSON en el store). */
export function serializarGenoma(g: GenomaVisual): string {
  return JSON.stringify(g);
}

/** Deserialización tolerante. */
export function deserializarGenoma(s: string | null | undefined): GenomaVisual {
  if (!s) return genomaVacio();
  try {
    const obj = JSON.parse(s) as Partial<GenomaVisual>;
    return {
      generacion: Number(obj.generacion) || 0,
      lecciones: Array.isArray(obj.lecciones) ? obj.lecciones.slice(0, MAX_LECCIONES_GENOMA) : [],
      patrones: Array.isArray(obj.patrones) ? obj.patrones : [],
      antiPatrones: Array.isArray(obj.antiPatrones) ? obj.antiPatrones : [],
      referencias: Array.isArray(obj.referencias) ? obj.referencias : [],
    };
  } catch {
    return genomaVacio();
  }
}
