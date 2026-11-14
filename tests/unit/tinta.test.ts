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

import { MODELO_LOCAL, progresoTinta, recetaParaModelo, resumenApp, textoVisible, turnoTinta, ultimaApp, usaTinta, type AppTinta } from "@/lib/forja/tinta/forja-web";
import { cambioLocal, recetaDePlantilla } from "@/lib/forja/tinta/cambios-locales";
import type { CatalogoTinta } from "@/lib/forja/tinta/cliente";

describe("FORJA WEB con Tinta: qué mensajes diseña Tinta", () => {
  const base = { hayApp: false, imagenes: 0 };
  it("una app nueva", () => {
    expect(usaTinta({ ...base, texto: "hazme una app para mi cafetería con pedidos" })).toBe(true);
    expect(usaTinta({ ...base, texto: "Crea una aplicación de rutinas para el gimnasio" })).toBe(true);
    expect(usaTinta({ ...base, texto: "crea una app para contar ovejas" })).toBe(true);
  });
  it("no las apps de gestión de datos, ni webs, ni charlas, ni si se pide código", () => {
    expect(usaTinta({ ...base, texto: "crea una app de lista de tareas" })).toBe(false);
    expect(usaTinta({ ...base, texto: "hazme una app de inventario para mi tienda" })).toBe(false);
    expect(usaTinta({ ...base, texto: "hazme una landing para mi cafetería" })).toBe(false);
    expect(usaTinta({ ...base, texto: "Hola FORJA WEB" })).toBe(false);
    expect(usaTinta({ ...base, texto: "hazme una app para mi cafetería en React" })).toBe(false);
    expect(usaTinta({ ...base, texto: "hazme una app para mi cafetería con código" })).toBe(false);
  });
  it("con una app ya hecha, todo lo que se escribe es sobre ella", () => {
    expect(usaTinta({ hayApp: true, imagenes: 0, texto: "ponla en modo oscuro" })).toBe(true);
    expect(usaTinta({ hayApp: true, imagenes: 0, texto: "¿qué paleta usaste?" })).toBe(true);
    expect(usaTinta({ hayApp: true, imagenes: 1, texto: "hazla como esta foto" })).toBe(false);
    expect(usaTinta({ hayApp: true, imagenes: 0, texto: "   " })).toBe(false);
  });
  it("sin ninguna IA conectada, todo lo que sea crear lo hace Tinta (también una landing)", () => {
    expect(usaTinta({ hayApp: false, imagenes: 0, sinIA: true, texto: "hazme una landing para mi barbería" })).toBe(true);
    expect(usaTinta({ hayApp: false, imagenes: 0, sinIA: true, texto: "Hola, ¿qué tal?" })).toBe(false);
  });
});

