import { describe, expect, it } from "vitest";
import { retrieveProjectKnowledge, projectKnowledgeContext, buildProjectSearchIndex } from "@/lib/forja/kb-project-retrieval";
import type { KBRepoAnalysis } from "@/lib/forja/kb-repo-analyzer";

const project: KBRepoAnalysis = {
  version: 1, id: "p1", name: "shop-ui", analyzedAt: new Date().toISOString(),
  totalFiles: 2, indexedFiles: 2, ignoredFiles: 0, totalBytes: 100,
  technologies: ["React", "TypeScript"], frameworks: ["Next.js"], packageManagers: ["npm"],
  components: ["ProductCard", "FilterDrawer"], patterns: ["component-library", "utility-css"],
  licenses: ["LICENSE"], entryPoints: ["src/app/page.tsx"], importantFiles: ["package.json"],
  files: [
    { path: "src/components/ProductCard.tsx", sizeBytes: 20, kind: "source", technology: ["React", "TypeScript"], componentNames: ["ProductCard"], patterns: ["component-library", "utility-css"] },
    { path: "src/components/FilterDrawer.tsx", sizeBytes: 20, kind: "source", technology: ["React", "TypeScript"], componentNames: ["FilterDrawer"], patterns: ["component-library"] },
  ],
};

describe("kb-project-retrieval", () => {
  it("encuentra un componente sin cargar el repositorio completo", () => {
    const hits = retrieveProjectKnowledge({ text: "filtro", component: "FilterDrawer" }, [project]);
    expect(hits[0]?.file?.componentNames).toContain("FilterDrawer");
  });

  it("prioriza tecnología y patrón", () => {
    const hits = retrieveProjectKnowledge({ text: "card", technology: "React", pattern: "component-library" }, [project]);
    expect(hits[0]?.score).toBeGreaterThan(5);
  });

  it("genera contexto compacto", () => {
    const ctx = projectKnowledgeContext(retrieveProjectKnowledge({ text: "product" }, [project]), 500);
    expect(ctx).toContain("ProductCard");
    expect(ctx.length).toBeLessThanOrEqual(500);
  });

  it("sin proyectos, no hay resultados ni error", () => {
    expect(retrieveProjectKnowledge({ text: "cualquier cosa" }, [])).toEqual([]);
  });

  it("sin ninguna coincidencia real, no devuelve nada por capricho", () => {
    const hits = retrieveProjectKnowledge({ text: "xyzxyzxyz-inventado" }, [project]);
    expect(hits).toEqual([]);
  });

  it("respeta el límite de resultados", () => {
    const hits = retrieveProjectKnowledge({ text: "component react", limit: 1 }, [project]);
    expect(hits.length).toBeLessThanOrEqual(1);
  });

  it("el componente exacto puntúa por encima de un archivo que solo casa en texto libre", () => {
    const hits = retrieveProjectKnowledge({ text: "algo", component: "ProductCard" }, [project]);
    expect(hits[0]?.file?.componentNames).toContain("ProductCard");
  });

  describe("prefiltro con Forja Search (V25)", () => {
    it("con índice, encuentra los mismos resultados que sin índice para un brief largo", () => {
      // El prefiltro busca cada PALABRA de `q.text` por separado (no la
      // frase completa como un solo trigrama): si buscara la frase entera,
      // los trigramas que cruzan palabras vecinas diluirían el ratio de
      // coincidencia real de "FilterDrawer" entre ruido irrelevante, y con
      // un corpus grande podría quedar fuera del prefiltro aunque el
      // ranking real sí lo hubiera encontrado.
      const q = { text: "necesito ayuda urgente con el componente FilterDrawer roto en mi tienda", component: "FilterDrawer" };
      const withoutIndex = retrieveProjectKnowledge(q, [project]);
      const index = buildProjectSearchIndex([project]);
      const withIndex = retrieveProjectKnowledge(q, [project], index);
      expect(withIndex.map((h) => h.file?.path ?? h.project.id)).toEqual(withoutIndex.map((h) => h.file?.path ?? h.project.id));
      expect(withIndex[0]?.file?.componentNames).toContain("FilterDrawer");
    });

    it("descarta proyectos que ni el índice ni la consulta relacionan", () => {
      const other: KBRepoAnalysis = {
        ...project,
        id: "p2",
        name: "blog-cms",
        technologies: ["Vue"],
        frameworks: [],
        components: ["PostCard"],
        patterns: [],
        files: [{ path: "src/components/PostCard.vue", sizeBytes: 20, kind: "source", technology: ["Vue"], componentNames: ["PostCard"], patterns: [] }],
      };
      const index = buildProjectSearchIndex([project, other]);
      const hits = retrieveProjectKnowledge({ text: "filtro", component: "FilterDrawer" }, [project, other], index);
      expect(hits.every((h) => h.project.id === "p1")).toBe(true);
    });
  });
});
