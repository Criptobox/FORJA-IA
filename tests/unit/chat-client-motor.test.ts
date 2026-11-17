/** El motor del móvil dentro del chat: `streamChat`, `fetchModels`, `probeModel` y la prueba de herramientas. */
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../../src/lib/forja/store", () => ({ useForja: { getState: () => ({ settings: { accessCode: "" } }) } }));
vi.mock("../../src/lib/forja/attachment-blob", () => ({ resolveAttachmentDataUrl: async (a: { dataUrl?: string }) => a.dataUrl ?? null }));

import { streamChat, fetchModels, probeModel } from "../../src/lib/forja/chat-client";
import { probeTools } from "../../src/lib/forja/tools-probe";
import { isFreeModel } from "../../src/lib/forja/free-models";
import { PROVIDER_MAP } from "../../src/lib/forja/providers";
import type { ProviderConfig } from "../../src/lib/forja/types";
import { DEFAULT_SETTINGS } from "../../src/lib/forja/types";

const cfg = (): ProviderConfig => ({ apiKey: "pw", enabled: true, models: [], useProxy: false }) as ProviderConfig;
afterEach(() => vi.unstubAllGlobals());

const CAT = { providers: [{ id: "opencode", models: { "big-pickle": { id: "big-pickle", cost: { input: 0, output: 0, cache_read: 0, cache_write: 0 } } } }] };

function motor() {
  const enc = new TextEncoder();
  let flujo: ReadableStreamDefaultController<Uint8Array> | null = null;
  const evs = [
    { type: "session.status", properties: { sessionID: "s", status: { type: "busy" } } },
    { type: "message.updated", properties: { info: { id: "a", role: "assistant", sessionID: "s" } } },
    { type: "message.part.updated", properties: { part: { id: "p", messageID: "a", sessionID: "s", type: "text", text: "Hola desde el motor" } } },
    { type: "session.idle", properties: { sessionID: "s" } },
  ];
  const rutas: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const u = new URL(String(url));
    rutas.push(`${init?.method ?? "GET"} ${u.pathname}`);
    if (u.pathname === "/config/providers") return Response.json(CAT);
    if (u.pathname === "/global/health") return Response.json({ healthy: true });
    if (u.pathname === "/session" && init?.method === "POST") return Response.json({ id: "s" });
    if (u.pathname === "/event") return new Response(new ReadableStream<Uint8Array>({ start(c) { flujo = c; } }), { status: 200 });
    if (u.pathname.endsWith("/prompt_async")) { setTimeout(() => evs.forEach((e) => flujo?.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`))), 0); return new Response(null, { status: 204 }); }
    return new Response(null, { status: 204 });
  }));
  return rutas;
}

describe("opencode-motor en el chat", () => {
  it("está registrado como proveedor gratis y sin clave de API", () => {
    const def = PROVIDER_MAP["opencode-motor"];
    expect(def.keyless).toBe(true);
    expect(def.directByDefault).toBe(true);
    expect(isFreeModel("opencode-motor", "opencode/big-pickle")).toBe(true);
  });

  it("streamChat responde por el motor y avisa del final", async () => {
    const rutas = motor();
    let texto = "";
    let fin = "";
    const devuelto = await streamChat({
      providerId: "opencode-motor",
      config: cfg(),
      modelId: "opencode/big-pickle",
      messages: [{ role: "user", content: "hola" }],
      settings: { ...DEFAULT_SETTINGS, stream: true, systemPrompt: "Eres Forja." },
      signal: new AbortController().signal,
      onDelta: (t) => { texto = t; },
      onFinish: (m) => { fin = m; },
      onDone: () => {},
    });
    expect(devuelto).toBe("Hola desde el motor");
    expect(texto).toBe("Hola desde el motor");
    expect(fin).toBe("fin");
    expect(rutas).toContain("POST /session");
    expect(rutas.some((r) => r.endsWith("/prompt_async"))).toBe(true);
  });

  it("fetchModels trae los gratis del catálogo del motor", async () => {
    motor();
    expect(await fetchModels("opencode-motor", cfg())).toEqual(["opencode/big-pickle"]);
  });

  it("probeModel mira el catálogo: ok si el modelo sigue, no-existe si ya no", async () => {
    motor();
    expect((await probeModel("opencode-motor", cfg(), "opencode/big-pickle")).verdict).toBe("ok");
    expect((await probeModel("opencode-motor", cfg(), "opencode/retirado")).verdict).toBe("no-existe");
  });

  it("probeModel sin conexión da sin-red", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    expect((await probeModel("opencode-motor", cfg(), "opencode/x")).verdict).toBe("sin-red");
  });

  it("las herramientas van por el camino XML: la prueba dice «no» sin tocar la red", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const r = await probeTools("opencode-motor", cfg(), "opencode/big-pickle");
    expect(r.support).toBe("no");
    expect(f).not.toHaveBeenCalled();
  });
});