describe("FORJA WEB con Tinta: piezas puras", () => {
  it("la receta vuelve al formato del modelo", () => {
    const j = JSON.parse(recetaParaModelo({ ...RECETA, mode: "dark", texts: { "h-search": ["Hola"] } }));
    expect(j).toEqual({
      idea: "Cafetería",
      bloques: [{ id: "h-search" }, { id: "c-coffee", copias: 2 }, { id: "a-coral" }, { id: "n-soft" }],
      paleta: "mandarina",
      tipografia: null,
      fondo: null,
      modo: "oscuro",
      textos: { "h-search": ["Hola"] },
    });
  });
  it("de la respuesta se enseña la frase, nunca la receta", () => {
    expect(textoVisible('¡Hecho!\n```json\n{"bloques":[]}\n```')).toBe("¡Hecho!");
    expect(textoVisible('Listo {"idea":"x","bloques":[{"id":"a"}]}')).toBe("Listo");
    expect(textoVisible("Te explico {sin receta} aquí")).toBe("Te explico {sin receta} aquí");
    expect(textoVisible("Arranco\n```json\n{\"bloques\":")).toBe("Arranco");
  });
  it("la app vigente es la del último mensaje con app", () => {
    const a1 = { receta: RECETA, pantallas: [], modelo: "m", llamadas: 1, version: 1 } as AppTinta;
    const a2 = { ...a1, version: 2 };
    expect(ultimaApp([{ role: "assistant", tintaApp: a1 }, { role: "user" }, { role: "assistant", tintaApp: a2 }, { role: "assistant" }])).toBe(a2);
    expect(ultimaApp([{ role: "assistant", tintaApp: a1, error: true }])).toBeNull();
  });
  it("resumen y panel de progreso", () => {
    expect(resumenApp({ version: 1, pantallas: [{ id: "a", nombre: "A" }, { id: "b", nombre: "B" }] })).toMatch(/2 pantallas.*Pídeme cambios/);
    expect(resumenApp({ version: 3, pantallas: [{ id: "a", nombre: "A" }] })).toBe("Versión 3 · 1 pantalla.");
    const p = progresoTinta({ paso: "equipo", cambio: false });
    expect(p.pasos.map((x) => x.estado)).toEqual(["done", "done", "done", "running", "pending"]);
    expect(p.pasos[3].titulo).toMatch(/equipo de agentes/);
    const c = progresoTinta({ paso: "corrigiendo", cambio: true });
    expect(c.pasos[2]).toMatchObject({ estado: "running", meta: "ajustando" });
    expect(progresoTinta({ paso: "listo", cambio: true }).pasos.every((x) => x.estado === "done")).toBe(true);
  });
});

