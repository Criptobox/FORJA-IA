import { describe, expect, it } from "vitest";
import { DIRECCIONES, direccionPorId } from "../../src/lib/forja/design-directions";
import {
  agregarPantallas,
  actualizarPantalla,
  cambiarDireccion,
  conNuevaVersion,
  crearProyecto,
  elegirVersion,
  eliminarPantalla,
  MAX_VERSIONES,
  moverPantalla,
  nombreDesdeBrief,
  slug,
  versionActual,
} from "../../src/lib/forja/estudio/proyecto";
import { asegurarTokens, primeraLongitud, tokensCss, urlFuentes } from "../../src/lib/forja/estudio/tokens";
import { codigoParaEditar, extraerPantalla, htmlDeVersion, htmlParcial } from "../../src/lib/forja/estudio/html";
import { leerPlan, pedidoIterar, promptPlan, promptSistema } from "../../src/lib/forja/estudio/prompts";
import { criticar, problemasParaCorregir } from "../../src/lib/forja/estudio/critica";
import { indiceHtml, rutasPantallas, zipProyecto } from "../../src/lib/forja/estudio/exportar";
import { readZip } from "../../src/lib/forja/zip";

const D = DIRECCIONES[0];
const HTML = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Reservas</title><style>:root{--color-acento:red}</style></head><body><h1>Reserva tu corte</h1></body></html>`;

function proyectoCon(n = 2) {
  let p = crearProyecto({ brief: "App de reservas para una peluquería de barrio", tipo: "app" });
  p = agregarPantallas(p, Array.from({ length: n }, (_, i) => ({ nombre: `Pantalla ${i + 1}`, proposito: `uso ${i + 1}` })));
  return p;
}

describe("estudio · proyecto", () => {
  it("crea un proyecto con nombre deducido del encargo y una dirección válida", () => {
    const p = crearProyecto({ brief: "Crea una app de reservas para peluquería", tipo: "app" });
    expect(p.nombre).toBe("App de reservas para peluquería");
    expect(direccionPorId(p.direccionId)).not.toBeNull();
    expect(p.pantallas).toEqual([]);
  });

  it("respeta la dirección elegida por el usuario", () => {
    const id = DIRECCIONES[2].id;
    expect(crearProyecto({ brief: "x", tipo: "web", direccionId: id }).direccionId).toBe(id);
  });

  it("nombreDesdeBrief no deja el nombre vacío", () => {
    expect(nombreDesdeBrief("   ")).toBe("Proyecto sin nombre");
  });

  it("añade, mueve y elimina pantallas sin mutar el original", () => {
    const p = proyectoCon(3);
    const [a, b] = p.pantallas;
    const movido = moverPantalla(p, b.id, -1);
    expect(movido.pantallas[0].id).toBe(b.id);
    expect(p.pantallas[0].id).toBe(a.id);
    expect(moverPantalla(p, a.id, -1)).toBe(p); // ya está arriba
    expect(eliminarPantalla(p, a.id).pantallas).toHaveLength(2);
  });

  it("guarda versiones, deja la nueva como actual y recorta las viejas", () => {
    let s = proyectoCon(1).pantallas[0];
    expect(versionActual(s)).toBeNull();
    for (let i = 0; i < MAX_VERSIONES + 2; i++) {
      s = conNuevaVersion(s, { pedido: `v${i}`, archivos: [{ path: "index.html", text: HTML }], entrada: "index.html" });
    }
    expect(s.versiones).toHaveLength(MAX_VERSIONES);
    expect(versionActual(s)?.pedido).toBe(`v${MAX_VERSIONES + 1}`);
    expect(s.estado).toBe("lista");
    const atras = elegirVersion(s, 0);
    expect(versionActual(atras)?.pedido).toBe("v2");
    expect(elegirVersion(s, 99)).toBe(s);
  });

  it("actualizarPantalla ignora ids que no existen y cambiarDireccion ids inválidos", () => {
    const p = proyectoCon(1);
    expect(actualizarPantalla(p, "no-existe", (s) => s)).toBe(p);
    expect(cambiarDireccion(p, "inventada")).toBe(p);
  });

  it("slug quita acentos y símbolos", () => {
    expect(slug("Pantalla de Inicio ¡Ñu!")).toBe("pantalla-de-inicio-nu");
    expect(slug("***")).toBe("pantalla");
  });
});

describe("estudio · tokens", () => {
  it("el bloque :root trae todas las variables que cita el prompt", () => {
    const css = tokensCss(D);
    for (const v of ["--color-fondo", "--color-superficie", "--color-texto", "--color-texto-suave", "--color-acento", "--color-acento-2", "--fuente-display", "--fuente-cuerpo", "--fuente-mono", "--radio"]) {
      expect(css).toContain(`${v}:`);
    }
  });

  it("primeraLongitud saca el valor de un texto descriptivo", () => {
    expect(primeraLongitud("0px (bordes rectos)", "9px")).toBe("0px");
    expect(primeraLongitud("muy redondeados", "9px")).toBe("9px");
  });

  it("la URL de fuentes no repite familias", () => {
    const u = urlFuentes({ ...D, fuentes: { display: "Inter", cuerpo: "Inter", mono: "IBM Plex Mono" } });
    expect(u.match(/family=Inter:/g)).toHaveLength(1);
  });

  it("asegurarTokens inyecta al abrir <head> y no duplica", () => {
    const sin = "<!doctype html><html><head><title>x</title></head><body>hola</body></html>";
    const con = asegurarTokens(sin, D);
    expect(con.indexOf("--color-acento:")).toBeLessThan(con.indexOf("<title>"));
    expect(asegurarTokens(con, D)).toBe(con);
    expect(asegurarTokens(HTML, D)).toBe(HTML); // el modelo ya los declaró
    expect(asegurarTokens("<p>suelto</p>", D)).toMatch(/^<!doctype html>/);
  });
});

describe("estudio · html", () => {
  it("extrae el HTML de una respuesta con cerca de código", () => {
    const r = extraerPantalla("Aquí va:\n```html\n" + HTML + "\n```\n");
    expect(r?.entrada).toBe("index.html");
    expect(r?.archivos[0].text).toContain("Reserva tu corte");
  });

  it("acepta un documento suelto sin cerca y rechaza texto sin HTML", () => {
    expect(extraerPantalla("Claro.\n" + HTML)?.archivos[0].text.startsWith("<!doctype")).toBe(true);
    expect(extraerPantalla("No puedo ayudar con eso")).toBeNull();
  });

  it("no guarda el kit de efectos aunque el modelo lo enlace", () => {
    const r = extraerPantalla('```html\n<!doctype html><html><head><link rel="stylesheet" href="forja-fx.css"></head><body data-fx="x"></body></html>\n```');
    expect(r?.archivos.map((f) => f.path)).toEqual(["index.html"]);
  });

  it("htmlParcial devuelve lo escrito hasta ahora", () => {
    expect(htmlParcial("Hola\n```html\n<!doctype html><html><body><h1>Ti")).toBe("<!doctype html><html><body><h1>Ti");
    expect(htmlParcial("sin html todavía")).toBe("");
  });

  it("htmlDeVersion empaqueta y asegura los tokens; codigoParaEditar recorta", () => {
    const v = { archivos: [{ path: "index.html", text: "<!doctype html><html><head></head><body>x</body></html>" }], entrada: "index.html" };
    expect(htmlDeVersion(v, D)).toContain("--color-acento:");
    expect(htmlDeVersion({ archivos: [], entrada: "index.html" }, D)).toBe("");
    const largo = { archivos: [{ path: "index.html", text: "a".repeat(100) }], entrada: "index.html" };
    expect(codigoParaEditar(largo, 10)).toContain("recortado");
  });
});

