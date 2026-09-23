/** FORJA IA — EXPERIENCE BIAS: detector editorial + métricas de experiencia
 * (v4.5.0, correcciones §11 y §12).
 *
 * ─── §11: el Editorial Score ───
 * Detector AUTOMÁTICO de que la composición vuelve a caer en «revista».
 * Señales (proxies deterministas sobre el HTML, sin DOM, sin red):
 *
 *   textDensity · largeTextBlocks · imageRectangles · readingFlow
 *   sectionCount · cardInteraction · motion · depth · 3d
 *   floatingElements · interactiveSurfaces
 *
 *   editorialScore = textDensity×0.25 + readingFlow×0.20 + imageRectangles×0.15
 *                    − motion×0.10 − depth×0.10 − interaction×0.10 − spatial×0.10
 *
 * NO es una opinión estética: es una señal TÉCNICA de que el resultado se
 * acerca otra vez al mismo patrón. Se mide, se registra y —si supera el
 * umbral— dispara el patch-first de experience-qa.ts.
 *
 * ─── §12: las métricas de experiencia ───
 *   editorial · spatial · motion · interaction · depth
 *   · componentRichness · visualNovelty
 *
 * El objetivo NO es maximizarlas todas: es verificar que la experiencia
 * COINCIDE con el ADN elegido (desviación, no máximo).
 *
 * Reglas de la casa: sin red, sin React, TypeScript estricto, nunca lanza.
 */

import type { ExperienciaDna } from "./experience-dna";

/* ------------------------------ métricas ----------------------------------- */

export interface MetricasExperiencia {
  /** 0..1 — cuánto «revista» tiene esta página (§11) */
  editorial: number;
  spatial: number;
  motion: number;
  interaction: number;
  depth: number;
  componentRichness: number;
  visualNovelty: number;
}

export interface SenalesHtml {
  textDensity: number;
  largeTextBlocks: number;
  imageRectangles: number;
  readingFlow: number;
  sectionCount: number;
  cardInteraction: number;
  motion: number;
  depth: number;
  threeD: number;
  floatingElements: number;
  interactiveSurfaces: number;
}

/** Quita etiquetas HTML en bucle hasta que no queda ninguna: un solo pase
 * de regex puede dejar una etiqueta reconstruida a partir de fragmentos
 * anidados (p. ej. `<scr<script>ipt>`), así que se repite hasta que el
 * resultado deja de cambiar. Solo se usa para medir densidad de texto —
 * nunca se reinyecta como HTML —, pero mejor sanear de verdad que confiar
 * en que nadie meta HTML adversarial en el brief. */
function quitarEtiquetas(s: string, patron: RegExp): string {
  let anterior: string;
  let actual = s;
  do {
    anterior = actual;
    actual = actual.replace(patron, "");
  } while (actual !== anterior);
  return actual;
}

/** Señales brutas 0..1 sobre el HTML (regex seguras, sin parsear DOM). */
export function senalesHtml(html: string): SenalesHtml {
  const h = html || "";
  const clamp = (n: number): number => Math.max(0, Math.min(1, n));
  const sinScripts = quitarEtiquetas(h, /<(script|style)[^>]*>[\s\S]*?<\/\1\s*>/gi);
  const texto = quitarEtiquetas(sinScripts, /<[^>]+>/g).replace(/</g, " ");
  const _textoLen = texto.replace(/\s+/g, " ").trim().length;
  const totalLen = Math.max(1, h.length);

  // textDensity: cuánto del archivo es párrafo corrido
  const parrafos = [...h.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) =>
    quitarEtiquetas(m[1], /<[^>]+>/g).replace(/</g, " ").trim()
  );
  const enParrafos = parrafos.join(" ").length;
  const textDensity = clamp(enParrafos / Math.max(1, totalLen * 0.18));

  // largeTextBlocks: párrafos largos (> 240 chars) — prosa corrida
  const largos = parrafos.filter((p) => p.length > 240).length;
  const largeTextBlocks = clamp(largos / 4);

  // imageRectangles: imágenes rectangulares dentro de cajas uniformes
  const imgs = (h.match(/<img\b/gi) ?? []).length;
  const figure = (h.match(/<figure|class="[^"]*(media|photo|imagen)[^"]*"/gi) ?? []).length;
  const imageRectangles = clamp((imgs + figure) / 10);

  // readingFlow: artículo/main de columna única con prosa
  const articulo = /<article\b|<main\b/i.test(h) ? 0.4 : 0;
  const columnasUnicas = /max-width:\s*(600|620|640|660|680|700|720)px/i.test(h) ? 0.4 : 0;
  const readingFlow = clamp(articulo + columnasUnicas + (largos > 2 ? 0.2 : 0));

  const sectionCount = clamp((h.match(/<section\b/gi) ?? []).length / 6);

  // movimiento: animaciones/transiciones/keyframes
  const anims = (h.match(/@keyframes\b/gi) ?? []).length + (h.match(/transition\s*:/gi) ?? []).length + (h.match(/animation\s*:/gi) ?? []).length;
  const motion = clamp(anims / 12);

  // depth: translateZ / perspective / parallax
  const depthHits = (h.match(/translateZ|perspective\s*:|preserve-3d|parallax/gi) ?? []).length;
  const depth = clamp(depthHits / 6);

  // 3D real
  const threeD = clamp((h.match(/preserve-3d|transform-style\s*:\s*3d|rotate3d|rotate[XYZ]/gi) ?? []).length / 4);

  // floating: posicionados + sombras de elevación
  const floats = (h.match(/position\s*:\s*(absolute|fixed)/gi) ?? []).length + (h.match(/shadow-floating|--shadow-deep|box-shadow\s*:[^;]{20,}/gi) ?? []).length;
  const floatingElements = clamp(floats / 8);

  // interacción: hover con transform/box-shadow, cursor pointer, ARIA expandible
  const hovers = (h.match(/:hover[^{]*\{[^}]*(transform|box-shadow|filter|background)/gi) ?? []).length;
  const interactiveSurfaces = clamp(hovers / 6);
  const cardInteraction = clamp((h.match(/<button|role="button"|tabindex="[0-9]"/gi) ?? []).length / 8);

  return { textDensity, largeTextBlocks, imageRectangles, readingFlow, sectionCount, cardInteraction, motion, depth, threeD, floatingElements, interactiveSurfaces };
}

