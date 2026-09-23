import { describe, expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import {
  MAX_ALMACENES,
  MAX_BYTES_ALMACEN,
  PREFIJO_ALMACEN,
  borrarAlmacen,
  guardarAlmacen,
  leerAlmacen,
  sembrarAlmacen,
  validarAlmacen,
} from "../../src/lib/forja/preview-storage";
import { CONSOLE_BRIDGE, SANDBOX_ORIGIN } from "../../src/lib/forja/sandbox";

function memoria() {
  const d = new Map<string, string>();
  return {
    d,
    getItem: (k: string) => d.get(k) ?? null,
    setItem: (k: string, v: string) => void d.set(k, v),
    removeItem: (k: string) => void d.delete(k),
  };
}

describe("preview-storage", () => {
  it("valida: solo objetos planos de cadenas y dentro del tope", () => {
    expect(validarAlmacen({ a: "1" }).ok).toBe(true);
    expect(validarAlmacen([]).ok).toBe(false);
    expect(validarAlmacen("x").ok).toBe(false);
    expect(validarAlmacen({ a: 1 }).ok).toBe(false);
    expect(validarAlmacen(new Map()).ok).toBe(false);
    const grande = { k: "x".repeat(MAX_BYTES_ALMACEN) };
    const r = validarAlmacen(grande);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/KB/);
  });

  it("guarda, lee y borra por conversación sin mezclar", () => {
    const s = memoria();
    expect(guardarAlmacen("s1", { tareas: "[1,2]" }, s)).toEqual({ ok: true, vacio: false });
    guardarAlmacen("s2", { tareas: "[9]" }, s);
    expect(leerAlmacen("s1", s)).toEqual({ tareas: "[1,2]" });
    expect(leerAlmacen("s2", s)).toEqual({ tareas: "[9]" });
    borrarAlmacen("s1", s);
    expect(leerAlmacen("s1", s)).toEqual({});
    expect(leerAlmacen("s2", s)).toEqual({ tareas: "[9]" });
  });

  it("un almacén vacío no deja clave colgando", () => {
    const s = memoria();
    guardarAlmacen("s1", { a: "1" }, s);
    expect(guardarAlmacen("s1", {}, s)).toEqual({ ok: true, vacio: true });
    expect(s.d.has(PREFIJO_ALMACEN + "s1")).toBe(false);
  });

  it("sin conversación no guarda, y lo que no valida no pisa lo guardado", () => {
    const s = memoria();
    expect(guardarAlmacen(null, { a: "1" }, s).ok).toBe(false);
    guardarAlmacen("s1", { a: "1" }, s);
    expect(guardarAlmacen("s1", { a: 2 }, s).ok).toBe(false);
    expect(leerAlmacen("s1", s)).toEqual({ a: "1" });
  });

  it("pasado el máximo de conversaciones, se borran las más viejas", () => {
    const s = memoria();
    for (let i = 0; i <= MAX_ALMACENES; i++) guardarAlmacen(`s${i}`, { v: String(i) }, s, 1000 + i);
    expect(leerAlmacen("s0", s)).toEqual({});
    expect(leerAlmacen(`s${MAX_ALMACENES}`, s)).toEqual({ v: String(MAX_ALMACENES) });
  });

  it("datos corruptos en disco se leen como vacío, no revientan", () => {
    const s = memoria();
    s.setItem(PREFIJO_ALMACEN + "s1", "{no json");
    expect(leerAlmacen("s1", s)).toEqual({});
  });

  it("la semilla no puede cerrar el <script> ni saltarse el <head>", () => {
    const html = sembrarAlmacen("<html><head><title>x</title></head><body><header>h</header></body></html>", {
      k: "</script><script>alert(1)</script>",
    });
    expect(html).not.toContain("</script><script>alert(1)");
    expect(html.indexOf("__FORJA_ALMACEN__")).toBeLessThan(html.indexOf("<title>"));
    // <header> no es <head>
    expect(sembrarAlmacen("<body><header>h</header></body>", {}).startsWith("<script>")).toBe(true);
  });
});

/** Ejecuta el puente como lo haría el iframe sin origen propio: tocar
 *  localStorage lanza, y lo que se manda al padre se recoge. */
function ejecutarPuente(semilla?: Record<string, string>) {
  const enviados: unknown[] = [];
  const lanza = () => {
    throw new Error("SecurityError");
  };
  const win: Record<string, unknown> = {
    __FORJA_ALMACEN__: semilla,
    addEventListener: () => {},
    Promise,
    setTimeout,
    clearTimeout,
    parent: { postMessage: (m: unknown) => enviados.push(JSON.parse(JSON.stringify(m))) },
  };
  Object.defineProperty(win, "localStorage", { get: lanza, configurable: true });
  Object.defineProperty(win, "sessionStorage", { get: lanza, configurable: true });
  win.window = win;
  win.document = { addEventListener: () => {}, get cookie() { return ""; } };
  win.console = { log() {}, info() {}, warn() {}, error() {}, debug() {} };
  runInNewContext(CONSOLE_BRIDGE, win);
  return { win: win as { localStorage: Storage; sessionStorage: Storage }, enviados };
}

describe("puente de consola: localStorage persistente", () => {
  it("arranca con la semilla y avisa al padre de cada cambio", async () => {
      const { win, enviados } = ejecutarPuente({ tareas: "[1]" });
      expect(win.localStorage.getItem("tareas")).toBe("[1]");
      win.localStorage.setItem("tareas", "[1,2]");
      win.localStorage.setItem("tema", "oscuro");
      await Promise.resolve();
      await Promise.resolve();
      const almacenes = enviados.filter((m) => (m as { almacen?: unknown }).almacen);
      // agrupado: dos escrituras seguidas, un solo aviso
      expect(almacenes).toHaveLength(1);
      expect(almacenes[0]).toEqual({ source: SANDBOX_ORIGIN, almacen: { tareas: "[1,2]", tema: "oscuro" } });
      // sessionStorage no persiste por definición
      win.sessionStorage.setItem("x", "1");
      await Promise.resolve();
      expect(enviados.filter((m) => (m as { almacen?: unknown }).almacen)).toHaveLength(1);
      // una escritura nueva, un aviso nuevo, sin esperar a ningún temporizador
      win.localStorage.removeItem("tema");
      await Promise.resolve();
      expect(enviados.filter((m) => (m as { almacen?: unknown }).almacen)).toHaveLength(2);
  });

  it("sin semilla sigue siendo memoria pura: no manda nada", async () => {
    const { win, enviados } = ejecutarPuente();
    win.localStorage.setItem("a", "1");
    await Promise.resolve();
    await Promise.resolve();
    expect(enviados.some((m) => (m as { almacen?: unknown }).almacen)).toBe(false);
    expect(JSON.stringify(enviados)).toMatch(/no persiste/);
  });
});
