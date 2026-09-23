import { describe, expect, it } from "vitest";
import { calculateProjectHealth } from "../../src/lib/forja/project-health";

describe("Project Health", () => {
  it("no inventa un score cuando no hay evidencia", () => {
    expect(calculateProjectHealth({}).score).toBeNull();
  });
  it("penaliza hallazgos medidos y secretos visibles", () => {
    const h = calculateProjectHealth({
      html: '<script>const k="sk-abcdefghijklmnop";</script>',
      qa: [{ width: 320, ok: false, items: [{ tipo: "scroll", detalle: "sale", }] , at: 1 }],
    });
    expect(h.score).not.toBeNull();
    expect(h.blockers.length).toBeGreaterThan(0);
    expect(h.metrics.find(m => m.id === "safety")?.score).toBeLessThan(100);
  });

  it("separa accesibilidad de visual: cada hallazgo penaliza solo su métrica", () => {
    const h = calculateProjectHealth({
      qa: [{
        width: 320,
        ok: false,
        items: [
          { tipo: "scroll", detalle: "sale" },
          { tipo: "sin-alt", detalle: "img sin alt" },
        ],
        at: 1,
      }],
    });
    const visual = h.metrics.find((m) => m.id === "visual");
    const a11y = h.metrics.find((m) => m.id === "accesibilidad");
    expect(visual?.score).toBe(85); // 1 hallazgo visual
    expect(a11y?.score).toBe(85); // 1 hallazgo de accesibilidad
    expect(h.blockers.some((b) => /accesibilidad/.test(b))).toBe(true);
  });

  it("sin QA todavía medido, ninguna de las dos métricas inventa un score", () => {
    const h = calculateProjectHealth({});
    expect(h.metrics.find((m) => m.id === "visual")?.score).toBeNull();
    expect(h.metrics.find((m) => m.id === "accesibilidad")?.score).toBeNull();
  });

  it("la seguridad usa el mismo motor que Security Center, con su detalle", () => {
    const h = calculateProjectHealth({ html: "<script>eval(x)</script>" });
    const safety = h.metrics.find((m) => m.id === "safety");
    expect(safety?.score).toBeLessThan(100);
    expect(safety?.detail).toMatch(/eval/);
  });
});

describe("Project Health — detalle del motor", () => {
  it("una página corta no se mide: «—», no un suspenso", () => {
    const h = calculateProjectHealth({ html: "<html><body><h1>x</h1></body></html>" });
    expect(h.metrics.find((m) => m.id === "detail")?.score).toBeNull();
  });
  it("una página de tamaño real recibe la puntuación de detalle del motor", () => {
    const html = `<html><body>${"<section><h2>S</h2><p>" + "texto ".repeat(80) + "</p></section>".repeat(1)}`.repeat(8) + "</body></html>";
    const d = calculateProjectHealth({ html }).metrics.find((m) => m.id === "detail");
    expect(typeof d?.score).toBe("number");
  });
});
