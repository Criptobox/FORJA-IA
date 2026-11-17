/** `streamChat` con OpenCode Zen: cada modelo va por SU ruta y el agente sigue
 * recibiendo las herramientas con la forma de siempre. */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

const settingsMock = { accessCode: "" };
vi.mock("../../src/lib/forja/store", () => ({
  useForja: { getState: () => ({ settings: settingsMock }) },
}));
vi.mock("../../src/lib/forja/attachment-blob", () => ({
  resolveAttachmentDataUrl: async (a: { dataUrl?: string; blobId?: string }) => a.dataUrl ?? null,
}));

import { streamChat } from "../../src/lib/forja/chat-client";
import type { ProviderConfig } from "../../src/lib/forja/types";
import { DEFAULT_SETTINGS } from "../../src/lib/forja/types";
import { TOOL_CATALOG } from "../../src/lib/forja/tools-catalog";

const cfg = (): ProviderConfig => ({ apiKey: "", enabled: true, models: [], useProxy: false }) as ProviderConfig;

const sse = (eventos: unknown[]) =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        const e = new TextEncoder();
        for (const ev of eventos) c.enqueue(e.encode(`data: ${JSON.stringify(ev)}\n\n`));
        c.enqueue(e.encode("data: [DONE]\n\n"));
        c.close();
      },
    }),
    { status: 200, headers: { "Content-Type": "text/event-stream" } }
  );

interface Llamada { url: string; headers: Record<string, string>; body: Record<string, unknown> }
let llamadas: Llamada[] = [];
function simular(respuesta: () => Response) {
  llamadas = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    llamadas.push({ url: String(url), headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
    return respuesta();
  }));
}

beforeEach(() => {
  settingsMock.accessCode = "";
  // el almacén de rutas aprendidas es global del navegador: se parte de limpio
  const mem = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) });
});
afterEach(() => vi.unstubAllGlobals());

const base = {
  providerId: "opencode" as const,
  config: cfg(),
  settings: { ...DEFAULT_SETTINGS, stream: true, systemPrompt: "Eres Forja." },
  signal: new AbortController().signal,
  tools: TOOL_CATALOG,
  onDelta: () => {},
  onDone: () => {},
};

