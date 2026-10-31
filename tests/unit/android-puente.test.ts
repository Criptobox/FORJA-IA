/** APK de Android: el puente entre el lado nativo y la interfaz.
 *
 * El script que monta `window.ForjaAndroid` vive dentro de MainActivity.kt (se
 * inyecta en el arranque de la página). Aquí se saca de ese archivo tal cual y
 * se ejecuta con un canal falso: así se comprueba que habla el mismo idioma que
 * `plataforma.ts` sin necesitar un móvil. Y lo que hace la interfaz cuando el
 * motor está listo, y que el «no cabe» de llama-server se reconozca.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

const persistido = vi.hoisted(() => ({ provider: null as unknown, defecto: null as unknown }));
vi.mock("../../src/lib/forja/store", () => ({
  useForja: {
    getState: () => ({
      setProviderConfig: (id: string, cfg: unknown) => (persistido.provider = { id, cfg }),
      setSettings: (s: { defaultModelKey: string }) => (persistido.defecto = s.defaultModelKey),
    }),
  },
}));

import { aplicarMotorListo } from "../../src/lib/forja/nativo";
import { leerJson, type EventoAndroid, type PuenteAndroid } from "../../src/lib/forja/plataforma";
import { esDemasiadoGrande, limiteDelMensaje } from "../../src/lib/forja/decisiones";

const KOTLIN = readFileSync(
  join(process.cwd(), "android/forja-app/app/src/main/java/app/forja/ia/MainActivity.kt"),
  "utf8"
);
const PUENTE_JS = KOTLIN.match(/PUENTE_JS = """([\s\S]*?)"""/)![1];

/** Ejecuta el script del puente con un canal y un `window` falsos. */
function montar() {
  const enviados: { op: string; args: unknown[] }[] = [];
  const eventos: EventoAndroid[] = [];
  const canal = {
    onmessage: null as null | ((e: { data: string }) => void),
    postMessage: (s: string) => enviados.push(JSON.parse(s)),
  };
  const ventana: Record<string, unknown> = {
    ForjaNativo: canal,
    dispatchEvent: (e: { detail: EventoAndroid }) => eventos.push(e.detail),
  };
  class CustomEvent {
    detail: unknown;
    constructor(_t: string, init: { detail: unknown }) {
      this.detail = init.detail;
    }
  }
  runInNewContext(PUENTE_JS, { window: ventana, CustomEvent, JSON, Promise });
  const nativo = (d: unknown) => canal.onmessage!({ data: JSON.stringify(d) });
  return { puente: ventana.ForjaAndroid as PuenteAndroid, enviados, eventos, nativo };
}

describe("puente de la APK (script de MainActivity.kt)", () => {
  it("saluda al lado nativo al arrancar", () => {
    const { enviados } = montar();
    expect(enviados).toEqual([{ op: "hola", args: [] }]);
  });

  it("la primera foto resuelve `listo` y las lecturas la devuelven", async () => {
    const { puente, nativo, eventos } = montar();
    const motor = { estado: "parado", modelo: null, contexto: 0, url: "", clave: "" };
    nativo({
      tipo: "_estado",
      info: { version: "4.72.0-a5", versionCode: 1005, ramTotalMB: 11800, ramDisponibleMB: 6000, nucleos: 8 },
      modelos: [{ nombre: "qwen2.5-coder-1.5b-instruct-q4_k_m.gguf", bytes: 1_100_000_000 }],
      motor,
    });
    await puente.listo;
    expect(leerJson(puente.info(), null as null | { nucleos: number })?.nucleos).toBe(8);
    expect(leerJson(puente.modelos(), [] as { nombre: string }[])[0].nombre).toMatch(/qwen/);
    expect(leerJson(puente.estadoMotor(), null)).toEqual(motor);
    expect(eventos).toContainEqual({ tipo: "estado" });
  });

  it("las órdenes viajan con sus argumentos", () => {
    const { puente, enviados } = montar();
    puente.iniciar("qwen.gguf", 16384, 4);
    puente.borrarModelo("viejo.gguf");
    puente.detener();
    puente.buscarActualizacion();
    expect(enviados.slice(1)).toEqual([
      { op: "iniciar", args: ["qwen.gguf", 16384, 4] },
      { op: "borrarModelo", args: ["viejo.gguf"] },
      { op: "detener", args: [] },
      { op: "buscarActualizacion", args: [] },
    ]);
  });

  it("los avisos del motor llegan como evento y actualizan su estado", () => {
    const { puente, nativo, eventos } = montar();
    const listo = { estado: "listo", modelo: "qwen.gguf", contexto: 16384, url: "http://127.0.0.1:41234/v1", clave: "k" };
    nativo({ tipo: "motor", estado: listo });
    expect(eventos.at(-1)).toEqual({ tipo: "motor", estado: listo });
    expect(leerJson(puente.estadoMotor(), null)).toEqual(listo);
  });

  it("los mensajes rotos o sin tipo se ignoran", () => {
    const { eventos, nativo } = montar();
    expect(() => nativo("no es un objeto")).not.toThrow();
    nativo({ sin: "tipo" });
    nativo(null);
    expect(eventos).toEqual([]);
  });
});

describe("cuando el motor nativo está listo", () => {
  it("el proveedor «nativo» apunta a él con su clave y queda por defecto", () => {
    aplicarMotorListo({
      estado: "listo",
      modelo: "qwen.gguf",
      contexto: 16384,
      url: "http://127.0.0.1:41234/v1",
      clave: "clave-de-sesion",
    });
    expect(persistido.provider).toEqual({
      id: "nativo",
      cfg: {
        enabled: true,
        models: ["qwen.gguf"],
        apiKey: "clave-de-sesion",
        baseUrl: "http://127.0.0.1:41234/v1",
        useProxy: false,
      },
    });
    expect(persistido.defecto).toBe("nativo::qwen.gguf");
  });
});

describe("«no cabe» de llama-server", () => {
  const msg =
    "Modelo nativo (Android) 400: request (10022 tokens) exceeds the available context size (8192 tokens), try increasing it";
  it("se reconoce como conversación demasiado grande, con sus números", () => {
    expect(esDemasiadoGrande(400, msg)).toBe(true);
    expect(limiteDelMensaje(msg)).toEqual({ limite: 8192, pedido: 10022 });
  });
});
