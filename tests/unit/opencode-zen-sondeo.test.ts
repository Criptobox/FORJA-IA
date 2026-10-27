/** Sondeo de OpenCode Zen sin clave, con `fetch` simulado: comprueba qué
 * cabecera viaja y que el veredicto sale de lo que Zen CONTESTA, no de lo que
 * se supone. */
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../../src/lib/forja/store", () => ({
  useForja: { getState: () => ({ settings: { accessCode: "" } }) },
}));
vi.mock("../../src/lib/forja/attachment-blob", () => ({
  resolveAttachmentDataUrl: async () => null,
}));

import { probarZenSinClave } from "../../src/lib/forja/chat-client";
import type { ProviderConfig } from "../../src/lib/forja/types";

const cfg = (apiKey = ""): ProviderConfig =>
  ({ apiKey, enabled: false, models: [], useProxy: false }) as ProviderConfig;

const CATALOGO = { data: [{ id: "gpt-5" }, { id: "mimo-v2.5-free" }, { id: "deepseek-v4-flash-free" }] };

function simular(chat: { status: number; body: string }) {
  const llamadas: { url: string; auth: string | undefined }[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const h = (init?.headers ?? {}) as Record<string, string>;
    llamadas.push({ url: String(url), auth: h.Authorization });
    if (String(url).endsWith("/models")) {
      return new Response(JSON.stringify(CATALOGO), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(chat.body, { status: chat.status });
  });
  vi.stubGlobal("fetch", fn);
  return llamadas;
}

afterEach(() => vi.unstubAllGlobals());

describe("probarZenSinClave", () => {
  it("sin clave manda «public» y, si Zen contesta 200, queda abierto con solo los -free", async () => {
    const llamadas = simular({ status: 200, body: "{}" });
    const r = await probarZenSinClave("opencode", cfg());
    expect(r.estado).toBe("abierto");
    expect(r.gratis).toEqual(["deepseek-v4-flash-free", "mimo-v2.5-free"]);
    expect(llamadas.every((l) => l.auth === "Bearer public")).toBe(true);
    expect(llamadas.some((l) => l.url.endsWith("/chat/completions"))).toBe(true);
  });

  it("si Zen contesta 403 FreeTierError, lo dice y NO lo da por abierto", async () => {
    simular({ status: 403, body: '{"error":{"type":"FreeTierError"}}' });
    const r = await probarZenSinClave("opencode", cfg());
    expect(r.estado).toBe("requiere-clave");
    expect(r.mensaje).toMatch(/opencode\.ai\/auth/);
    expect(r.gratis.length).toBe(2); // el catálogo se conserva para mostrarlo
  });

  it("con clave propia manda esa clave, no la anónima", async () => {
    const llamadas = simular({ status: 200, body: "{}" });
    await probarZenSinClave("opencode", cfg("sk-mia"));
    expect(llamadas.every((l) => l.auth === "Bearer sk-mia")).toBe(true);
  });

  it("si el primer modelo da 400, prueba el siguiente antes de decidir", async () => {
    const vistos: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith("/models")) {
        return new Response(JSON.stringify(CATALOGO), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      const modelo = JSON.parse(String(init?.body)).model as string;
      vistos.push(modelo);
      return modelo === "deepseek-v4-flash-free"
        ? new Response('{"error":{"message":"bad endpoint"}}', { status: 400 })
        : new Response("{}", { status: 200 });
    }));
    const r = await probarZenSinClave("opencode", cfg());
    expect(vistos).toEqual(["deepseek-v4-flash-free", "mimo-v2.5-free"]);
    expect(r.estado).toBe("abierto");
  });

  it("si todos dan 400, cuenta el motivo y manda max_tokens 16", async () => {
    const cuerpos: { max_tokens?: number }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith("/models")) {
        return new Response(JSON.stringify(CATALOGO), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      cuerpos.push(JSON.parse(String(init?.body)));
      return new Response('{"error":{"message":"nope"}}', { status: 400 });
    }));
    const r = await probarZenSinClave("opencode", cfg());
    expect(r.estado).toBe("otro");
    expect(r.mensaje).toMatch(/nope/);
    expect(cuerpos.every((b) => b.max_tokens === 16)).toBe(true);
  });

  it("un 500 del chat no se atribuye a la clave", async () => {
    simular({ status: 500, body: "Internal server error" });
    const r = await probarZenSinClave("opencode", cfg());
    expect(r.estado).toBe("servicio");
  });
});
