import { describe, it, expect } from "vitest";
import { ordenarParaVision, puedeVer, visionPorNombre } from "../../src/lib/forja/capacidades";

const c = (providerId: string, modelId: string) => ({ providerId, modelId });

describe("capacidades: visión", () => {
  it("la pista por nombre reconoce familias con visión y no inventa en las de texto", () => {
    for (const m of ["gemini-2.5-flash", "gpt-4o-mini", "claude-sonnet-5", "meta-llama/llama-4-scout", "qwen2.5-vl-72b", "pixtral-12b"]) {
      expect(visionPorNombre(m), m).toBe(true);
    }
    for (const m of ["llama-3.3-70b-versatile", "deepseek-chat", "qwen3-coder", "mistral-7b-instruct"]) {
      expect(visionPorNombre(m), m).toBe(false);
    }
  });

  it("solo niega con evidencia", () => {
    expect(puedeVer({}, "groq::llama-3.3-70b")).toBe(true);
    expect(puedeVer({ "groq::llama-3.3-70b": { at: 1 } }, "groq::llama-3.3-70b")).toBe(false);
  });

  it("quita los que dijeron que no ven y sube los que ven, sin perder el orden", () => {
    const cadena = [c("groq", "llama-3.3-70b"), c("nvidia", "deepseek-r1"), c("gemini", "gemini-2.5-flash"), c("openrouter", "llama-4-scout")];
    const r = ordenarParaVision(cadena, { "groq::llama-3.3-70b": { at: 1 } });
    expect(r.map((x) => x.modelId)).toEqual(["gemini-2.5-flash", "llama-4-scout", "deepseek-r1"]);
  });

  it("si todos dijeron que no, no deja la cadena vacía", () => {
    const cadena = [c("groq", "a"), c("groq", "b")];
    const r = ordenarParaVision(cadena, { "groq::a": { at: 1 }, "groq::b": { at: 1 } });
    expect(r).toHaveLength(2);
  });
});
