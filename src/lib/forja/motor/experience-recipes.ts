/** FORJA IA — EXPERIENCE RECIPES (v4.5.0, correcciones §4).
 *
 * «Una de las correcciones más importantes»: FORJA no debe pedirle al
 * modelo que invente toda la composición desde cero cada vez. Debe tener
 * RECETAS DE EXPERIENCIA — composiciones probadas, estructuradas, que el
 * LLM ejecuta en vez de improvisar.
 *
 * Las 7 recetas iniciales del doc §28 (fase 3):
 *
 *   SPATIAL_PRODUCT · CINEMATIC_PRODUCT · IMMERSIVE_PORTFOLIO
 *   INTERACTIVE_SAAS · 3D_SHOWCASE · CREATIVE_STUDIO · MODERN_MINIMAL
 *
 * Cada receta declara hero, composición, superficies, movimiento,
 * interacción y objeto — el YAML del doc convertido a datos con parse
 * inverso a texto para prompts.
 *
 * Reglas de la casa: sin red, sin React, TypeScript estricto, nunca lanza.
 */

import type { FamiliaExperiencia } from "./familias-experiencia";
import type { TipoHero } from "./hero-engine";

/* -------------------------------- tipos ------------------------------------ */

export type IdReceta =
  | "spatial_product"
  | "cinematic_product"
  | "immersive_portfolio"
  | "interactive_saas"
  | "3d_showcase"
  | "creative_studio"
  | "modern_minimal";

export interface RecetaExperiencia {
  id: IdReceta;
  nombre: string;
  familias: FamiliaExperiencia[];
  /** señales de petición que la prefieren */
  cuando: RegExp;
  hero: { tipo: TipoHero; pesoVisual: "alta" | "media" | "baja" };
  composicion: {
    asimetrica: boolean;
    profundidad: "alta" | "media" | "baja";
    capas: number;
    /** HERO_FULLSCREEN / escenas completas */
    fullscreen?: boolean;
    escalaTipografica?: "enorme" | "grande" | "normal";
    reticula?: "técnica" | "editorial" | "libre";
  };
  superficies: { redondeo: "alto" | "medio" | "bajo"; floatingCards: boolean; elevacion: "alta" | "media" | "baja" };
  motion: {
    parallax: boolean;
    reveal: boolean;
    float: boolean;
    hover: boolean;
    stagger?: boolean;
    scrollScenes?: boolean;
    cameraMovement?: "opcional" | "no";
  };
  interaccion: { magneticCta: "sí" | "opcional" | "no"; tiltCards: "sí" | "opcional" | "no"; hoverTransform?: boolean; projectReveal?: boolean };
  objeto: { tipo: "producto-o-objeto-3d" | "ui-producto" | "objeto-3d" | "escena" | "tipografia" };
  navegacion: { minimal?: boolean; tecnica?: boolean };
}

