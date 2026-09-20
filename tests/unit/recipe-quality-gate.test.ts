import { describe, expect, it } from "vitest";
import { buildForjaRecipe } from "@/lib/forja/recipe-builder";
import { evaluateRecipeQuality, applyRecipeQuality } from "@/lib/forja/recipe-quality-gate";
import type { KBSmartResult } from "@/lib/forja/kb-smart-retrieval";

const hit = (id: string, component: string): KBSmartResult => ({
  resource: { id, name: `${component}.tsx`, mimeType: "text/tsx", sizeBytes: 10, accountEmail: "MEGA", webViewLink: "", category: "codigo", tags: [], technology: "React", license: "MIT", status: "clasificado", indexedAt: new Date().toISOString(), sourceProvider: "mega", sourceKind: "mega", relativePath: `shop/${component}.tsx` },
  score: 20, reasons: [`componente:${component}`], matchedComponent: component, matchedProject: "shop-ui", matchedPath: `shop/${component}.tsx`,
});

describe("recipe-quality-gate", () => {
  it("marca para revisión una receta con evidencia pero sin QA explícito", () => {
    // Evidencia + coherencia + licencia + procedencia ya suman 85 puntos
    // (>= 80) sin ningún dato de QA. Si "approved" dependiera solo del
    // score, esta receta —nunca verificada— pasaría directo a aprobada:
    // justo lo que "si es útil pero todavía no hay QA comprobado →
    // revisión" promete evitar.
    const recipe = buildForjaRecipe({ text: "tienda ProductCard FilterDrawer", components: ["ProductCard", "FilterDrawer"] }, [hit("1", "ProductCard"), hit("2", "FilterDrawer")]);
    const report = evaluateRecipeQuality(recipe, [hit("1", "ProductCard"), hit("2", "FilterDrawer")]);
    expect(report.status).toBe("review");
    expect(report.checks.qaEvidence).toBe(false);
    expect(report.score).toBe(85);
  });

  it("no permite aprobar sin licencia", () => {
    const good = hit("1", "ProductCard");
    good.resource.license = "";
    const recipe = buildForjaRecipe({ text: "ProductCard" }, [good]);
    expect(evaluateRecipeQuality(recipe, [good]).status).toBe("rejected");
  });

  it("solo aprueba cuando hay evidencia explícita de QA", () => {
    const results = [hit("1", "ProductCard"), hit("2", "FilterDrawer")];
    const recipe = { ...buildForjaRecipe({ text: "tienda ProductCard FilterDrawer", components: ["ProductCard", "FilterDrawer"] }, results), qaEvidence: true };
    expect(evaluateRecipeQuality(recipe, results).status).toBe("approved");
  });

  it("persiste el resultado del gate en la receta", () => {
    const results = [hit("1", "ProductCard")];
    const recipe = buildForjaRecipe({ text: "ProductCard" }, results);
    const checked = applyRecipeQuality(recipe, results);
    expect(checked.qualityStatus).toBe("review");
    expect(checked.qualityReasons?.length).toBeGreaterThan(0);
    expect(checked.qualityCheckedAt).toBeTruthy();
  });
});