/** El Editorial Score del doc §11, normalizado a 0..1. Las ponderaciones
 * son las EXACTAS del doc:
 *
 *   editorialScore = textDensity×0.25 + readingFlow×0.20 + imageRectangles×0.15
 *                    − motion×0.10 − depth×0.10 − interaction×0.10 − spatial×0.10
 *
 * La parte positiva (máx. 0.60 con esos pesos) se NORMALIZA a 0..1 para que
 * el umbral de alarma sea operativo (sin normalizar, una página puramente
 * editorial sin imágenes tocaría techo en 0.60 y el umbral 0.62 sería
 * inalcanzable). Las penalizaciones se aplican después, igual que el doc.
 * 0 = nada de revista, 1 = revista pura. */
export function scoreEditorial(s: SenalesHtml): number {
  const positivo = (s.textDensity * 0.25 + s.readingFlow * 0.2 + s.imageRectangles * 0.15) / 0.6;
  const raw = positivo - s.motion * 0.1 - s.depth * 0.1 - s.cardInteraction * 0.1 - s.threeD * 0.1;
  return Math.max(0, Math.min(1, raw));
}

/** Umbral de alarma: por encima de esto, el QA de experiencia interviene. */
export const UMBRAL_EDITORIAL = 0.62;

/** Las 7 métricas de experiencia (§12) a partir de las señales. */
export function medirExperiencia(html: string): MetricasExperiencia {
  const s = senalesHtml(html);
  const edit = scoreEditorial(s);
  return {
    editorial: edit,
    spatial: Math.max(0, Math.min(1, s.depth * 0.6 + s.threeD * 0.25 + s.floatingElements * 0.15)),
    motion: s.motion,
    interaction: Math.max(s.interactiveSurfaces, s.cardInteraction * 0.8),
    depth: s.depth,
    componentRichness: Math.max(0, Math.min(1, (new Set((html.match(/class="[^"]{3,40}"/gi) ?? []).map((c) => c.slice(7, -1).split(/\s+/)[0]))).size / 22)),
    visualNovelty: Math.max(0, Math.min(1, 1 - edit)),
  };
}

/* --------------------------- desviación del ADN ----------------------------- */

export interface DesviacionExperiencia {
  /** 0..1 — 0 = la página coincide con el ADN de experiencia */
  desviacion: number;
  /** dimensiones desalineadas con la diferencia */
  desalineados: { dimension: string; esperado: number; observado: number }[];
  resumen: string;
}

/** ¿La experiencia medida COINCIDE con el ADN elegido? (§12: no se busca
 * el máximo, se busca la coherencia). Determinista y gratis. */
export function desviacionDeDna(m: MetricasExperiencia, e: ExperienciaDna): DesviacionExperiencia {
  const pares: { dimension: string; esperado: number; observado: number }[] = [
    { dimension: "spatial", esperado: e.spatial.depth, observado: m.spatial },
    { dimension: "motion", esperado: e.motion.intensity, observado: m.motion },
    { dimension: "interaction", esperado: e.interaction.richness, observado: m.interaction },
  ];
  const desalineados = pares.filter((p) => Math.abs(p.esperado - p.observado) > 0.35);
  const desviacion = Math.max(0, Math.min(1, desalineados.reduce((acc, p) => acc + Math.abs(p.esperado - p.observado), 0) / 3));
  const editorialAlta = m.editorial > UMBRAL_EDITORIAL && e.spatial.depth > 0.4;
  const resumen = editorialAlta
    ? `sesgo editorial alto (${Math.round(m.editorial * 100)}%) con ADN de profundidad: la página volvió a la revista`
    : desviacion > 0.35
      ? `experiencia desviada del ADN (${desalineados.map((d) => `${d.dimension} ${Math.round(d.esperado * 100)}%→${Math.round(d.observado * 100)}%`).join(", ")})`
      : `experiencia coherente con el ADN (editorial ${Math.round(m.editorial * 100)}%, desviación ${Math.round(desviacion * 100)}%)`;
  return { desviacion, desalineados, resumen };
}

/** Línea para la traza y el registro. */
export function resumenMetricas(m: MetricasExperiencia): string {
  const p = (n: number): string => `${Math.round(n * 100)}%`;
  return `editorial ${p(m.editorial)} · spatial ${p(m.spatial)} · motion ${p(m.motion)} · interacción ${p(m.interaction)} · depth ${p(m.depth)} · riqueza ${p(m.componentRichness)} · novedad ${p(m.visualNovelty)}`;
}
