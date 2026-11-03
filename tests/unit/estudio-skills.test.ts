import { describe, expect, it } from "vitest";
import {
  alternarSkill,
  bloqueSkills,
  camposSinEtiqueta,
  comprobarSkills,
  LIMITE_SKILL,
  MAX_SKILLS_PANTALLA,
  SKILLS_PANTALLA,
  skillPorId,
  skillsAutomaticas,
  skillsDePantalla,
} from "../../src/lib/forja/estudio/skills";
import { crearProyecto, direccionDe } from "../../src/lib/forja/estudio/proyecto";
import { pedidoPantalla, pedidoVariante, promptSistema } from "../../src/lib/forja/estudio/prompts";
import { criticar, problemasParaCorregir } from "../../src/lib/forja/estudio/critica";
import { pareceHtml, resolverSkillsPorDefecto, RuntimeModelo } from "../../src/lib/forja/motor/runtime-modelo";
import { ejecutarEnRuntime, type OpenDesignRequest } from "../../src/lib/forja/motor/adapter-opendesign";
import { ejecutarMvpForja } from "../../src/lib/forja/motor/nucleo-v4";
import type { LlamadaModelo } from "../../src/lib/forja/motor/tipos";

const pantalla = (nombre: string, proposito = "") => ({ nombre, proposito });
const doc = (body: string) => `<!doctype html><html lang="es"><head><title>x</title><style>:root{--c:#000}</style></head><body>${body}</body></html>`;

describe("estudio · skills de pantalla (catálogo)", () => {
  it("son cortas: cada una cabe en LIMITE_SKILL", () => {
    for (const s of SKILLS_PANTALLA) expect(s.texto.length, s.id).toBeLessThanOrEqual(LIMITE_SKILL);
  });

  it("ids únicos y cada una dice de qué skill original sale", () => {
    const ids = SKILLS_PANTALLA.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SKILLS_PANTALLA) {
      expect(s.original).toMatch(/^(skills|craft)\//);
      expect(s.texto.startsWith("[Skill:")).toBe(true);
    }
  });

  it("no arrastran la maquinaria del kit (MCP, data-od-*)", () => {
    for (const s of SKILLS_PANTALLA) expect(s.texto).not.toMatch(/data-od-|MCP|prepare_open_design|collectionId/);
  });
});

describe("estudio · skills de pantalla (selección)", () => {
  it("elige por el nombre y el propósito de la pantalla", () => {
    expect(skillsAutomaticas(pantalla("Iniciar sesión"), "app")).toEqual(["acceso"]);
    expect(skillsAutomaticas(pantalla("Inicio de sesión"), "app")).toEqual(["acceso"]);
    expect(skillsAutomaticas(pantalla("Crear cuenta"), "app")).toContain("acceso");
    expect(skillsAutomaticas(pantalla("Crear cuenta"), "app")).not.toContain("ajustes");
    expect(skillsAutomaticas(pantalla("Mi cuenta"), "app")).toEqual(["ajustes"]);
    expect(skillsAutomaticas(pantalla("Inicio"), "app")).toEqual(["marco-app"]);
    expect(skillsAutomaticas(pantalla("Ajustes"), "app")).toEqual(["ajustes"]);
    expect(skillsAutomaticas(pantalla("Mis reservas"), "app")).toEqual(["tabla"]);
    expect(skillsAutomaticas(pantalla("Nueva reserva"), "app")).toEqual(["formulario"]);
    expect(skillsAutomaticas(pantalla("Buscar pistas"), "app")).toEqual(["busqueda"]);
    expect(skillsAutomaticas(pantalla("Bienvenida"), "app")).toEqual(["bienvenida"]);
    expect(skillsAutomaticas(pantalla("Precios"), "web")).toEqual(["planes"]);
    expect(skillsAutomaticas(pantalla("Asistente"), "app")).toEqual(["asistente"]);
  });

  it("el nombre pesa más que el propósito y nunca pasan del cupo", () => {
    const r = skillsAutomaticas(pantalla("Facturas", "buscar, filtrar y crear una nueva factura desde el formulario"), "app");
    expect(r[0]).toBe("tabla");
    expect(r.length).toBeLessThanOrEqual(MAX_SKILLS_PANTALLA);
  });

  it("«Inicio» de una web es portada: ni marco de app ni base de producto", () => {
    expect(skillsDePantalla(pantalla("Inicio", "presenta la propuesta de valor"), "web")).toEqual([]);
  });

  it("en apps la base «producto» va siempre; en webs solo con un patrón", () => {
    expect(skillsDePantalla(pantalla("Perfil"), "app")[0]).toBe("producto");
    expect(skillsDePantalla(pantalla("Contacto", "formulario de contacto"), "web")).toEqual(["producto", "formulario"]);
  });

  it("las elegidas a mano mandan (sin añadir la base) y se filtran las desconocidas", () => {
    expect(skillsDePantalla({ ...pantalla("Inicio"), skills: ["tabla", "no-existe"] }, "app")).toEqual(["tabla"]);
    expect(skillsDePantalla({ ...pantalla("Inicio"), skills: [] }, "app")).toEqual([]);
  });

  it("alternarSkill quita, añade y respeta el cupo", () => {
    const s = pantalla("Ajustes");
    expect(alternarSkill(s, "app", "ajustes")).toEqual(["producto"]);
    const con = alternarSkill(s, "app", "tabla");
    expect(con).toEqual(["producto", "ajustes", "tabla"]);
    expect(alternarSkill({ ...s, skills: con }, "app", "acceso")).toEqual(con); // lleno
    expect(alternarSkill(s, "app", "inventada")).toEqual(["producto", "ajustes"]);
  });
});

