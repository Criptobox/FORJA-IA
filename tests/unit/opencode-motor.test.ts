import { describe, expect, it, vi, afterEach } from "vitest";
import {
  aplicarEventoMotor,
  adoptarPendientes,
  cabecerasMotor,
  guionDeConversacion,
  herramientasApagadas,
  idDeModeloMotor,
  leerModelosMotor,
  modelosGratisDelMotor,
  nuevoEstadoMotor,
  separarModeloMotor,
  sondearMotor,
  streamMotor,
  textoDelEstado,
  urlDelMotor,
} from "@/lib/forja/opencode-motor";

describe("conexión", () => {
  it("urlDelMotor limpia barras y /v1 y cae a la de siempre si no vale", () => {
    expect(urlDelMotor("http://127.0.0.1:4096/")).toBe("http://127.0.0.1:4096");
    expect(urlDelMotor("http://127.0.0.1:4096/v1")).toBe("http://127.0.0.1:4096");
    expect(urlDelMotor("")).toBe("http://127.0.0.1:4096");
    expect(urlDelMotor("sin-esquema")).toBe("http://127.0.0.1:4096");
    expect(urlDelMotor(undefined)).toBe("http://127.0.0.1:4096");
  });
  it("cabeceras: Basic opencode:contraseña, y nada si no hay contraseña", () => {
    expect(cabecerasMotor("abc123").Authorization).toBe(`Basic ${btoa("opencode:abc123")}`);
    expect(cabecerasMotor("").Authorization).toBeUndefined();
    expect(cabecerasMotor("x", false)["Content-Type"]).toBeUndefined();
  });
  it("ids de modelo proveedor/modelo", () => {
    expect(idDeModeloMotor("opencode", "big-pickle")).toBe("opencode/big-pickle");
    expect(separarModeloMotor("opencode/grok-code/fast")).toEqual({ providerID: "opencode", modelID: "grok-code/fast" });
    expect(separarModeloMotor("sin-barra")).toBeNull();
    expect(separarModeloMotor("/x")).toBeNull();
  });
});

describe("modelosGratisDelMotor", () => {
  const cat = {
    providers: [
      {
        id: "opencode",
        models: {
          "big-pickle": { id: "big-pickle", cost: { input: 0, output: 0, cache_read: 0, cache_write: 0 } },
          "gpt-5": { id: "gpt-5", cost: { input: 1.25, output: 10 } },
          "sin-precio": { id: "sin-precio" },
          "precio-raro": { id: "precio-raro", cost: { input: 0, output: null, cache_read: 0, cache_write: 0 } },
          anidado: { id: "anidado", cost: { input: 0, output: 0, cache: { read: 0, write: 0 } } },
        },
      },
      { id: "otro", models: { m: { id: "m", cost: { input: 0, output: 0, cache_read: 0, cache_write: 0 } } } },
    ],
  };
  it("solo coste cero explícito en los cuatro precios", () => {
    expect(modelosGratisDelMotor(cat)).toEqual(["opencode/anidado", "opencode/big-pickle", "otro/m"]);
  });
  it("acepta providers como objeto y tolera basura", () => {
    expect(modelosGratisDelMotor({ providers: { a: { id: "a", models: { x: { cost: { input: 0, output: 0, cache_read: 0, cache_write: 0 } } } } } })).toEqual(["a/x"]);
    expect(modelosGratisDelMotor(null)).toEqual([]);
    expect(modelosGratisDelMotor({ providers: 5 })).toEqual([]);
  });
});

describe("guionDeConversacion", () => {
  it("un turno va tal cual y el sistema aparte", () => {
    const g = guionDeConversacion([{ role: "user", content: "hola" }], "Eres Forja.");
    expect(g.text).toBe("hola");
    expect(g.system).toBe("Eres Forja.");
    expect(g.files).toEqual([]);
  });
  it("varios turnos van como guion y piden responder al último", () => {
    const g = guionDeConversacion([
      { role: "system", content: "Regla extra" },
      { role: "user", content: "a" },
      { role: "assistant", content: "b" },
      { role: "user", content: "c" },
    ]);
    expect(g.system).toBe("Regla extra");
    expect(g.text).toContain("Usuario: a\n\nAsistente: b\n\nUsuario: c");
    expect(g.text).toMatch(/Responde SOLO al último mensaje/);
  });
  it("las imágenes del último mensaje del usuario viajan como archivos", () => {
    const g = guionDeConversacion([
      { role: "user", content: "mira", attachments: [{ dataUrl: "data:image/png;base64,AAA", name: "f.png" }, { dataUrl: "blob:x" }] },
    ]);
    expect(g.files).toEqual([{ type: "file", mime: "image/png", url: "data:image/png;base64,AAA", filename: "f.png" }]);
  });
  it("nunca manda un texto vacío", () => {
    expect(guionDeConversacion([]).text).toBe(" ");
  });
  it("las herramientas del motor van todas apagadas", () => {
    const h = herramientasApagadas();
    expect(Object.values(h).every((v) => v === false)).toBe(true);
    expect(Object.keys(h)).toEqual(expect.arrayContaining(["bash", "write", "edit", "read"]));
  });
});