describe("FORJA WEB con Tinta: un turno (la IA solo si hace falta)", () => {
  const DIBUJO = { html: "<!doctype html><title>app</title>", pantallas: [{ id: "inicio", nombre: "Inicio" }], borrador: {} };
  const PLANTILLA = { brief: "Café", blocks: [{ id: "h-search" }, { id: "c-coffee", repeat: 2 }, { id: "n-soft" }], palette: "mandarina", mode: "light" };
  const motor = (texto?: { ok: boolean }) =>
    canalFalso((accion, datos) => {
      if (accion === "instrucciones") return { ok: true, datos: { sistema: "SIS:" + JSON.stringify(datos), prompt: "" } };
      if (accion === "catalogo") return { ok: true, datos: CATALOGO };
      if (accion === "leer") {
        const t = (datos as { texto: string }).texto;
        const ok = texto ? texto.ok : t.includes("bloques");
        return { ok: true, datos: { ok, errores: ok ? [] : ["sin JSON"], avisos: [], receta: ok ? RECETA : null, correccion: "Corrige" } };
      }
      if (accion === "dibujar") return { ok: true, datos: DIBUJO };
      if (accion === "equipo") return { ok: true, datos: { ...DIBUJO, modo: "equipo", plantilla: PLANTILLA } };
      return { ok: false, error: "?" };
    });
  const lista = (f: ReturnType<typeof canalFalso>) => {
    const c = crearClienteTinta(f.canal);
    setTimeout(() => f.avisar({ tipo: "tinta:listo", api: TINTA_API }), 0);
    return c;
  };
  const base = { modeloKey: null, signal: new AbortController().signal };
  const anterior: AppTinta = { receta: RECETA, pantallas: [], modelo: "x", llamadas: 0, version: 1 };

  it("la primera versión la hace el equipo sin IA (aunque haya una conectada)", async () => {
    const f = motor();
    const pedir = vi.fn<PedirModelo>();
    const equipo = vi.fn();
    const r = await turnoTinta({ ...base, pedido: "app de café", hayModelo: true, cliente: lista(f), pedirModelo: pedir, mostrarEquipo: equipo });
    expect(pedir).not.toHaveBeenCalled();
    expect(f.enviados.map((e) => e.accion)).toEqual(["equipo"]);
    expect(f.enviados[0].datos).toEqual({ idea: "app de café" });
    expect(r.app).toMatchObject({ html: DIBUJO.html, llamadas: 0, modelo: MODELO_LOCAL, receta: { blocks: PLANTILLA.blocks, palette: "mandarina" } });
    expect(r.texto).toMatch(/sin gastar IA/);
    expect(equipo.mock.calls).toEqual([[true], [false]]);
  });

  it("un cambio que se entiende se aplica en local y se redibuja, sin IA", async () => {
    const f = motor();
    const pedir = vi.fn<PedirModelo>();
    const r = await turnoTinta({ ...base, pedido: "ponla en modo oscuro", anterior, hayModelo: true, cliente: lista(f), pedirModelo: pedir });
    expect(pedir).not.toHaveBeenCalled();
    expect(f.enviados.map((e) => e.accion)).toEqual(["catalogo", "dibujar"]);
    expect(r.texto).toBe("Hecho, sin gastar IA: modo oscuro.");
    expect(r.app?.receta.mode).toBe("dark");
  });

  it("«otra versión» vuelve a llamar al equipo, sin IA", async () => {
    const f = motor();
    const r = await turnoTinta({ ...base, pedido: "hazme otra versión", anterior, hayModelo: false, cliente: lista(f), pedirModelo: vi.fn<PedirModelo>() });
    expect(f.enviados.map((e) => e.accion)).toEqual(["catalogo", "equipo"]);
    expect(r.app?.html).toBe(DIBUJO.html);
  });

  it("lo que no se entiende, sin IA conectada: dice qué se puede pedir y no toca la app", async () => {
    const f = motor();
    const r = await turnoTinta({ ...base, pedido: "hazla más divertida para niños", anterior, hayModelo: false, cliente: lista(f), pedirModelo: vi.fn<PedirModelo>() });
    expect(r.app).toBeUndefined();
    expect(r.texto).toMatch(/Sin IA conectada entiendo cambios como/);
  });

  it("lo que no se entiende, con IA: se le pasa la receta actual y se redibuja", async () => {
    const f = motor();
    const pedir = vi.fn<PedirModelo>(async () => ({ texto: 'Hecho.\n```json\n{"bloques":[]}\n```', modelKey: "groq::m" }));
    const r = await turnoTinta({ ...base, pedido: "hazla más divertida para niños", anterior, hayModelo: true, cliente: lista(f), pedirModelo: pedir });
    expect(f.enviados.map((e) => e.accion)).toEqual(["catalogo", "instrucciones", "leer", "dibujar"]);
    expect((f.enviados[1].datos as { actual: string }).actual).toContain('"bloques"');
    expect(r).toMatchObject({ texto: "Hecho.", app: { html: DIBUJO.html, llamadas: 1 } });
  });

  it("con IA, una respuesta sin JSON es conversación", async () => {
    const f = motor();
    const pedir = vi.fn<PedirModelo>(async () => ({ texto: "Usé la paleta mandarina.", modelKey: "groq::m" }));
    const r = await turnoTinta({ ...base, pedido: "¿qué paleta usaste?", anterior, hayModelo: true, cliente: lista(f), pedirModelo: pedir });
    expect(r).toEqual({ texto: "Usé la paleta mandarina.", modelo: "groq::m", avisos: [] });
  });

  it("si la IA no da una receta válida se corrige una vez y luego falla claro", async () => {
    const f = motor({ ok: false });
    const pedir = vi.fn<PedirModelo>(async () => ({ texto: "{nada}", modelKey: "groq::m" }));
    await expect(
      turnoTinta({ ...base, pedido: "hazla más divertida", anterior, hayModelo: true, cliente: lista(f), pedirModelo: pedir })
    ).rejects.toThrow(/no devolvió un diseño válido/);
    expect(pedir).toHaveBeenCalledTimes(2);
  });
});

