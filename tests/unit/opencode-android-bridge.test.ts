import { describe, expect, it, vi } from "vitest";
import { runAndroidOpenCodeTask, validateAndroidTask, type ForjaOpenCodeNative } from "@/lib/forja/opencode-android-bridge";

const goodModel = { id: "model-free", name: "Model Free", providerID: "zen", free: true };
function fakeBridge(overrides: Partial<ForjaOpenCodeNative> = {}): ForjaOpenCodeNative {
  return {
    getStatus: vi.fn().mockResolvedValue({ available: true, running: true, message: "OK" }),
    listModels: vi.fn().mockResolvedValue([goodModel]),
    runTask: vi.fn().mockResolvedValue({ ok: true, sessionID: "ses_123", text: "Hecho" }),
    ...overrides,
  };
}

describe("puente Android OpenCode", () => {
  it("valida prompt, modelo y sesión", () => {
    expect(validateAndroidTask({ prompt: " ", model: "zen/model-free" })).toMatch(/Escribe/);
    expect(validateAndroidTask({ prompt: "hola", model: "" })).toMatch(/gratuito/);
    expect(validateAndroidTask({ prompt: "hola", model: "zen/model-free", sessionID: "bad/id" })).toMatch(/sesión/);
    expect(validateAndroidTask({ prompt: "hola", model: "zen/model-free" })).toBeNull();
  });
  it("rechaza un modelo no verificado antes de ejecutar", async () => {
    const bridge = fakeBridge({ listModels: vi.fn().mockResolvedValue([{ ...goodModel, free: false }]) });
    const result = await runAndroidOpenCodeTask({ prompt: "Haz una web", model: "zen/model-free" }, bridge);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no se ha enviado/i);
    expect(bridge.runTask).not.toHaveBeenCalled();
  });
  it("no intenta ejecutar cuando el motor está detenido", async () => {
    const bridge = fakeBridge({ getStatus: vi.fn().mockResolvedValue({ available: true, running: false, message: "Inicia el motor" }) });
    const result = await runAndroidOpenCodeTask({ prompt: "Haz una web", model: "zen/model-free" }, bridge);
    expect(result).toMatchObject({ ok: false, error: "Inicia el motor" });
    expect(bridge.runTask).not.toHaveBeenCalled();
  });
  it("ejecuta únicamente tras verificar catálogo y estado", async () => {
    const bridge = fakeBridge();
    const result = await runAndroidOpenCodeTask({ prompt: "Haz una web", model: "zen/model-free" }, bridge);
    expect(result).toMatchObject({ ok: true, model: "zen/model-free", text: "Hecho" });
    expect(bridge.runTask).toHaveBeenCalledWith({ prompt: "Haz una web", model: "zen/model-free" });
  });
  it("convierte excepciones del puente en un error visible", async () => {
    const bridge = fakeBridge({ getStatus: vi.fn().mockRejectedValue(new Error("Sin respuesta")) });
    await expect(runAndroidOpenCodeTask({ prompt: "Haz una web", model: "zen/model-free" }, bridge)).resolves.toMatchObject({ ok: false, error: "Sin respuesta" });
  });
});
