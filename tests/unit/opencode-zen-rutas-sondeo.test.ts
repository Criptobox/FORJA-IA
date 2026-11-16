/** El sondeo de Zen prueba cada modelo por SU ruta, prueba las otras si el
 * fallo huele a «ruta equivocada» y recuerda la que responde. */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

vi.mock("../../src/lib/forja/store", () => ({
  useForja: { getState: () => ({ settings: { accessCode: "" } }) },
}));
vi.mock("../../src/lib/forja/attachment-blob", () => ({
  resolveAttachmentDataUrl: async () => null,
}));

import { probarZenSinClave, probeModel } from "../../src/lib/forja/chat-client";
import { probeTools, _clearToolsCacheForTests } from "../../src/lib/forja/tools-probe";
import { rutaZen } from "../../src/lib/forja/zen-rutas";
import { topeZenHasta, esTopeGratisZen } from "../../src/lib/forja/opencode-zen";
import type { ProviderConfig } from "../../src/lib/forja/types";

const cfg = (): ProviderConfig => ({ apiKey: "", enabled: false, models: [], useProxy: false }) as ProviderConfig;

type Resp = { status: number; body?: string };
/** `rutas[modelo][ruta]`: qué contesta cada ruta; lo no listado, 404. */
function simular(ids: string[], rutas: Record<string, Partial<Record<string, Resp>>>) {
  const vistas: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("models.dev")) return new Response("nope", { status: 500 });
      if (u.endsWith("/models")) return Response.json({ data: ids.map((id) => ({ id })) });
      const ruta = u.split("/zen/v1")[1];
      const b = JSON.parse(String(init?.body));
      vistas.push(`${b.model} ${ruta}`);
      const r = rutas[b.model]?.[ruta] ?? { status: 404, body: "Not Found" };
      return new Response(r.body ?? "{}", { status: r.status });
    })
  );
  return vistas;
}

beforeEach(() => {
  const mem = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) });
  _clearToolsCacheForTests();
});
afterEach(() => vi.unstubAllGlobals());

describe("probarZenSinClave con rutas", () => {
  it("gpt-5-nano responde en /responses al primer intento y se recuerda", async () => {
    const vistas = simular(["gpt-5-nano-free"], { "gpt-5-nano-free": { "/responses": { status: 200 } } });
    const r = await probarZenSinClave("opencode", cfg());
    expect(vistas).toEqual(["gpt-5-nano-free /responses"]);
    expect(r.estado).toBe("abierto");
    expect(r.gratis).toEqual(["gpt-5-nano-free"]);
    expect(rutaZen("gpt-5-nano-free")).toBe("responses");
  });

  it("si /chat/completions da 404 prueba las demás y recuerda la que responde", async () => {
    const vistas = simular(["qwen3-coder-free"], { "qwen3-coder-free": { "/messages": { status: 200 } } });
    const r = await probarZenSinClave("opencode", cfg());
    expect(vistas).toEqual(["qwen3-coder-free /chat/completions", "qwen3-coder-free /responses", "qwen3-coder-free /messages"]);
    expect(r.gratis).toEqual(["qwen3-coder-free"]);
    expect(rutaZen("qwen3-coder-free")).toBe("messages");
    // y las pruebas y el chat ya lo llaman por ahí
    const p = await probeModel("opencode", cfg(), "qwen3-coder-free");
    expect(p.verdict).toBe("ok");
    expect(vistas.at(-1)).toBe("qwen3-coder-free /messages");
  });

  it("un modelo retirado NO reintenta en las otras rutas", async () => {
    const vistas = simular(["viejo-free"], {
      "viejo-free": { "/chat/completions": { status: 400, body: '{"error":{"message":"Upstream request failed: Model is unavailable."}}' } },
    });
    const r = await probarZenSinClave("opencode", cfg());
    expect(vistas).toEqual(["viejo-free /chat/completions"]);
    expect(r.estado).toBe("sin-modelos-gratis");
  });

  it("un 429 (tope de uso) tampoco prueba otras rutas y el modelo se queda en la lista", async () => {
    const vistas = simular(["gpt-5-nano-free"], { "gpt-5-nano-free": { "/responses": { status: 429, body: '{"error":{"type":"FreeUsageLimitError"}}' } } });
    const r = await probarZenSinClave("opencode", cfg());
    expect(vistas).toHaveLength(1);
    expect(r.estado).toBe("abierto");
    expect(r.gratis).toContain("gpt-5-nano-free");
  });
});