export const RECETAS: ReadonlyArray<RecetaExperiencia> = [
  {
    id: "spatial_product",
    nombre: "SPATIAL_PRODUCT",
    familias: ["spatial", "product"],
    cuando: /\b(producto|saas|espacial|3d|capas|fisic|hardware|gadget)\b/i,
    hero: { tipo: "HERO_SPATIAL", pesoVisual: "alta" },
    composicion: { asimetrica: true, profundidad: "alta", capas: 4 },
    superficies: { redondeo: "alto", floatingCards: true, elevacion: "media" },
    motion: { parallax: true, reveal: true, float: true, hover: true },
    interaccion: { magneticCta: "opcional", tiltCards: "opcional" },
    objeto: { tipo: "producto-o-objeto-3d" },
    navegacion: {},
  },
  {
    id: "cinematic_product",
    nombre: "CINEMATIC_PRODUCT",
    familias: ["cinematic", "immersive"],
    cuando: /\b(cinemat|pelicul|film|epic|[eé]pico|historia|lanza|release|automoci[óo]n)\b/i,
    hero: { tipo: "HERO_FULLSCREEN", pesoVisual: "alta" },
    composicion: { asimetrica: false, profundidad: "alta", capas: 4, fullscreen: true, escalaTipografica: "enorme" },
    superficies: { redondeo: "medio", floatingCards: false, elevacion: "baja" },
    motion: { parallax: true, reveal: true, float: false, hover: false, scrollScenes: true, cameraMovement: "opcional" },
    interaccion: { magneticCta: "no", tiltCards: "no" },
    objeto: { tipo: "escena" },
    navegacion: { minimal: true },
  },
  {
    id: "immersive_portfolio",
    nombre: "IMMERSIVE_PORTFOLIO",
    familias: ["immersive", "modular"],
    cuando: /\b(portfolio|portafolio|estudio|fotograf|arquitectura|obra|proyecto)\b/i,
    hero: { tipo: "HERO_3D_OBJECT", pesoVisual: "alta" },
    composicion: { asimetrica: true, profundidad: "alta", capas: 5, escalaTipografica: "enorme", reticula: "técnica" },
    superficies: { redondeo: "bajo", floatingCards: false, elevacion: "media" },
    motion: { parallax: true, reveal: true, float: false, hover: true, scrollScenes: true },
    interaccion: { magneticCta: "no", tiltCards: "no", hoverTransform: true, projectReveal: true },
    objeto: { tipo: "objeto-3d" },
    navegacion: { minimal: true, tecnica: true },
  },
  {
    id: "interactive_saas",
    nombre: "INTERACTIVE_SAAS",
    familias: ["interactive", "product"],
    cuando: /\b(saas|startup|app|plataforma|software|dashboard|workflow|flujo)\b/i,
    hero: { tipo: "HERO_PRODUCT", pesoVisual: "media" },
    composicion: { asimetrica: true, profundidad: "media", capas: 4 },
    superficies: { redondeo: "alto", floatingCards: true, elevacion: "media" },
    motion: { parallax: false, reveal: true, float: true, hover: true, stagger: true },
    interaccion: { magneticCta: "opcional", tiltCards: "opcional", hoverTransform: true },
    objeto: { tipo: "ui-producto" },
    navegacion: {},
  },
  {
    id: "3d_showcase",
    nombre: "3D_SHOWCASE",
    familias: ["3d-showcase", "spatial"],
    cuando: /\b(3d|webgl|modelo 3d|objeto 3d|escaparate|showroom|gaming|automotive)\b/i,
    hero: { tipo: "HERO_3D_OBJECT", pesoVisual: "alta" },
    composicion: { asimetrica: true, profundidad: "alta", capas: 6, escalaTipografica: "grande" },
    superficies: { redondeo: "medio", floatingCards: true, elevacion: "alta" },
    motion: { parallax: true, reveal: true, float: true, hover: true, scrollScenes: true },
    interaccion: { magneticCta: "opcional", tiltCards: "sí" },
    objeto: { tipo: "objeto-3d" },
    navegacion: { minimal: true },
  },
  {
    id: "creative_studio",
    nombre: "CREATIVE_STUDIO",
    familias: ["immersive", "cinematic"],
    cuando: /\b(estudio creativo|agencia|creative studio|branding|direcci[óo]n de arte)\b/i,
    hero: { tipo: "HERO_CINEMATIC", pesoVisual: "alta" },
    composicion: { asimetrica: true, profundidad: "alta", capas: 5, escalaTipografica: "enorme", reticula: "libre" },
    superficies: { redondeo: "medio", floatingCards: false, elevacion: "media" },
    motion: { parallax: true, reveal: true, float: false, hover: true, scrollScenes: true, cameraMovement: "opcional" },
    interaccion: { magneticCta: "sí", tiltCards: "opcional", hoverTransform: true },
    objeto: { tipo: "escena" },
    navegacion: { minimal: true, tecnica: true },
  },
  {
    id: "modern_minimal",
    nombre: "MODERN_MINIMAL",
    familias: ["minimal", "product"],
    cuando: /\b(minimal|simple|limpio|sobrio|auster|silencioso|claro)\b/i,
    hero: { tipo: "HERO_MINIMAL", pesoVisual: "media" },
    composicion: { asimetrica: true, profundidad: "baja", capas: 3, escalaTipografica: "grande" },
    superficies: { redondeo: "alto", floatingCards: false, elevacion: "baja" },
    motion: { parallax: false, reveal: true, float: false, hover: true },
    interaccion: { magneticCta: "no", tiltCards: "no", hoverTransform: true },
    objeto: { tipo: "tipografia" },
    navegacion: {},
  },
];

