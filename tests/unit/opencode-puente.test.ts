/** `fetch` hacia el motor por el puente nativo: sin CORS ni contraseña en JavaScript. */
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../../src/lib/forja/store", () => ({ useForja: { getState: () => ({ settings: { accessCode: "" } }) } }));
vi.mock("../../src/lib/forja/attachment-blob", () => ({ resolveAttachmentDataUrl: async (a: { dataUrl?: string }) => a.dataUrl ?? null }));

import { crearFetchNativo, esUrlLocalDelMotor } from "../../src/lib/forja/opencode-puente";
import { fetchDelMotor, leerModelosMotor, streamMotor } from "../../src/lib/forja/opencode-motor";
import type { EventoAndroid } from "../../src/lib/forja/plataforma";

/** Un lado nativo falso: recibe `ocHttp`/`ocCancelar` y contesta con avisos, como Kotlin. */
function nativoFalso(responder: (id: string, metodo: string, ruta: string, cuerpo: string | null, emitir: (e: EventoAndroid) => void) => void) {
  const oyentes = new Set<(e: EventoAndroid) => void>();
  const emitir = (e: EventoAndroid) => oyentes.forEach((f) => f(e));
  const llamadas: { id: string; metodo: string; ruta: string; cuerpo: string | null }[] = [];
  const cancelados: string[] = [];
  const puente = {
    ocHttp: (id: string, metodo: string, ruta: string, cuerpo: string | null) => {
      llamadas.push({ id, metodo, ruta, cuerpo });
      setTimeout(() => responder(id, metodo, ruta, cuerpo, emitir), 0);
    },
    ocCancelar: (id: string) => cancelados.push(id),
  };
  const escuchar = (fn: (e: EventoAndroid) => void) => {
    oyentes.add(fn);
    return () => oyentes.delete(fn);
  };
  return { puente, escuchar, emitir, llamadas, cancelados };
}

const http = (id: string, fase: string, extra: object = {}) => ({ tipo: "ocHttp", id, fase, ...extra }) as EventoAndroid;

describe("esUrlLocalDelMotor", () => {
  it("solo 127.0.0.1 y localhost", () => {
    expect(esUrlLocalDelMotor("http://127.0.0.1:4096/x")).toBe(true);
    expect(esUrlLocalDelMotor("http://localhost:4096")).toBe(true);
    expect(esUrlLocalDelMotor("http://192.168.1.5:4096")).toBe(false);
    expect(esUrlLocalDelMotor("https://opencode.ai")).toBe(false);
    expect(esUrlLocalDelMotor("basura")).toBe(false);
  });
});

