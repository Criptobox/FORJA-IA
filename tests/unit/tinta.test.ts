import { describe, expect, it, vi } from "vitest";
import { crearClienteTinta, ErrorTinta, TINTA_API, type CanalTinta, type RecetaTinta } from "@/lib/forja/tinta/cliente";
import { crearConTinta, type PasoTinta, type PedirModelo } from "@/lib/forja/tinta/crear";
import { conAppTinta, NOMBRE_PANTALLA_TINTA } from "@/lib/forja/tinta/proyecto";
import { crearProyecto, versionActual } from "@/lib/forja/estudio/proyecto";

/** Motor falso: responde como Tinta a cada acción. */
function canalFalso(responder: (accion: string, datos: unknown) => { ok: boolean; datos?: unknown; error?: string } | null) {
  let oyente: ((m: unknown) => void) | null = null;
  const enviados: { accion: string; datos: unknown }[] = [];
  const canal: CanalTinta = {
    enviar: (m) => {
      enviados.push({ accion: m.accion, datos: m.datos });
      const r = responder(m.accion, m.datos);
      if (r) setTimeout(() => oyente?.({ tipo: "tinta:respuesta", id: m.id, ...r }), 0);
    },
    escuchar: (f) => {
      oyente = f;
      return () => (oyente = null);
    },
  };
  return { canal, enviados, avisar: (m: unknown) => oyente?.(m) };
}

const RECETA: RecetaTinta = { brief: "Cafetería", blocks: [{ id: "h-search" }, { id: "c-coffee", repeat: 2 }, { id: "a-coral" }, { id: "n-soft" }], palette: "mandarina" };

describe("cliente del motor Tinta", () => {
  it("espera al aviso de arranque con la API correcta", async () => {
    const f = canalFalso(() => null);
    const c = crearClienteTinta(f.canal);
    const listo = c.listo(500);
    f.avisar({ tipo: "tinta:listo", api: 999 }); // otra versión del contrato: se ignora
    f.avisar({ tipo: "tinta:listo", api: TINTA_API });
    await expect(listo).resolves.toBeUndefined();
    await expect(c.listo()).resolves.toBeUndefined();
  });

  it("si no arranca, falla con un mensaje claro", async () => {
    const c = crearClienteTinta(canalFalso(() => null).canal);
    await expect(c.listo(20)).rejects.toThrow(/no arrancó/);
  });

  it("relaciona cada respuesta con su petición e ignora la basura", async () => {
    const f = canalFalso((accion) => (accion === "ping" ? { ok: true, datos: { api: 1, version: "x", bloques: 311, plantillas: 48 } } : null));
    const c = crearClienteTinta(f.canal);
    f.avisar(null);
    f.avisar({ tipo: "tinta:respuesta", id: 99, ok: true, datos: {} });
    f.avisar("texto");
    await expect(c.pedir("ping", {})).resolves.toMatchObject({ bloques: 311 });
  });

  it("los errores del motor llegan como ErrorTinta; «Cancelado» se marca", async () => {
    const f = canalFalso((accion) => (accion === "dibujar" ? { ok: false, error: "La receta no es válida" } : { ok: false, error: "Cancelado" }));
    const c = crearClienteTinta(f.canal);
    await expect(c.pedir("dibujar", { receta: RECETA })).rejects.toMatchObject({ name: "ErrorTinta", cancelado: false, message: /no es válida/ });
    await expect(c.pedir("equipo", { receta: RECETA })).rejects.toMatchObject({ cancelado: true });
  });

  it("tiempo de espera y cancelación", async () => {
    const c = crearClienteTinta(canalFalso(() => null).canal);
    await expect(c.pedir("ping", {}, { ms: 20 })).rejects.toThrow(/no respondió/);
    const ctrl = new AbortController();
    const p = c.pedir("ping", {}, { signal: ctrl.signal });
    ctrl.abort();
    await expect(p).rejects.toMatchObject({ cancelado: true });
    const ya = new AbortController();
    ya.abort();
    await expect(c.pedir("ping", {}, { signal: ya.signal })).rejects.toBeInstanceOf(ErrorTinta);
  });

  it("cerrar rechaza lo pendiente y deja de escuchar", async () => {
    const f = canalFalso(() => null);
    const c = crearClienteTinta(f.canal);
    const p = c.pedir("ping", {});
    c.cerrar();
    await expect(p).rejects.toMatchObject({ cancelado: true });
  });
});

/** Tinta falsa para el flujo completo. */
function motorFalso(lecturas: { ok: boolean; receta?: RecetaTinta | null }[]) {
  let i = 0;
  return canalFalso((accion, datos) => {
    if (accion === "instrucciones") return { ok: true, datos: { sistema: "SISTEMA " + (datos as { idea: string }).idea, prompt: "P" } };
    if (accion === "leer") {
      const l = lecturas[Math.min(i++, lecturas.length - 1)];
      return { ok: true, datos: { ok: l.ok, errores: l.ok ? [] : ["Falta la lista «bloques»."], avisos: [], receta: l.receta ?? null, correccion: "Responde otra vez SOLO con el JSON corregido" } };
    }
    if (accion === "equipo") return { ok: true, datos: { html: "<!doctype html><title>app</title>", pantallas: [{ id: "inicio", nombre: "Inicio" }, { id: "perfil", nombre: "Perfil" }], borrador: { selected: ["h-search"] }, modo: "critico", plantilla: {} } };
    return null;
  });
}

