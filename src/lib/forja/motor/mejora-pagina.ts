/** FORJA IA — «MEJORA MI PÁGINA» (v4.0.0, sección 24 del plan maestro).
 *
 * Modo sobre código existente (git repo, HTML, React, Next.js, Vue…):
 *
 *   analizar → extraer sistema actual → crear ADN → detectar genericidad
 *   → proponer rediseño → generar variante → comparar → aplicar cambios
 *
 * Encaja con la filosofía de refresh/migration de OpenDesign: FORJA hace
 * el análisis y el criterio; la generación de la variante es del Codificador
 * (modelo inyectado) o del runtime. Las etapas 1-4 son 100% deterministas:
 * funcionan sin modelo y dan valor de inmediato (diagnóstico honesto).
 */

import type { AdnVisual2 } from "./tipos-v4";
import { adn2DesdeAdn1, sanearAdn2 } from "./adn2";
import { detectarGenericidad } from "./antigenerico";
import { analisisVisual } from "./antigenerico2";
import { chequeosEstaticos, type HallazgoVision } from "./vision";
import { revisarVisual } from "./revisor-visual";
import { scoreDe } from "./bucle-mejora";

/* -------------------------------- tipos ------------------------------------ */

/** El sistema actual extraído del código. */
export interface SistemaActual {
  /** colores en uso (hex normalizados) */
  colores: string[];
  /** familias tipográficas en uso */
  fuentes: string[];
  /** secciones detectadas (por orden de aparición) */
  secciones: string[];
  /** frameworks/libraries sospechados (por huellas) */
  frameworks: string[];
  /** tamaño aproximado del sistema (px de escala tipográfica) */
  escalaTipografica: string[];
}

/** El diagnóstico completo de «mejora mi página». */
export interface DiagnosticoMejora {
  sistema: SistemaActual;
  /** hallazgos del inspector sobre el código actual */
  hallazgos: HallazgoVision[];
  /** informe anti-genérico (capa 1 + capa 2) */
  identidad: number;
  sintomas: string[];
  /** score 0..100 del código actual */
  scoreActual: number;
  /** el ADN 2.0 reconstruido desde el código actual */
  adnDetectado: AdnVisual2;
  /** la propuesta de rediseño (qué cambiar y por qué) */
  propuesta: string[];
  /** pasos siguientes del pipeline (para la UI) */
  siguientesPasos: string[];
}

/* ----------------------------- análisis actual ------------------------------ */

/** Huellas de frameworks conocidos (solo lectura, sin dependencias). */
const HUELLAS_FRAMEWORKS: { nombre: string; pista: RegExp }[] = [
  { nombre: "Next.js", pista: /__next|next\/head|data-nextjs/i },
  { nombre: "React", pista: /data-reactroot|react-dom/i },
  { nombre: "Vue", pista: /data-v-[0-9a-f]{8}|v-app/i },
  { nombre: "Tailwind", pista: /\b(?:flex|grid)\s+(?:items-|justify-|gap-)|\b(?:bg|text|p|m)-\[/i },
  { nombre: "Bootstrap", pista: /\b(?:btn|col-md|row|container-fluid)\b/i },
  { nombre: "WordPress", pista: /wp-content|wp-includes/i },
];

/** Extrae el sistema actual de un HTML/código. Determinista. */
export function extraerSistemaActual(codigo: string): SistemaActual {
  const colores = [...new Set([...codigo.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toLowerCase()))].slice(0, 10);
  const fuentes = listaDeFuentes(codigo);
  const secciones = [
    ...codigo.matchAll(/<(?:section|header|footer|nav|main)[^>]*(?:class|id)="([^"]{2,40})"/gi),
  ]
    .map((m) => m[1].split(/\s+/)[0])
    .slice(0, 10);
  const frameworks = HUELLAS_FRAMEWORKS.filter((f) => f.pista.test(codigo)).map((f) => f.nombre);
  const escala = [...new Set([...codigo.matchAll(/font-size\s*:\s*([\d.]+)(?:px|rem)/gi)].map((m) => `${m[1]}${m[2]}`))].slice(0, 6);
  return { colores, fuentes, secciones, frameworks, escalaTipografica: escala };
}

