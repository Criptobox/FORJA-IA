import { describe, expect, it } from "vitest";
import { PROVIDERS } from "@/lib/forja/providers";
import { FAILOVER_ORDER, isFreeModel } from "@/lib/forja/free-models";
import { RADAR_SOURCES } from "@/lib/forja/free-radar";

describe("OpenCode Zen", () => {
  const def = PROVIDERS.find((p) => p.id === "opencode");

  it("está registrado como proveedor OpenAI-compatible con su clave y sus docs", () => {
    expect(def?.baseUrl).toBe("https://opencode.ai/zen/v1");
    expect(def?.protocol).toBe("openai");
    expect(def?.keyUrl).toBe("https://opencode.ai/auth");
  });

  it("no fija modelos de serie: los «-free» de Zen se retiran sin aviso", () => {
    // deepseek-v4-flash-free y mimo-v2.5-free dieron «Model is unavailable».
    // La lista sale de «Probar», que llama de verdad a cada modelo.
    expect(def?.defaultModels).toEqual([]);
    expect(def?.keyOptional).toBe(true);
  });

  it("los «-free» del catálogo se reconocen como gratis", () => {
    for (const m of ["nemotron-3-ultra-free", "mimo-v2.5-free"]) expect(isFreeModel("opencode", m), m).toBe(true);
  });

  it("entra en el failover y en el radar", () => {
    expect(FAILOVER_ORDER).toContain("opencode");
    expect(RADAR_SOURCES.some((s) => s.providerId === "opencode")).toBe(true);
  });
});
