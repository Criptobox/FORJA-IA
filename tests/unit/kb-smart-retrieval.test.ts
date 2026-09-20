import { describe, expect, it } from "vitest";
import { retrieveSmartKB, retrieveSmartKBBundle, smartKBContext } from "@/lib/forja/kb-smart-retrieval";
import type { KBResource } from "@/lib/forja/kb-index";
import type { KBRepoAnalysis } from "@/lib/forja/kb-repo-analyzer";

const manifest: KBRepoAnalysis = {
  version: 1, id: "shop-manifest", name: "shop-ui", analyzedAt: new Date().toISOString(),
  totalFiles: 2, indexedFiles: 2, ignoredFiles: 0, totalBytes: 100,
  technologies: ["React", "TypeScript"], frameworks: ["Next.js"], packageManagers: ["npm"],
  components: ["ProductCard", "FilterDrawer"], patterns: ["component-library", "utility-css"],
  licenses: ["MIT"], entryPoints: ["src/app/page.tsx"], importantFiles: ["package.json"],
  files: [
    { path: "src/components/ProductCard.tsx", sizeBytes: 20, kind: "source", technology: ["React", "TypeScript"], componentNames: ["ProductCard"], patterns: ["component-library"] },
    { path: "src/components/FilterDrawer.tsx", sizeBytes: 20, kind: "source", technology: ["React", "TypeScript"], componentNames: ["FilterDrawer"], patterns: ["component-library"] },
  ],
};

const bundleManifest: KBRepoAnalysis = {
  version: 1, id: "shop-bundle-manifest", name: "shop-ui-completa", analyzedAt: new Date().toISOString(),
  totalFiles: 3, indexedFiles: 3, ignoredFiles: 0, totalBytes: 150,
  technologies: ["React", "TypeScript"], frameworks: ["Next.js"], packageManagers: ["npm"],
  components: ["Navbar", "ProductCard", "FilterDrawer"], patterns: ["component-library"],
  licenses: ["MIT"], entryPoints: ["src/app/page.tsx"], importantFiles: ["package.json"],
  files: [
    { path: "src/components/Navbar.tsx", sizeBytes: 20, kind: "source", technology: ["React", "TypeScript"], componentNames: ["Navbar"], patterns: ["component-library"] },
    { path: "src/components/ProductCard.tsx", sizeBytes: 20, kind: "source", technology: ["React", "TypeScript"], componentNames: ["ProductCard"], patterns: ["component-library"] },
    { path: "src/components/FilterDrawer.tsx", sizeBytes: 20, kind: "source", technology: ["React", "TypeScript"], componentNames: ["FilterDrawer"], patterns: ["component-library"] },
  ],
};

const resource = (id: string, name: string, path: string, manifestId = "shop-manifest"): KBResource => ({
  id, name, mimeType: "text/tsx", sizeBytes: 100, accountEmail: "MEGA", webViewLink: "",
  category: "codigo", tags: ["react"], technology: "React", license: "MIT", status: "clasificado",
  indexedAt: new Date().toISOString(), relativePath: path, sourceKind: "mega", sourceProvider: "mega",
  remoteId: id, projectManifestId: manifestId,
});

