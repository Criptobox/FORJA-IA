import { describe, expect, it } from "vitest";
import { buildWebStudioPrompt, WEB_STUDIO_STAGES } from "../../src/lib/forja/web-studio";

describe("Web Studio", () => {
  it("mantiene el workflow completo", () => {
    expect(WEB_STUDIO_STAGES.map(s => s.id)).toEqual(["brief","plan","build","qa","fix","regression","publish"]);
  });
  it("obliga a inspeccionar y verificar sin inventar mediciones", () => {
    const p = buildWebStudioPrompt({ brief: "mejora el hero" });
    expect(p).toContain("Primero inspecciona el proyecto existente");
    expect(p).toContain("No afirmes que algo pasó una prueba");
    expect(p).toContain("Visual QA");
  });
});