const CATALOGO: CatalogoTinta = {
  paletas: [
    { id: "mandarina", nombre: "Mandarina", ambiente: "", acento: "#ff7a1a", fondo: "#fff6ee" },
    { id: "lavanda", nombre: "Lavanda", ambiente: "", acento: "#8b6cf0", fondo: "#f6f3ff" },
    { id: "oceano", nombre: "Océano", ambiente: "", acento: "#1f7ae0", fondo: "#eef5ff" },
    { id: "bosque", nombre: "Bosque", ambiente: "", acento: "#2f8f4e", fondo: "#eef7f0" },
    { id: "cafe", nombre: "Café tostado", ambiente: "", acento: "#8a5a3c", fondo: "#f4ece1" },
    { id: "grafito", nombre: "Grafito", ambiente: "", acento: "#555555", fondo: "#f2f2f2" },
  ],
  tipografias: [
    { id: "elegante", nombre: "Elegante", tag: "" },
    { id: "redondeada", nombre: "Redondeada", tag: "" },
  ],
  fondos: [{ id: "aurora", nombre: "Aurora", tag: "", grupo: "" }],
  bloques: [
    { id: "h-search", rol: "header", nombre: "Saludo + buscador" },
    { id: "c-coffee", rol: "cards", nombre: "Producto con aire" },
    { id: "a-coral", rol: "buttons", nombre: "Acción coral" },
    { id: "n-soft", rol: "nav", nombre: "Barra esencial" },
    { id: "w-calendario", rol: "widgets", nombre: "Calendario del mes" },
    { id: "w-filtros", rol: "fields", nombre: "Búsqueda con filtros" },
  ],
};

describe("cambios sin IA", () => {
  const cambio = (t: string) => cambioLocal(t, RECETA, CATALOGO);
  it("modo, color, paleta, letra y fondo", () => {
    expect(cambio("ponla en modo oscuro")?.receta.mode).toBe("dark");
    expect(cambio("más clarita, modo claro")?.receta.mode).toBe("light");
    expect(cambio("hazla en azul")?.receta.palette).toBe("oceano");
    expect(cambio("mejor verde")?.receta.palette).toBe("bosque");
    expect(cambio("usa la paleta Lavanda")?.receta.palette).toBe("lavanda");
    expect(cambio("pon la letra elegante")?.receta.font).toBe("elegante");
    expect(cambio("cambia el fondo a aurora")?.receta.background).toBe("aurora");
    expect(cambioLocal("quita el fondo", { ...RECETA, background: "aurora" }, CATALOGO)?.receta.background).toBeUndefined();
  });
  it("el nombre va a la cabecera y no se confunde con un color", () => {
    const c = cambio("ponla en modo oscuro y llama a la cafetería Café Brisa");
    expect(c?.receta.mode).toBe("dark");
    expect(c?.receta.texts?.["h-search"]?.[0]).toBe("Café Brisa");
    expect(c?.receta.palette).toBe("mandarina");
    expect(cambio("llámala Pulso")?.receta.texts?.["h-search"]?.[0]).toBe("Pulso");
  });
  it("quitar y añadir piezas, más tarjetas", () => {
    const sin = cambio("quita el botón coral");
    expect(sin?.receta.blocks.map((b) => b.id)).toEqual(["h-search", "c-coffee", "n-soft"]);
    const con = cambio("añade un calendario");
    expect(con?.receta.blocks.map((b) => b.id)).toEqual(["h-search", "c-coffee", "a-coral", "w-calendario", "n-soft"]);
    expect(cambio("pon más tarjetas")?.receta.blocks[1]).toEqual({ id: "c-coffee", repeat: 3 });
    // la única tarjeta no se quita
    expect(cambio("quita el producto")).toBeNull();
  });
  it("«otra versión» rehace; lo que no se entiende es null", () => {
    expect(cambio("dame otra versión")?.rehacer).toBe(true);
    expect(cambio("hazla más divertida para niños")).toBeNull();
    expect(cambio("¿qué paleta usaste?")).toBeNull();
  });
  it("la plantilla del equipo se convierte en receta", () => {
    expect(recetaDePlantilla({ brief: "x", blocks: [{ id: "a" }, { id: "b", repeat: 3 }], palette: "p", mode: "dark", id: "t1" }, "idea")).toEqual({
      brief: "x",
      blocks: [{ id: "a" }, { id: "b", repeat: 3 }],
      palette: "p",
      mode: "dark",
    });
    expect(recetaDePlantilla(null, "x")).toBeNull();
  });
});