describe("crear con Tinta", () => {
  it("una llamada al modelo, el equipo a la vista y la app dibujada", async () => {
    const f = motorFalso([{ ok: true, receta: RECETA }]);
    const cliente = crearClienteTinta(f.canal);
    setTimeout(() => f.avisar({ tipo: "tinta:listo", api: 1 }), 0);
    const pedirModelo = vi.fn<PedirModelo>(async () => ({ texto: "```json{}```", modelKey: "groq::gpt-oss-120b" }));
    const mostrar = vi.fn();
    const pasos: PasoTinta[] = [];
    const r = await crearConTinta({ brief: " Una cafetería ", modeloKey: null, signal: new AbortController().signal, cliente, pedirModelo, mostrarEquipo: mostrar, onPaso: (p) => pasos.push(p) });
    expect(pedirModelo).toHaveBeenCalledTimes(1);
    expect(pedirModelo.mock.calls[0][0]).toMatchObject({ sistema: "SISTEMA Una cafetería", usuario: "Una cafetería", maxTokens: 2048 });
    expect(r).toMatchObject({ modo: "critico", modelKey: "groq::gpt-oss-120b", llamadas: 1, receta: RECETA });
    expect(r.pantallas).toHaveLength(2);
    expect(mostrar.mock.calls).toEqual([[true], [false]]);
    expect(pasos).toEqual(["arrancando", "instrucciones", "modelo", "leyendo", "equipo", "listo"]);
    expect(f.enviados.find((e) => e.accion === "equipo")?.datos).toMatchObject({ receta: RECETA, idea: "Una cafetería" });
  });

  it("si la primera respuesta no sirve, la devuelve con la corrección (2 llamadas)", async () => {
    const f = motorFalso([{ ok: false }, { ok: true, receta: RECETA }]);
    const cliente = crearClienteTinta(f.canal);
    f.avisar({ tipo: "tinta:listo", api: 1 });
    const pedirModelo = vi.fn().mockResolvedValueOnce({ texto: "no sé", modelKey: "a::b" }).mockResolvedValueOnce({ texto: "ok", modelKey: "a::b" });
    const r = await crearConTinta({ brief: "x", modeloKey: "a::b", signal: new AbortController().signal, cliente, pedirModelo });
    expect(r.llamadas).toBe(2);
    expect(pedirModelo.mock.calls[1][0].usuario).toMatch(/Tu respuesta anterior fue:\nno sé[\s\S]*SOLO con el JSON/);
  });

  it("si tampoco sirve la segunda, lo dice y no abre al equipo", async () => {
    const f = motorFalso([{ ok: false }, { ok: false }]);
    const cliente = crearClienteTinta(f.canal);
    f.avisar({ tipo: "tinta:listo", api: 1 });
    const mostrar = vi.fn();
    await expect(
      crearConTinta({ brief: "x", modeloKey: null, signal: new AbortController().signal, cliente, pedirModelo: async () => ({ texto: "?", modelKey: "a::b" }), mostrarEquipo: mostrar })
    ).rejects.toThrow(/no dio una propuesta válida.*otro modelo/);
    expect(mostrar).not.toHaveBeenCalled();
    expect(f.enviados.some((e) => e.accion === "equipo")).toBe(false);
  });

  it("sin encargo no llama a nadie", async () => {
    const pedirModelo = vi.fn();
    await expect(crearConTinta({ brief: "  ", modeloKey: null, signal: new AbortController().signal, cliente: crearClienteTinta(canalFalso(() => null).canal), pedirModelo })).rejects.toThrow(/Describe/);
    expect(pedirModelo).not.toHaveBeenCalled();
  });
});

describe("el resultado entra al Estudio", () => {
  it("una pantalla «App completa» con el HTML, el borrador y el modelo que la hizo", () => {
    const p = crearProyecto({ brief: "Una cafetería", tipo: "app" }, 1000);
    const r = { html: "<!doctype html>", pantallas: [{ id: "inicio", nombre: "Inicio" }, { id: "perfil", nombre: "Perfil" }], borrador: { selected: ["h-search"] }, receta: RECETA, modo: "equipo" as const, modelKey: "groq::m", llamadas: 1, avisos: [] };
    const q = conAppTinta(p, r, "Una cafetería", 2000);
    expect(q.pantallas).toHaveLength(1);
    const s = q.pantallas[0];
    expect(s.nombre).toBe(NOMBRE_PANTALLA_TINTA);
    expect(s.proposito).toMatch(/2 pantallas: Inicio, Perfil/);
    expect(s.estado).toBe("lista");
    const v = versionActual(s)!;
    expect(v).toMatchObject({ entrada: "index.html", modelo: "groq::m", pedido: "Una cafetería" });
    expect(v.archivos.map((a) => a.path)).toEqual(["index.html", "tinta-proyecto.json"]);
    expect(JSON.parse(v.archivos[1].text)).toMatchObject({ format: "estilos-tinta-project", draft: { selected: ["h-search"] } });
  });
});
