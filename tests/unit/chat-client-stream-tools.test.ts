/** Test unitario de `streamChat` con tool_calls FRAGMENTADOS en el stream.
 *
 * Groq y OpenRouter trocean un tool_call en varios deltas SSE: el primero
 * trae id + nombre con `arguments: ""`, y los siguientes traen trozos del
 * JSON sin repetir el id — solo el `index` del wire los agrupa. Si el
 * cliente no acumula por `index`, la llamada llega rota.
 *
 * El stream de este test replica BYTE A BYTE lo que emite el modelo
 * `mock-tools-fragmentado` de /api/mock-llm. */
import { describe, it, expect, vi, afterEach } from "vitest";

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

const cfg = (extra: Partial<ProviderConfig> = {}): ProviderConfig =>
  ({ apiKey: "sk-x", enabled: true, models: [], ...extra }) as ProviderConfig;

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Mismo wire que `mock-tools-fragmentado`: 1 delta que abre la llamada y
 *  2 deltas con fragmentos del JSON de argumentos, todos con index 0. */
function sseFragmentado(): ReadableStream<Uint8Array> {
  const args = JSON.stringify({
    path: "index.html",
    content: '<!DOCTYPE html><html lang="es"><body><h1>Fragmentado</h1></body></html>',
  });
  const tercio = Math.ceil(args.length / 3);
  const fragmentos = [0, 1, 2].map((i) => args.slice(i * tercio, (i + 1) * tercio));

  const encoder = new TextEncoder();
  const eventos: unknown[] = [
    {
      id: "mock-frag-1",
      choices: [
        {
          delta: {
            tool_calls: [
              { index: 0, id: "call_frag_1", type: "function", function: { name: "write_file", arguments: "" } },
            ],
          },
          index: 0,
        },
      ],
    },
    ...fragmentos.map((frag) => ({
      id: "mock-frag-1",
      choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: frag } }] }, index: 0 }],
    })),
  ];

  return new ReadableStream({
    start(controller) {
      for (const ev of eventos) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

describe("streamChat con tool_calls fragmentados en el stream", () => {
  it("acumula los fragmentos por index y entrega UNA llamada completa", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(sseFragmentado(), {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          })
      )
    );

    const capturadas: { id: string; name: string; args: Record<string, unknown> }[][] = [];
    await streamChat({
      providerId: "openai",
      config: cfg(),
      modelId: "mock-tools-fragmentado",
      messages: [{ role: "user", content: "escribe la página" }],
      settings: { ...DEFAULT_SETTINGS, stream: true },
      signal: new AbortController().signal,
      tools: TOOL_CATALOG,
      onDelta: () => {},
      onDone: () => {},
      onToolCalls: (calls) => {
        capturadas.push(calls.map((c) => ({ id: c.id, name: c.name, args: c.args })));
      },
    });

    expect(capturadas, "onToolCalls se disparó una vez").toHaveLength(1);
    expect(capturadas[0], "UNA sola llamada, no tres trozos").toHaveLength(1);
    expect(capturadas[0][0].id).toBe("call_frag_1");
    expect(capturadas[0][0].name).toBe("write_file");
    expect(capturadas[0][0].args.path).toBe("index.html");
    expect(String(capturadas[0][0].args.content)).toContain("<h1>Fragmentado</h1>");
  });
});

describe("streamChat con varias tool_calls sin index (respuesta completa, no streaming)", () => {
  it("dos llamadas cuyos ids tienen los mismos dígitos llegan las dos, en orden", async () => {
    // Sin `index` la ranura sale de los dígitos del id: «call_x_5» y
    // «call_y_5» caían en la misma y la segunda pisaba a la primera.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          choices: [
            {
              index: 0,
              message: {
                content: "",
                tool_calls: [
                  { id: "call_mide_snapshot_diff_5", type: "function", function: { name: "snapshot_diff", arguments: '{"a":"s1"}' } },
                  { id: "call_mide_ask_memory_5", type: "function", function: { name: "ask_memory", arguments: '{"q":"hero"}' } },
                ],
              },
            },
          ],
        })
      )
    );
    const capturadas: { id: string; name: string }[][] = [];
    await streamChat({
      providerId: "openai",
      config: cfg(),
      modelId: "x",
      messages: [{ role: "user", content: "mide" }],
      settings: { ...DEFAULT_SETTINGS, stream: false },
      signal: new AbortController().signal,
      tools: TOOL_CATALOG,
      onDelta: () => {},
      onDone: () => {},
      onToolCalls: (calls) => capturadas.push(calls.map((c) => ({ id: c.id, name: c.name }))),
    });
    expect(capturadas).toHaveLength(1);
    expect(capturadas[0].map((c) => c.name)).toEqual(["snapshot_diff", "ask_memory"]);
  });
});
