/** FORJA IA — COMPOSITION ENGINE v4.7.2.
 * Compila el ritmo de TODA la página. No decide contenido: decide cómo se
 * distribuye, solapa y mueve cada escena para evitar la landing repetitiva.
 */
import type { FamiliaExperiencia } from "./familias-experiencia";
import type { RecetaExperiencia } from "./experience-recipes";
import type { PlanoContenido } from "./plano-contenido";

export type RitmoComposicion = "scene" | "split" | "rail" | "focus" | "stack" | "grid";

export interface CompositionSection {
  id: string;
  index: number;
  rhythm: RitmoComposicion;
  visualWeight: "low" | "medium" | "high";
  spatialRole: "background" | "anchor" | "content" | "object" | "transition";
  overlap: boolean;
  fullBleed: boolean;
  motion: "none" | "reveal" | "parallax" | "stagger" | "scroll-scene";
}

export interface CompositionBlueprint {
  version: "forja.composition@1";
  family: FamiliaExperiencia;
  recipe: RecetaExperiencia["id"];
  sections: CompositionSection[];
  antiTemplate: string[];
  css: string;
}

const ids = (plano: PlanoContenido): string[] => plano.secciones.map((s) => s.id);

function rhythmFor(familia: FamiliaExperiencia, recipe: RecetaExperiencia, i: number, total: number): RitmoComposicion {
  if (recipe.composicion.fullscreen) return i % 2 === 0 ? "scene" : "focus";
  if (familia === "dashboard") return i === 0 ? "focus" : i % 3 === 0 ? "split" : "grid";
  if (familia === "editorial") return i === 0 ? "focus" : i % 2 ? "split" : "stack";
  if (familia === "minimal") return i % 2 ? "split" : "focus";
  if (familia === "3d-showcase" || familia === "spatial") return i % 4 === 0 ? "scene" : i % 4 === 1 ? "split" : i % 4 === 2 ? "rail" : "focus";
  if (familia === "cinematic" || familia === "immersive") return i % 3 === 0 ? "scene" : i % 3 === 1 ? "focus" : "rail";
  if (familia === "interactive" || familia === "product") return i % 4 === 0 ? "focus" : i % 4 === 1 ? "split" : i % 4 === 2 ? "rail" : "stack";
  if (familia === "modular") return i % 2 ? "grid" : "split";
  return i === 0 ? "focus" : i === total - 1 ? "scene" : "split";
}

function motionFor(recipe: RecetaExperiencia, rhythm: RitmoComposicion): CompositionSection["motion"] {
  if (rhythm === "scene" && recipe.motion.scrollScenes) return "scroll-scene";
  if (recipe.motion.parallax && rhythm === "rail") return "parallax";
  if (recipe.motion.stagger && rhythm === "grid") return "stagger";
  return recipe.motion.reveal ? "reveal" : "none";
}

export function construirCompositionBlueprint(args: {
  familia: FamiliaExperiencia;
  receta: RecetaExperiencia;
  plano: PlanoContenido;
}): CompositionBlueprint {
  const sectionIds = ids(args.plano).filter((id) => !["nav", "footer"].includes(id));
  const sections = sectionIds.map((id, index) => {
    const rhythm = rhythmFor(args.familia, args.receta, index, sectionIds.length);
    const high = index === 0 || rhythm === "scene" || rhythm === "focus";
    return {
      id,
      index,
      rhythm,
      visualWeight: high ? "high" : rhythm === "split" || rhythm === "rail" ? "medium" : "low",
      spatialRole: rhythm === "scene" ? "anchor" : rhythm === "focus" ? "object" : rhythm === "rail" ? "content" : "content",
      overlap: args.receta.composicion.asimetrica && ["scene", "split", "focus"].includes(rhythm),
      fullBleed: Boolean(args.receta.composicion.fullscreen) || rhythm === "scene",
      motion: motionFor(args.receta, rhythm),
    } satisfies CompositionSection;
  });
  return {
    version: "forja.composition@1",
    family: args.familia,
    recipe: args.receta.id,
    sections,
    antiTemplate: [
      "no usar hero centrado + tres cards idénticas como columna vertebral",
      "no repetir el mismo ritmo en tres secciones consecutivas",
      "no convertir cada sección en una caja con borde idéntico",
      "el objeto/foco debe reaparecer solo cuando tenga función narrativa",
    ],
    css: cssCompositionBlueprint(),
  };
}

export function seccionCompositionBlueprint(c: CompositionBlueprint): string {
  return [
    "# COMPOSITION BLUEPRINT (v4.7.2 — ejecutar, no reinterpretar)",
    `family=${c.family}; recipe=${c.recipe}; version=${c.version}`,
    "SECUENCIA:",
    ...c.sections.map((s) => `- ${s.index + 1}. ${s.id}: rhythm=${s.rhythm}; weight=${s.visualWeight}; role=${s.spatialRole}; overlap=${s.overlap}; fullBleed=${s.fullBleed}; motion=${s.motion}`),
    "ANTI-TEMPLATE:",
    ...c.antiTemplate.map((x) => `- ${x}`),
    "REGLA: la página completa debe mostrar variación de composición; 3D/motion no puede limitarse al hero.",
  ].join("\n");
}

export function cssCompositionBlueprint(): string {
  return `
/* FORJA composition primitives — deterministic, responsive, reduced-motion safe */
.forja-scene { min-height: min(92svh, 980px); display: grid; align-items: center; position: relative; overflow: clip; }
.forja-split { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(280px, .95fr); gap: clamp(1.5rem, 5vw, 6rem); align-items: center; }
.forja-rail { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(72vw, 1fr); gap: clamp(1rem, 3vw, 2.5rem); overflow-x: auto; scroll-snap-type: x mandatory; padding-bottom: .75rem; }
.forja-rail > * { scroll-snap-align: start; }
.forja-focus { position: relative; isolation: isolate; }
.forja-focus > .forja-object, .forja-focus > .forja-surface { transform: translate3d(0,0,0); }
.forja-stack { display: grid; gap: clamp(1rem, 2vw, 2rem); }
.forja-grid { display: grid; grid-template-columns: repeat(12, minmax(0,1fr)); gap: clamp(.75rem, 2vw, 1.5rem); }
.forja-grid > *:nth-child(4n+1) { grid-column: span 7; }
.forja-grid > *:nth-child(4n+2) { grid-column: span 5; }
.forja-grid > *:nth-child(4n+3) { grid-column: span 5; }
.forja-grid > *:nth-child(4n+4) { grid-column: span 7; }
.forja-overlap { margin-inline: clamp(0rem, -4vw, -3rem); position: relative; z-index: 2; }
@media (max-width: 900px) { .forja-split { grid-template-columns: 1fr; } .forja-grid > * { grid-column: span 6 !important; } }
@media (max-width: 620px) { .forja-scene { min-height: auto; padding-block: 4rem; } .forja-rail { grid-auto-columns: 88vw; } .forja-grid { grid-template-columns: 1fr; } .forja-grid > * { grid-column: 1 !important; } .forja-overlap { margin-inline: 0; } }
@media (prefers-reduced-motion: reduce) { .forja-rail { scroll-behavior: auto; } .forja-overlap, .forja-focus > .forja-object, .forja-focus > .forja-surface { transform: none !important; } }
`.trim();
}
