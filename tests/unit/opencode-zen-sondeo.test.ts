/** Sondeo de OpenCode Zen con `fetch` simulado: comprueba qué cabecera viaja y
 * que el veredicto sale de lo que Zen CONTESTA modelo a modelo, no de lo que
 * dice el catálogo. */
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

const RETIRADO = '{"error":{"type":"server_error","message":"Upstream request failed: Model is unavailable."}}';
const LIMITE = '{"error":{"type":"FreeUsageLimitError","message":"Rate limit exceeded."}}';

/** `porModelo`: respuesta de chat por id; los que no están contestan 200. */
function simular(
  ids: string[],
  porModelo: Record<string, { status: number; body: string }> = {},
  oficiales: string[] | null = null
) {
  const auth: (string | undefined)[] = [];
  const cuerpos: { model?: string; max_tokens?: number }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const h = (init?.headers ?? {}) as Record<string, string>;
      const esModelsDev = String(url).includes("models.dev");
      // models.dev es público: ahí NO debe viajar ninguna clave, y no cuenta como llamada a Zen
      if (esModelsDev) expect(h.Authorization).toBeUndefined();
      else auth.push(h.Authorization);
      if (esModelsDev) {
        if (oficiales === null) return new Response("nope", { status: 500 });
        const models = Object.fromEntries(oficiales.map((id) => [id, { id, cost: { input: 0, output: 0 } }]));
        return new Response(JSON.stringify({ opencode: { id: "opencode", models } }), { status: 200 });
      }
      if (String(url).endsWith("/models")) {
        return new Response(JSON.stringify({ data: ids.map((id) => ({ id })) }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      const b = JSON.parse(String(init?.body));
      cuerpos.push(b);
      const r = porModelo[b.model] ?? { status: 200, body: "{}" };
      return new Response(r.body, { status: r.status });
    })
  );
  return { auth, cuerpos };
}

afterEach(() => vi.unstubAllGlobals());

describe("probarZenSinClave", () => {
  it("sin clave manda «public» y deja SOLO los modelos que responden", async () => {
    const { auth, cuerpos } = simular(
      ["gpt-5", "deepseek-v4-flash-free", "mimo-v2.5-free", "nemotron-3-ultra-free"],
      { "deepseek-v4-flash-free": { status: 400, body: RETIRADO }, "mimo-v2.5-free": { status: 429, body: LIMITE } }
    );
    const r = await probarZenSinClave("opencode", cfg());
    expect(r.estado).toBe("abierto");
    // el limitado es gratis y válido: se queda; el retirado, no
    expect(r.gratis).toEqual(["mimo-v2.5-free", "nemotron-3-ultra-free"]);
    expect(r.mensaje).toMatch(/2 modelos gratis: 1 responden, 1 con límite/);
    expect(r.mensaje).toMatch(/deepseek-v4-flash-free \(retirado\)/);
    expect(auth.every((a) => a === "Bearer public")).toBe(true);
    expect(cuerpos.every((b) => b.max_tokens === 16)).toBe(true);
  });

  it("si TODOS están retirados lo dice con el motivo de cada uno", async () => {
    simular(["a-free", "b-free"], { "a-free": { status: 400, body: RETIRADO }, "b-free": { status: 400, body: RETIRADO } });
    const r = await probarZenSinClave("opencode", cfg());
    expect(r.estado).toBe("sin-modelos-gratis");
    expect(r.mensaje).toMatch(/a-free \(retirado\)/);
    expect(r.mensaje).toMatch(/b-free \(retirado\)/);
  });

  it("solo con límite de uso: siguen en la lista (son gratis, solo van con tope)", async () => {
    simular(["a-free", "b-free"], { "a-free": { status: 429, body: LIMITE }, "b-free": { status: 429, body: LIMITE } });
    const r = await probarZenSinClave("opencode", cfg());
    expect(r.estado).toBe("abierto");
    expect(r.gratis).toEqual(["a-free", "b-free"]);
    expect(r.mensaje).toMatch(/2 con límite de uso temporal/);
  });

  it("caso real: los 8 gratis del catálogo oficial salen aunque Zen /models traiga solo algunos", async () => {
    const OCHO = [
      "beam-free", "big-pickle", "deepseek-v4.1-flash-free", "flint-40b-free",
      "glm-5.3-flash-free", "mimo-v2.6-flash-free", "nemotron-3.5-lightning-free", "nemotron-3.5-super-vl-free",
    ];
    simular(["gpt-5", "deepseek-v4.1-flash-free"], {}, OCHO);
    const r = await probarZenSinClave("opencode", cfg());
    expect(r.estado).toBe("abierto");
    expect(r.gratis).toEqual(OCHO);
    expect(r.mensaje).toMatch(/8 modelos gratis: 8 responden/);
  });

  it("si models.dev falla, sigue con el catálogo vivo de Zen", async () => {
    simular(["a-free"], {}, null);
    const r = await probarZenSinClave("opencode", cfg());
    expect(r.estado).toBe("abierto");
    expect(r.gratis).toEqual(["a-free"]);
  });

  it("modelos que piden clave: se dicen y se sugiere la clave gratis", async () => {
    simular(["a-free", "b-free"], { "b-free": { status: 401, body: "ModelError" } });
    const r = await probarZenSinClave("opencode", cfg());
    expect(r.estado).toBe("abierto");
    expect(r.gratis).toEqual(["a-free"]);
    expect(r.mensaje).toMatch(/b-free \(requiere-clave\)/);
    expect(r.mensaje).toMatch(/opencode\.ai\/auth/);
  });

  it("403 FreeTierError → exige clave y NO se da por abierto", async () => {
    simular(["a-free"], { "a-free": { status: 403, body: '{"error":{"type":"FreeTierError"}}' } });
    const r = await probarZenSinClave("opencode", cfg());
    expect(r.estado).toBe("requiere-clave");
    expect(r.mensaje).toMatch(/opencode\.ai\/auth/);
  });

  it("con clave propia manda esa clave, no la anónima", async () => {
    const { auth } = simular(["a-free"]);
    await probarZenSinClave("opencode", cfg("sk-mia"));
    expect(auth.every((a) => a === "Bearer sk-mia")).toBe(true);
  });

  it("llama como mucho a 12 y deja el resto en la lista sin comprobar", async () => {
    const ids = Array.from({ length: 15 }, (_, i) => `m${String(i).padStart(2, "0")}-free`);
    const { cuerpos } = simular(ids);
    const r = await probarZenSinClave("opencode", cfg());
    expect(cuerpos.length).toBe(12);
    expect(r.gratis.length).toBe(15);
    expect(r.mensaje).toMatch(/\+3 sin comprobar/);
  });

  it("un 500 de todos no se atribuye a la clave", async () => {
    simular(["a-free"], { "a-free": { status: 500, body: "Internal server error" } });
    const r = await probarZenSinClave("opencode", cfg());
    expect(r.estado).toBe("servicio");
  });
});
