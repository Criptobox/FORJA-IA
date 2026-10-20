/** Forja IA — Recipe Feedback Loop (V23).
 * Registra evidencia de uso real sin convertir una sola ejecución en una
 * verdad absoluta. El resultado modifica la confianza de la receta y obliga
 * a revisar recetas que acumulan fallos.
 */
import { getForjaRecipe, saveForjaRecipe, type ForjaRecipe } from "./recipe-builder";

export type RecipeOutcome = "passed" | "failed" | "neutral";

export function recordRecipeOutcome(id: string, outcome: RecipeOutcome, qaEvidence = false): ForjaRecipe | undefined {
  const recipe = getForjaRecipe(id);
  if (!recipe) return undefined;
  const previous = recipe.feedback ?? { uses: 0, passed: 0, failed: 0 };
  const feedback = {
    uses: previous.uses + 1,
    passed: previous.passed + (outcome === "passed" ? 1 : 0),
    failed: previous.failed + (outcome === "failed" ? 1 : 0),
    lastOutcome: outcome,
    lastAt: new Date().toISOString(),
  } as const;
  const updated: ForjaRecipe = {
    ...recipe,
    usageCount: recipe.usageCount + 1,
    qaEvidence: recipe.qaEvidence || qaEvidence,
    feedback,
    updatedAt: new Date().toISOString(),
  };
  saveForjaRecipe(updated);
  return updated;
}

export function recipeConfidence(recipe: ForjaRecipe): number {
  const f = recipe.feedback;
  if (!f || f.uses === 0) return recipe.quality ?? 0;
  const empirical = Math.round((f.passed / f.uses) * 100);
  const quality = recipe.quality ?? 0;
  return Math.round(quality * 0.6 + empirical * 0.4);
}

/** Evita que una receta con demasiados fallos siga entrando como referencia
 * preferida hasta que vuelva a pasar un gate explícito. */
export function shouldDemoteRecipe(recipe: ForjaRecipe): boolean {
  const f = recipe.feedback;
  return Boolean(f && f.uses >= 3 && f.failed > f.passed);
}