const SES = "ses_1";
const msg = (id: string, role: string, extra: Record<string, unknown> = {}) => ({ type: "message.updated", properties: { info: { id, role, sessionID: SES, ...extra } } });
const parte = (id: string, messageID: string, type: string, text = "") => ({ type: "message.part.updated", properties: { part: { id, messageID, sessionID: SES, type, text } } });
const delta = (partID: string, messageID: string, d: string) => ({ type: "message.part.delta", properties: { sessionID: SES, messageID, partID, field: "text", delta: d } });
const estado = (sid: string, t: string) => ({ type: "session.status", properties: { sessionID: sid, status: { type: t } } });

describe("aplicarEventoMotor", () => {
  it("acumula el texto del asistente, ignora el del usuario y termina al quedar libre", () => {
    const e = nuevoEstadoMotor(SES);
    aplicarEventoMotor(e, msg("u1", "user"));
    aplicarEventoMotor(e, parte("pu", "u1", "text", "hola mi pregunta"));
    aplicarEventoMotor(e, estado(SES, "busy"));
    aplicarEventoMotor(e, msg("a1", "assistant"));
    aplicarEventoMotor(e, parte("pa", "a1", "text", ""));
    expect(aplicarEventoMotor(e, delta("pa", "a1", "Hola"))).toBe(true);
    aplicarEventoMotor(e, delta("pa", "a1", " mundo"));
    expect(textoDelEstado(e).texto).toBe("Hola mundo");
    expect(e.terminado).toBe(false);
    aplicarEventoMotor(e, estado(SES, "idle"));
    expect(e.terminado).toBe(true);
  });
  it("el razonamiento va aparte del texto", () => {
    const e = nuevoEstadoMotor(SES);
    aplicarEventoMotor(e, msg("a1", "assistant"));
    aplicarEventoMotor(e, parte("r", "a1", "reasoning", "pienso"));
    aplicarEventoMotor(e, parte("t", "a1", "text", "listo"));
    expect(textoDelEstado(e)).toEqual({ texto: "listo", razonamiento: "pienso" });
  });
  it("partes que llegan antes que su mensaje se guardan y se reparten al saber de quién son", () => {
    const e = nuevoEstadoMotor(SES);
    aplicarEventoMotor(e, parte("pa", "a1", "text", ""));
    aplicarEventoMotor(e, delta("pa", "a1", "Hola"));
    aplicarEventoMotor(e, parte("pu", "u1", "text", "mi pregunta"));
    expect(textoDelEstado(e).texto).toBe("");
    aplicarEventoMotor(e, msg("u1", "user"));
    aplicarEventoMotor(e, msg("a1", "assistant"));
    expect(textoDelEstado(e).texto).toBe("Hola");
  });
  it("ignora eventos de otras sesiones", () => {
    const e = nuevoEstadoMotor(SES);
    expect(aplicarEventoMotor(e, { type: "message.updated", properties: { info: { id: "x", role: "assistant", sessionID: "otra" } } })).toBe(false);
    aplicarEventoMotor(e, estado("otra", "busy"));
    aplicarEventoMotor(e, { type: "session.idle", properties: { sessionID: "otra" } });
    expect(e.ocupado).toBe(false);
    expect(e.terminado).toBe(false);
  });
  it("un idle sin haber visto nada no termina (el de antes de empezar)", () => {
    const e = nuevoEstadoMotor(SES);
    aplicarEventoMotor(e, { type: "session.idle", properties: { sessionID: SES } });
    expect(e.terminado).toBe(false);
  });
  it("el error con código HTTP del mensaje se conserva (429, 401…)", () => {
    const e = nuevoEstadoMotor(SES);
    aplicarEventoMotor(e, msg("a1", "assistant", { error: { name: "APIError", data: { message: "Free usage limit reached", statusCode: 429 } } }));
    expect(e.error).toEqual({ mensaje: "Free usage limit reached", status: 429 });
  });
  it("session.error corta con el mensaje", () => {
    const e = nuevoEstadoMotor(SES);
    aplicarEventoMotor(e, { type: "session.error", properties: { sessionID: SES, error: { data: { message: "boom" } } } });
    expect(e.terminado).toBe(true);
    expect(e.error?.mensaje).toBe("boom");
  });
  it("recoge los tokens del mensaje del asistente", () => {
    const e = nuevoEstadoMotor(SES);
    aplicarEventoMotor(e, msg("a1", "assistant", { tokens: { input: 10, output: 4, reasoning: 0, cache: { read: 2, write: 0 } } }));
    expect(e.uso).toEqual({ entrada: 10, salida: 4, cacheLeido: 2, cacheEscrito: 0 });
  });
  it("adoptarPendientes rescata el texto si el evento del mensaje se perdió", () => {
    const e = nuevoEstadoMotor(SES);
    aplicarEventoMotor(e, msg("u1", "user"));
    aplicarEventoMotor(e, parte("pa", "a1", "text", "respuesta"));
    expect(textoDelEstado(e).texto).toBe("");
    adoptarPendientes(e);
    expect(textoDelEstado(e).texto).toBe("respuesta");
  });
});

