import { describe, expect, it } from "vitest";
import { buildForjaRecipe, recipeContext } from "@/lib/forja/recipe-builder";
import type { KBSmartResult } from "@/lib/forja/kb-smart-retrieval";

const hit = (id: string, component: string): KBSmartResult => ({
  resource: { id, name: `${component}.tsx`, mimeType: "text/tsx", sizeBytes: 10, accountEmail: "MEGA", webViewLink: "", category: "codigo", tags: [], technology: "React", license: "MIT", status: "clasificado", indexedAt: new Date().toISOString(), sourceProvider: "mega", sourceKind: "mega", relativePath: `shop/${component}.tsx` },
  score: 20, reasons: [`componente:${component}`], matchedComponent: component, matchedProject: "shop-ui", matchedPath: `shop/${component}.tsx`,
});

describe("recipe-builder", () => {
  it("crea una receta sin copiar el código remoto", () => {
    const recipe = buildForjaRecipe({ text: "tienda ProductCard FilterDrawer", components: ["ProductCard", "FilterDrawer"] }, [hit("1", "ProductCard"), hit("2", "FilterDrawer")], "Tienda catalogo");
    expect(recipe.name).toBe("Tienda catalogo");
    expect(recipe.components.map((x) => x.name)).toEqual(["ProductCard", "FilterDrawer"]);
    expect(recipe.sources).toEqual(["shop/ProductCard.tsx", "shop/FilterDrawer.tsx"]);
    // La receta guarda referencias (nombre, ruta, proyecto), nunca el
    // contenido del archivo: no hay ningún campo de código en el objeto.
    expect(recipe).not.toHaveProperty("content");
    expect(recipe).not.toHaveProperty("code");
  });

  it("genera contexto con reglas de adaptación", () => {
    const recipe = buildForjaRecipe({ text: "ProductCard" }, [hit("1", "ProductCard")]);
    const context = recipeContext(recipe);
    expect(context).toContain("FORJA RECIPE");
    expect(context).toContain("Adaptación:");
    expect(context).toContain("Reutilizar la estructura");
  });
});
