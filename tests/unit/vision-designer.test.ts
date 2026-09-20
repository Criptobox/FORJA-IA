import { describe, expect, it } from "vitest";
import { emptyVisionAnalysis, visionDesignerPrompt, compactVisionContext } from "@/lib/forja/vision-designer";

describe("Vision Designer", () => {
  it("el análisis vacío ya trae la advertencia de no copiar", () => {
    const vacio = emptyVisionAnalysis();
    expect(vacio.avoidCopying.length).toBeGreaterThan(0);
    expect(vacio.composition).toEqual([]);
  });

  it("el prompt anuncia cuántas referencias hay y prohíbe copiar identidad", () => {
    const prompt = visionDesignerPrompt(3);
    expect(prompt).toContain("REFERENCIAS: 3");
    expect(prompt).toContain("No reproduzcas identidad");
  });

  it("compactVisionContext solo incluye secciones con contenido", () => {
    const analysis = { ...emptyVisionAnalysis(), color: ["acento cálido"], hierarchy: [] };
    const contexto = compactVisionContext(analysis);
    expect(contexto).toContain("COLOR: acento cálido");
    expect(contexto).not.toContain("JERARQUÍA:");
  });

  it("compactVisionContext respeta el tope de caracteres", () => {
    const analysis = { ...emptyVisionAnalysis(), composition: ["línea muy larga ".repeat(50)] };
    const contexto = compactVisionContext(analysis, 40);
    expect(contexto.length).toBeLessThanOrEqual(40);
  });
});
