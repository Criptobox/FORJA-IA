import { describe, expect, it, beforeEach } from "vitest";
import { buildForjaRecipe, saveForjaRecipe, searchForjaRecipes } from "@/lib/forja/recipe-builder";
import { recordRecipeOutcome, recipeConfidence, shouldDemoteRecipe } from "@/lib/forja/recipe-feedback";
import type { KBSmartResult } from "@/lib/forja/kb-smart-retrieval";

const hit = (id: string, component: string): KBSmartResult => ({
  resource: { id, name: `${component}.tsx`, mimeType: "text/tsx", sizeBytes: 10, accountEmail: "MEGA", webViewLink: "", category: "codigo", tags: [], technology: "React", license: "MIT", status: "clasificado", indexedAt: new Date().toISOString(), sourceProvider: "mega", sourceKind: "mega", relativePath: `shop/${component}.tsx` },
  score: 20, reasons: [`componente:${component}`], matchedComponent: component, matchedProject: "shop-ui", matchedPath: `shop/${component}.tsx`,
});

function stubLocalStorage() {
  const mem = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => { mem.set(k, v); },
      removeItem: (k: string) => mem.delete(k),
    },
    configurable: true,
  });
  Object.defineProperty(globalThis, "window", { value: { dispatchEvent: () => true }, configurable: true });
}

describe("recipe-feedback", () => {
  beforeEach(() => stubLocalStorage());

  it("registra resultados y baja recetas con fallos repetidos", () => {
    const recipe = { ...buildForjaRecipe({ text: "ProductCard" }, [hit("feedback", "ProductCard")]), quality: 80, qualityStatus: "review" as const };
    saveForjaRecipe(recipe);
    recordRecipeOutcome(recipe.id, "failed");
    recordRecipeOutcome(recipe.id, "failed");
    recordRecipeOutcome(recipe.id, "failed");
    const updated = recordRecipeOutcome(recipe.id, "passed");
    expect(updated?.feedback?.uses).toBe(4);
    expect(shouldDemoteRecipe(updated!)).toBe(true);
    expect(recipeConfidence(updated!)).toBeLessThan(80);
  });

  it("una receta degradada por fallos repetidos deja de salir en la búsqueda frente a una sana", () => {
    const demoted = { ...buildForjaRecipe({ text: "tienda ProductCard" }, [hit("1", "ProductCard")]), qualityStatus: "approved" as const };
    saveForjaRecipe(demoted);
    for (let i = 0; i < 3; i++) recordRecipeOutcome(demoted.id, "failed");

    const healthy = { ...buildForjaRecipe({ text: "tienda ProductCard" }, [hit("2", "ProductCard")]), qualityStatus: "approved" as const };
    saveForjaRecipe(healthy);

    const found = searchForjaRecipes("tienda ProductCard");
    expect(found.map((r) => r.id)).toEqual([healthy.id]);
  });
});
