/** Modelo local .gguf: la parte pura (gguf-mensajes) y su paso por streamChat.
 *
 * El motor de verdad (WebAssembly + OPFS) solo existe en el navegador y lo
 * prueba el e2e `modelo-local-gguf.spec.ts` con un .gguf real. Aquí se fija lo
 * que decide la app: cómo traduce la petición, qué contexto usa, qué dice
 * cuando falla, que Auto lo deja para el final y que `streamChat` trata sus
 * trozos como los de cualquier proveedor OpenAI (texto, herramientas, uso).
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/lib/forja/store", () => ({
  useForja: { getState: () => ({ settings: { accessCode: "" } }) },
}));
vi.mock("../../src/lib/forja/attachment-blob", () => ({
  resolveAttachmentDataUrl: async (a: { dataUrl?: string }) => a.dataUrl ?? null,
}));

/** Lo que recibe el motor y los trozos que devuelve, por prueba. */
const motor = vi.hoisted(() => ({
  llamadas: [] as { nombre: string; cuerpo: unknown }[],
  trozos: [] as unknown[],
}));
vi.mock("../../src/lib/forja/gguf-local", () => ({
  generarLocal: async (nombre: string, cuerpo: unknown, _signal: AbortSignal, onData: (c: unknown) => void) => {
    motor.llamadas.push({ nombre, cuerpo });
    for (const t of motor.trozos) onData(t);
  },
  refrescarModelos: async () => ["qwen2.5-1.5b-instruct-q4_k_m.gguf"],
  soportaHerramientas: async () => true,
}));

import {
  AVISO_IMAGEN,
  agruparGguf,
  contextoEfectivo,
  esArchivoGguf,
  explicarErrorGguf,
  mensajesParaWllama,
  nombreVisible,
  parametrosParaWllama,
  plantillaConHerramientas,
} from "../../src/lib/forja/gguf-mensajes";
import { streamChat, fetchModels } from "../../src/lib/forja/chat-client";
import { isFreeModel } from "../../src/lib/forja/free-models";
import { buildTaskChain } from "../../src/lib/forja/task-router";
import { DEFAULT_SETTINGS, type ProviderConfig } from "../../src/lib/forja/types";
import { TOOL_CATALOG } from "../../src/lib/forja/tools-catalog";

describe("archivos .gguf", () => {
  it("reconoce el nombre sin importar mayúsculas", () => {
    expect(esArchivoGguf("Modelo.GGUF")).toBe(true);
    expect(esArchivoGguf("modelo.bin")).toBe(false);
  });

  it("agrupa los trozos de un modelo partido en orden y cuenta los que faltan", () => {
    const g = agruparGguf([
      "llama-3b-00002-of-00003.gguf",
      "qwen.gguf",
      "llama-3b-00001-of-00003.gguf",
      "notas.txt",
    ]);
    expect(g).toEqual([
      {
        nombre: "llama-3b-00001-of-00003.gguf",
        archivos: ["llama-3b-00001-of-00003.gguf", "llama-3b-00002-of-00003.gguf"],
        faltan: 1,
      },
      { nombre: "qwen.gguf", archivos: ["qwen.gguf"], faltan: 0 },
    ]);
  });

  it("el nombre visible quita la extensión y el sufijo de trozo", () => {
    expect(nombreVisible("qwen2.5-1.5b-q4_k_m.gguf")).toBe("qwen2.5-1.5b-q4_k_m");
    expect(nombreVisible("llama-3b-00001-of-00003.gguf")).toBe("llama-3b");
  });
});

describe("contexto", () => {
  it("no pasa del contexto con el que se entrenó el modelo", () => {
    expect(contextoEfectivo(8192, 2048)).toBe(2048);
    expect(contextoEfectivo(4096, 32768)).toBe(4096);
    expect(contextoEfectivo(4096, undefined)).toBe(4096);
  });
});

describe("traducción de la petición", () => {
  it("las imágenes se cambian por un aviso y las partes de texto se juntan", () => {
    const [m] = mensajesParaWllama([
      {
        role: "user",
        content: [
          { type: "text", text: "¿Qué ves?" },
          { type: "image_url", image_url: { url: "data:image/png;base64,AAA" } },
        ],
      },
    ]);
    expect(m).toEqual({ role: "user", content: `¿Qué ves?\n\n${AVISO_IMAGEN}` });
  });

  it("conserva las llamadas a herramientas y sus resultados, sin el razonamiento", () => {
    const calls = [{ id: "c1", type: "function", function: { name: "write_file", arguments: "{}" } }];
    const out = mensajesParaWllama([
      { role: "assistant", content: "", tool_calls: calls, reasoning_content: "pienso…" },
      { role: "tool", content: "ok", tool_call_id: "c1", name: "write_file" },
    ]);
    expect(out).toEqual([
      { role: "assistant", content: "", tool_calls: calls },
      { role: "tool", content: "ok", tool_call_id: "c1" },
    ]);
  });

  it("la respuesta siempre tiene techo, y nunca más de medio contexto", () => {
    const base = { messages: [{ role: "user", content: "hola" }] };
    expect(parametrosParaWllama(base, 8192).max_tokens).toBe(2048);
    expect(parametrosParaWllama({ ...base, max_tokens: 16000 }, 8192).max_tokens).toBe(4096);
    expect(parametrosParaWllama({ ...base, max_tokens: 300 }, 8192).max_tokens).toBe(300);
    const p = parametrosParaWllama({ ...base, temperature: 0.2, tools: [{ type: "function" }] }, 4096);
    expect(p).toMatchObject({ temperature: 0.2, tools: [{ type: "function" }], stream: true, cache_prompt: true });
  });
});

