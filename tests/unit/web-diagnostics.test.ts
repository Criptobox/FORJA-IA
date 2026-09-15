import { describe, expect, it } from "vitest";
import { diagnoseFindings, summarizeDiagnosis } from "../../src/lib/prism/web-diagnostics";

describe("diagnoseFindings — evidencia del verificador convertida en acción", () => {
  it("un error de runtime se marca bloqueante y apunta al código de la app", () => {
    const d = diagnoseFindings(
      [{ id: "runtime-error", severity: "error", source: "runtime", message: "ReferenceError: x is not defined", evidence: "console" }],
      ["src/app/page.tsx", "package.json"]
    );
    expect(d.status).toBe("blocked");
    expect(d.items[0].action).toBe("runtime");
    expect(d.items[0].candidatePaths).toContain("src/app/page.tsx");
    expect(d.items[0].doneWhen).toMatch(/ejecutar/);
    expect(summarizeDiagnosis(d)).toMatch(/ReferenceError/);
  });

  it("un hallazgo visual no inventa una línea exacta, pero sí candidatos", () => {
    const d = diagnoseFindings(
      [{ id: "visual-overflow", severity: "error", source: "visual", message: "overflow horizontal" }],
      ["src/app/page.tsx", "src/app/globals.css"]
    );
    expect(d.items[0].action).toBe("visual-review");
    expect(d.items[0].candidatePaths.length).toBeGreaterThan(0);
  });

  it("un secreto filtrado se marca como remove-secret, no como patch genérico", () => {
    const d = diagnoseFindings(
      [{ id: "possible-secret", severity: "error", source: "static", message: "posible clave API en config.js" }],
      ["config.js"]
    );
    expect(d.items[0].action).toBe("remove-secret");
    expect(d.status).toBe("blocked");
  });

  it("sin hallazgos, el estado es «ready» y el siguiente paso lo dice", () => {
    const d = diagnoseFindings([], ["index.html"]);
    expect(d.status).toBe("ready");
    expect(d.items).toHaveLength(0);
    expect(d.nextStep).toMatch(/regresión|regresion/i);
  });

  it("solo warnings deja el estado en «needs-fix», no bloqueado", () => {
    const d = diagnoseFindings(
      [{ id: "html-title", severity: "warning", source: "static", message: "falta <title>" }],
      ["index.html"]
    );
    expect(d.status).toBe("needs-fix");
  });
});
