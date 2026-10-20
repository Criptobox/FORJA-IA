/** FORJA IA — PANEL DE JUECES 2.0 con EVIDENCIA (v4.0.0, sección 13 del plan).
 *
 * Regla taxativa del plan: «los jueces no deben reducirse a una puntuación
 * total. Deben producir EVIDENCIA»:
 *
 *   JUEZ VISUAL       → qué funciona / qué falla / qué conservar
 *   JUEZ UX           → qué funciona / qué falla / qué conservar
 *   JUEZ ORIGINALIDAD → patrones genéricos / diferenciadores / riesgos
 *
 * Se mantienen los 3 jueces core de v3 y se añaden los 5 OPCIONALES del
 * plan: accesibilidad, conversión, responsive, coherencia de sistema y
 * performance.
 *
 * La evidencia tiene DOS fuentes que se combinan:
 *  1. DETERMINISTA (gratis, siempre): hallazgos del inspector, informe
 *     anti-genérico y auditoría de sistema → EVIDENCIA FÍSICA.
 *  2. DEL MODELO (si hay llamada): el juez añade criterio y matices sobre
 *     esa base, nunca empieza de cero.
 */

import type { EvidenciaJuez } from "./tipos-v4";
import type { HallazgoVision } from "./vision";
import type { InformeAntiGenerico } from "./antigenerico";
import type { HallazgoSistema } from "./bridge-design-system";
import type { AdnVisual2 } from "./tipos-v4";

/* -------------------------------- tipos ------------------------------------ */

/** Ids de jueces: 3 core + 5 opcionales del plan. */
export type JuezId2 =
  | "visual"
  | "ux"
  | "originalidad"
  | "accesibilidad"
  | "conversion"
  | "responsive"
  | "coherencia"
  | "performance";

export interface DefinicionJuez2 {
  id: JuezId2;
  nombre: string;
  /** qué examina, en una línea */
  mirada: string;
  core: boolean;
}

export const JUECES_2: ReadonlyArray<DefinicionJuez2> = [
  { id: "visual", nombre: "Juez Visual", mirada: "jerarquía, composición, tipografía y color con intención", core: true },
  { id: "ux", nombre: "Juez UX/Accesibilidad", mirada: "la información se entiende y se llega a ella", core: true },
  { id: "originalidad", nombre: "Juez de Originalidad", mirada: "¿podría cambiarse el logo y venderse como plantilla?", core: true },
  { id: "accesibilidad", nombre: "Juez de Accesibilidad", mirada: "contraste, teclado, alt, labels, foco", core: false },
  { id: "conversion", nombre: "Juez de Conversión", mirada: "la acción importante está clara y sin fricción", core: false },
  { id: "responsive", nombre: "Juez de Responsive", mirada: "funciona en distintos tamaños de verdad", core: false },
  { id: "coherencia", nombre: "Juez de Coherencia de Sistema", mirada: "respeta el design system y el ADN declarados", core: false },
  { id: "performance", nombre: "Juez de Performance", mirada: "peso, fuentes, animaciones y coste de render", core: false },
];

export function juezPorId(id: string): DefinicionJuez2 | undefined {
  return JUECES_2.find((j) => j.id === id);
}

/** Nota de un juez sobre UNA visión: puntuación + evidencia completa. */
export interface NotaJuez2 {
  juez: JuezId2;
  /** a qué visión se refiere esta nota */
  vision: "A" | "B" | "C";
  /** 0..10 */
  nota: number;
  evidencia: EvidenciaJuez;
  /** fuente principal de la evidencia */
  base: "determinista" | "modelo" | "mixta";
}

/* ---------------------- evidencia determinista (gratis) -------------------- */

/** Construye evidencia FÍSICA desde las herramientas deterministas. Esto
 * corre siempre, sin modelo: los jueces NUNCA parten de cero. */
export function evidenciaDeterminista(
  inspector: HallazgoVision[],
  genericidad: InformeAntiGenerico,
  sistema: HallazgoSistema[]
): Record<"visual" | "ux" | "originalidad", EvidenciaJuez> {
  const criticos = inspector.filter((h) => h.severidad === "critico");
  const avisos = inspector.filter((h) => h.severidad === "aviso");
  const visual: EvidenciaJuez = {
    funciona: [
      genericidad.nivel === "bajo" ? "sin síntomas gruesos de plantilla en la capa determinista" : "",
    ].filter(Boolean) as string[],
    falla: [
      ...criticos.map((h) => `${h.titulo}: ${h.detalle}`),
      ...sistema.slice(0, 3).map((h) => `sistema — ${h.titulo}`),
    ],
    conservar: avisos.length ? ["la base estructural es corregible con avisos, no rehacer desde cero"] : [],
  };
  const ux: EvidenciaJuez = {
    funciona: criticos.length === 0 ? ["ningún bloqueo crítico de uso detectado"] : [],
    falla: [
      ...inspector.filter((h) => h.categoria === "accesibilidad").map((h) => `${h.titulo}: ${h.detalle}`),
      ...inspector.filter((h) => h.categoria === "movil").map((h) => `${h.titulo}: ${h.detalle}`),
    ],
    conservar: [],
  };
  const originalidad: EvidenciaJuez = {
    funciona: genericidad.puntuacionIdentidad >= 80 ? [`identidad ${genericidad.puntuacionIdentidad}/100`] : [],
    falla: genericidad.sintomas.map((s) => `${s.nombre} — ${s.motivo}`),
    conservar: [],
    patronesGenericos: genericidad.sintomas.map((s) => s.nombre),
    diferenciadores: genericidad.nivel === "bajo" ? ["decisiones fuera del catálogo de plantilla"] : [],
    riesgos: genericidad.recordatorio.slice(0, 4),
  };
  return { visual, ux, originalidad };
}

