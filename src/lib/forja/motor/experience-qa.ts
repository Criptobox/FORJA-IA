/** FORJA IA — EXPERIENCE QA + REPARACIÓN PATCH-FIRST (v4.5.0, correcciones §21 y §22).
 *
 * ─── §21: el QA nuevo ───
 * El QA no comprueba solo overflow/texto/contraste/responsive/a11y
 * (eso ya lo hace el Revisor visual y el enrutador v4.4). Comprueba la
 * EXPERIENCIA:
 *
 *   EDITORIAL BIAS · SPATIAL COHERENCE · MOTION COHERENCE · DEPTH
 *   COHERENCE · INTERACTION RICHNESS · VISUAL REPETITION · HERO QUALITY ·
 *   SURFACE CONSISTENCY · RESPONSIVE EXPERIENCE
 *
 * ─── §22: reparación PATCH-FIRST ───
 * Cuando QA detecta sesgo editorial alto u otra desviación, NO se
 * regenera toda la página:
 *
 *   detect → classify → patch
 *
 *   editorial bias alto → cambiar composición del hero · introducir objeto
 *   focal · convertir cards estáticas en floating · agregar depth ·
 *   agregar scroll reveal · MANTENER el contenido
 *
 * Todos los parches son deterministas, CAPADOS y append-only (CSS + un
 * script pequeño con guard de prefers-reduced-motion): nunca reescriben el
 * contenido del usuario. Lo que no se puede parchear sube al bucle LLM de
 * siempre.
 *
 * Reglas de la casa: sin red, sin React, TypeScript estricto, nunca lanza.
 */

import type { ExperienciaDna } from "./experience-dna";
import { medirExperiencia, type MetricasExperiencia, UMBRAL_EDITORIAL } from "./experience-bias";
import { tokensExperienciaCss } from "./tokens-experiencia";
import { cssMovimiento, type PlanMovimiento } from "./motion-engine";
import { cssEscenario, type PlanEspacial } from "./spatial-engine";

/* ------------------------------- hallazgos --------------------------------- */

export type ChequeoExperiencia =
  | "editorial-bias"
  | "spatial-coherence"
  | "motion-coherence"
  | "depth-coherence"
  | "interaction-richness"
  | "visual-repetition"
  | "hero-quality"
  | "surface-consistency"
  | "responsive-experience";

export interface HallazgoExperiencia {
  chequeo: ChequeoExperiencia;
  nivel: "info" | "aviso" | "critico";
  evidencia: string;
  /** corrección propuesta (texto para el LLM si no hay parche) */
  correccion: string;
}

/** Audita la EXPERIENCIA del HTML contra el ADN elegido (§21). Puro:
 * no muta nada, no decide parches. */