export function recetaPorId(id: string): RecetaExperiencia | undefined {
  return RECETAS.find((r) => r.id === id);
}

/* ------------------------------ elección ----------------------------------- */

export interface SeleccionReceta {
  receta: RecetaExperiencia;
  /** por qué esta receta (para la traza y el prompt) */
  motivo: string;
  /** true cuando la receta pertenece realmente a la familia solicitada */
  compatible: boolean;
}

/** La receta para una familia: por familia primero, por señales después,
 * y un desempate estable por orden del catálogo. Nunca devuelve undefined. */
function fallbackReceta(familia: FamiliaExperiencia): IdReceta {
  const mapa: Record<FamiliaExperiencia, IdReceta> = {
    spatial: "spatial_product", immersive: "cinematic_product", product: "interactive_saas",
    cinematic: "cinematic_product", interactive: "interactive_saas", "3d-showcase": "3d_showcase",
    modular: "immersive_portfolio", editorial: "modern_minimal", minimal: "modern_minimal", dashboard: "interactive_saas",
  };
  return mapa[familia];
}

export function recetaParaFamilia(familia: FamiliaExperiencia, mensaje: string = ""): SeleccionReceta {
  const m = (mensaje || "").toLowerCase();
  const compatibles = RECETAS.filter((r) => r.familias.includes(familia));
  const candidatos = compatibles.length ? compatibles : RECETAS.filter((r) => r.id === fallbackReceta(familia));
  const puntuadas = candidatos.map((r, i) => ({ r, puntos: (r.cuando.test(m) ? 2 : 0), i }));
  puntuadas.sort((a, b) => b.puntos - a.puntos || a.i - b.i);
  const ganadora = puntuadas[0] ?? { r: RECETAS[0], puntos: 0, i: 0 };
  return {
    receta: ganadora.r,
    compatible: ganadora.r.familias.includes(familia),
    motivo: ganadora.r.familias.includes(familia)
      ? `receta compatible con la familia (${ganadora.r.familias.join(", ")}) y las señales del brief`
      : `fallback explícito para la familia «${familia}»`,
  };
}

/* ------------------------------ salidas ------------------------------------ */

const nivel = (v: boolean | undefined, si = "sí", no = "no"): string => (v ? si : no);

/** Bloque para prompts: la receta completa en formato legible (el YAML del
 * doc, convertido a contrato). El LLM ejecuta, no improvisa (corrección §4). */
export function seccionReceta(r: RecetaExperiencia): string {
  return [
    `# EXPERIENCE RECIPE: ${r.nombre} (ejecutar, no improvisar)`,
    `hero: tipo ${r.hero.tipo} con peso visual ${r.hero.pesoVisual}`,
    `composition: asimétrica ${nivel(r.composicion.asimetrica)}; profundidad ${r.composicion.profundidad}; capas ${r.composicion.capas}${r.composicion.fullscreen ? "; escena a pantalla completa" : ""}${r.composicion.escalaTipografica ? `; tipografía ${r.composicion.escalaTipografica}` : ""}${r.composicion.reticula ? `; retícula ${r.composicion.reticula}` : ""}`,
    `surfaces: redondeo ${r.superficies.redondeo}; floatingCards ${nivel(r.superficies.floatingCards)}; elevación ${r.superficies.elevacion}`,
    `motion: parallax ${nivel(r.motion.parallax)}; reveal ${nivel(r.motion.reveal)}; float ${nivel(r.motion.float)}; hover ${nivel(r.motion.hover)}${r.motion.stagger ? `; stagger ${nivel(r.motion.stagger)}` : ""}${r.motion.scrollScenes ? `; escenas de scroll ${nivel(r.motion.scrollScenes)}` : ""}${r.motion.cameraMovement && r.motion.cameraMovement !== "no" ? "; camera movement opcional" : ""}`,
    `interaction: magneticCTA ${r.interaccion.magneticCta}; tiltCards ${r.interaccion.tiltCards}${r.interaccion.hoverTransform ? "; hover transform sí" : ""}${r.interaccion.projectReveal ? "; project reveal sí" : ""}`,
    `object: ${r.objeto.tipo}`,
    `navigation: ${r.navegacion.minimal ? "minimal" : "estándar"}${r.navegacion.tecnica ? " con retícula técnica" : ""}`,
  ].join("\n");
}