describe("kb-smart-retrieval", () => {
  it("infiere ProductCard desde el texto y prioriza su ruta", () => {
    const results = retrieveSmartKB({ text: "necesito un ProductCard para una tienda", limit: 5, codeFirst: true }, [
      resource("1", "ProductCard.tsx", "shop/src/components/ProductCard.tsx"),
      resource("2", "FilterDrawer.tsx", "shop/src/components/FilterDrawer.tsx"),
    ], [manifest]);
    expect(results[0]?.matchedComponent).toBe("ProductCard");
    expect(results[0]?.matchedPath).toContain("ProductCard.tsx");
  });

  it("prioriza un patrón existente en el manifiesto", () => {
    const results = retrieveSmartKB({ text: "usa utility css", limit: 5 }, [
      resource("1", "ProductCard.tsx", "shop/src/components/ProductCard.tsx"),
    ], [manifest]);
    expect(results[0]?.matchedPattern).toBe("utility-css");
  });

  it("el contexto explica por qué se recuperó el recurso", () => {
    const results = retrieveSmartKB({ text: "ProductCard", limit: 5 }, [resource("1", "ProductCard.tsx", "shop/src/components/ProductCard.tsx")], [manifest]);
    const ctx = smartKBContext(results, 1000);
    expect(ctx).toContain("componente:ProductCard");
    expect(ctx).toContain("proyecto:shop-ui");
  });

  it("con `codeFirst` y una consulta sin ninguna relación real, no arrastra código de MEGA solo por serlo", () => {
    // `buildCerebroPlanWithKnowledge` activa `codeFirst: true` en TODO
    // encargo web por defecto. Sin este resguardo, cualquier archivo de
    // código en MEGA habría pasado el filtro `score > 0` sin haber
    // coincidido en nada con el brief — justo lo que la fase promete NO
    // hacer ("no inventa componentes que no aparecen en los manifiestos").
    const results = retrieveSmartKB(
      { text: "arregla la paginación del panel de facturación", limit: 5, codeFirst: true },
      [resource("1", "ProductCard.tsx", "shop/src/components/ProductCard.tsx")],
      [manifest]
    );
    expect(results).toEqual([]);
  });

  it("`codeFirst` sí desempata entre candidatos que ya coincidieron de verdad", () => {
    const results = retrieveSmartKB(
      { text: "necesito un ProductCard", limit: 5, codeFirst: true },
      [resource("1", "ProductCard.tsx", "shop/src/components/ProductCard.tsx")],
      [manifest]
    );
    expect(results[0]?.reasons).toEqual(expect.arrayContaining(["código", "MEGA"]));
  });

  it("agrupa varias piezas relacionadas del mismo proyecto (bundle)", () => {
    const results = retrieveSmartKBBundle({
      text: "Navbar ProductCard FilterDrawer",
      components: ["Navbar", "ProductCard", "FilterDrawer"],
      codeFirst: true,
      limit: 6,
    }, [
      resource("nav", "Navbar.tsx", "shop/src/components/Navbar.tsx", "shop-bundle-manifest"),
      resource("pc", "ProductCard.tsx", "shop/src/components/ProductCard.tsx", "shop-bundle-manifest"),
      resource("fd", "FilterDrawer.tsx", "shop/src/components/FilterDrawer.tsx", "shop-bundle-manifest"),
    ], [bundleManifest]);
    expect(results.map((x) => x.resource.name)).toEqual(
      expect.arrayContaining(["Navbar.tsx", "ProductCard.tsx", "FilterDrawer.tsx"])
    );
    expect(results.every((x) => x.matchedProject === "shop-ui-completa")).toBe(true);
  });

  it("la cobertura no descarta una pieza pedida por comparar solo `matchedComponent`", () => {
    // Los tres recursos comparten manifiesto, así que `matchedComponent` es
    // el mismo para los tres (el "mejor" archivo del manifiesto para el
    // `component` singular inferido — ver `fileMatches`/`inferQuery`). Si la
    // fase de cobertura de `retrieveSmartKBBundle` comparara solo contra
    // `matchedComponent`, la búsqueda de "Navbar" y "ProductCard" no
    // encontraría nada (ambos "matchedComponent" resuelven a otro nombre) y,
    // con un `limit` menor que el número de piezas pedidas, el recurso
    // `Navbar.tsx` real habría quedado fuera del resultado aunque el usuario
    // lo pidió explícitamente y existe en la Knowledge Base.
    const results = retrieveSmartKBBundle({
      text: "Navbar ProductCard FilterDrawer",
      components: ["Navbar", "ProductCard", "FilterDrawer"],
      codeFirst: true,
      limit: 2,
    }, [
      resource("pc", "ProductCard.tsx", "shop/src/components/ProductCard.tsx", "shop-bundle-manifest"),
      resource("fd", "FilterDrawer.tsx", "shop/src/components/FilterDrawer.tsx", "shop-bundle-manifest"),
      resource("nav", "Navbar.tsx", "shop/src/components/Navbar.tsx", "shop-bundle-manifest"),
    ], [bundleManifest]);
    expect(results.map((x) => x.resource.name)).toContain("Navbar.tsx");
  });
});
