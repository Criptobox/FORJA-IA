import { describe, expect, it } from "vitest";
import { NETLIFY_API, publicarEnNetlify, recordarSitio, sitioDeConversacion } from "../../src/lib/forja/netlify";

type Llamada = { url: string; init: RequestInit };
function falsoFetch(respuestas: Array<{ status: number; body: unknown }>) {
  const llamadas: Llamada[] = [];
  const f = (async (url: string, init: RequestInit) => {
    llamadas.push({ url, init });
    const r = respuestas.shift() ?? { status: 500, body: {} };
    return new Response(typeof r.body === "string" ? r.body : JSON.stringify(r.body), { status: r.status });
  }) as unknown as typeof fetch;
  return { f, llamadas };
}
const ZIP = new Uint8Array([80, 75, 3, 4]);

describe("publicarEnNetlify", () => {
  it("sin sitio: lo crea y despliega el ZIP con el token", async () => {
    const { f, llamadas } = falsoFetch([
      { status: 201, body: { id: "s1", ssl_url: "https://abc.netlify.app", admin_url: "https://app.netlify.com/sites/abc" } },
      { status: 200, body: { ssl_url: "https://abc.netlify.app" } },
    ]);
    const r = await publicarEnNetlify({ token: " tok ", zip: ZIP, fetchImpl: f });
    expect(r).toEqual({ ok: true, siteId: "s1", url: "https://abc.netlify.app", adminUrl: "https://app.netlify.com/sites/abc", nuevo: true });
    expect(llamadas[0].url).toBe(`${NETLIFY_API}/sites`);
    expect(llamadas[1].url).toBe(`${NETLIFY_API}/sites/s1/deploys`);
    expect((llamadas[1].init.headers as Record<string, string>)["Content-Type"]).toBe("application/zip");
    expect((llamadas[1].init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("con sitio recordado: despliega directo, sin crear otro", async () => {
    const { f, llamadas } = falsoFetch([{ status: 200, body: { ssl_url: "https://abc.netlify.app" } }]);
    const r = await publicarEnNetlify({ token: "t", zip: ZIP, siteId: "s1", fetchImpl: f });
    expect(r.ok && r.nuevo).toBe(false);
    expect(llamadas).toHaveLength(1);
  });

  it("si el sitio recordado ya no existe, crea uno nuevo y lo dice", async () => {
    const { f } = falsoFetch([
      { status: 404, body: { message: "Not Found" } },
      { status: 201, body: { id: "s2", ssl_url: "https://nuevo.netlify.app" } },
      { status: 200, body: {} },
    ]);
    const r = await publicarEnNetlify({ token: "t", zip: ZIP, siteId: "s1", fetchImpl: f });
    expect(r).toMatchObject({ ok: true, siteId: "s2", url: "https://nuevo.netlify.app", nuevo: true });
  });

  it("explica los errores de Netlify en vez de un código suelto", async () => {
    const { f } = falsoFetch([{ status: 401, body: { message: "Access Denied" } }]);
    const r = await publicarEnNetlify({ token: "malo", zip: ZIP, fetchImpl: f });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/rechazó el token/);
  });

  it("sin red lo dice, no revienta", async () => {
    const f = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    const r = await publicarEnNetlify({ token: "t", zip: ZIP, fetchImpl: f });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/No se pudo conectar con Netlify/);
  });

  it("sin token o sin archivos no llama a nadie", async () => {
    const { f, llamadas } = falsoFetch([]);
    expect((await publicarEnNetlify({ token: "", zip: ZIP, fetchImpl: f })).ok).toBe(false);
    expect((await publicarEnNetlify({ token: "t", zip: new Uint8Array(), fetchImpl: f })).ok).toBe(false);
    expect(llamadas).toHaveLength(0);
  });
});

describe("sitio por conversación", () => {
  it("se recuerda por id y no se mezclan", () => {
    const d = new Map<string, string>();
    const s = { getItem: (k: string) => d.get(k) ?? null, setItem: (k: string, v: string) => void d.set(k, v), removeItem: (k: string) => void d.delete(k) };
    recordarSitio("c1", "s1", s);
    recordarSitio("c2", "s2", s);
    expect(sitioDeConversacion("c1", s)).toBe("s1");
    expect(sitioDeConversacion("c2", s)).toBe("s2");
    expect(sitioDeConversacion("c3", s)).toBeNull();
  });
});
