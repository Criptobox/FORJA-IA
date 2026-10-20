import { describe, expect, it } from "vitest";
import { buildWebStudioPrompt, evaluarEtapas, WEB_STUDIO_STAGES, type EvidenciaStudio } from "../../src/lib/forja/web-studio";

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


describe("evaluarEtapas", () => {
  const base: EvidenciaStudio = { brief: "", iniciado: false, hayHtml: false, qa: [], tareasQaAbiertas: 0, bloqueos: 0 };

  it("sin evidencia nada está hecho y lo siguiente es el brief", () => {
    const e = evaluarEtapas(base);
    expect(Object.values(e.etapas).every((x) => x !== "hecha")).toBe(true);
    expect(e.siguiente).toBe("brief");
  });

  it("con hallazgos en la última medida, lo siguiente es arreglar", () => {
    const e = evaluarEtapas({ ...base, iniciado: true, hayHtml: true, qa: [[{ ok: false, hallazgos: 2 }]] });
    expect(e.etapas.qa).toBe("hecha");
    expect(e.siguiente).toBe("fix");
    expect(e.motivo).toMatch(/2 hallazgo/);
  });

  it("la regresión exige volver a medir después y quedar limpio", () => {
    const una = evaluarEtapas({ ...base, iniciado: true, hayHtml: true, qa: [[{ ok: true, hallazgos: 0 }]] });
    expect(una.etapas.fix).toBe("hecha");
    expect(una.siguiente).toBe("regression");
    const dos = evaluarEtapas({ ...base, iniciado: true, hayHtml: true, qa: [[{ ok: false, hallazgos: 1 }], [{ ok: true, hallazgos: 0 }]] });
    expect(dos.etapas.regression).toBe("hecha");
    expect(dos.siguiente).toBe("publish");
  });

  it("un medidor que no respondió no cuenta como medida", () => {
    const e = evaluarEtapas({ ...base, hayHtml: true, qa: [[{ ok: true, noRespondio: true, hallazgos: 0 }]] });
    expect(e.etapas.qa).toBe("pendiente");
  });

  it("publicar se bloquea con bloqueos verificados y nunca se marca hecho", () => {
    expect(evaluarEtapas({ ...base, bloqueos: 1 }).etapas.publish).toBe("bloqueada");
    const limpio = evaluarEtapas({ ...base, iniciado: true, hayHtml: true, qa: [[{ ok: true, hallazgos: 0 }], [{ ok: true, hallazgos: 0 }]] });
    expect(limpio.etapas.publish).toBe("pendiente");
  });
});
