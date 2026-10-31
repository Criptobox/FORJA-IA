/** Las herramientas de la Knowledge Base no se le describen al modelo si no hay
 * nada que leer: con el catálogo entero, cada vuelta del agente pagaba ~900
 * tokens por herramientas que solo podían contestar «no hay recursos». */
import { describe, it, expect } from "vitest";
import { sinHerramientasVacias } from "../../src/lib/forja/use-agent-tools";
import { TOOL_CATALOG } from "../../src/lib/forja/tools-catalog";

const nombres = (c: readonly { name: string }[]) => c.map((t) => t.name);

describe("herramientas sin nada que leer", () => {
  it("con la Knowledge Base vacía no van kb_search, kb_read ni kb_project_search", () => {
    const c = nombres(sinHerramientasVacias(TOOL_CATALOG, { recursos: 0, manifiestos: 0 }));
    expect(c).not.toContain("kb_search");
    expect(c).not.toContain("kb_read");
    expect(c).not.toContain("kb_project_search");
    expect(c, "el resto sigue").toContain("write_file");
    expect(c.length).toBe(TOOL_CATALOG.length - 3);
  });

  it("en cuanto hay recursos o proyectos analizados, vuelven las suyas", () => {
    expect(nombres(sinHerramientasVacias(TOOL_CATALOG, { recursos: 2, manifiestos: 0 }))).toEqual(
      expect.arrayContaining(["kb_search", "kb_read"])
    );
    const soloProyectos = nombres(sinHerramientasVacias(TOOL_CATALOG, { recursos: 0, manifiestos: 1 }));
    expect(soloProyectos).toContain("kb_project_search");
    expect(soloProyectos).not.toContain("kb_search");
  });

  it("con todo indexado, el catálogo queda entero", () => {
    expect(sinHerramientasVacias(TOOL_CATALOG, { recursos: 1, manifiestos: 1 })).toHaveLength(TOOL_CATALOG.length);
  });
});