describe("estudio · skills en los prompts (prompts cortos para modelos gratis)", () => {
  const p = crearProyecto({ brief: "App de reservas para un club de pádel en Valencia", tipo: "app" });
  const sistema = promptSistema(p, direccionDe(p));

  it("el pedido de pantalla lleva el bloque de sus skills", () => {
    const t = pedidoPantalla(p, pantalla("Iniciar sesión"));
    expect(t).toContain("## Patrones de esta pantalla");
    expect(t).toContain("[Skill: acceso]");
    expect(t).toContain("[Skill: pantalla de producto]");
    expect(pedidoVariante(p, pantalla("Iniciar sesión"), "<html></html>")).toContain("[Skill: acceso]");
  });

  it("una portada web no lleva bloque de patrones", () => {
    const w = crearProyecto({ brief: "Web de una panadería", tipo: "web" });
    expect(pedidoPantalla(w, pantalla("Inicio", "propuesta de valor"))).not.toContain("Patrones");
  });

  it("el system prompt del proyecto no cambia con las skills (va igual en todas las pantallas)", () => {
    expect(sistema).not.toContain("[Skill:");
  });

  it("presupuesto: system + pedido < 8.000 caracteres (~2k tokens) en el peor caso", () => {
    // el peor caso es el cupo lleno con las tres skills más largas
    const largas = [...SKILLS_PANTALLA].sort((a, b) => b.texto.length - a.texto.length).slice(0, MAX_SKILLS_PANTALLA + 1);
    const peor = pedidoPantalla(p, { ...pantalla("Pantalla con un nombre largo", "para qué sirve, en una frase"), skills: largas.map((s) => s.id) });
    expect(peor.length).toBeLessThan(2_400);
    expect(sistema.length + peor.length).toBeLessThan(8_000);
  });

  it("bloqueSkills ignora ids desconocidos y queda vacío sin skills", () => {
    expect(bloqueSkills([])).toBe("");
    expect(bloqueSkills(["no-existe"])).toBe("");
  });
});