describe("OpenCode Zen: una ruta por modelo", () => {
  it("gpt-5-nano va por /responses, sin clave pone «public» y devuelve la herramienta pedida", async () => {
    simular(() =>
      sse([
        { type: "response.output_text.delta", delta: "Voy" },
        { type: "response.output_item.added", output_index: 0, item: { type: "function_call", id: "fc_1", call_id: "call_w", name: "write_file", arguments: "" } },
        { type: "response.function_call_arguments.delta", item_id: "fc_1", delta: '{"path":"index.html","content":"<h1>Hola</h1>"}' },
        { type: "response.completed", response: { usage: { input_tokens: 9, output_tokens: 4 } } },
      ])
    );
    const llamadasTool: { id: string; name: string; args: Record<string, unknown> }[] = [];
    let texto = "";
    let motivo = "";
    let uso: { entrada: number | null; salida: number | null } | null = null;
    await streamChat({
      ...base,
      modelId: "gpt-5-nano",
      messages: [{ role: "user", content: "crea index.html" }],
      onDelta: (t) => { texto = t; },
      onFinish: (m) => { motivo = m; },
      onUsage: (u) => { uso = u; },
      onToolCalls: (calls) => llamadasTool.push(...calls.map((c) => ({ id: c.id, name: c.name, args: c.args }))),
    });
    expect(llamadas[0].url).toBe("https://opencode.ai/zen/v1/responses");
    expect(llamadas[0].headers.Authorization).toBe("Bearer public");
    expect(llamadas[0].body.instructions).toBe("Eres Forja.");
    expect(llamadas[0].body.stream).toBe(true);
    expect(texto).toBe("Voy");
    expect(llamadasTool).toEqual([{ id: "call_w", name: "write_file", args: { path: "index.html", content: "<h1>Hola</h1>" } }]);
    expect(motivo).toBe("herramienta");
    expect(uso).toMatchObject({ entrada: 9, salida: 4 });
  });

  it("minimax va por /messages con las dos cabeceras de clave y entrega la herramienta", async () => {
    simular(() =>
      sse([
        { type: "message_start", message: { usage: { input_tokens: 5 } } },
        { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Ok" } },
        { type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "toolu_9", name: "write_file" } },
        { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: '{"path":"a.js"}' } },
        { type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 3 } },
      ])
    );
    const got: { id: string; name: string; args: Record<string, unknown> }[] = [];
    await streamChat({
      ...base,
      modelId: "minimax-m2.1-free",
      messages: [{ role: "user", content: "hola" }],
      onToolCalls: (calls) => got.push(...calls.map((c) => ({ id: c.id, name: c.name, args: c.args }))),
    });
    expect(llamadas[0].url).toBe("https://opencode.ai/zen/v1/messages");
    expect(llamadas[0].headers["x-api-key"]).toBe("public");
    expect(llamadas[0].headers.Authorization).toBe("Bearer public");
    expect(llamadas[0].body.system).toBe("Eres Forja.");
    expect(got).toEqual([{ id: "toolu_9", name: "write_file", args: { path: "a.js" } }]);
  });

  it("la segunda vuelta del agente manda la herramienta y su resultado en el formato de la ruta", async () => {
    simular(() => sse([{ type: "response.output_text.delta", delta: "Hecho" }, { type: "response.completed", response: {} }]));
    await streamChat({
      ...base,
      modelId: "gpt-5-nano",
      messages: [
        { role: "user", content: "crea" },
        { role: "assistant", content: "", tool_calls: [{ id: "call_w", type: "function", function: { name: "write_file", arguments: '{"path":"i.html"}' } }] },
        { role: "user", content: "", tool_call_id: "call_w", name: "write_file" } as never,
      ].map((m, i) => (i === 2 ? { role: "tool", tool_call_id: "call_w", content: "escrito" } : m)) as never,
    });
    const entrada = llamadas[0].body.input as Record<string, unknown>[];
    expect(entrada.map((e) => e.type ?? e.role)).toEqual(["user", "function_call", "function_call_output"]);
    expect(entrada[2]).toEqual({ type: "function_call_output", call_id: "call_w", output: "escrito" });
  });

  it("un modelo normal (big-pickle) sigue por /chat/completions sin traducir", async () => {
    simular(() => sse([{ choices: [{ delta: { content: "Hola" }, index: 0 }] }, { choices: [{ delta: {}, finish_reason: "stop", index: 0 }] }]));
    let texto = "";
    await streamChat({ ...base, modelId: "big-pickle", messages: [{ role: "user", content: "hola" }], onDelta: (t) => { texto = t; } });
    expect(llamadas[0].url).toBe("https://opencode.ai/zen/v1/chat/completions");
    expect(llamadas[0].headers["x-api-key"]).toBeUndefined();
    expect(llamadas[0].body.messages).toBeDefined();
    expect(texto).toBe("Hola");
  });

  it("sin streaming: /responses con llamada a herramienta en el cuerpo", async () => {
    simular(() => Response.json({ status: "completed", output: [{ type: "function_call", call_id: "c1", name: "write_file", arguments: '{"path":"x"}' }] }));
    const got: string[] = [];
    await streamChat({
      ...base,
      settings: { ...DEFAULT_SETTINGS, stream: false },
      modelId: "gpt-5-nano",
      messages: [{ role: "user", content: "x" }],
      onToolCalls: (calls) => got.push(...calls.map((c) => c.name)),
    });
    expect(got).toEqual(["write_file"]);
  });

  it("un error dentro del stream (HTTP 200) se lanza, no deja la burbuja muda", async () => {
    simular(() => sse([{ type: "error", message: "modelo saturado" }]));
    await expect(streamChat({ ...base, modelId: "gpt-5-nano", messages: [{ role: "user", content: "x" }] })).rejects.toThrow(/modelo saturado/);
  });

  it("una ruta aprendida manda sobre la del nombre", async () => {
    localStorage.setItem("forja-zen-rutas", JSON.stringify({ "qwen3-coder": "messages" }));
    simular(() => sse([{ type: "message_delta", delta: { stop_reason: "end_turn" } }]));
    await streamChat({ ...base, modelId: "qwen3-coder", messages: [{ role: "user", content: "x" }] });
    expect(llamadas[0].url).toBe("https://opencode.ai/zen/v1/messages");
  });
});
