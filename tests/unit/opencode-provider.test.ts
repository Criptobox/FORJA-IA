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

  it("todos sus modelos de serie son «-free» y se reconocen como gratis", () => {
    expect(def?.defaultModels.length).toBeGreaterThan(0);
    for (const m of def?.defaultModels ?? []) expect(isFreeModel("opencode", m), m).toBe(true);
  });

  it("entra en el failover y en el radar", () => {
    expect(FAILOVER_ORDER).toContain("opencode");
    expect(RADAR_SOURCES.some((s) => s.providerId === "opencode")).toBe(true);
  });
});
