/** FORJA IA — ANTI-GENERIC ENGINE 2.0 (v4.0.0, fase 7 del plan maestro).
 *
 * El detector v3 (antigenerico.ts) es la CAPA 1. El plan exige tres capas:
 *
 *   CAPA 1 — DETERMINISTA (regex/DOM/CSS): hero genérico, tarjetas
 *            repetitivas, CTA estándar, colores frecuentes, blobs,
 *            gradientes, glassmorphism, estructuras repetidas.
 *            → YA EXISTE, se reutiliza tal cual (gratis, cada pasada).
 *
 *   CAPA 2 — VISUAL (screenshot/visión): composición predecible, repetición
 *            visual, exceso de simetría, densidad, monotonía, falta de
 *            focal point. Aquí hay dos vías: (a) proxies deterministas que
 *            miden ESTRUCTURA del HTML (simetría de secciones, repetición
 *            de bloques, densidad de contenido, focal) — gratis y siempre
 *            disponibles; (b) el modelo multimodal vía LlamadaVision
 *            (contrato en vision.ts) cuando el host la inyecta.
 *
 *   CAPA 3 — SEMÁNTICA (modelo): la pregunta del plan — «¿el diseño tiene
 *            una razón para existir o podría cambiarse el logo y venderse
 *            como otra plantilla?». Contrato listo: prompt + parser; corre
 *            solo cuando hay modelo y perfil lo permite.
 *
 * La puntuación compuesta (0..100 de identidad) combina las tres capas con
 * pesos: capa 1 x0.5, capa 2 x0.3, capa 3 x0.2. Sin capa 3 el peso se
 * reparte entre las disponibles: NUNCA se inventa información.
 */

import {
  type InformeAntiGenerico,
  type SintomaGenerico,
  detectarGenericidad,
} from "./antigenerico";
import { idV4 } from "./tipos-v4";

/* -------------------------------- tipos ------------------------------------ */

/** Un síntoma de la capa visual (proxies deterministas del HTML). */
export interface SintomaVisual {
  id: string;
  nombre: string;
  /** qué mide exactamente (con el dato: «7 secciones idénticas») */
  evidencia: string;
  gravedad: 1 | 2 | 3;
}

/** Informe de la capa visual por proxies estructurales. */
export interface InformeVisual {
  sintomas: SintomaVisual[];
  /** 0..100 composición con intención */
  puntuacion: number;
  focalPoint: boolean;
}

/** El informe completo de 3 capas. */
export interface InformeAntiGenerico2 {
  capa1: InformeAntiGenerico;
  capa2: InformeVisual;
  /** presente solo si hubo modelo y respondió */
  capa3: {
    /** el veredicto del modelo: tiene razón para existir */
    razonParaExistir: boolean;
    /** la explicación del modelo */
    justificacion: string;
    /** 0..100 */
    puntuacion: number;
  } | null;
  /** 0..100 identidad compuesta */
  puntuacionCompuesta: number;
  nivel: "bajo" | "medio" | "alto";
  motivo: string;
  /** la pregunta exacta de la capa semántica (para trazabilidad) */
  preguntaSemantica: string;
}

/* ----------------------------- capa 2 · visual ------------------------------ */