describe("estudio · autocomprobación de las skills", () => {
  it("camposSinEtiqueta: label for, label envolvente, aria-label; el placeholder no cuenta", () => {
    expect(camposSinEtiqueta(doc('<label for="a">Correo</label><input id="a">'))).toBe(0);
    expect(camposSinEtiqueta(doc("<label>Nombre <input></label>"))).toBe(0);
    expect(camposSinEtiqueta(doc('<input aria-label="Buscar">'))).toBe(0);
    expect(camposSinEtiqueta(doc('<input placeholder="Correo"><input type="submit"><input type="hidden">'))).toBe(1);
    expect(camposSinEtiqueta(doc('<label for="x">X</label><input id="y"><textarea></textarea>'))).toBe(2);
  });

  const casos: [string, string, string][] = [
    // [skill, html que cumple, html que no]
    ["producto", "<h1>Facturas</h1><p>Panadería Lola · 240 €</p>", "<p>Lorem ipsum dolor</p>"],
    ["marco-app", '<nav><a aria-current="page" href="#">Inicio</a></nav>', "<nav><a href=#>Inicio</a></nav>"],
    ["tabla", '<table><tr><th>Nombre</th></tr></table><style>td{font-variant-numeric:tabular-nums}</style>', "<div>Nada</div>"],
    ["formulario", '<form><label for="n">Nombre</label><input id="n"></form>', '<form><input placeholder="Nombre"></form>'],
    ["detalle", '<a href="#">← Volver a pedidos</a><h1>Pedido 42</h1>', "<h1>Pedido 42</h1>"],
    ["busqueda", '<form role="search"><input type="search" aria-label="Buscar"></form>', "<h1>Buscar</h1>"],
    ["ajustes", "<h2>Zona de peligro</h2><button>Eliminar cuenta</button>", "<h2>Notificaciones</h2>"],
    ["acceso", '<input type="email" autocomplete="email" aria-label="Correo"><input type="password" autocomplete="current-password" aria-label="Contraseña"><a>¿Has olvidado la contraseña?</a>', '<input type="password" aria-label="Contraseña">'],
    ["bienvenida", "<button>Empezar</button><a>Ya tengo cuenta</a>", "<button>Empezar</button>"],
    ["planes", "<p>9,99 €/mes</p><a>Restaurar compras</a>", "<p>9,99 €</p><a>No, no quiero ahorrar</a>"],
    ["asistente", '<label for="m">Mensaje</label><textarea id="m"></textarea>', "<p>Hola</p>"],
  ];

  for (const [id, bien, mal] of casos) {
    it(`${id}: pasa lo correcto y marca lo incorrecto`, () => {
      const s = skillPorId(id)!;
      expect(s.comprobar(doc(bien), "app"), "debería cumplir").toEqual([]);
      expect(s.comprobar(doc(mal), "app").length, "debería fallar").toBeGreaterThan(0);
    });
  }

  it("cada skill del catálogo tiene su caso de prueba", () => {
    expect(casos.map((c) => c[0]).sort()).toEqual(SKILLS_PANTALLA.map((s) => s.id).sort());
  });

  it("lo que solo exigen las tiendas de apps no se pide en una web", () => {
    expect(skillPorId("ajustes")!.comprobar(doc("<h2>Notificaciones</h2>"), "web")).toEqual([]);
    expect(skillPorId("planes")!.comprobar(doc("<p>9 €/mes</p>"), "web")).toEqual([]);
  });

  it("el CSS y los scripts no cuentan como texto visible", () => {
    expect(skillPorId("bienvenida")!.comprobar(doc("<script>const omitir = 1</script><button>Empezar</button>"), "app").length).toBe(1);
  });

  it("comprobarSkills junta sin repetir y la crítica los pone primero en «Corregir»", () => {
    const html = doc('<form><input placeholder="Correo"></form>');
    const fallos = comprobarSkills(html, ["formulario", "formulario", "acceso"], "app");
    expect(fallos.length).toBe(new Set(fallos).size);
    const c = criticar(html, ["formulario"], "app");
    expect(c.patrones.length).toBe(1);
    expect(problemasParaCorregir(c)[0]).toBe(c.patrones[0]);
    expect(criticar(html).patrones).toEqual([]); // sin skills, la crítica de siempre
  });
});

/* -------------------- runtime del adaptador con modelo real -------------------- */

function request(skills: string[] = []): OpenDesignRequest {
  return {
    requestId: "req-1",
    projectId: "p",
    brief: "# Brief\nLa web de reservas de un club de pádel en Valencia",
    direccion: "Editorial cálida — papel y tinta",
    designSystem: {
      nombre: "Pádel",
      identidad: "cálida",
      colores: ["#123456"],
      tokensCss: ":root{--color-acento:#123456}",
      designMd: "# DESIGN",
    } as OpenDesignRequest["designSystem"],
    skills,
    prompts: [
      { rol: "codificador", system: "Eres el Codificador.", user: "Construye la página completa." },
      { rol: "revisor", system: "Eres el Revisor.", user: "Audita." },
    ],
    limites: { maxIteraciones: 3, maxCaracteres: 120_000 },
  };
}

const PAGINA = "Aquí está:\n```html\n<!doctype html><html lang=\"es\"><body><main><h1>Club de pádel</h1></main></body></html>\n```";

