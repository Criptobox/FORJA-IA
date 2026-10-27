import { describe, it, expect } from "vitest";
import { camposDeRazonamiento, reenviaRazonamiento } from "@/lib/forja/razonamiento-tools";

describe("reenviaRazonamiento", () => {
  it("sí en DeepSeek, OpenCode Zen y en modelos deepseek/mimo de cualquier pasarela", () => {
    expect(reenviaRazonamiento("deepseek", "deepseek-chat")).toBe(true);
    expect(reenviaRazonamiento("opencode", "nemotron-3.5-lightning-free")).toBe(true);
    expect(reenviaRazonamiento("openrouter", "deepseek/deepseek-v4-flash:free")).toBe(true);
    expect(reenviaRazonamiento("aihubmix", "mimo-v2.5-pro")).toBe(true);
  });
  it("no en proveedores donde un campo desconocido puede dar 400", () => {
    expect(reenviaRazonamiento("openai", "gpt-4o-mini")).toBe(false);
    expect(reenviaRazonamiento("groq", "llama-3.3-70b")).toBe(false);
    expect(reenviaRazonamiento("gemini", "gemini-2.5-flash")).toBe(false);
  });
});

describe("camposDeRazonamiento", () => {
  it("devuelve el campo solo si hay razonamiento y el proveedor lo quiere", () => {
    expect(camposDeRazonamiento("opencode", "x-free", "pienso")).toEqual({ reasoning_content: "pienso" });
    expect(camposDeRazonamiento("openai", "gpt-4o", "pienso")).toEqual({});
  });
  it("nunca manda vacío ni solo espacios", () => {
    expect(camposDeRazonamiento("opencode", "x-free", "")).toEqual({});
    expect(camposDeRazonamiento("opencode", "x-free", "  \n ")).toEqual({});
    expect(camposDeRazonamiento("opencode", "x-free", undefined)).toEqual({});
  });
});
