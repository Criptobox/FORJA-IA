/** FORJA IA — MÉTRICAS de FORJA IA (v4.0.0, sección 30 del plan).
 *
 * «No medir solamente "bonito"». Las 8 métricas del plan, todas 0..10:
 *
 *   Identidad      — ¿tiene decisiones propias?
 *   Genericidad    — ¿cuántos patrones genéricos aparecen? (10 = ninguno)
 *   Coherencia     — ¿respeta el ADN?
 *   UX             — ¿la información se entiende?
 *   Accesibilidad  — ¿cumple criterios definidos?
 *   Responsive     — ¿funciona en distintos tamaños?
 *   Código         — ¿es limpio y funcional?
 *   Iteración      — ¿las correcciones realmente mejoran?
 *
 * Todo determinista (inspector + anti-genérico + auditoría de sistema +
 * bucle): medir es GRATIS y corre en cada generación si el perfil lo pide.
 * Cada métrica viaja con evidencia (los hallazgos que la sustentan) porque
 * en FORJA una cifra sin evidencia no vale nada.
 */

import type { MetricasForja } from "./tipos-v4";
import { revisarVisual, type InformeRevisorVisual } from "./revisor-visual";
import type { DesignSystemPrisma } from "./bridge-design-system";
import type { IteracionMejora } from "./bucle-mejora";

/** Métricas con su evidencia y nota global. */
export interface MedicionForja extends MetricasForja {
  /** evidencia por métrica (1-3 líneas cada una) */
  evidencia: Record<keyof MetricasForja, string>;
  /** media ponderada (identidad y coherencia pesan más: es FORJA) */
  media: number;
  /** resumen en una línea para el chat */
  resumen: string;
}

/** Ponderación de la media. */
const PESOS: Record<keyof MetricasForja, number> = {
  identidad: 1.5,
  genericidad: 1.5,
  coherencia: 1.4,
  ux: 1.2,
  accesibilidad: 1,
  responsive: 1,
  codigo: 1,
  iteracion: 0.4,
};

/** Mide un HTML con todo el arsenal determinista. */
export function medir(
  html: string,
  opts: { ds?: DesignSystemPrisma; iteraciones?: IteracionMejora[] } = {}
): MedicionForja {
  const inf: InformeRevisorVisual = revisarVisual(html, { ds: opts.ds });
  const porCategoria = new Map<string, number>();
  for (const h of inf.hallazgos) {
    porCategoria.set(h.categoria, (porCategoria.get(h.categoria) ?? 0) + (h.severidad === "critico" ? 2 : h.severidad === "aviso" ? 1 : 0.4));
  }
  const nota = (cat: string | null): number => {
    const penal = cat ? (porCategoria.get(cat) ?? 0) : 0;
    return Math.max(0, Math.min(10, Math.round((10 - penal) * 10) / 10));
  };

  // Identidad y genericidad desde el informe anti-genérico
  const identidad = Math.round((inf.identidad / 100) * 10 * 10) / 10;
  const genericidad = identidad; // mismo dato, extremo opuesto de la escala

  // Coherencia: hallazgos de sistema (si no hay DS, se mide por prohibiciones)
  const penalSistema = (opts.ds ? porCategoria.get("estandares") ?? 0 : 0) + (porCategoria.get("bug") ?? 0) * 0.5;
  const coherencia = Math.max(0, Math.min(10, Math.round((10 - penalSistema) * 10) / 10));

  const ux = nota("visual");
  const accesibilidad = nota("accesibilidad");
  const responsive = nota("movil");
  const codigo = nota("bug");

  // Iteración: proporción de iteraciones que mejoraron
  const its = opts.iteraciones ?? [];
  const iteracion = its.length
    ? Math.round((its.filter((i) => i.mejoro).length / its.length) * 10 * 10) / 10
    : 10;

  const evidencia: Record<keyof MetricasForja, string> = {
    identidad: `identidad anti-genérica ${inf.identidad}/100 (${inf.hallazgos.filter((h) => h.categoria === "visual").length} hallazgos visuales)`,
    genericidad: `${inf.criticos + inf.avisos} síntomas activos; identidad compuesta ${inf.identidad}/100`,
    coherencia: opts.ds ? `${inf.hallazgos.filter((h) => h.categoria === "estandares").length} desviaciones de sistema` : "sin design system declarado: coherencia medida por bugs",
    ux: `${porCategoria.get("visual") ?? 0} penalizaciones visuales/UX`,
    accesibilidad: `${porCategoria.get("accesibilidad") ?? 0} penalizaciones de accesibilidad`,
    responsive: `${porCategoria.get("movil") ?? 0} penalizaciones móviles`,
    codigo: `${inf.criticos} críticos de código`,
    iteracion: its.length ? `${its.filter((i) => i.mejoro).length}/${its.length} iteraciones mejoraron` : "sin iteraciones (aprobó directo)",
  };

  const vals = { identidad, genericidad, coherencia, ux, accesibilidad, responsive, codigo, iteracion };
  const pesoTotal = Object.values(PESOS).reduce((a, b) => a + b, 0);
  const media = Math.round((Object.entries(vals) as [keyof MetricasForja, number][])
    .reduce((s, [k, v]) => s + v * PESOS[k], 0) / pesoTotal * 10) / 10;

  const peor = (Object.entries(vals) as [keyof MetricasForja, number][])
    .sort((a, b) => a[1] - b[1])[0];

  return {
    ...vals,
    evidencia,
    media,
    resumen: `Media ponderada ${media}/10. Punto débil: ${peor[0]} (${peor[1]}/10). ${inf.resumen}`,
  };
}

/** Texto de la medición para el chat/panel. */
export function textoMedicion(m: MedicionForja): string {
  const linea = (k: keyof MetricasForja): string => `${k}: ${m[k]}/10 — ${m.evidencia[k]}`;
  return [
    `## Métricas (media ponderada ${m.media}/10)`,
    linea("identidad"),
    linea("genericidad"),
    linea("coherencia"),
    linea("ux"),
    linea("accesibilidad"),
    linea("responsive"),
    linea("codigo"),
    linea("iteracion"),
  ].join("\n");
}