export function auditarExperiencia(html: string, e: ExperienciaDna): HallazgoExperiencia[] {
  const out: HallazgoExperiencia[] = [];
  const h = html || "";
  if (!h.trim()) return out;
  const m = medirExperiencia(h);

  // 1 · editorial bias (§21/§23)
  if (m.editorial > UMBRAL_EDITORIAL && e.spatial.depth > 0.4) {
    out.push({
      chequeo: "editorial-bias",
      nivel: m.editorial > 0.78 ? "critico" : "aviso",
      evidencia: `editorial ${Math.round(m.editorial * 100)}% (umbral ${Math.round(UMBRAL_EDITORIAL * 100)}%) con ADN de profundidad ${Math.round(e.spatial.depth * 100)}%`,
      correccion: "cambiar la composición del hero, introducir objeto focal, convertir cards estáticas en flotantes y agregar profundidad SIN tocar el contenido",
    });
  }

  // 2 · spatial coherence
  const tiene3d = /perspective|translateZ|preserve-3d/i.test(h);
  if (e.spatial.depth >= 0.6 && !tiene3d) {
    out.push({
      chequeo: "spatial-coherence",
      nivel: "aviso",
      evidencia: `ADN pide profundidad ${Math.round(e.spatial.depth * 100)}% y modo ${e.spatial.mode}, pero el HTML no declara perspective/translateZ`,
      correccion: "aplicar los tokens --depth-*/--perspective a objeto focal y cards flotantes",
    });
  }

  // 3 · motion coherence
  const anims = (h.match(/@keyframes/gi) ?? []).length + (h.match(/transition\s*:/gi) ?? []).length;
  if (e.motion.intensity >= 0.6 && anims < 3) {
    out.push({
      chequeo: "motion-coherence",
      nivel: "aviso",
      evidencia: `intensidad de movimiento ${Math.round(e.motion.intensity * 100)}% pero solo ${anims} animación(es)/transición(es)`,
      correccion: "activar el MOTION PLAN: reveal al scroll con stagger y flotación ambiente del objeto",
    });
  }
  if (e.motion.intensity <= 0.2 && anims > 8) {
    out.push({
      chequeo: "motion-coherence",
      nivel: "info",
      evidencia: `ADN pide movimiento mínimo (${Math.round(e.motion.intensity * 100)}%) pero hay ${anims} animaciones`,
      correccion: "reducir a feedback y foco: el movimiento de más roba tokens y foco",
    });
  }

  // 4 · depth coherence (capas declaradas vs CSS de capas)
  if (e.spatial.layers >= 5 && !/position\s*:\s*(absolute|fixed)/i.test(h)) {
    out.push({
      chequeo: "depth-coherence",
      nivel: "aviso",
      evidencia: `plan de ${e.spatial.layers} capas pero sin elementos posicionados: todo está apilado en flujo`,
      correccion: "dar posición y translateZ a objeto, cards y capa de fondo según el SPATIAL PLAN",
    });
  }

  // 5 · interaction richness
  const hovers = (h.match(/:hover/gi) ?? []).length;
  if (e.interaction.richness >= 0.7 && hovers < 2) {
    out.push({
      chequeo: "interaction-richness",
      nivel: "aviso",
      evidencia: `riqueza de interacción ${Math.round(e.interaction.richness * 100)}% pero ${hovers} reglas :hover`,
      correccion: "estados hover/focus/active en todo lo clicable; tilt/magnetic según el ADN",
    });
  }

  // 6 · hero quality (el patrón prohibido §6)
  const heroPorDefecto =
    /<h1[^>]*>[^<]{4,}<\/h1>/i.test(h) && /text-align\s*:\s*center/i.test(h) && !/translateZ|perspective|<img|<video|canvas/i.test(h.slice(0, Math.max(1, h.search(/<section\b/i)) + 900));
  if (heroPorDefecto) {
    out.push({
      chequeo: "hero-quality",
      nivel: "aviso",
      evidencia: "hero por defecto: h1 centrado + párrafo + botón, sin objeto ni profundidad",
      correccion: "recomponer el hero según el tipo decidido (texto+objeto, texto+UI flotante, escena…)",
    });
  }

  // 7 · surface consistency (radios dispersos)
  const radios = new Set((h.match(/border(?:-radius)?\s*:\s*[^;\n]*?(\d{1,3})px/gi) ?? []).map((x) => x.replace(/\D+/g, (n) => n)));
  if (radios.size > 4) {
    out.push({
      chequeo: "surface-consistency",
      nivel: "info",
      evidencia: `${radios.size} valores de radio distintos (${[...radios].slice(0, 6).join(", ")}px): superficies sin sistema`,
      correccion: "unificar con los tokens --radius-sm…--radius-2xl",
    });
  }

  // 8 · responsive experience
  const medias = (h.match(/@media/gi) ?? []).length;
  if (medias === 0 && h.length > 1500) {
    out.push({
      chequeo: "responsive-experience",
      nivel: "aviso",
      evidencia: "sin @media: el plan responsivo de experiencia no está aplicado",
      correccion: "aplicar el RESPONSIVE EXPERIENCE PLAN (mantiene/reduce/reordena/elimina/transforma)",
    });
  }

  return out;
}

/* -------------------------------- parches ---------------------------------- */

export type TipoParcheExperiencia =
  | "tokens-experiencia"
  | "profundidad"
  | "cards-flotantes"
  | "scroll-reveal"
  | "hero-composicion"
  | "objeto-focal";

export interface ParcheExperiencia {
  tipo: TipoParcheExperiencia;
  evidencia: string;
}

