import { describe, expect, it } from "vitest";
import { roleForPath } from "@/components/forja/mega-kb-import";

describe("roleForPath (indexación desde MEGA)", () => {
  it("detecta TypeScript/React y lo pone también en `technology`, no solo en las etiquetas", () => {
    const r = roleForPath("src/components/Button.tsx");
    expect(r.category).toBe("componentes");
    expect(r.tags).toEqual(expect.arrayContaining(["mega", "codigo", "typescript", "react"]));
    expect(r.technology).toBe("TypeScript");
  });

  it("detecta Python por extensión cuando no hay pista en la ruta", () => {
    const r = roleForPath("scripts/build.py");
    expect(r.technology).toBe("Python");
    expect(r.category).toBe("recursos-code");
  });

  it("clasifica por carpeta antes que por extensión: template gana aunque sea .ts", () => {
    const r = roleForPath("starter-kits/nextjs/config.ts");
    expect(r.category).toBe("templates");
    expect(r.technology).toBe("TypeScript");
  });

  it("reconoce recetas de Forja y repositorios por nombre de carpeta", () => {
    expect(roleForPath("forja-recipes/deploy.md").category).toBe("forja-recipes");
    expect(roleForPath("my-repo/README.md").category).toBe("repositorios");
  });

  it("un archivo sin ninguna pista cae en recursos-code, sin tecnología inventada", () => {
    const r = roleForPath("assets/logo.svg");
    expect(r.category).toBe("recursos-code");
    expect(r.technology).toBe("");
    expect(r.tags).toContain("recurso");
  });
});
