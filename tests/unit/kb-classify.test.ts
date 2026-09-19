import { describe, it, expect, vi } from "vitest";
import { classifyFile, isTextLike, parseClassifyReply } from "../../src/lib/forja/kb-classify";
import type { ProviderConfig, AppSettings } from "../../src/lib/forja/types";

describe("parseClassifyReply", () => {
  it("lee JSON limpio", () => {
    const r = parseClassifyReply('{"category": "componentes-ui", "technology": "React", "tags": ["dashboard", "oscuro"]}');
    expect(r).toEqual({ category: "componentes-ui", technology: "React", tags: ["dashboard", "oscuro"] });
  });

  it("saca el JSON aunque venga envuelto en explicación o valla de código", () => {
    const r = parseClassifyReply('Aquí tienes:\n```json\n{"category": "visual", "technology": "", "tags": []}\n```\nEspero que ayude.');
    expect(r).toEqual({ category: "visual", technology: "", tags: [] });
  });

  it("sin category, no es válido", () => {
    expect(parseClassifyReply('{"technology": "React", "tags": []}')).toBeNull();
  });

  it("category vacía tampoco es válida", () => {
    expect(parseClassifyReply('{"category": "  ", "tags": []}')).toBeNull();
  });

  it("tags que no son array o con basura, se limpian o se ignoran", () => {
    expect(parseClassifyReply('{"category": "x", "tags": "no-es-array"}')).toEqual({ category: "x", technology: "", tags: [] });
    expect(parseClassifyReply('{"category": "x", "tags": ["ok", 5, "", "otro"]}')).toEqual({
      category: "x",
      technology: "",
      tags: ["ok", "otro"],
    });
  });

  it("texto sin ningún JSON, null", () => {
    expect(parseClassifyReply("no hay nada aquí")).toBeNull();
  });

  it("JSON roto dentro de las llaves, null", () => {
    expect(parseClassifyReply("{esto no es json}")).toBeNull();
  });
});

describe("isTextLike", () => {
  it("por mimeType", () => {
    expect(isTextLike("text/plain", "a")).toBe(true);
    expect(isTextLike("application/json", "a")).toBe(true);
    expect(isTextLike("image/png", "a")).toBe(false);
  });
  it("por extensión cuando el mimeType no ayuda (Drive a veces manda genérico)", () => {
    expect(isTextLike("application/octet-stream", "componente.tsx")).toBe(true);
    expect(isTextLike("application/octet-stream", "foto.png")).toBe(false);
  });
});

describe("classifyFile", () => {
  const config: ProviderConfig = { apiKey: "k", enabled: true, models: ["m"] };
  const settings = {} as AppSettings;

  it("devuelve el resultado cuando el modelo responde JSON válido", async () => {
    const stream = vi.fn().mockResolvedValue('{"category": "backend", "technology": "Python", "tags": ["api"]}');
    const result = await classifyFile(
      { providerId: "custom", modelId: "m", config, settings, signal: new AbortController().signal, stream },
      { name: "server.py", mimeType: "text/x-python", sizeBytes: 100, existingCategories: [] }
    );
    expect(result).toEqual({ category: "backend", technology: "Python", tags: ["api"] });
    expect(stream).toHaveBeenCalledTimes(1);
  });

  it("si streamChat lanza (sin red, modelo caído), devuelve null en vez de propagar", async () => {
    const stream = vi.fn().mockRejectedValue(new Error("sin red"));
    const result = await classifyFile(
      { providerId: "custom", modelId: "m", config, settings, signal: new AbortController().signal, stream },
      { name: "x.txt", mimeType: "text/plain", sizeBytes: 10, existingCategories: [] }
    );
    expect(result).toBeNull();
  });

  it("si el modelo responde texto sin JSON, null (no inventa una categoría)", async () => {
    const stream = vi.fn().mockResolvedValue("No puedo ayudar con eso.");
    const result = await classifyFile(
      { providerId: "custom", modelId: "m", config, settings, signal: new AbortController().signal, stream },
      { name: "x.txt", mimeType: "text/plain", sizeBytes: 10, existingCategories: [] }
    );
    expect(result).toBeNull();
  });

  it("pide reutilizar las categorías existentes en el prompt", async () => {
    const stream = vi.fn().mockResolvedValue('{"category": "visual", "tags": []}');
    await classifyFile(
      { providerId: "custom", modelId: "m", config, settings, signal: new AbortController().signal, stream },
      { name: "x.png", mimeType: "image/png", sizeBytes: 10, existingCategories: ["visual", "componentes"] }
    );
    const opts = stream.mock.calls[0][0];
    expect(opts.messages[0].content).toContain("visual, componentes");
  });
});