describe("herramientas y errores", () => {
  it("la plantilla de chat dice si el modelo sabe usar herramientas", () => {
    expect(plantillaConHerramientas("{% if tools %}<tool_call>{% endif %}")).toBe(true);
    expect(plantillaConHerramientas("{{ '<|im_start|>' + message['role'] }}")).toBe(false);
    expect(plantillaConHerramientas(null)).toBe(false);
  });

  it("un contexto desbordado dice cuánto ocupa la petición y qué hacer", () => {
    const msg = explicarErrorGguf(
      new Error("request (2598 tokens) exceeds the available context size (512 tokens)"),
      512
    );
    expect(msg).toContain("2598 tokens");
    expect(msg).toContain("512");
    expect(msg).toMatch(/hilo nuevo/);
  });

  it("el fallo de wllama con UTF-8 no válido dice que se regenere, no «error desconocido»", () => {
    const msg = explicarErrorGguf(new Error("Invalid typed array length: 1163217991"), 8192);
    expect(msg).toMatch(/Regenerar/);
    expect(msg).not.toMatch(/contexto/);
  });

  it("sin memoria sugiere un modelo más pequeño", () => {
    expect(explicarErrorGguf(new Error("RangeError: Array buffer allocation failed"), 4096)).toMatch(/más pequeño/);
  });
});

describe("en la app", () => {
  it("es gratis: no cuenta para el techo de llamadas de pago", () => {
    expect(isFreeModel("gguf", "cualquier-modelo.gguf")).toBe(true);
  });

  it("Auto lo deja el último aunque su nombre diga «coder»", () => {
    const cadena = buildTaskChain("code", {
      gguf: { apiKey: "", enabled: true, models: ["qwen2.5-coder-7b-instruct-q4_k_m.gguf"] },
      groq: { apiKey: "gsk", enabled: true, models: ["llama-3.1-8b-instant"] },
    });
    expect(cadena.map((c) => c.providerId)).toEqual(["groq", "gguf"]);
  });

  it("si es lo único que hay, Auto lo usa", () => {
    const cadena = buildTaskChain("chat", {
      gguf: { apiKey: "", enabled: true, models: ["phi.gguf"] },
    });
    expect(cadena[0]?.modelKey).toBe("gguf::phi.gguf");
  });

  it("«Cargar modelos» lista los .gguf guardados, sin red", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const modelos = await fetchModels("gguf", { apiKey: "", enabled: true, models: [] });
    expect(modelos).toEqual(["qwen2.5-1.5b-instruct-q4_k_m.gguf"]);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("streamChat usa el motor local y procesa sus trozos como los de OpenAI", async () => {
    motor.llamadas.length = 0;
    motor.trozos = [
      { choices: [{ delta: { content: "Hola" }, index: 0, finish_reason: null }] },
      { choices: [{ delta: { content: ", mundo" }, index: 0, finish_reason: null }] },
      {
        choices: [
          {
            delta: {
              tool_calls: [{ index: 0, id: "c1", type: "function", function: { name: "write_file", arguments: '{"path":"a.txt"}' } }],
            },
            index: 0,
            finish_reason: "tool_calls",
          },
        ],
        usage: { prompt_tokens: 120, completion_tokens: 9, total_tokens: 129 },
      },
    ];
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const onToolCalls = vi.fn();
    const onUsage = vi.fn();
    const onFinish = vi.fn();
    const texto = await streamChat({
      providerId: "gguf",
      config: { apiKey: "", enabled: true, models: ["qwen.gguf"] } as ProviderConfig,
      modelId: "qwen.gguf",
      messages: [{ role: "user", content: "hola" }],
      settings: { ...DEFAULT_SETTINGS, systemPrompt: "Eres útil.", stream: false },
      signal: new AbortController().signal,
      tools: TOOL_CATALOG.slice(0, 1),
      onDelta: () => {},
      onDone: () => {},
      onToolCalls,
      onUsage,
      onFinish,
    });
    vi.unstubAllGlobals();

    expect(texto).toBe("Hola, mundo");
    expect(fetchSpy, "ni una petición de red").not.toHaveBeenCalled();
    expect(motor.llamadas).toHaveLength(1);
    const cuerpo = motor.llamadas[0].cuerpo as { messages: { role: string }[]; tools?: unknown[] };
    expect(motor.llamadas[0].nombre).toBe("qwen.gguf");
    expect(cuerpo.messages[0]).toEqual({ role: "system", content: "Eres útil." });
    expect(cuerpo.tools, "las herramientas viajan en formato OpenAI").toHaveLength(1);
    expect(onToolCalls).toHaveBeenCalledWith([{ id: "c1", name: "write_file", args: { path: "a.txt" } }], expect.anything());
    expect(onUsage).toHaveBeenCalled();
    expect(onFinish).toHaveBeenCalled();
  });
});
