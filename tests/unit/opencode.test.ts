import { describe, expect, it } from "vitest";
import { isModelFree, normalizeOpenCodeModels, openCodeBaseUrl } from "../../src/lib/forja/opencode";

describe("integración OpenCode: filtro de modelos gratuitos", () => {
  it("solo marca como gratis un modelo con coste de entrada y salida cero", () => {
    expect(isModelFree({ cost: { input: 0, output: 0 } }, "provider-x")).toBe(true);
    expect(isModelFree({ cost: { input: 0, output: 0.1 } }, "provider-x")).toBe(false);
    expect(isModelFree({}, "provider-x")).toBe(false);
  });

  it("normaliza proveedores sin mostrar como gratuitos los modelos de pago", () => {
    const models = normalizeOpenCodeModels({ all: [{ id: "demo", models: {
      gratis: { name: "Modelo gratis", cost: { input: 0, output: 0 } },
      pago: { name: "Modelo de pago", cost: { input: 1, output: 2 } },
      precioDesconocido: { name: "Sin precio" },
    } }] });
    expect(models).toHaveLength(3);
    expect(models.filter((model) => model.free).map((model) => model.id)).toEqual(["gratis"]);
  });

  it("rechaza URLs de conexión inválidas", () => {
    const previous = process.env.OPENCODE_BASE_URL;
    process.env.OPENCODE_BASE_URL = "javascript:alert(1)";
    expect(openCodeBaseUrl()).toBeNull();
    if (previous === undefined) delete process.env.OPENCODE_BASE_URL;
    else process.env.OPENCODE_BASE_URL = previous;
  });
});
