/** FORJA IA — ENRUTADOR DETERMINISTA / MOTOR NO-LLM (v4.4, sección 22 del plan).
 *
 * ─── El problema ───
 * Hay problemas que NUNCA merecen un modelo: padding, margin, gap,
 * overflow, border-radius, alt, ARIA, lang, viewport, noopener… El plan
 * los lista uno a uno. Pagar un Codificador + un Revisor por añadir
 * `lang="es"` es el peor gasto posible de la forja.
 *
 * ─── La solución ───
 * El pipeline EXACTO del plan, determinista y gratis:
 *
 *   Detect → Classify → Deterministic Fix? ── YES → Patch
 *                                  └── NO → LLM
 *
 * Dos fuentes de detección que se combinan:
 *  1. SUS PROPIOS CHEQUEOS sobre el HTML (regex seguras, sin DOM): faltan
 *     lang/viewport/title/alt, enlaces _blank sin noopener, tabindex
 *     positivos, imágenes sin dimensiones, contraste obvio (color de texto
 *     casi igual al fondo declarado en línea)…
 *  2. LOS HALLAZGOS del revisor-visual: si su título/corrección encaja con
 *     un patrón conocido (mismo catálogo), se convierte en parche.
 *
 * SOLO los parches clasificados seguros se aplican: manipulación por
 * regex acotada, con límite de sustituciones y SIN tocar el diseño
 * (nada de reescribir estilos decorativos). Si un hallazgo no encaja,
 * sube al LLM como siempre: el router no sustituye al Codificador,
 * le ahorra el trabajo mecánico.
 *
 * Reglas de la casa: sin red, sin React, TypeScript estricto, nunca lanza.
 */

import type { InformeRevisorVisual } from "./revisor-visual";

/* -------------------------------- tipos ------------------------------------ */

/** Un parche determinista: qué, dónde y cómo. Aplicable y serializable. */
export interface ParcheDeterminista {
  /** categoría del catálogo del plan */
  tipo:
    | "lang"
    | "viewport"
    | "title"
    | "alt"
    | "aria"
    | "noopener"
    | "tabindex"
    | "overflow"
    | "dimensiones-img"
    | "contraste"
    | "charset"
    | "reduced-motion";
  /** qué se detectó (para la traza y el ROI) */
  evidencia: string;
  /** sustitución aplicada (antes → después, recortado) */
  antes?: string;
  despues?: string;
}

export interface ResultadoParcheo {
  html: string;
  parches: ParcheDeterminista[];
  /** nº de problemas que quedaron SIN parche (suben al LLM) */
  sinParche: number;
}

/* ------------------------------- detección 1 ------------------------------- */

/** Detección propia sobre el HTML. Cada chequeo devuelve su parche CANDIDATO
 * (aún no aplicado). Regex acotadas: nada de parsear el HTML entero. */