describe("motor · RuntimeModelo (el adaptador con un modelo de verdad)", () => {
  it("manda brief, tokens y skills al modelo y devuelve su HTML", async () => {
    const vistas: Parameters<LlamadaModelo>[0][] = [];
    const rt = new RuntimeModelo({
      llamada: async (a) => (vistas.push(a), PAGINA),
      modelo: { providerId: "groq", modelId: "llama" },
    });
    const art = await ejecutarEnRuntime(rt, request(["acceso", "landing-conversion"]));
    expect(art.ok).toBe(true);
    expect(art.html).toMatch(/^<!doctype html>/);
    expect(art.productor).toBe("groq:llama");
    expect(rt.tipo).toBe("opendesign");
    expect(vistas[0].system).toContain("--color-acento");
    expect(vistas[0].system).toContain("[Skill: acceso]"); // skill del Estudio
    expect(vistas[0].system).toContain("[Habilidad: landing de conversión]"); // habilidad del motor
    expect(vistas[0].user).toContain("club de pádel");
    expect(vistas[0].rol).toBe("codificador");
  });

  it("si el modelo charla en vez de dar HTML, se lo vuelve a pedir", async () => {
    let n = 0;
    const rt = new RuntimeModelo({
      llamada: async (a) => (++n === 1 ? "¡Claro! Te propongo una web con tres secciones…" : (expect(a.user).toMatch(/no traía el documento HTML/), PAGINA)),
      modelo: { providerId: "x", modelId: "y" },
    });
    const art = await rt.ejecutar(request());
    expect(n).toBe(2);
    expect(art.ok).toBe(true);
    expect(art.trazas.join(" ")).toMatch(/intento 1: sin HTML/);
  });

  it("respeta maxIteraciones y no lanza nunca", async () => {
    let n = 0;
    const rt = new RuntimeModelo({ llamada: async () => (n++, "nada"), modelo: { providerId: "x", modelId: "y" } });
    const art = await rt.ejecutar({ ...request(), limites: { maxIteraciones: 2, maxCaracteres: 1000 } });
    expect(n).toBe(2);
    expect(art.ok).toBe(false);
    expect(art.error).toMatch(/no devolvió/);
  });

  it("un fallo del modelo (cuota agotada en toda la cadena) sale como ok:false", async () => {
    const rt = new RuntimeModelo({
      llamada: async () => {
        throw new Error("429 rate limit");
      },
      modelo: { providerId: "auto", modelId: "cadena-gratis" },
      productor: () => "",
    });
    const art = await rt.ejecutar(request());
    expect(art.ok).toBe(false);
    expect(art.error).toContain("429");
  });

  it("con Auto, el productor es el modelo que respondió de verdad", async () => {
    const rt = new RuntimeModelo({ llamada: async () => PAGINA, modelo: { providerId: "auto", modelId: "cadena" }, productor: () => "gemini::flash" });
    expect((await rt.ejecutar(request())).productor).toBe("gemini::flash");
  });

  it("rechaza un HTML que pasa del límite de caracteres", async () => {
    const rt = new RuntimeModelo({ llamada: async () => PAGINA, modelo: { providerId: "x", modelId: "y" } });
    const art = await rt.ejecutar({ ...request(), limites: { maxIteraciones: 1, maxCaracteres: 20 } });
    expect(art.ok).toBe(false);
    expect(art.error).toMatch(/límite/);
  });

  it("el prompt es corto aunque el brief sea enorme", () => {
    const rt = new RuntimeModelo({ llamada: async () => PAGINA, modelo: { providerId: "x", modelId: "y" } });
    const { system, user } = rt.prompts({ ...request(["acceso", "formulario"]), brief: "x".repeat(50_000) });
    expect(user.length).toBeLessThan(3_700);
    expect(system.length).toBeLessThan(3_000);
  });

  it("pareceHtml y resolverSkillsPorDefecto", () => {
    expect(pareceHtml("<!doctype html><html><body></body></html>")).toBe(true);
    expect(pareceHtml("Te propongo una web")).toBe(false);
    expect(resolverSkillsPorDefecto([])).toBe("");
    expect(resolverSkillsPorDefecto(["inventada"])).toBe("");
  });

  it("enchufado al núcleo: el MVP usa el HTML del modelo y no el del runtime local", async () => {
    const res = await ejecutarMvpForja(
      { mensaje: "Web de reservas para un club de pádel en Valencia", modo: "directo" },
      {
        perfil: "FREE",
        runtime: new RuntimeModelo({ llamada: async () => PAGINA, modelo: { providerId: "x", modelId: "y" } }),
        sinReparacionDetalle: true,
      }
    );
    expect(res.traza.some((t) => /runtime runtime-modelo:x:y/.test(t))).toBe(true);
    expect(res.resultado.codigo).toContain("Club de pádel");
  });
});