describe("probeModel y probeTools usan la ruta del modelo", () => {
  it("probeModel manda gpt-5-nano a /responses con 16 tokens", async () => {
    const vistas = simular([], { "gpt-5-nano": { "/responses": { status: 200 } } });
    const r = await probeModel("opencode", cfg(), "gpt-5-nano");
    expect(r.verdict).toBe("ok");
    expect(vistas).toEqual(["gpt-5-nano /responses"]);
  });

  it("probeTools pide las herramientas por /messages para minimax y acepta el 200", async () => {
    const vistas = simular([], { "minimax-m2.1-free": { "/messages": { status: 200 } } });
    const r = await probeTools("opencode", cfg(), "minimax-m2.1-free");
    expect(r.support).toBe("ok");
    expect(vistas).toEqual(["minimax-m2.1-free /messages"]);
  });

  it("probeTools con /responses manda strict:false y pide ≥16 tokens", async () => {
    let cuerpo: Record<string, unknown> = {};
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init?: RequestInit) => { cuerpo = JSON.parse(String(init?.body)); return new Response("{}", { status: 200 }); }));
    await probeTools("opencode", cfg(), "gpt-5-nano");
    expect(cuerpo.max_output_tokens).toBe(16);
    expect((cuerpo.tools as { strict: boolean }[])[0].strict).toBe(false);
  });
});

const TOPE = '{"type":"error","error":{"type":"FreeUsageLimitError","message":"Free usage limit reached. Free models work in OpenCode (https://opencode.ai); subscribe to OpenCode Go to keep going: https://opencode.ai/go"}}';

describe("tope de uso gratis de Zen", () => {
  it("reconoce el mensaje real de Zen", () => {
    expect(esTopeGratisZen(TOPE)).toBe(true);
    expect(esTopeGratisZen("Model is unavailable")).toBe(false);
  });

  it("al primer tope deja de probar (no es del modelo, es de la cuenta) y no vuelve a probar enseguida", async () => {
    const ids = ["a-free", "b-free", "c-free", "d-free", "e-free", "f-free"];
    const todos: Record<string, Partial<Record<string, Resp>>> = {};
    for (const id of ids) todos[id] = { "/chat/completions": { status: 429, body: TOPE } };
    const vistas = simular(ids, todos);
    const r = await probarZenSinClave("opencode", cfg());
    expect(vistas.length).toBeLessThanOrEqual(2); // los que ya iban en vuelo, no una ráfaga
    expect(r.mensaje).toMatch(/agotó el uso gratis/);
    expect(r.gratis).toEqual(expect.arrayContaining(ids)); // ninguno desaparece de la lista
    expect(topeZenHasta()).toBeGreaterThan(Date.now());
    // y un segundo «Probar» enseguida NO llama a Zen
    const antes = vistas.length;
    const r2 = await probarZenSinClave("opencode", cfg());
    expect(vistas.length).toBe(antes);
    expect(r2.mensaje).toMatch(/no vuelvo a probar/);
  });

  it("prueba como mucho 8 modelos", async () => {
    const ids = Array.from({ length: 20 }, (_, i) => `m${String(i).padStart(2, "0")}-free`);
    const todos: Record<string, Partial<Record<string, Resp>>> = {};
    for (const id of ids) todos[id] = { "/chat/completions": { status: 200 } };
    const vistas = simular(ids, todos);
    await probarZenSinClave("opencode", cfg());
    expect(vistas).toHaveLength(8);
  });
});
