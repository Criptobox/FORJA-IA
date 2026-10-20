/** Forja IA — Lo que el QA visual mide en móvil, convertido en correcciones (Plan Maestro 2026 §38, Sprint 6).
 *
 * La revisión automática ya ejecuta cada página generada en un iframe de
 * 390 px con el medidor de `visual-qa.ts` dentro, y el medidor ya mide lo que
 * rompe una web en un móvil: scroll horizontal, botones fuera de la pantalla,
 * botones sin nombre, contraste ilegible, texto diminuto, imágenes sin alt,
 * objetivos de toque minúsculos. Pero de todo eso solo se usaban las señas de
 * «parece hecha por una IA». Lo demás se medía y se tiraba: el modelo nunca se
 * enteraba de que su página se salía por la derecha en un iPhone.
 *
 * Aquí cada hallazgo recibe una severidad, y los graves vuelven al modelo como
 * corrección automática, por el mismo bucle y con el mismo tope que los
 * errores de consola.
 *
 * ——— Qué dispara una corrección y qué no ———
 *
 *  · ALTA (se corrige sola): scroll horizontal, elemento fuera de pantalla,
 *    control sin nombre accesible. Rompen el uso: no se ve, no se alcanza o
 *    un lector de pantalla no lo puede anunciar.
 *  · MEDIA: contraste por debajo de AA también se corrige solo (texto que
 *    no se lee es un defecto, no un gusto). Texto < 12 px e imagen sin alt
 *    viajan en la corrección si ya hay una, pero no la disparan: cada
 *    corrección automática cuesta una llamada.
 *  · BAJA: objetivo de toque pequeño. Se informa, no se corrige solo.
 *
 * Funciones puras: se prueban sin navegador.
 */
import { QA_LABEL, reglaDeQA, type QAResult, type QATipo } from "./visual-qa";

export type SeveridadQA = "alta" | "media" | "baja";

export const SEVERIDAD_QA: Record<QATipo, SeveridadQA> = {
  scroll: "alta",
  fuera: "alta",
  "sin-nombre": "alta",
  contraste: "media",
  texto: "media",
  "sin-alt": "media",
  "toque-pequeno": "baja",
};

/** Tipos que por sí solos disparan una corrección automática. */
const DISPARAN: ReadonlySet<QATipo> = new Set<QATipo>(["scroll", "fuera", "sin-nombre", "contraste"]);

const ORDEN: Record<SeveridadQA, number> = { alta: 0, media: 1, baja: 2 };

export interface HallazgoQA {
  tipo: QATipo;
  severidad: SeveridadQA;
  etiqueta: string;
  /** cuántas veces se midió */
  veces: number;
  /** hasta 3 detalles del medidor, tal cual */
  ejemplos: string[];
}

/** Agrupa lo medido por tipo, con su severidad, de más a menos grave. */
export function hallazgosQA(qa: QAResult | null | undefined): HallazgoQA[] {
  if (!qa || qa.noRespondio || !qa.items?.length) return [];
  const porTipo = new Map<QATipo, HallazgoQA>();
  for (const it of qa.items) {
    const h =
      porTipo.get(it.tipo) ??
      { tipo: it.tipo, severidad: SEVERIDAD_QA[it.tipo], etiqueta: QA_LABEL[it.tipo], veces: 0, ejemplos: [] };
    h.veces++;
    if (h.ejemplos.length < 3 && it.detalle && !h.ejemplos.includes(it.detalle)) h.ejemplos.push(it.detalle);
    porTipo.set(it.tipo, h);
  }
  return [...porTipo.values()].sort((a, b) => ORDEN[a.severidad] - ORDEN[b.severidad] || b.veces - a.veces);
}

/** ¿Hay algo lo bastante grave como para pedir una corrección sola? */
export function hayQueCorregirQA(h: readonly HallazgoQA[]): boolean {
  return h.some((x) => DISPARAN.has(x.tipo));
}

/** Una línea para el aviso: «Scroll horizontal ×1 · Contraste ×3». */
export function resumenQA(h: readonly HallazgoQA[]): string {
  return h.map((x) => `${x.etiqueta}${x.veces > 1 ? ` ×${x.veces}` : ""}`).join(" · ");
}

/** Lo que se le manda al modelo: lo MEDIDO, con la regla para arreglarlo.
 *  Los de severidad baja no viajan: no merecen tokens en una corrección. */
export function promptDeQA(h: readonly HallazgoQA[], ancho: number, entry: string): string {
  const relevantes = h.filter((x) => x.severidad !== "baja");
  const lineas = relevantes.map((x) => {
    const ej = x.ejemplos.length ? ` Medido: ${x.ejemplos.map((e) => `«${e}»`).join(", ")}.` : "";
    return `- [${x.severidad}] ${x.etiqueta} (${x.veces}).${ej} Cómo: ${reglaDeQA(x.tipo)}`;
  });
  return [
    `He abierto tu página (${entry}) a ${ancho} px de ancho, como la vería alguien en el móvil, y he medido el DOM pintado. Esto es lo que falla:`,
    "",
    ...lineas,
    "",
    "Corrige exactamente eso en el archivo que corresponda, sin cambiar el diseño ni el contenido de lo demás.",
  ].join("\n");
}
