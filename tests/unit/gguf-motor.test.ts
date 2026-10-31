/** Motor del modelo local: qué pasa cuando llama.cpp se detuvo por dentro.
 *
 * El caso de la captura: en un móvil, con WebGPU, el modelo cargaba y al
 * generar wllama devolvía «(ABORT)»; el worker quedaba muerto y Chrome se
 * colgaba. Aquí wllama está simulado: se comprueba que el motor tira el worker
 * muerto, pasa a la CPU (y lo recuerda), reintenta y responde; que en un móvil
 * ya arranca en la CPU; y que si aborta en la CPU lo explica sin «(ABORT)».
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const sim = vi.hoisted(() => ({
  instancias: [] as { gpuPedida: boolean; salidas: number }[],
  /** Qué hace cada instancia al generar, por orden de creación. */
  guion: [] as ("aborta" | "ok")[],
  avisos: [] as string[],
}));

vi.mock("sonner", () => ({
  toast: Object.assign(() => {}, {
    warning: (t: string) => sim.avisos.push(t),
    info: (t: string) => sim.avisos.push(t),
  }),
}));

vi.mock("@wllama/wllama/esm/index.js", () => ({
  Wllama: class {
    yo: { gpuPedida: boolean; salidas: number };
    accion: "aborta" | "ok";
    constructor() {
      this.accion = sim.guion[sim.instancias.length] ?? "ok";
      this.yo = { gpuPedida: false, salidas: 0 };
      sim.instancias.push(this.yo);
    }
    isSupportWebGPU() {
      return true;
    }
    async loadModel(_b: Blob[], p: { n_gpu_layers?: number }) {
      this.yo.gpuPedida = p.n_gpu_layers !== 0;
    }
    getLoadedContextInfo() {
      return { n_ctx: 8192, n_ctx_train: 32768 };
    }
    getChatTemplate() {
      return null;
    }
    async exit() {}
    async createChatCompletion(o: { onData: (c: unknown) => void }) {
      if (this.accion === "aborta") throw new Error("(ABORT) ");
      this.yo.salidas++;
      o.onData({ choices: [{ index: 0, delta: { content: "hola" }, finish_reason: "stop" }] });
    }
  },
}));

const { generarLocal, guardarModelos, useGgufAjustes, useGgufEstado, descargarModelo } = await import(
  "../../src/lib/forja/gguf-local"
);

async function preparar() {
  await descargarModelo();
  sim.instancias.length = 0;
  sim.avisos.length = 0;
  useGgufAjustes.setState({ gpu: "auto", contexto: 8192 });
  await guardarModelos([new File([new Uint8Array(16)], "qwen.gguf")]);
}

const cuerpo = { messages: [{ role: "user", content: "hola" }] };

describe("cuando llama.cpp se detiene por dentro", () => {
  beforeEach(async () => {
    await preparar();
  });

  it("con WebGPU: descarta el worker, pasa a la CPU, lo recuerda y responde", async () => {
    sim.guion = ["aborta", "ok"];
    const trozos: unknown[] = [];
    await generarLocal("qwen.gguf", cuerpo, new AbortController().signal, (c) => trozos.push(c));

    expect(sim.instancias).toHaveLength(2);
    expect(sim.instancias[0].gpuPedida, "la primera cargó en la GPU").toBe(true);
    expect(sim.instancias[1].gpuPedida, "la segunda, en la CPU").toBe(false);
    expect(trozos).toHaveLength(1);
    expect(useGgufAjustes.getState().gpu, "queda recordado para este dispositivo").toBe("no");
    expect(useGgufEstado.getState().aceleracion).toBe("cpu");
    expect(sim.avisos).toContain("El modelo local pasa a la CPU");
  });

  it("si aborta en la CPU, lo explica sin «(ABORT)» y el próximo mensaje encuentra un motor nuevo", async () => {
    useGgufAjustes.setState({ gpu: "no" });
    sim.guion = ["aborta", "ok"];
    const err = await generarLocal("qwen.gguf", cuerpo, new AbortController().signal, () => {}).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/memoria/);
    expect((err as Error).message).not.toContain("(ABORT)");
    expect(useGgufEstado.getState().cargado, "el worker muerto no se queda").toBeNull();

    await generarLocal("qwen.gguf", cuerpo, new AbortController().signal, () => {});
    expect(sim.instancias).toHaveLength(2);
    expect(sim.instancias[1].salidas).toBe(1);
  });

  it("en un móvil arranca en la CPU aunque haya WebGPU", async () => {
    const ua = vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (Linux; Android 14) Mobile");
    sim.guion = ["ok"];
    await generarLocal("qwen.gguf", cuerpo, new AbortController().signal, () => {});
    expect(sim.instancias[0].gpuPedida).toBe(false);
    ua.mockRestore();
  });
});
