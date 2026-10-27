/** El bucle de agente con DeepSeek/MiMo/Zen: el razonamiento del turno que pidió
 * la herramienta tiene que volver en el mensaje del asistente, o la API
 * contesta 400. Sin tools el mismo modelo responde 200 (por eso «Hola» iba bien
 * y el agente se rompía en la segunda vuelta). */
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../../src/lib/forja/store", () => ({
  useForja: { getState: () => ({ settings: { accessCode: "" } }) },
}));
vi.mock("../../src/lib/forja/attachment-blob", () => ({
  resolveAttachmentDataUrl: async (a: { dataUrl?: string }) => a.dataUrl ?? null,
}));

import { streamChat, type StreamMessage } from "../../src/lib/forja/chat-client";
import type { ProviderConfig, ProviderId } from "../../src/lib/forja/types";
import { DEFAULT_SETTINGS } from "../../src/lib/forja/types";
import { TOOL_CATALOG } from "../../src/lib/forja/tools-catalog";

const cfg = (): ProviderConfig => ({ apiKey: "sk-x", enabled: true, models: [] }) as ProviderConfig;
const CALLS = [{ id: "call_1", type: "function", function: { name: "list_files", arguments: "{}" } }];

afterEach(() => vi.unstubAllGlobals());

function simular(respuesta: unknown) {
  const cuerpos: { messages: Record<string, unknown>[] }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      cuerpos.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify(respuesta), { status: 200, headers: { "Content-Type": "application/json" } });
    })
  );
  return cuerpos;
}

const llamar = (providerId: ProviderId, modelId: string, messages: StreamMessage[], onToolCalls?: (c: unknown[], m?: { reasoning?: string }) => void) =>
  streamChat({
    providerId,
    config: cfg(),
    modelId,
    messages,
    settings: { ...DEFAULT_SETTINGS, stream: false },
    signal: new AbortController().signal,
    tools: TOOL_CATALOG,
    onDelta: () => {},
    onDone: () => {},
    onToolCalls,
  });

describe("razonamiento + herramientas", () => {
  it("al pedir una tool, entrega el reasoning_content del turno al llamador", async () => {
    simular({ choices: [{ message: { content: "", reasoning_content: "debo listar los archivos", tool_calls: CALLS } }] });
    let razon: string | undefined;
    await llamar("opencode", "nemotron-3.5-lightning-free", [{ role: "user", content: "lista" }], (_c, m) => {
      razon = m?.reasoning;
    });
    expect(razon).toBe("debo listar los archivos");
  });

  it("con streaming (lo normal en el agente): junta el razonamiento de todos los trozos", async () => {
    const sse = [
      { choices: [{ delta: { reasoning_content: "debo " } }] },
      { choices: [{ delta: { reasoning_content: "listar" } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", type: "function", function: { name: "list_files", arguments: "{}" } }] } }] },
    ]
      .map((c) => `data: ${JSON.stringify(c)}\n\n`)
      .join("") + "data: [DONE]\n\n";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(sse, { status: 200, headers: { "Content-Type": "text/event-stream" } })));
    let razon: string | undefined;
    let nCalls = 0;
    await streamChat({
      providerId: "opencode",
      config: cfg(),
      modelId: "x-free",
      messages: [{ role: "user", content: "lista" }],
      settings: { ...DEFAULT_SETTINGS, stream: true },
      signal: new AbortController().signal,
      tools: TOOL_CATALOG,
      onDelta: () => {},
      onDone: () => {},
      onToolCalls: (c, m) => {
        nCalls = c.length;
        razon = m?.reasoning;
      },
    });
    expect(nCalls).toBe(1);
    expect(razon).toBe("debo listar");
  });

  const historial: StreamMessage[] = [
    { role: "user", content: "lista" },
    { role: "assistant", content: "", tool_calls: CALLS, reasoning_content: "debo listar los archivos" },
    { role: "user", content: "x", tool_call_id: "call_1", name: "list_files" } as StreamMessage,
  ];
  const mensajeAsistente = (c: { messages: Record<string, unknown>[] }[]) =>
    c[0].messages.find((m) => m.role === "assistant" && m.tool_calls) as Record<string, unknown>;

  it.each([
    ["opencode", "mimo-v2.6-flash-free"],
    ["deepseek", "deepseek-chat"],
  ] as [ProviderId, string][])("%s: devuelve el reasoning_content en el mensaje del asistente", async (prov, modelo) => {
    const cuerpos = simular({ choices: [{ message: { content: "ok" } }] });
    await llamar(prov, modelo, historial);
    expect(mensajeAsistente(cuerpos).reasoning_content).toBe("debo listar los archivos");
  });

  it("openai: NO manda el campo (un campo desconocido puede dar 400)", async () => {
    const cuerpos = simular({ choices: [{ message: { content: "ok" } }] });
    await llamar("openai", "gpt-4o-mini", historial);
    expect(mensajeAsistente(cuerpos)).not.toHaveProperty("reasoning_content");
  });

  it("sin razonamiento en el turno, tampoco inventa el campo", async () => {
    const cuerpos = simular({ choices: [{ message: { content: "ok" } }] });
    const sin = historial.map((m) => (m.reasoning_content ? { ...m, reasoning_content: undefined } : m));
    await llamar("opencode", "x-free", sin);
    expect(mensajeAsistente(cuerpos)).not.toHaveProperty("reasoning_content");
  });
});
