import { describe, expect, it } from "vitest";
import { calculateProjectHealth } from "../../src/lib/prism/project-health";

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
});