/* ------------------------------- prompt ------------------------------------ */

/** Prompt del juez: recibe la evidencia física y la COMPLETA con criterio.
 * Formato por etiquetas, tolerante a modelos gratis. */
export function promptJuez2(
  juez: JuezId2,
  propuesta: string,
  evidenciaBase: string,
  adn2: AdnVisual2
): string {
  const def = juezPorId(juez);
  const esOriginalidad = juez === "originalidad";
  return [
    `## ${def?.nombre ?? juez}`,
    `Tu mirada: ${def?.mirada ?? ""}`,
    `Prohibiciones del ADN que auditas: ${adn2.prohibiciones.join("; ") || "—"}`,
    ``,
    `## Propuesta a evaluar`,
    propuesta.slice(0, 3000),
    ``,
    `## Evidencia física ya detectada (herramientas deterministas)`,
    evidenciaBase.slice(0, 2000) || "(sin hallazgos automáticos)",
    ``,
    `## Tu trabajo`,
    `Confirma, matiza o refuta la evidencia con criterio y añade lo que las herramientas no pueden ver. Responde EXACTAMENTE así:`,
    `<nota-juez juez="${juez}">`,
    `Nota: N/10`,
    `Funciona: (hechos concretos, una por línea)`,
    `Falla: (hechos concretos con DÓNDE, una por línea)`,
    `Conservar: (qué vale aunque se descarte)`,
    esOriginalidad ? `Patrones genéricos: (cuáles aparecen)` : ``,
    esOriginalidad ? `Diferenciadores: (qué la hace distinta)` : ``,
    esOriginalidad ? `Riesgos: (hacia qué plantilla deriva)` : ``,
    `</nota-juez>`,
  ]
    .filter(Boolean)
    .join("\n");
}

/* -------------------------------- parser ------------------------------------ */

/** Parser tolerante de <nota-juez juez="..." vision="A">. Nota saneada
 * 0..10; la evidencia toma hasta 5 ítems por campo. */
export function parseNotaJuez2(texto: string, juez: JuezId2, vision: "A" | "B" | "C"): NotaJuez2 {
  const bloque = texto.match(/<nota-juez[^>]*>([\s\S]*?)<\/nota-juez>/i)?.[1] ?? texto;
  const notaRaw = Number(bloque.match(/Nota\s*:\s*(\d{1,2})/i)?.[1] ?? NaN);
  const listaDe = (nombre: string): string[] => {
    const m = bloque.match(new RegExp(`^\\s*${nombre}\\s*:\\s*([\\s\\S]*?)(?=\\n\\s*[A-ZÁÉÍÓÚ][a-záéíóú-]+\\s*:|$)`, "im"));
    if (!m) return [];
    return m[1]
      .split("\n")
      .map((l) => l.replace(/^[-*\d.)\s]+/, "").trim())
      .filter((l) => l.length >= 3)
      .slice(0, 5);
  };
  const evidencia: EvidenciaJuez = {
    funciona: listaDe("Funciona"),
    falla: listaDe("Falla"),
    conservar: listaDe("Conservar"),
  };
  if (juez === "originalidad") {
    evidencia.patronesGenericos = listaDe("Patrones gen[ée]ricos");
    evidencia.diferenciadores = listaDe("Diferenciadores");
    evidencia.riesgos = listaDe("Riesgos");
  }
  const nota = Math.max(0, Math.min(10, Math.round(Number.isNaN(notaRaw) ? 5 : notaRaw)));
  const tieneModelo = /<nota-juez/i.test(texto);
  return { juez, vision, nota, evidencia, base: tieneModelo ? "modelo" : "determinista" };
}

/* ------------------------------ tablas y resumen --------------------------- */

/** Tabla comparativa del panel en texto: por juez, nota por visión con la
 * ganadora marcada con «◀». Para el chat; la UI pinta la suya. */
export function tablaNotas(notas: NotaJuez2[], _letras: ("A" | "B" | "C")[]): string {
  const lineas: string[] = [];
  for (const n of notas) {
    const mejor = Math.max(...notas.filter((x) => x.juez === n.juez).map((x) => x.nota));
    const marca = n.nota === mejor ? " ◀" : "";
    lineas.push(`${n.juez} · ${n.vision}: ${n.nota}/10${marca}`);
  }
  return lineas.join("\n");
}

/** Media de notas por visión (para elegir la base de la fusión). */
export function mediasPorVision(notas: NotaJuez2[], letras: ("A" | "B" | "C")[]): Record<"A" | "B" | "C", number> {
  const medias = { A: 0, B: 0, C: 0 } as Record<"A" | "B" | "C", number>;
  for (const l of letras) {
    const deL = notas.filter((n) => n.vision === l);
    medias[l] = deL.length ? deL.reduce((s, n) => s + n.nota, 0) / deL.length : 0;
  }
  return medias;
}

/** La mejor visión según media (desempate por originalidad). */
export function mejorVision(notas: NotaJuez2[], letras: ("A" | "B" | "C")[]): "A" | "B" | "C" {
  const medias = mediasPorVision(notas, letras);
  const orden = [...letras].sort((a, b) => medias[b] - medias[a]);
  return orden[0] ?? "A";
}