/** Analiza la composición del HTML con proxies estructurales deterministas. */
export function analisisVisual(html: string): InformeVisual {
  const sintomas: SintomaVisual[] = [];
  if (!html) return { sintomas: [], puntuacion: 100, focalPoint: false };

  // 1. Simetría: secciones hermano con la misma huella de clases
  const secciones = html.match(/<(?:section|article)[^>]*class="[^"]*"[^>]*>/gi) ?? [];
  const huellas = secciones.map(huellasDe);
  const conteo = new Map<string, number>();
  for (const h of huellas) conteo.set(h, (conteo.get(h) ?? 0) + 1);
  const repetidas = [...conteo.entries()].filter(([, n]) => n >= 3);
  if (repetidas.length) {
    sintomas.push({
      id: "simetria-excesiva",
      nombre: "Simetría excesiva",
      evidencia: `${repetidas[0][1]} secciones con estructura idéntica (mismas clases)`,
      gravedad: 2,
    });
  }

  // 2. Monotonía: alturas uniformes sospechosas (misma altura inline en ≥4 bloques)
  const alturas = [...html.matchAll(/min-height\s*:\s*(\d{2,4})px/gi)].map((m) => m[1]);
  const conteoAlturas = new Map<string, number>();
  for (const a of alturas) conteoAlturas.set(a, (conteoAlturas.get(a) ?? 0) + 1);
  const alturaRepetida = [...conteoAlturas.entries()].find(([, n]) => n >= 4);
  if (alturaRepetida) {
    sintomas.push({
      id: "monotonia",
      nombre: "Monotonía de bloques",
      evidencia: `${alturaRepetida[1]} bloques con la misma min-height (${alturaRepetida[0]}px)`,
      gravedad: 1,
    });
  }

  // 3. Densidad: ratio de texto real vs etiquetas (cachos de contenido)
  const texto = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const etiquetas = (html.match(/</g) ?? []).length;
  const densidad = etiquetas > 0 ? texto.length / etiquetas : 0;
  if (etiquetas > 40 && densidad < 8) {
    sintomas.push({
      id: "densidad-baja",
      nombre: "Densidad de contenido baja",
      evidencia: `${etiquetas} etiquetas para ~${texto.length} caracteres de texto (cajitas vacías)`,
      gravedad: 2,
    });
  }

  // 4. Focal point: ¿hay UN elemento declaradamente dominante?
  const h1 = (html.match(/<h1[\s>]/i) ?? []).length;
  const hero = /class="[^"]*(?:hero|portada|destacad|principal)[^"]*"/i.test(html);
  const focalPoint = h1 === 1 && hero;
  if (!focalPoint) {
    sintomas.push({
      id: "sin-focal",
      nombre: "Falta de focal point",
      evidencia: h1 === 1 ? "h1 único pero sin bloque dominante declarado" : `${h1} h1: la atención no tiene dónde aterrizar`,
      gravedad: 2,
    });
  }

  // 5. Repetición visual de cards/list items con contenido clavado
  const items = html.match(/<(?:li|article|div)[^>]*class="[^"]*(?:card|tarjeta|item)[^"]*"[^>]*>/gi) ?? [];
  if (items.length >= 3) {
    sintomas.push({
      id: "repeticion-visual",
      nombre: "Repetición visual",
      evidencia: `${items.length} tarjetas ídem (catálogo de plantilla)`,
      gravedad: 2,
    });
  }

  // puntuación: 100 - 12 por gravedad 2/3, -6 por gravedad 1
  let p = 100;
  for (const s of sintomas) p -= s.gravedad === 1 ? 6 : 12;
  return { sintomas, puntuacion: Math.max(0, Math.min(100, p)), focalPoint };
}

function huellasDe(tag: string): string {
  return (tag.match(/class="([^"]*)"/i)?.[1] ?? "")
    .split(/\s+/)
    .sort()
    .join(" ");
}

/* ----------------------------- capa 3 · semántica --------------------------- */

/** La pregunta exacta del plan (sección 14): el test de la plantilla. */
export const PREGUNTA_SEMANTICA =
  "¿El diseño tiene una razón para existir o podría cambiarse el logo y venderse como otra plantilla?";

/** Prompt de la capa semántica. El modelo juzga INTENCIÓN, no estética. */
export function promptCapaSemantica(html: string, adnIdentidad: string): string {
  return [
    `## Test semántico de identidad`,
    `Pregunta: «${PREGUNTA_SEMANTICA}»`,
    `Identidad declarada del proyecto: ${adnIdentidad || "(no declarada)"}`,
    ``,
    `HTML (recorte):`,
    html.slice(0, 6000),
    ``,
    `Responde EXACTAMENTE:`,
    `<test-identidad>`,
    `Razon para existir: si|no`,
    `Justificacion: (2-3 frases: qué decisiones demuestran intención propia o qué es sustituible por plantilla)`,
    `Puntuacion: N/100 (100 = imposible confundirlo con otra marca)`,
    `</test-identidad>`,
  ].join("\n");
}

