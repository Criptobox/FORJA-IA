/** Forja IA — Quality Gate for reusable recipes (V22).
 * Evalúa evidencia y coherencia antes de que una receta se convierta en
 * conocimiento reutilizable. No afirma que un proyecto pasó QA si no existe
 * evidencia real de QA.
 */
import type { KBSmartResult } from "./kb-smart-retrieval";
import type { ForjaRecipe } from "./recipe-builder";

export type RecipeQualityStatus = "approved" | "review" | "rejected";

export interface RecipeQualityReport {
  score: number;
  status: RecipeQualityStatus;
  reasons: string[];
  checks: {
    evidence: boolean;
    coherence: boolean;
    licensing: boolean;
    provenance: boolean;
    qaEvidence: boolean;
  };
}

const unique = (xs: string[]) => [...new Set(xs.filter(Boolean))];

export function evaluateRecipeQuality(recipe: ForjaRecipe, results: KBSmartResult[] = []): RecipeQualityReport {
  const reasons: string[] = [];
  const components = recipe.components.filter((c) => c.name);
  const sources = unique(recipe.sources);
  const providers = unique(recipe.sourceProviders);
  const licenses = unique(results.map((r) => r.resource.license || "").filter(Boolean));
  const evidence = components.length > 0 && sources.length > 0;
  const provenance = providers.length > 0 || results.some((r) => Boolean(r.resource.sourceUrl));
  const licensing = licenses.length > 0 && !licenses.some((license) => /unknown|desconoc|sin licencia|proprietary/i.test(license));
  const projects = unique(results.map((r) => r.matchedProject || "").filter(Boolean));
  const coherence = components.length >= 2 ? projects.length <= 1 || results.filter((r) => r.matchedProject).length >= Math.min(components.length, 2) : components.length === 1;
  // QA solo cuenta si existe evidencia explícita en los datos; nunca se infiere.
  const qaEvidence = Boolean(recipe.qaEvidence);

  if (evidence) reasons.push("Hay componentes y rutas de origen verificables.");
  else reasons.push("Falta evidencia suficiente de componentes o rutas.");
  if (coherence) reasons.push("La receta mantiene una relación coherente entre las piezas recuperadas.");
  else reasons.push("Las piezas proceden de fuentes/proyectos poco relacionados.");
  if (licensing) reasons.push("Existe información de licencia utilizable.");
  else reasons.push("La licencia no está suficientemente documentada para reutilización automática.");
  if (provenance) reasons.push("La procedencia del conocimiento está identificada.");
  else reasons.push("La procedencia no está suficientemente identificada.");
  if (qaEvidence) reasons.push("Existe evidencia explícita de QA.");
  else reasons.push("No existe evidencia explícita de QA; no se marca como verificada.");

  let score = 0;
  if (evidence) score += 25;
  if (coherence) score += 25;
  if (licensing) score += 20;
  if (provenance) score += 15;
  if (qaEvidence) score += 15;

  // Aprobar exige evidencia de QA, no solo una puntuación alta: sin ella,
  // evidencia + coherencia + licencia + procedencia ya suman 85 (>=80) y
  // una receta jamás verificada pasaría directo a "approved" —justo lo que
  // "si es útil pero todavía no hay QA comprobado → revisión" promete
  // evitar. El score sigue reflejando la calidad global, pero el estado
  // "approved" queda reservado a recetas con QA explícito.
  const status: RecipeQualityStatus =
    !evidence || !licensing ? "rejected" : score >= 80 && qaEvidence ? "approved" : "review";
  return { score, status, reasons: unique(reasons), checks: { evidence, coherence, licensing, provenance, qaEvidence } };
}

export function applyRecipeQuality(recipe: ForjaRecipe, results: KBSmartResult[] = []): ForjaRecipe {
  const report = evaluateRecipeQuality(recipe, results);
  return {
    ...recipe,
    quality: report.score,
    qualityStatus: report.status,
    qualityReasons: report.reasons,
    qualityCheckedAt: new Date().toISOString(),
  };
}

export function recipeCanBeReused(recipe: ForjaRecipe): boolean {
  return recipe.qualityStatus === "approved" || recipe.qualityStatus === "review";
}
