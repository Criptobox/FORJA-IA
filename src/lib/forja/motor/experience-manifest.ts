/** FORJA IA — EXPERIENCE MANIFEST v4.7.1.
 * Fuente única de verdad de la experiencia compilada.
 * Determinista, serializable y segura: el LLM ejecuta el manifest; no decide
 * la arquitectura de la experiencia.
 */
import type { ExperienciaDna } from "./experience-dna";
import type { FamiliaExperiencia } from "./familias-experiencia";
import type { RecetaExperiencia } from "./experience-recipes";
import type { DecisionPuerta } from "./performance-gate";
import type { PlanEspacial } from "./spatial-engine";
import type { PlanMovimiento } from "./motion-engine";
import type { HeroElegido } from "./hero-engine";
import type { EleccionCards } from "./card-system";
import type { PlanoContenido } from "./plano-contenido";
import type { CompositionBlueprint } from "./composition-engine";

export type ModoExperiencia = "2d" | "2.5d" | "3d" | "webgl";

export interface SpatialBlueprint {
  mode: ModoExperiencia;
  layers: number;
  perspective: boolean;
  overlap: boolean;
  focalObject: boolean;
  floatingSurfaces: boolean;
}

export interface MotionBlueprint {
  intensity: number;
  primitives: string[];
  budget: number;
  reducedMotion: boolean;
}

export interface ComponentBlueprint {
  id: string;
  type: string;
  required: boolean;
  role: string;
  layer?: number;
  motion?: string[];
}

export interface ExperienceManifest {
  version: "forja.experience@2";
  family: FamiliaExperiencia;
  recipe: RecetaExperiencia["id"];
  mode: ModoExperiencia;
  dna: ExperienciaDna;
  spatial: SpatialBlueprint;
  motion: MotionBlueprint;
  components: ComponentBlueprint[];
  composition: CompositionBlueprint;
  requiredPrimitives: string[];
  contentSections: string[];
  forbiddenStructures: string[];
  responsive: {
    desktop: string;
    tablet: string;
    mobile: string;
  };
}

const modo = (d: DecisionPuerta): ModoExperiencia => d.modo;

function componentsFor(
  familia: FamiliaExperiencia,
  receta: RecetaExperiencia,
  hero: HeroElegido,
  cards: EleccionCards,
  plano: PlanoContenido,
  spatial: PlanEspacial,
  motion: PlanMovimiento,
): ComponentBlueprint[] {
  const out: ComponentBlueprint[] = [
    { id: "nav", type: "navigation", required: true, role: "orientación" },
    { id: "hero", type: hero.tipo, required: true, role: "foco principal", layer: spatial.layers[0]?.z ?? 0 },
  ];
  if (receta.superficies.floatingCards) out.push({ id: "floating-card-1", type: "floating-card", required: true, role: "profundidad + apoyo", layer: 30 });
  if (receta.objeto.tipo !== "tipografia") out.push({ id: "focal-object", type: receta.objeto.tipo, required: true, role: "objeto focal", layer: 20 });
  if (cards.variantes.length) out.push({ id: "card-system", type: cards.variantes.join("+"), required: familia !== "editorial", role: "contenido secundario" });
  for (const s of plano.secciones.filter((x) => !["nav", "hero", "footer"].includes(x.id)).slice(0, 5)) {
    out.push({ id: s.id, type: "section", required: true, role: s.objetivo });
  }
  out.push({ id: "footer", type: "footer", required: true, role: "cierre" });
  if (motion.primitivas.includes("reveal")) out.push({ id: "motion-reveal", type: "reveal", required: true, role: "entrada narrativa", motion: ["reveal"] });
  return out;
}

export function construirExperienceManifest(args: {
  familia: FamiliaExperiencia;
  receta: RecetaExperiencia;
  dna: ExperienciaDna;
  representacion: DecisionPuerta;
  planEspacial: PlanEspacial;
  planMovimiento: PlanMovimiento;
  hero: HeroElegido;
  cards: EleccionCards;
  plano: PlanoContenido;
  composition: CompositionBlueprint;
  primitivas?: { ids?: string[] };
}): ExperienceManifest {
  const m = modo(args.representacion);
  const required = m === "2.5d" || m === "3d" || m === "webgl";
  const minimumLayers = Math.max(2, args.receta.composicion.capas);
  const sections = args.plano.secciones.map((s) => s.id);
  return {
    version: "forja.experience@2",
    family: args.familia,
    recipe: args.receta.id,
    mode: m,
    dna: args.dna,
    spatial: {
      mode: m,
      layers: minimumLayers,
      perspective: required,
      overlap: args.receta.composicion.asimetrica || args.receta.superficies.floatingCards,
      focalObject: args.receta.objeto.tipo !== "tipografia",
      floatingSurfaces: args.receta.superficies.floatingCards,
    },
    motion: {
      intensity: args.dna.motion.intensity,
      primitives: [
        args.receta.motion.reveal ? "reveal" : "none",
        args.receta.motion.float ? "float" : "none",
        args.receta.motion.parallax ? "parallax" : "none",
        args.receta.motion.hover ? "hover" : "none",
        args.receta.motion.stagger ? "stagger" : "none",
      ].filter((x) => x !== "none"),
      budget: Math.max(4, Math.min(28, 4 + Math.round(args.dna.motion.intensity * 24))),
      reducedMotion: true,
    },
    components: componentsFor(args.familia, args.receta, args.hero, args.cards, args.plano, args.planEspacial, args.planMovimiento),
    composition: args.composition,
    requiredPrimitives: args.primitivas?.ids ?? [],
    contentSections: sections,
    forbiddenStructures: args.familia === "editorial" ? [] : ["centered-default-hero", "three-identical-cards-as-main-section", "repeated-box-grid"],
    responsive: {
      desktop: "composición completa; capas y objeto según manifest",
      tablet: "reducir capas y tamaño del objeto; conservar jerarquía",
      mobile: "reordenar copy/objeto; reducir motion y capas; nunca escalar desktop ciegamente",
    },
  };
}

export function seccionExperienceManifest(m: ExperienceManifest): string {
  return [
    "# EXPERIENCE MANIFEST (FUENTE DE VERDAD — ejecutar, no reinterpretar)",
    `family: ${m.family}`,
    `recipe: ${m.recipe}`,
    `mode: ${m.mode}`,
    `spatial: layers=${m.spatial.layers}; perspective=${m.spatial.perspective}; overlap=${m.spatial.overlap}; focalObject=${m.spatial.focalObject}; floatingSurfaces=${m.spatial.floatingSurfaces}`,
    `motion: intensity=${Math.round(m.motion.intensity * 100)}%; budget=${m.motion.budget}; primitives=${m.motion.primitives.join(", ") || "none"}; reducedMotion=required`,
    `required components: ${m.components.filter((x) => x.required).map((x) => x.id).join(", ")}`,
    `required sections: ${m.contentSections.join(", ")}`,
    `composition: ${m.composition.sections.map((s) => `${s.id}:${s.rhythm}:${s.motion}`).join(" | ")}`,
    `forbidden: ${m.forbiddenStructures.join(", ") || "none"}`,
    "responsive: desktop=full; tablet=reduce/reorder; mobile=recompose, no blind scaling",
    "REGLA: no conviertas una experiencia espacial/product/immersive en una landing editorial durante la implementación.",
  ].join("\n");
}