/** Parser tolerante del <test-identidad>. Devuelve null si no hay bloque. */
export function parseCapaSemantica(texto: string): InformeAntiGenerico2["capa3"] | null {
  if (!texto) return null;
  const bloque = texto.match(/<test-identidad>([\s\S]*?)<\/test-identidad>/i)?.[1];
  if (!bloque) return null;
  const si = /raz[oó]n\s*para\s*existir\s*:\s*si\b/i.test(bloque);
  const no = /raz[oó]n\s*para\s*existir\s*:\s*no\b/i.test(bloque);
  if (!si && !no) return null;
  const just = (bloque.match(/Justificaci[oó]n\s*:\s*([\s\S]*?)(?=\n\s*Puntuaci[oó]n\s*:|$)/i)?.[1] ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
  const punt = Number(bloque.match(/Puntuaci[oó]n\s*:\s*(\d{1,3})/i)?.[1] ?? NaN);
  return {
    razonParaExistir: si,
    justificacion: just || (si ? "con intención declarada" : "sustituible por plantilla"),
    puntuacion: Number.isNaN(punt) ? (si ? 70 : 30) : Math.max(0, Math.min(100, punt)),
  };
}

/* --------------------------- informe compuesto ------------------------------ */

/** Ponderación de la puntuación compuesta. */
function componer(c1: number, c2: number, c3: number | null): number {
  if (c3 === null) return Math.round(c1 * 0.62 + c2 * 0.38);
  return Math.round(c1 * 0.5 + c2 * 0.3 + c3 * 0.2);
}

/** Informe completo de 3 capas. La capa 3 solo se incluye si el host pasa
 * la función de modelo (misma disciplina que el resto del módulo). */
export async function informeAntiGenerico2(
  html: string,
  adnIdentidad: string,
  llamarModelo?: (args: { system: string; user: string; temperatura: number }) => Promise<string>
): Promise<InformeAntiGenerico2> {
  const capa1 = detectarGenericidad(html);
  const capa2 = analisisVisual(html);
  let capa3: InformeAntiGenerico2["capa3"] = null;
  if (llamarModelo && html) {
    try {
      const salida = await llamarModelo({
        system: promptCapaSemantica(html, adnIdentidad),
        user: "Aplica el test de identidad.",
        temperatura: 0.2,
      });
      capa3 = parseCapaSemantica(salida);
    } catch {
      capa3 = null;
    }
  }
  const puntuacionCompuesta = componer(capa1.puntuacionIdentidad, capa2.puntuacion, capa3?.puntuacion ?? null);
  const nivel: InformeAntiGenerico2["nivel"] = puntuacionCompuesta >= 80 ? "bajo" : puntuacionCompuesta >= 55 ? "medio" : "alto";
  const motivos: string[] = [capa1.motivo];
  if (capa2.sintomas.length) {
    motivos.push(`Capa visual: ${capa2.sintomas.map((s) => `${s.nombre} (${s.evidencia})`).join("; ")}`);
  }
  if (capa3 && !capa3.razonParaExistir) {
    motivos.push(`Test semántico: el diseño no demuestra razón para existir — ${capa3.justificacion}`);
  }
  return {
    capa1,
    capa2,
    capa3,
    puntuacionCompuesta,
    nivel,
    motivo: motivos.filter(Boolean).join(" · "),
    preguntaSemantica: PREGUNTA_SEMANTICA,
  };
}

/** Síntomas unificados de las capas 1 y 2 (para el Revisor y los jueces). */
export function sintomasUnificados(informe: InformeAntiGenerico2): SintomaGenerico[] {
  const out: SintomaGenerico[] = [...informe.capa1.sintomas];
  for (const s of informe.capa2.sintomas) {
    out.push({
      id: `v-${s.id}`,
      nombre: s.nombre,
      motivo: s.evidencia,
      alternativa: "romper el patrón: variar estructura, densidad o foco de esos bloques",
      gravedad: s.gravedad,
    });
  }
  return out;
}

/** Texto del informe para prompts (Revisor / juez de originalidad). */
export function textoInforme2(informe: InformeAntiGenerico2): string {
  return [
    `NIVEL DE SATURACIÓN: ${informe.nivel.toUpperCase()} (identidad compuesta ${informe.puntuacionCompuesta}/100)`,
    informe.motivo,
    informe.capa3 ? `Test semántico: «${informe.preguntaSemantica}» → ${informe.capa3.razonParaExistir ? "SÍ" : "NO"}` : `Test semántico no aplicado (sin modelo en este perfil)`,
  ].join("\n");
}

/** Id de informe para trazas. */
export function nuevoIdInforme(): string {
  return idV4("ag2");
}
