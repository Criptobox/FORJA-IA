/** FORJA IA — REVISOR VISUAL AUTOMÁTICO (v4.0.0, fase 10 del plan maestro).
 *
 * Después de generar el HTML, el plan exige este pipeline:
 *
 *   HTML → render → screenshot → vision → DOM → CSS
 *        → anti-generic → accessibility → responsive
 *
 *   Resultado: PASS / WARN / FAIL
 *   Cada hallazgo: problema + evidencia + gravedad + causa probable +
 *   corrección propuesta.
 *
 * Implementación fiel al módulo: las etapas DOM/CSS/a11y/responsive son los
 * 17 chequeos deterministas de vision.ts (gratis, siempre); anti-generic es
 * la capa 1+2 de antigenerico2.ts; screenshot+vision es la vía opcional
 * (LlamadaVision de vision.ts) que el host inyecta si quiere visión real.
 * Este módulo ENRIQUECE los hallazgos de v3 con causa probable y corrección
 * propuesta (mapeo determinista por categoría) y emite el veredicto.
 */

import { type HallazgoVision, chequeosEstaticos } from "./vision";
import { analisisVisual } from "./antigenerico2";
import { detectarGenericidad } from "./antigenerico";
import type { HallazgoVisual2, VeredictoVisual } from "./tipos-v4";
import type { DesignSystemPrisma } from "./bridge-design-system";
import { auditarContraDesignSystem } from "./bridge-design-system";

/* ------------------------- causa y corrección por categoría ---------------- */

/** Mapeo determinista categoría+severidad → causa probable y corrección.
 * Es «el manual del Codificador»: lo que el Revisor sugiere tiene que ser
 * corregible, no una queja. */
function enriquecer(h: HallazgoVision): HallazgoVisual2 {
  let causaProbable = "descuido del generador";
  let correccion = "corregir directamente en el HTML/CSS";
  switch (h.categoria) {
    case "bug":
      causaProbable = "plantilla base incompleta o lógica por saltarse";
      correccion = "corregir el marcado en la fuente y re-renderizar";
      break;
    case "accesibilidad":
      causaProbable = "el generador priorizó apariencia sobre semántica";
      correccion = "añadir el atributo/estructura que falta (alt, label, lang, foco)";
      break;
    case "visual":
      causaProbable = "se copió el catálogo por defecto en vez de decidir";
      correccion = "sustituir por la decisión del ADN 2.0 (composición/escala/acento)";
      break;
    case "movil":
      causaProbable = "no se probó el viewport móvil";
      correccion = "revisar media queries y tamaños mínimos de objetivo táctil";
      break;
    case "seo":
      causaProbable = "metadatos no tratados como contenido";
      correccion = "declarar title/meta/estructura de encabezados";
      break;
    case "rendimiento":
      causaProbable = "recursos sin optimizar (fuentes, imágenes, animaciones)";
      correccion = "lazy-loading, pesos razonables y reduced-motion";
      break;
    case "seguridad":
      causaProbable = "enlaces/entradas sin endurecer";
      correccion = "noopener en _blank, escapar entradas, no inline data: sensible";
      break;
    case "estandares":
      causaProbable = "etiquetas o prácticas obsoletas";
      correccion = "usar HTML5 estándar y validar";
      break;
  }
  return { ...h, causaProbable, correccion };
}

/* ------------------------------- el revisor -------------------------------- */

/** Resultado del revisor visual. */
export interface InformeRevisorVisual {
  veredicto: VeredictoVisual;
  hallazgos: HallazgoVisual2[];
  /** resumen numérico */
  criticos: number;
  avisos: number;
  mejoras: number;
  /** identidad anti-genérica 0..100 (capa 1+2 compuestas) */
  identidad: number;
  /** líneas de resumen para el chat */
  resumen: string;
}

/** Opciones del revisor: auditar contra design system si hay. */
export interface OpcionesRevisorVisual {
  ds?: DesignSystemPrisma;
  /** umbral de avisos para WARN (defecto 3) */
  umbralAvisos?: number;
}

/** Revisa un HTML completo: inspector + anti-genérico 2 + sistema → PASS/WARN/FAIL. */
export function revisarVisual(html: string, opts: OpcionesRevisorVisual = {}): InformeRevisorVisual {
  const hallazgosBrutos: HallazgoVision[] = html ? chequeosEstaticos(html) : [];
  const gen = html ? detectarGenericidad(html) : null;
  const visual = html ? analisisVisual(html) : null;
  const sistema = opts.ds && html ? auditarContraDesignSystem(html, opts.ds) : [];

  // los síntomas de composición de la capa 2 entran como hallazgos también
  const deCapa2: HallazgoVision[] = (visual?.sintomas ?? []).map((s) => ({
    severidad: s.gravedad === 3 ? "critico" : s.gravedad === 2 ? "aviso" : "mejora",
    categoria: "visual" as const,
    titulo: `Anti-genérico (capa visual): ${s.nombre}`,
    detalle: s.evidencia,
  }));

  const todos = [...hallazgosBrutos, ...sistema, ...deCapa2].map(enriquecer);
  const criticos = todos.filter((h) => h.severidad === "critico").length;
  const avisos = todos.filter((h) => h.severidad === "aviso").length;
  const mejoras = todos.filter((h) => h.severidad === "mejora").length;

  const umbral = opts.umbralAvisos ?? 3;
  const veredicto: VeredictoVisual =
    !html || criticos > 0 ? "FAIL" : avisos >= umbral ? "WARN" : "PASS";

  const identidad = gen ? Math.round(gen.puntuacionIdentidad * 0.5 + (visual?.puntuacion ?? 100) * 0.5) : 100;

  const partes: string[] = [];
  partes.push(veredicto === "PASS" ? "Entrega aprobada por el revisor visual." : veredicto === "WARN" ? `Entrega con ${avisos} aviso(s): corregir antes de exportar.` : `Entrega rechazada: ${criticos} hallazgo(s) crítico(s).`);
  if (visual && !visual.focalPoint) partes.push("Sin focal point claro.");
  if (gen && gen.nivel !== "bajo") partes.push(`Anti-genérico: saturación ${gen.nivel}.`);

  return {
    veredicto,
    hallazgos: todos.slice(0, 24),
    criticos,
    avisos,
    mejoras,
    identidad,
    resumen: partes.join(" "),
  };
}

/** Texto del informe para el chat y para el prompt del Revisor-modelo. */
export function textoRevisorVisual(inf: InformeRevisorVisual): string {
  const simbolo = { PASS: "✅", WARN: "⚠️", FAIL: "❌" }[inf.veredicto];
  const lineas = [`${simbolo} ${inf.veredicto} — ${inf.resumen}`];
  for (const h of inf.hallazgos.slice(0, 12)) {
    lineas.push(`- [${h.severidad}] ${h.titulo} — ${h.detalle} · causa: ${h.causaProbable} · corrección: ${h.correccion}`);
  }
  return lineas.join("\n");
}

/** Los defectos que el bucle de mejora (fase 11) debe intentar corregir:
 * solo críticos y avisos, con su corrección propuesta. */
export function defectosCorregibles(inf: InformeRevisorVisual): { titulo: string; correccion: string }[] {
  return inf.hallazgos
    .filter((h) => h.severidad !== "mejora")
    .slice(0, 8)
    .map((h) => ({ titulo: h.titulo, correccion: h.correccion }));
}
