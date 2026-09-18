import { describe, expect, it } from "vitest";
import { scanSecurity } from "../../src/lib/prism/security-center";

describe("Security Center", () => {
  it("detecta patrones peligrosos sin afirmar una auditoría completa", () => {
    const r = scanSecurity('const key="sk-abcdefghijklmnop"; eval(x);');
    expect(r.findings.some(f => f.rule === "secret-inline")).toBe(true);
    expect(r.findings.some(f => f.rule === "eval")).toBe(true);
    expect(r.disclaimer).toMatch(/no sustituye/i);
  });
  it("no inventa hallazgos en código vacío", () => {
    expect(scanSecurity("").findings).toHaveLength(0);
    expect(scanSecurity("").score).toBeNull();
  });
});