export interface ResultadoParchesExperiencia {
  html: string;
  parches: ParcheExperiencia[];
  /** hallazgos que no tuvieron parche determinista (suben al LLM) */
  sinParche: HallazgoExperiencia[];
}

const MARCA_CSS = "/* FORJA · QA de experiencia (patch-first §22) */";
const MARCA_JS = "/* FORJA · QA de experiencia: activación de clases (capada) */";

function tieneCssForja(h: string): boolean {
  return h.includes(MARCA_CSS);
}

/** Inyecta (append-only) un bloque <style> extra. Si ya inyectamos antes,
 * reemplaza SOLO nuestro bloque. */
function inyectarCss(html: string, css: string): string {
  const bloque = `\n<style id="forja-qa-exp">\n${MARCA_CSS}\n${css}\n</style>`;
  if (tieneCssForja(html)) {
    const re = /<style id="forja-qa-exp">[\s\S]*?<\/style>/i;
    return re.test(html) ? html.replace(re, bloque) : `${html}${bloque}`;
  }
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${bloque}\n</head>`);
  return `${html}${bloque}`;
}

/** Inyecta (append-only) un pequeño script de activación. Idempotente. */
function inyectarScript(html: string, js: string): string {
  const bloque = `\n<script id="forja-qa-exp-js">\n${MARCA_JS}\n(function(){\n"use strict";\ntry{\n${js}\n}catch(e){}\n})();\n</script>`;
  const re = /<script id="forja-qa-exp-js">[\s\S]*?<\/script>/i;
  if (re.test(html)) return html.replace(re, bloque);
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${bloque}\n</body>`);
  return `${html}${bloque}`;
}

/** Aplica los parches PATCH-FIRST (§22) para los hallazgos dados. Cada
 * parche es capado (límites duros) y con guard de reduced-motion. El
 * contenido del usuario NUNCA se reescribe: solo añadimos CSS y clases. */