/* ------------------------------------------------------------------ */
/* un motor simulado                                                   */
/* ------------------------------------------------------------------ */

interface Visto { metodo: string; ruta: string; auth: string | null; cuerpo?: Record<string, unknown> }

function motorSimulado(opciones: { eventos?: unknown[]; promptStatus?: number; catalogo?: unknown; healthStatus?: number; caido?: boolean } = {}) {
  const vistos: Visto[] = [];
  let flujo: ReadableStreamDefaultController<Uint8Array> | null = null;
  const enc = new TextEncoder();
  const emitir = (ev: unknown) => flujo?.enqueue(enc.encode(`data: ${JSON.stringify(ev)}\n\n`));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (opciones.caido) throw new TypeError("Failed to fetch");
      const u = new URL(String(url));
      const metodo = init?.method ?? "GET";
      const auth = ((init?.headers ?? {}) as Record<string, string>).Authorization ?? null;
      let cuerpo: Record<string, unknown> | undefined;
      if (init?.body) cuerpo = JSON.parse(String(init.body));
      vistos.push({ metodo, ruta: u.pathname, auth, cuerpo });
      if (u.pathname === "/global/health") return Response.json({ healthy: true }, { status: opciones.healthStatus ?? 200 });
      if (u.pathname === "/config/providers") return Response.json(opciones.catalogo ?? { providers: [] });
      if (u.pathname === "/session" && metodo === "POST") return Response.json({ id: SES });
      if (u.pathname === "/event") {
        return new Response(new ReadableStream<Uint8Array>({ start(c) { flujo = c; c.enqueue(enc.encode(`data: ${JSON.stringify({ type: "server.connected", properties: {} })}\n\n`)); init?.signal?.addEventListener("abort", () => c.error(new DOMException("Aborted", "AbortError"))); } }), { status: 200, headers: { "Content-Type": "text/event-stream" } });
      }
      if (u.pathname.endsWith("/prompt_async")) {
        const status = opciones.promptStatus ?? 204;
        if (status === 204) setTimeout(() => (opciones.eventos ?? []).forEach(emitir), 0);
        return new Response(status === 204 ? null : "no", { status });
      }
      return new Response(null, { status: 204 });
    })
  );
  return { vistos };
}

const RESPUESTA = [
  estado(SES, "busy"),
  msg("u1", "user"),
  parte("pu", "u1", "text", "hola"),
  msg("a1", "assistant"),
  parte("pa", "a1", "reasoning", "pienso"),
  parte("pt", "a1", "text", ""),
  delta("pt", "a1", "¡Hola"),
  delta("pt", "a1", "!"),
  msg("a1", "assistant", { tokens: { input: 7, output: 3 } }),
  estado(SES, "idle"),
];

afterEach(() => vi.unstubAllGlobals());