function listaDeFuentes(codigo: string): string[] {
  const out: string[] = [];
  const vistos = new Set<string>();
  for (const m of codigo.matchAll(/font-family\s*:\s*([^;}]+)/gi)) {
    const primera = m[1].split(",")[0].replace(/["']/g, "").trim().slice(0, 40);
    const clave = primera.toLowerCase();
    if (primera && !vistos.has(clave)) {
      vistos.add(clave);
      out.push(primera);
    }
    if (out.length >= 4) break;
  }
  return out;
}

/* ------------------------------- diagnóstico -------------------------------- */

/** Diagnóstico completo del código actual (pasos 1-5 del plan, sin modelo). */
export function diagnosticarPagina(codigo: string, mensajeUsuario = ""): DiagnosticoMejora {
  const sistema = extraerSistemaActual(codigo);
  const hallazgos = chequeosEstaticos(codigo);
  const gen1 = detectarGenericidad(codigo);
  const gen2 = analisisVisual(codigo);
  const informe = revisarVisual(codigo);
  const identidad = Math.round(gen1.puntuacionIdentidad * 0.5 + gen2.puntuacion * 0.5);

  // ADN detectado: reconstrucción honesta desde lo que HAY
  const adnDetectado = sanearAdn2({
    ...adn2DesdeAdn1(null, mensajeUsuario),
    identidad: identidad >= 70
      ? "el proyecto actual ya tiene voz propia (conservar y potenciar)"
      : "el proyecto actual deriva a plantilla (necesita decisiones propias)",
    color: sistema.colores.slice(0, 3).map((c) => `color en uso: ${c} (decidir si se queda)`) ,
    tipografia: sistema.fuentes.slice(0, 2).map((f) => `fuente en uso: ${f}`),
    composicion: [
      `${sistema.secciones.length} secciones: ${sistema.secciones.slice(0, 5).join(" → ") || "(sin estructura clara)"}`,
      `focal point: ${gen2.focalPoint ? "presente" : "AUSENTE (definir uno)"}`,
    ],
    referencias: [],
    antiPatrones: gen1.sintomas.map((s) => s.nombre),
  });

  // Propuesta: los hallazgos convertidos en decisiones
  const propuesta: string[] = [];
  if (!gen2.focalPoint) propuesta.push("Definir UN focal point dominante en la portada (ahora la vista no aterriza en nada).");
  for (const s of gen1.sintomas.slice(0, 4)) {
    propuesta.push(`Sustituir «${s.nombre}» → ${s.alternativa}`);
  }
  for (const s of gen2.sintomas.slice(0, 3)) {
    propuesta.push(`Composición: ${s.nombre} (${s.evidencia}) → romper el patrón con estructura variable.`);
  }
  const criticos = hallazgos.filter((h) => h.severidad === "critico");
  if (criticos.length) {
    propuesta.push(`Reparar ${criticos.length} hallazgo(s) crítico(s) del inspector antes de cualquier estética.`);
  }
  if (!propuesta.length) {
    propuesta.push("El código actual está sano: el rediseño debe ser quirúrgico (foco, identidad, detalle), no un refactor.");
  }

  return {
    sistema,
    hallazgos,
    identidad,
    sintomas: [...gen1.sintomas.map((s) => s.nombre), ...gen2.sintomas.map((s) => s.nombre)],
    scoreActual: scoreDe(informe),
    adnDetectado,
    propuesta: propuesta.slice(0, 8),
    siguientesPasos: [
      "confirmar el ADN detectado con el usuario (o ajustar)",
      "generar la VARIANTE con el Codificador respetando el ADN",
      "comparar score actual vs variante (revisor visual)",
      "aplicar solo si la variante GANA con evidencia",
    ],
  };
}

/* -------------------------- prompt de la variante --------------------------- */

/** Prompt para que el Codificador genere la VARIANTE mejorada. */
export function promptVarianteMejora(codigo: string, diagnostico: DiagnosticoMejora): string {
  return [
    `## Genera la VARIANTE mejorada de esta página`,
    `ADN detectado (respetar y POTENCIAR):`,
    `- Identidad: ${diagnostico.adnDetectado.identidad}`,
    `- Composición: ${diagnostico.adnDetectado.composicion.join("; ")}`,
    `- Prohibido: ${[...diagnostico.adnDetectado.prohibiciones, ...diagnostico.adnDetectado.antiPatrones].join("; ")}`,
    ``,
    `## Cambios pedidos (con evidencia, no gustos)`,
    ...diagnostico.propuesta.map((p, i) => `${i + 1}. ${p}`),
    ``,
    `## Código actual`,
    codigo.slice(0, 50000),
    ``,
    `Devuelve el HTML COMPLETO de la variante. Solo el código.`,
  ].join("\n");
}

/** Comparación honesta antes/depués: ¿la variante ganó? */
export function compararMejora(scoreActual: number, scoreVariante: number): {
  aplicable: boolean;
  veredicto: string;
} {
  const delta = scoreVariante - scoreActual;
  return {
    aplicable: delta > 0,
    veredicto:
      delta > 0
        ? `La variante GANA (+${delta} puntos): procede aplicar.`
        : delta === 0
          ? "Empate técnico: conservar el original (no cambiar por cambiar)."
          : `La variante PIERDE (${delta} puntos): descartar y conservar el original.`,
  };
}