describe("estudio · prompts", () => {
  it("el system prompt lleva tokens, marco de app y las otras pantallas", () => {
    const p = proyectoCon(2);
    const s = promptSistema(p, D);
    expect(s).toContain("--color-acento:");
    expect(s).toContain("APP MÓVIL");
    expect(s).toContain("Pantalla 2");
    expect(s).toContain("```html");
  });

  it("el pedido de iteración incluye el código y el cambio", () => {
    const t = pedidoIterar({ nombre: "Inicio" }, "<html></html>", "hazlo oscuro");
    expect(t).toContain("<html></html>");
    expect(t).toContain("hazlo oscuro");
  });

  it("leerPlan tolera viñetas, numeración y separadores distintos", () => {
    const plan = leerPlan(
      "Aquí tienes:\n1. Inicio | resumen del día\n- **Reservar** — elegir hora y servicio\n* Perfil: datos y citas\nNombre de la pantalla | para qué\nInicio | repetida",
      "app"
    );
    expect(plan.map((x) => x.nombre)).toEqual(["Inicio", "Reservar", "Perfil"]);
    expect(plan[1].proposito).toBe("elegir hora y servicio");
  });

  it("leerPlan cae a un plan por defecto si no entiende nada", () => {
    expect(leerPlan("lo siento", "web").length).toBeGreaterThan(0);
    expect(promptPlan("tienda", "web")).toContain("|");
  });
});

describe("estudio · crítica y exportación", () => {
  it("criticar devuelve identidad 0..100 y problemas acotados", () => {
    const c = criticar(HTML);
    expect(c.identidad).toBeGreaterThanOrEqual(0);
    expect(c.identidad).toBeLessThanOrEqual(100);
    expect(problemasParaCorregir(c).length).toBeLessThanOrEqual(8);
  });

  it("el ZIP trae índice, sistema de diseño y solo las pantallas con versión", async () => {
    let p = proyectoCon(2);
    const [a] = p.pantallas;
    p = actualizarPantalla(p, a.id, (s) => conNuevaVersion(s, { pedido: "generar", archivos: [{ path: "index.html", text: HTML }], entrada: "index.html" }));
    const rutas = rutasPantallas(p);
    expect(rutas.get(a.id)).toBe("pantallas/01-pantalla-1.html");
    expect(indiceHtml(p, rutas)).toContain("pantallas/01-pantalla-1.html");
    const zip = zipProyecto(p);
    const entradas = await readZip(zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer);
    expect(entradas.map((e) => e.path).sort()).toEqual(["DESIGN.md", "index.html", "pantallas/01-pantalla-1.html", "tokens.css"]);
  });

  it("rutas sin colisión aunque dos pantallas se llamen igual", () => {
    let p = crearProyecto({ brief: "x", tipo: "web" });
    p = agregarPantallas(p, [{ nombre: "Inicio", proposito: "" }, { nombre: "Inicio", proposito: "" }]);
    const rutas = [...rutasPantallas(p).values()];
    expect(new Set(rutas).size).toBe(2);
  });
});