describe("streamMotor", () => {
  it("pide la respuesta con las herramientas del motor apagadas, entrega el texto en streaming y borra la sesión", async () => {
    const { vistos } = motorSimulado({ eventos: RESPUESTA });
    const deltas: string[] = [];
    const razon: string[] = [];
    let uso: unknown = null;
    let fin = "";
    const texto = await streamMotor({
      config: { apiKey: "clave-local" },
      modelId: "opencode/big-pickle",
      messages: [{ role: "user", content: "hola" }],
      systemPrompt: "Eres Forja.",
      signal: new AbortController().signal,
      onDelta: (t) => deltas.push(t),
      onReasoning: (t) => razon.push(t),
      onUsage: (u) => { uso = u; },
      onFinish: (m) => { fin = m; },
    });
    expect(texto).toBe("¡Hola!");
    expect(deltas.at(-1)).toBe("¡Hola!");
    expect(deltas).toContain("¡Hola");
    expect(razon.at(-1)).toBe("pienso");
    expect(uso).toEqual({ entrada: 7, salida: 3, cacheLeido: null, cacheEscrito: null });
    expect(fin).toBe("fin");

    const basic = `Basic ${btoa("opencode:clave-local")}`;
    expect(vistos.every((v) => v.auth === basic)).toBe(true);
    const prompt = vistos.find((v) => v.ruta.endsWith("/prompt_async"))!;
    expect(prompt.cuerpo).toMatchObject({
      model: { providerID: "opencode", modelID: "big-pickle" },
      system: "Eres Forja.",
      parts: [{ type: "text", text: "hola" }],
    });
    expect(Object.values(prompt.cuerpo!.tools as Record<string, boolean>).every((v) => v === false)).toBe(true);
    // el flujo se abre ANTES de pedir la respuesta
    expect(vistos.findIndex((v) => v.ruta === "/event")).toBeLessThan(vistos.findIndex((v) => v.ruta.endsWith("/prompt_async")));
    expect(vistos.some((v) => v.metodo === "DELETE" && v.ruta === `/session/${SES}`)).toBe(true);
  });

  it("si el motor contesta con un error HTTP del modelo (429) lo lanza con su código", async () => {
    motorSimulado({ eventos: [estado(SES, "busy"), msg("a1", "assistant", { error: { name: "APIError", data: { message: "Free usage limit reached", statusCode: 429 } } }), estado(SES, "idle")] });
    await expect(
      streamMotor({ config: { apiKey: "" }, modelId: "opencode/big-pickle", messages: [{ role: "user", content: "x" }], signal: new AbortController().signal, onDelta: () => {} })
    ).rejects.toMatchObject({ message: "Free usage limit reached", status: 429 });
  });

  it("sin conexión explica qué hacer", async () => {
    motorSimulado({ caido: true });
    await expect(
      streamMotor({ config: { apiKey: "" }, modelId: "opencode/big-pickle", messages: [{ role: "user", content: "x" }], signal: new AbortController().signal, onDelta: () => {} })
    ).rejects.toThrow(/Abre la app OpenCode Mobile/);
  });

  it("un modelo sin proveedor/ se rechaza antes de llamar", async () => {
    const { vistos } = motorSimulado();
    await expect(
      streamMotor({ config: { apiKey: "" }, modelId: "big-pickle", messages: [{ role: "user", content: "x" }], signal: new AbortController().signal, onDelta: () => {} })
    ).rejects.toThrow(/proveedor\/modelo/);
    expect(vistos).toHaveLength(0);
  });

  it("un 401 pide copiar la contraseña de nuevo", async () => {
    motorSimulado({ promptStatus: 401 });
    await expect(
      streamMotor({ config: { apiKey: "mala" }, modelId: "opencode/big-pickle", messages: [{ role: "user", content: "x" }], signal: new AbortController().signal, onDelta: () => {} })
    ).rejects.toMatchObject({ status: 401, message: expect.stringMatching(/contraseña/) });
  });

  it("si se aborta, pide al motor que pare la sesión", async () => {
    const { vistos } = motorSimulado({ eventos: [estado(SES, "busy"), msg("a1", "assistant")] });
    const control = new AbortController();
    const p = streamMotor({ config: { apiKey: "" }, modelId: "opencode/big-pickle", messages: [{ role: "user", content: "x" }], signal: control.signal, onDelta: () => {} });
    setTimeout(() => control.abort(), 20);
    await expect(p).rejects.toBeDefined();
    expect(vistos.some((v) => v.ruta === `/session/${SES}/abort`)).toBe(true);
  });
});

describe("catálogo y sondeo", () => {
  const catalogo = { providers: [{ id: "opencode", models: { "big-pickle": { id: "big-pickle", cost: { input: 0, output: 0, cache_read: 0, cache_write: 0 } }, "gpt-5": { id: "gpt-5", cost: { input: 1, output: 2 } } } }] };
  it("leerModelosMotor devuelve solo los gratis", async () => {
    motorSimulado({ catalogo });
    expect(await leerModelosMotor({ apiKey: "k" })).toEqual(["opencode/big-pickle"]);
  });
  it("sondearMotor: ok con modelos, sin conexión y contraseña mala", async () => {
    motorSimulado({ catalogo });
    const ok = await sondearMotor({ apiKey: "k" });
    expect(ok.estado).toBe("ok");
    expect(ok.modelos).toEqual(["opencode/big-pickle"]);
    expect(ok.mensaje).toMatch(/sin clave de API/);
    vi.unstubAllGlobals();
    motorSimulado({ caido: true });
    expect((await sondearMotor({ apiKey: "k" })).estado).toBe("sin-conexion");
    vi.unstubAllGlobals();
    motorSimulado({ healthStatus: 401 });
    expect((await sondearMotor({ apiKey: "mala" })).estado).toBe("clave");
  });
  it("un motor sin modelos gratis lo dice", async () => {
    motorSimulado({ catalogo: { providers: [] } });
    const r = await sondearMotor({ apiKey: "k" });
    expect(r.estado).toBe("otro");
    expect(r.mensaje).toMatch(/ningún modelo gratis/);
  });
});