export function parchesExperiencia(
  html: string,
  hallazgos: HallazgoExperiencia[],
  e: ExperienciaDna,
  planMovimiento?: PlanMovimiento,
  planEspacial?: PlanEspacial
): ResultadoParchesExperiencia {
  let h: string = html || "";
  const parches: ParcheExperiencia[] = [];
  const pendientes = new Set(hallazgos.map((x) => x.chequeo));
  const necesita: (t: ChequeoExperiencia) => boolean = (t) => pendientes.has(t);

  // 1 · tokens de experiencia: base de cualquier otro parche
  const cssTokens = tokensExperienciaCss(e);
  if (cssTokens && !/--depth-1/.test(h)) {
    const h2 = inyectarCss(h, cssTokens);
    if (h2 !== h) {
      pendientes.delete("surface-consistency");
      parches.push({ tipo: "tokens-experiencia", evidencia: ":root con --radius/--depth/--motion/--shadow/--surface desde el ADN" });
      h = h2;
    }
  }

  // 2 · profundidad (spatial/depth coherence + editorial bias)
  if ((necesita("spatial-coherence") || necesita("depth-coherence") || necesita("editorial-bias")) && e.spatial.depth >= 0.5) {
    const escenario = cssEscenario(planEspacial ?? ({ depth: e.spatial.depth, perspective: e.spatial.perspective, layers: [] } as PlanEspacial));
    const cssProf = [
      escenario,
      `@media (prefers-reduced-motion: no-preference) {`,
      `  .forja-capa-1 { transform: translateZ(var(--depth-1)); } .forja-capa-2 { transform: translateZ(var(--depth-2)); }`,
      `  .forja-capa-3 { transform: translateZ(var(--depth-3)); } .forja-capa-4 { transform: translateZ(var(--depth-4)); }`,
      `  .forja-escena { perspective: var(--perspective); transform-style: preserve-3d; }`,
      `}`,
    ].filter(Boolean).join("\n");
    const h2 = inyectarCss(h, cssProf);
    if (h2 !== h) {
      h = h2;
      parches.push({ tipo: "profundidad", evidencia: `escena con perspective y utilidades de profundidad (ADN ${Math.round(e.spatial.depth * 100)}%)` });
      pendientes.delete("spatial-coherence");
      pendientes.delete("depth-coherence");
    }
  }

  // 3 · cards flotantes + objeto focal + hero + reveal: un script capado
  const js: string[] = [];
  if (necesita("editorial-bias") || necesita("hero-quality")) {
    js.push(
      `var secciones=document.querySelectorAll("section, main > div");`,
      `var n=Math.min(secciones.length,1);`,
      `if(n){var s0=secciones[0];s0.classList.add("forja-escena","forja-hero-ajustado");`,
      `var hijos=s0.querySelectorAll("h1, h2, img, figure, .card, [class*=card]");`,
      `for(var i=0;i<Math.min(hijos.length,6);i++){var el=hijos[i];el.classList.add(i%2?"forja-capa-2":"forja-capa-3");}}`
    );
    parches.push({ tipo: "hero-composicion", evidencia: "hero recomputado como escena: piezas del hero a profundidades distintas (contenido intacto)" });
    pendientes.delete("hero-quality");
  }
  if (necesita("editorial-bias")) {
    js.push(
      `var cards=document.querySelectorAll("[class*=card], article, li");`,
      `var c=0;`,
      `for(var i=0;i<cards.length&&c<10;i++){var el=cards[i];var r=el.getBoundingClientRect&&el.getBoundingClientRect();`,
      `if(r&&r.width>140&&r.height>90){el.classList.add("forja-flotante");c++;}}`
    );
    parches.push({ tipo: "cards-flotantes", evidencia: "hasta 10 cajas grandes convertidas en superficies flotantes (elevación del ADN)" });
    pendientes.delete("editorial-bias");
  }
  if (necesita("motion-coherence") && e.motion.intensity >= 0.6) {
    js.push(
      `var objetivo=document.querySelectorAll("section, .card, [class*=card], img, figure");`,
      `for(var i=0;i<Math.min(objetivo.length,14);i++){var el=objetivo[i];if(!el.classList.contains("reveal"))el.classList.add("reveal");el.style.setProperty("--i",String(i%6));}`
    );
    parches.push({ tipo: "scroll-reveal", evidencia: "clases reveal + stagger capadas a 14 piezas con timing del MOTION PLAN" });
    pendientes.delete("motion-coherence");
  }
  if (js.length) {
    const h2 = inyectarScript(h, js.join("\n"));
    if (h2 !== h) h = h2;
  }

  // 4 · CSS final del patch (flotantes + hero ajustado + motion)
  const cssExtra = [
    planMovimiento ? cssMovimiento(planMovimiento) : "",
    parches.some((p) => p.tipo === "cards-flotantes")
      ? `@media (prefers-reduced-motion: no-preference) {\n  .forja-flotante { transform: translateZ(var(--depth-2)); box-shadow: var(--surface-floating); transition: transform var(--motion-medium) var(--ease-out); }\n  .forja-flotante:hover { transform: translateZ(var(--depth-3)); }\n}`
      : "",
    parches.some((p) => p.tipo === "hero-composicion")
      ? `.forja-hero-ajustado h1 { text-align: left; max-width: 14ch; font-size: clamp(2.4rem, 7vw, 5.5rem); line-height: 1.02; letter-spacing: -0.02em; }\n.forja-hero-ajustado { display: grid; gap: 24px; align-items: center; }`
      : "",
  ].filter(Boolean).join("\n");
  if (cssExtra) {
    const h2 = inyectarCss(h, cssExtra);
    if (h2 !== h) h = h2;
  }

  return {
    html: h,
    parches,
    sinParche: hallazgos.filter((x) => pendientes.has(x.chequeo)),
  };
}

/* ------------------------------- salidas ----------------------------------- */

/** Resumen para la traza y el registro. */
export function resumenQaExperiencia(hallazgos: HallazgoExperiencia[], parches: ParcheExperiencia[]): string {
  if (!hallazgos.length && !parches.length) return "QA experiencia: sin hallazgos";
  const partes = [`${hallazgos.length} hallazgo(s)`, ...parches.map((p) => `parche ${p.tipo}`)];
  return `QA experiencia: ${partes.join(" · ")}`;
}

/** Las métricas re-medidas tras parchear (para el ROI). */
export function medirTrasParche(html: string): MetricasExperiencia {
  return medirExperiencia(html);
}
