import { describe, expect, it } from "vitest";
import { ASTRYX_TOKENS_CSS, DETALLES_WEB, astryxPrompt } from "../../src/lib/forja/web/astryx-base";
import { readFileSync } from "node:fs";

describe("base de diseño (Astryx, MIT)", () => {
  it("lleva los tokens y los detalles que suelen faltar", () => {
    const p = astryxPrompt();
    for (const t of ["--space-4", "--radius-element", "--shadow-med", "--dur-fast", "light-dark(", "--text-5xl"]) expect(p).toContain(t);
    expect(p).toContain("focus-visible");
    expect(p).toContain("prefers-reduced-motion");
    expect(DETALLES_WEB.length).toBeGreaterThanOrEqual(8);
  });
  it("es corta: no gasta tokens de más (≲ 700 tokens ≈ 3.200 caracteres)", () => {
    expect(astryxPrompt().length).toBeLessThan(3200);
    expect(ASTRYX_TOKENS_CSS.length).toBeLessThan(1700);
  });
  it("los tokens son CSS equilibrado", () => {
    expect((ASTRYX_TOKENS_CSS.match(/\{/g) ?? []).length).toBe((ASTRYX_TOKENS_CSS.match(/\}/g) ?? []).length);
  });
  it("el aviso de la licencia MIT de Meta está en el repo", () => {
    const n = readFileSync("THIRD_PARTY_NOTICES.md", "utf8");
    expect(n).toContain("github.com/meta/astryx");
    expect(n).toContain("MIT License");
    expect(n).toContain("Meta Platforms");
  });
});