describe("crearFetchNativo", () => {
  it("una respuesta normal: estado, cuerpo y json()", async () => {
    const n = nativoFalso((id, _m, _r, _c, emitir) => {
      emitir(http(id, "cabecera", { status: 200 }));
      emitir(http(id, "datos", { texto: '{"hola":' }));
      emitir(http(id, "datos", { texto: '"mundo"}' }));
      emitir(http(id, "fin"));
    });
    const f = crearFetchNativo(n.puente, n.escuchar);
    const res = await f("http://127.0.0.1:4096/config/providers?x=1");
    expect(res.ok).toBe(true);
    expect(await res.json()).toEqual({ hola: "mundo" });
    expect(n.llamadas[0]).toMatchObject({ metodo: "GET", ruta: "/config/providers?x=1", cuerpo: null });
  });

  it("manda método y cuerpo, y un 204 no tiene cuerpo", async () => {
    const n = nativoFalso((id, _m, _r, _c, emitir) => {
      emitir(http(id, "cabecera", { status: 204 }));
      emitir(http(id, "fin"));
    });
    const res = await crearFetchNativo(n.puente, n.escuchar)("http://127.0.0.1:4096/session/s/prompt_async", { method: "post", body: '{"a":1}' });
    expect(res.status).toBe(204);
    expect(n.llamadas[0]).toMatchObject({ metodo: "POST", cuerpo: '{"a":1}' });
  });

  it("un 401 llega como respuesta con su texto (no como excepción)", async () => {
    const n = nativoFalso((id, _m, _r, _c, emitir) => {
      emitir(http(id, "cabecera", { status: 401 }));
      emitir(http(id, "datos", { texto: "no" }));
      emitir(http(id, "fin"));
    });
    const res = await crearFetchNativo(n.puente, n.escuchar)("http://127.0.0.1:4096/session");
    expect(res.status).toBe(401);
    expect(await res.text()).toBe("no");
  });

  it("un error antes de la cabecera rechaza como un fallo de red", async () => {
    const n = nativoFalso((id, _m, _r, _c, emitir) => emitir(http(id, "error", { mensaje: "Connection refused" })));
    await expect(crearFetchNativo(n.puente, n.escuchar)("http://127.0.0.1:4096/x")).rejects.toThrow("Connection refused");
  });

  it("un error a mitad de flujo rompe la lectura", async () => {
    const n = nativoFalso((id, _m, _r, _c, emitir) => {
      emitir(http(id, "cabecera", { status: 200 }));
      emitir(http(id, "datos", { texto: "a" }));
      emitir(http(id, "error", { mensaje: "se cayó" }));
    });
    const res = await crearFetchNativo(n.puente, n.escuchar)("http://127.0.0.1:4096/event");
    await expect(res.text()).rejects.toThrow("se cayó");
  });

  it("deja pasar el texto con acentos y emojis troceado en el medio", async () => {
    const n = nativoFalso((id, _m, _r, _c, emitir) => {
      emitir(http(id, "cabecera", { status: 200 }));
      emitir(http(id, "datos", { texto: "¡Hola, cómo " }));
      emitir(http(id, "datos", { texto: "estás? 🙂" }));
      emitir(http(id, "fin"));
    });
    expect(await (await crearFetchNativo(n.puente, n.escuchar)("http://127.0.0.1:4096/x")).text()).toBe("¡Hola, cómo estás? 🙂");
  });

  it("abortar corta la petición nativa y rompe el flujo", async () => {
    const n = nativoFalso((id, _m, _r, _c, emitir) => {
      emitir(http(id, "cabecera", { status: 200 }));
      emitir(http(id, "datos", { texto: "algo" }));
    });
    const control = new AbortController();
    const res = await crearFetchNativo(n.puente, n.escuchar)("http://127.0.0.1:4096/event", { signal: control.signal });
    const lector = res.body!.getReader();
    expect((await lector.read()).done).toBe(false);
    control.abort();
    await expect(lector.read()).rejects.toMatchObject({ name: "AbortError" });
    expect(n.cancelados).toHaveLength(1);
  });

  it("si ya venía abortada ni llama al lado nativo", async () => {
    const n = nativoFalso(() => {});
    const control = new AbortController();
    control.abort();
    await expect(crearFetchNativo(n.puente, n.escuchar)("http://127.0.0.1:4096/x", { signal: control.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(n.llamadas).toHaveLength(0);
  });

  it("cancelar la lectura avisa al lado nativo", async () => {
    const n = nativoFalso((id, _m, _r, _c, emitir) => emitir(http(id, "cabecera", { status: 200 })));
    const res = await crearFetchNativo(n.puente, n.escuchar)("http://127.0.0.1:4096/event");
    await res.body!.cancel();
    expect(n.cancelados).toHaveLength(1);
  });

  it("dos peticiones a la vez no se mezclan", async () => {
    const n = nativoFalso((id, _m, ruta, _c, emitir) => {
      emitir(http(id, "cabecera", { status: 200 }));
      emitir(http(id, "datos", { texto: ruta }));
      emitir(http(id, "fin"));
    });
    const f = crearFetchNativo(n.puente, n.escuchar);
    const [a, b] = await Promise.all([f("http://127.0.0.1:4096/a"), f("http://127.0.0.1:4096/b")]);
    expect(await a.text()).toBe("/a");
    expect(await b.text()).toBe("/b");
  });
});

describe("el cliente del motor dentro de la APK (por el puente)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Un OpenCode falso detrás del puente: catálogo, sesiones y flujo de eventos. */
  function opencodeFalso() {
    let flujo: ((e: EventoAndroid) => void) | null = null;
    let idEventos = "";
    const n = nativoFalso((id, metodo, ruta, _cuerpo, emitir) => {
      if (ruta === "/config/providers") {
        emitir(http(id, "cabecera", { status: 200 }));
        emitir(http(id, "datos", { texto: JSON.stringify({ providers: [{ id: "opencode", models: { "big-pickle": { id: "big-pickle", cost: { input: 0, output: 0, cache_read: 0, cache_write: 0 } } } }] }) }));
        emitir(http(id, "fin"));
      } else if (ruta === "/session" && metodo === "POST") {
        emitir(http(id, "cabecera", { status: 200 }));
        emitir(http(id, "datos", { texto: '{"id":"ses_1"}' }));
        emitir(http(id, "fin"));
      } else if (ruta === "/event") {
        idEventos = id;
        flujo = emitir;
        emitir(http(id, "cabecera", { status: 200 }));
      } else if (ruta.endsWith("/prompt_async")) {
        emitir(http(id, "cabecera", { status: 204 }));
        emitir(http(id, "fin"));
        const ev = (e: unknown) => emitir(http(idEventos, "datos", { texto: `data: ${JSON.stringify(e)}\n\n` }));
        setTimeout(() => {
          ev({ type: "session.status", properties: { sessionID: "ses_1", status: { type: "busy" } } });
          ev({ type: "message.updated", properties: { info: { id: "a1", role: "assistant", sessionID: "ses_1" } } });
          ev({ type: "message.part.updated", properties: { part: { id: "p1", messageID: "a1", sessionID: "ses_1", type: "text", text: "Hola desde el motor nativo" } } });
          ev({ type: "session.idle", properties: { sessionID: "ses_1" } });
        }, 0);
      } else {
        emitir(http(id, "cabecera", { status: 204 }));
        emitir(http(id, "fin"));
      }
    });
    void flujo;
    return n;
  }

  function enApk(n: ReturnType<typeof nativoFalso>) {
    // fetchDelMotor lee el puente de `window.ForjaAndroid` y los avisos de `window`
    const oyentes: ((ev: Event) => void)[] = [];
    n.escuchar((e) => oyentes.forEach((f) => f(new CustomEvent("forja-android", { detail: e }))));
    vi.stubGlobal("window", {
      ForjaAndroid: n.puente,
      addEventListener: (_t: string, f: (ev: Event) => void) => oyentes.push(f),
      removeEventListener: () => {},
    });
  }

  it("fetchDelMotor usa el puente si es el motor local y el navegador si es otra URL", () => {
    const n = opencodeFalso();
    enApk(n);
    const f = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", f);
    // otra máquina: va por el fetch normal
    void fetchDelMotor("http://192.168.1.5:4096")("http://192.168.1.5:4096/x");
    expect(f).toHaveBeenCalledTimes(1);
    expect(n.llamadas).toHaveLength(0);
  });

  it("carga los modelos gratis y responde un mensaje sin tocar el fetch del navegador", async () => {
    const n = opencodeFalso();
    enApk(n);
    const f = vi.fn(async () => {
      throw new Error("el navegador no debe llamar al motor");
    });
    vi.stubGlobal("fetch", f);

    expect(await leerModelosMotor({ apiKey: "", baseUrl: "http://127.0.0.1:4096" })).toEqual(["opencode/big-pickle"]);

    const deltas: string[] = [];
    const texto = await streamMotor({
      config: { apiKey: "", baseUrl: "http://127.0.0.1:4096" },
      modelId: "opencode/big-pickle",
      messages: [{ role: "user", content: "hola" }],
      signal: new AbortController().signal,
      onDelta: (t) => deltas.push(t),
    });
    expect(texto).toBe("Hola desde el motor nativo");
    expect(deltas.at(-1)).toBe("Hola desde el motor nativo");
    expect(f).not.toHaveBeenCalled();
    // pidió la sesión, el flujo, el prompt y borró la sesión, todo por el puente
    const rutas = n.llamadas.map((l) => `${l.metodo} ${l.ruta}`);
    expect(rutas).toEqual(expect.arrayContaining(["POST /session", "GET /event", "POST /session/ses_1/prompt_async", "DELETE /session/ses_1"]));
  });
});