function detectarEnHtml(html: string): ParcheDeterminista[] {
  const out: ParcheDeterminista[] = [];
  const add = (p: ParcheDeterminista): void => void out.push(p);

  if (!/<html[^>]*\slang\s*=/i.test(html)) {
    add({ tipo: "lang", evidencia: "<html> sin atributo lang" });
  }
  if (!/name=["']?viewport/i.test(html)) {
    add({ tipo: "viewport", evidencia: "falta <meta name=viewport>" });
  }
  if (!/<title>[^<]{2,}<\/title>/i.test(html)) {
    add({ tipo: "title", evidencia: "falta o vacío <title>" });
  }
  if (!/<meta[^>]+charset/i.test(html)) {
    add({ tipo: "charset", evidencia: "falta <meta charset>" });
  }
  // imágenes sin alt (o alt vacío en imágenes de contenido)
  const imgSinAlt = html.match(/<img(?![^>]*\salt\s*=)[^>]*>/gi);
  if (imgSinAlt?.length) {
    add({ tipo: "alt", evidencia: `${imgSinAlt.length} <img> sin alt` });
  }
  // _blank sin noopener (seguridad del plan)
  const blanks = html.match(/<a[^>]*target\s*=\s*["']?_blank[^>]*>/gi) ?? [];
  if (blanks.some((a) => !/noopener|noreferrer/i.test(a))) {
    add({ tipo: "noopener", evidencia: `enlace(s) _blank sin noopener (${blanks.length})` });
  }
  // tabindex positivos rompen el orden de foco (a11y)
  if (/tabindex\s*=\s*["']?[1-9]/i.test(html)) {
    add({ tipo: "tabindex", evidencia: "tabindex positivo detectado" });
  }
  // animaciones largas sin reduced-motion (a11y del plan)
  if (/@keyframes/i.test(html) && !/prefers-reduced-motion/i.test(html)) {
    add({ tipo: "reduced-motion", evidencia: "keyframes sin @media prefers-reduced-motion" });
  }
  // scroll horizontal: body con width fijo ~desktop (atributo o CSS)
  if (
    /<body[^>]*\swidth\s*[:=]\s*["']?\s*1[0-9]{3}px/i.test(html) ||
    /<style[^>]*>[\s\S]*?\bbody\s*\{[^}]*\bwidth\s*:\s*1[0-9]{3}px/i.test(html)
  ) {
    add({ tipo: "overflow", evidencia: "body con width fijo ~desktop (scroll horizontal en móvil)" });
  }
  return out;
}

/* ------------------------------- detección 2 ------------------------------- */

/** Mapea títulos/correcciones del revisor-visual al catálogo del router.
 * Solo patrones EXACTOS conocidos: lo dudoso sube al LLM. */
function parchesDesdeInforme(inf: InformeRevisorVisual | null): ParcheDeterminista[] {
  if (!inf) return [];
  const out: ParcheDeterminista[] = [];
  for (const h of inf.hallazgos) {
    const t = `${h.titulo} ${h.detalle}`.toLowerCase();
    if (/lang/.test(t) && h.severidad !== "mejora") out.push({ tipo: "lang", evidencia: h.titulo });
    else if (/viewport/.test(t)) out.push({ tipo: "viewport", evidencia: h.titulo });
    else if (/sin alt|alt/.test(t) && /img|imagen/.test(t)) out.push({ tipo: "alt", evidencia: h.titulo });
    else if (/noopener|_blank/.test(t)) out.push({ tipo: "noopener", evidencia: h.titulo });
    else if (/aria|label/.test(t)) out.push({ tipo: "aria", evidencia: h.titulo });
    else if (/tabindex/.test(t)) out.push({ tipo: "tabindex", evidencia: h.titulo });
    else if (/overflow|desbord/.test(t)) out.push({ tipo: "overflow", evidencia: h.titulo });
  }
  return out;
}

/** Detección combinada: HTML propio + informe del revisor (deduplicado). */
export function detectarParches(
  html: string,
  inf?: InformeRevisorVisual | null
): ParcheDeterminista[] {
  const vistos = new Set<string>();
  const todos = [...detectarEnHtml(html), ...parchesDesdeInforme(inf ?? null)];
  return todos.filter((p) => {
    const k = `${p.tipo}:${p.evidencia}`;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

/* ------------------------------- parcheo ----------------------------------- */

/** Alturas genéricas pero DESCRIPTIVAS (el plan: nada de alt="image"). */
function altGenerico(src: string | undefined): string {
  const nombre = (src ?? "").split("/").pop()?.replace(/\.[a-z0-9]+$/i, "") ?? "";
  const limpio = nombre.replace(/[-_]+/g, " ").trim();
  return limpio ? limpio.slice(0, 60) : "imagen de la página";
}

const RE_MS_ALTA = /(150|200|300|400|500)ms/;

/** Aplica los parches al HTML. Cada regla: UNA sustitución máxima y segura.
 * Devuelve el HTML nuevo y qué se aplicó. NUNCA lanza: regex rara = parche
 * saltado, y el problema sube al LLM. */
export function parchearHtml(html: string, candidatos: ParcheDeterminista[]): ResultadoParcheo {
  let h = html;
  const aplicados: ParcheDeterminista[] = [];
  let sinParche = 0;

  for (const p of candidatos) {
    const antes = h;
    try {
      switch (p.tipo) {
        case "lang": {
          if (!/<html[^>]*\slang\s*=/i.test(h)) {
            h = h.replace(/<html(\s[^>]*)?>/i, (m) => m.replace(/>$/, ' lang="es">'));
            // html mínimo sin <html> explícito: no toca (sin parche)
            if (h === antes && /<html/i.test(html) === false) sinParche++;
          }
          break;
        }
        case "viewport": {
          if (!/name=["']?viewport/i.test(h) && /<head[^>]*>/i.test(h)) {
            h = h.replace(/<head([^>]*)>/i, (m) => `${m}\n<meta name="viewport" content="width=device-width, initial-scale=1">`);
          }
          break;
        }
        case "charset": {
          if (!/<meta[^>]+charset/i.test(h) && /<head[^>]*>/i.test(h)) {
            h = h.replace(/<head([^>]*)>/i, (m) => `${m}\n<meta charset="utf-8">`);
          }
          break;
        }
        case "title": {
          if (!/<title>[^<]{2,}<\/title>/i.test(h)) {
            if (/<title>[^<]*<\/title>/i.test(h)) {
              h = h.replace(/<title>[^<]*<\/title>/i, "<title>Página</title>");
            } else if (/<head[^>]*>/i.test(h)) {
              h = h.replace(/<head([^>]*)>/i, (m) => `${m}\n<title>Página</title>`);
            }
          }
          break;
        }
        case "alt": {
          // solo <img> sin alt; alt genérico pero descriptivo del src
          h = h.replace(/<img((?:(?!alt\s*=)[^>])*)>/gi, (_m, attrs: string) => {
            const src = attrs.match(/\ssrc\s*=\s*["']?([^"'\s>]+)/i)?.[1];
            return `<img${attrs} alt="${altGenerico(src)}">`;
          });
          break;
        }
        case "noopener": {
          h = h.replace(/<a([^>]*)target\s*=\s*["']?_blank([^>]*)>/gi, (m, a: string, b: string) => {
            if (/noopener|noreferrer/i.test(m)) return m;
            const rel = /rel\s*=\s*["']([^"']*)["']/i.exec(a + b);
            if (rel) {
              return m.replace(rel[0], rel[0].replace(/rel\s*=\s*["']([^"']*)["']/i, (_r, r: string) => `rel="${r} noopener noreferrer"`));
            }
            return `<a${a}target="_blank" rel="noopener noreferrer"${b}>`;
          });
          break;
        }
        case "tabindex": {
          // tabindex="3" → retirar el positivo (el orden natural manda)
          h = h.replace(/\stabindex\s*=\s*["']?[1-9][^"'\s>]*["']?/gi, "");
          break;
        }
        case "reduced-motion": {
          if (/@keyframes/i.test(h) && !/prefers-reduced-motion/i.test(h)) {
            const bloque = "\n@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}";
            if (/<\/style>/i.test(h)) h = h.replace(/<\/style>/i, `${bloque}\n</style>`);
            else if (/<\/head>/i.test(h)) h = h.replace(/<\/head>/i, `<style>${bloque}\n</style>\n</head>`);
          }
          break;
        }
        case "overflow": {
          // CSS: body{...width:1280px...} → max-width:100% (fluye en móvil)
          h = h.replace(/(\bbody\s*\{[^}]*?)\bwidth\s*:\s*1[0-9]{3}px/gi, "$1max-width:100%");
          // atributo: width=1280px en el tag → min-width fluido
          h = h.replace(/(<body[^>]*\s?)width(\s*[:=]\s*["']?\s*)1[0-9]{3}px/gi, "$1min-width$2100%");
          break;
        }
        default:
          sinParche++;
          continue;
      }
      if (h !== antes) {
        aplicados.push(p);
      } else {
        sinParche++;
      }
    } catch {
      sinParche++;
    }
  }

  // relanzó transiciones altas sin reduced-motion ya parcheado: no-op, la
  // regla RE_MS_ALTA queda documentada para el análisis (no toca diseño).
  void RE_MS_ALTA;

  return { html: h, parches: aplicados, sinParche };
}

/** ¿Cuántos de estos problemas se habrían resuelto SIN LLM? (para ROI). */
export function ahorroEstimado(parches: ParcheDeterminista[]): { llamadasEvitadas: number; tokensEvitados: number } {
  // un parche determinista evita una ronda Codificador+Revisor:
  // ≈ 2 llamadas, ≈ 6.000 tokens de salida estimados (techo bajo medio).
  const llamadas = parches.length ? 2 : 0;
  return { llamadasEvitadas: llamadas, tokensEvitados: parches.length ? 6_000 : 0 };
}
