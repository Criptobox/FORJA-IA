/** El motor OpenCode de la APK está listo: el proveedor se configura solo, sin que la persona pegue nada. */
import { describe, it, expect, vi, beforeEach } from "vitest";

const est = vi.hoisted(() => ({
  providers: {} as Record<string, { enabled?: boolean; apiKey?: string; baseUrl?: string; models?: string[]; useProxy?: boolean }>,
  settings: { defaultModelKey: "" as string },
  limpiados: [] as string[],
}));
vi.mock("../../src/lib/forja/store", () => ({
  useForja: {
    getState: () => ({
      providers: est.providers,
      settings: est.settings,
      setProviderConfig: (id: string, cfg: object) => (est.providers[id] = { ...est.providers[id], ...cfg }),
      setSettings: (s: Partial<typeof est.settings>) => Object.assign(est.settings, s),
    }),
  },
}));
vi.mock("../../src/lib/forja/modelos-rotos", () => ({
  useModelosRotos: { getState: () => ({ limpiarProveedor: (id: string) => est.limpiados.push(id) }) },
}));
const fetchModels = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/forja/chat-client", () => ({ fetchModels }));

import { aplicarOpenCodeListo, modeloPorDefecto } from "../../src/lib/forja/opencode-nativo";
import type { EstadoOpenCode } from "../../src/lib/forja/plataforma";

const listo = (extra: Partial<EstadoOpenCode> = {}): EstadoOpenCode => ({
  estado: "listo",
  instalado: true,
  progreso: 1000,
  mensaje: null,
  url: "http://127.0.0.1:4096",
  usuario: "opencode",
  clave: "pw-local",
  version: "1.0.0",
  ...extra,
});

beforeEach(() => {
  est.providers = {};
  est.settings = { defaultModelKey: "" };
  est.limpiados = [];
  fetchModels.mockReset();
});

describe("modeloPorDefecto", () => {
  it("prefiere big-pickle si está y si no, el primero", () => {
    expect(modeloPorDefecto(["opencode/a", "opencode/big-pickle"])).toBe("opencode/big-pickle");
    expect(modeloPorDefecto(["opencode/a", "opencode/b"])).toBe("opencode/a");
    expect(modeloPorDefecto([])).toBeNull();
  });
});

describe("aplicarOpenCodeListo", () => {
  it("configura el proveedor con la URL y la contraseña del puente, carga los modelos y elige uno", async () => {
    fetchModels.mockResolvedValue(["opencode/big-pickle", "opencode/grok-code"]);
    const m = await aplicarOpenCodeListo(listo());
    expect(m).toEqual(["opencode/big-pickle", "opencode/grok-code"]);
    expect(est.providers["opencode-motor"]).toMatchObject({
      enabled: true,
      apiKey: "pw-local",
      baseUrl: "http://127.0.0.1:4096",
      useProxy: false,
      models: ["opencode/big-pickle", "opencode/grok-code"],
    });
    expect(fetchModels).toHaveBeenCalledWith("opencode-motor", expect.objectContaining({ apiKey: "pw-local", baseUrl: "http://127.0.0.1:4096" }));
    expect(est.limpiados).toEqual(["opencode-motor"]);
    expect(est.settings.defaultModelKey).toBe("opencode-motor::opencode/big-pickle");
  });

  it("no pisa el modelo que la persona ya había elegido", async () => {
    est.settings.defaultModelKey = "gemini::gemini-2.5-flash";
    fetchModels.mockResolvedValue(["opencode/big-pickle"]);
    await aplicarOpenCodeListo(listo());
    expect(est.settings.defaultModelKey).toBe("gemini::gemini-2.5-flash");
  });

  it("si el motor no ofrece modelos gratis no toca la lista ni el modelo por defecto", async () => {
    est.providers["opencode-motor"] = { models: ["viejo"] };
    fetchModels.mockResolvedValue([]);
    expect(await aplicarOpenCodeListo(listo())).toEqual([]);
    expect(est.providers["opencode-motor"].models).toEqual(["viejo"]);
    expect(est.settings.defaultModelKey).toBe("");
  });

  it("solo actúa cuando el motor está listo", async () => {
    for (const estado of ["parado", "instalando", "arrancando", "error"] as const) {
      expect(await aplicarOpenCodeListo(listo({ estado }))).toEqual([]);
    }
    expect(fetchModels).not.toHaveBeenCalled();
    expect(est.providers["opencode-motor"]).toBeUndefined();
  });

  it("dos avisos «listo» seguidos cargan una sola vez", async () => {
    let soltar: (v: string[]) => void = () => {};
    fetchModels.mockReturnValue(new Promise<string[]>((r) => (soltar = r)));
    const a = aplicarOpenCodeListo(listo());
    const b = aplicarOpenCodeListo(listo());
    soltar(["opencode/x"]);
    expect(await a).toEqual(["opencode/x"]);
    expect(await b).toEqual(["opencode/x"]);
    expect(fetchModels).toHaveBeenCalledTimes(1);
  });

  it("un fallo de red al leer los modelos se propaga y permite reintentar", async () => {
    fetchModels.mockRejectedValueOnce(new Error("sin conexión"));
    await expect(aplicarOpenCodeListo(listo())).rejects.toThrow("sin conexión");
    fetchModels.mockResolvedValueOnce(["opencode/a"]);
    expect(await aplicarOpenCodeListo(listo())).toEqual(["opencode/a"]);
  });
});
