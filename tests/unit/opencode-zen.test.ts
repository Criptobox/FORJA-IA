import { describe, expect, it } from "vitest";
import {
  ZEN_CLAVE_ANONIMA,
  detalleDeError,
  hablaChatCompletions,
  claveEfectiva,
  clasificarRespuestaZen,
  esClaveOpcional,
  esModeloGratisZen,
  modelosGratisDeCatalogo,
} from "@/lib/forja/opencode-zen";

describe("claveEfectiva", () => {
  it("usa tu clave si la hay, también en Zen", () => {
    expect(claveEfectiva("opencode", "  sk-abc ")).toBe("sk-abc");
  });
  it("en Zen sin clave manda la anónima", () => {
    expect(claveEfectiva("opencode", "")).toBe(ZEN_CLAVE_ANONIMA);
    expect(claveEfectiva("opencode", "   ")).toBe(ZEN_CLAVE_ANONIMA);
  });
  it("en los demás proveedores NO inventa una clave", () => {
    expect(claveEfectiva("openrouter", "")).toBe("");
    expect(claveEfectiva("groq", "  ")).toBe("");
  });
  it("solo opencode es de clave opcional", () => {
    expect(esClaveOpcional("opencode")).toBe(true);
    expect(esClaveOpcional("ollama")).toBe(false);
  });
});

describe("modelos gratis de Zen", () => {
  it("solo cuenta el sufijo -free, no presume por el nombre", () => {
    expect(esModeloGratisZen("deepseek-v4-flash-free")).toBe(true);
    expect(esModeloGratisZen("MiMo-V2.5-FREE")).toBe(true);
    expect(esModeloGratisZen("gpt-5")).toBe(false);
    expect(esModeloGratisZen("freedom-pro")).toBe(false);
  });
  it("filtra, deduplica y ordena el catálogo", () => {
    expect(modelosGratisDeCatalogo(["b-free", "gpt-5", "a-free", "b-free"])).toEqual(["a-free", "b-free"]);
  });
  it("incluye big-pickle (gratis sin sufijo) y aparta los que no usan /chat/completions", () => {
    const cat = ["big-pickle", "mimo-v2.5-free", "minimax-m2.7-free", "gpt-5-nano-free", "claude-haiku-4-5", "qwen3.6-free"];
    expect(modelosGratisDeCatalogo(cat)).toEqual(["big-pickle", "mimo-v2.5-free"]);
  });
  it("reconoce las familias que Zen sirve por otro endpoint", () => {
    for (const id of ["gpt-5", "claude-sonnet-4-6", "qwen3.6-plus", "minimax-m2.7-free", "gemini-3-flash"])
      expect(hablaChatCompletions(id)).toBe(false);
    for (const id of ["deepseek-v4-flash-free", "mimo-v2.5-free", "glm-4.7-free", "kimi-k2", "big-pickle"])
      expect(hablaChatCompletions(id)).toBe(true);
  });
  it("detalleDeError saca el mensaje del JSON de OpenAI o devuelve el texto", () => {
    expect(detalleDeError('{"error":{"message":"model not supported"}}')).toBe("model not supported");
    expect(detalleDeError("plain text")).toBe("plain text");
    expect(detalleDeError("")).toBe("");
  });
});

describe("clasificarRespuestaZen", () => {
  it("200 sin clave → abierto", () => {
    expect(clasificarRespuestaZen(200, "{}", false).estado).toBe("abierto");
  });
  it("403 FreeTierError → requiere clave, con el motivo", () => {
    const r = clasificarRespuestaZen(403, '{"error":{"type":"FreeTierError"}}', false);
    expect(r.estado).toBe("requiere-clave");
    expect(r.mensaje).toMatch(/opencode\.ai\/auth/);
  });
  it("401 sin clave → requiere clave; con clave → clave inválida", () => {
    expect(clasificarRespuestaZen(401, "Missing API key", false).estado).toBe("requiere-clave");
    expect(clasificarRespuestaZen(401, "Invalid API key", true).estado).toBe("clave-invalida");
  });
  it("5xx no se atribuye a la clave", () => {
    const r = clasificarRespuestaZen(500, "Internal server error", true);
    expect(r.estado).toBe("servicio");
    expect(r.mensaje).toMatch(/no es tu clave/);
  });
  it("400 enseña el motivo real y no culpa a la clave", () => {
    const r = clasificarRespuestaZen(400, '{"error":{"message":"Unsupported endpoint for model"}}', false);
    expect(r.estado).toBe("otro");
    expect(r.mensaje).toMatch(/HTTP 400/);
    expect(r.mensaje).toMatch(/Unsupported endpoint for model/);
  });
  it("429 no cuenta como abierto ni como clave mala", () => {
    expect(clasificarRespuestaZen(429, "", false).estado).toBe("otro");
  });
});
