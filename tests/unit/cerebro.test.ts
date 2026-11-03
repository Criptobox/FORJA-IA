import { describe, expect, it } from "vitest";
import { disponerMapa, mapaDelProyecto, preguntaSobre, tipoDeArchivo } from "../../src/lib/forja/cerebro";
import { aristasDeArchivos, grafoDeArchivos } from "../../src/lib/forja/grafo-proyecto";

const bloque = (ruta: string, codigo: string, lang = "html") => "```" + lang + " " + ruta + "\n" + codigo + "\n```";

const conversacion = [
  { role: "user", content: "hazme una web" },
  {
    role: "assistant",
    content: [
      bloque("index.html", '<link rel="stylesheet" href="styles.css"><script src="app.js"></script>'),
      bloque("styles.css", "@import 'base.css'; body{}", "css"),
      bloque("base.css", "*{margin:0}", "css"),
      bloque("app.js", "import { datos } from './datos.js'; console.log(datos)", "js"),
      bloque("datos.js", "export const datos = 1", "js"),
      bloque("notas.md", "solo notas", "md"),
    ].join("\n\n"),
  },
];

describe("cerebro · mapa del proyecto", () => {
  it("un nodo por archivo y aristas dirigidas sacadas del código", () => {
    const m = mapaDelProyecto(conversacion);
    expect(m.nodos.map((n) => n.id)).toEqual(["app.js", "base.css", "datos.js", "index.html", "notas.md", "styles.css"]);
    const ar = m.aristas.map((e) => `${e.de}>${e.a}`).sort();
    expect(ar).toEqual(["app.js>datos.js", "index.html>app.js", "index.html>styles.css", "styles.css>base.css"]);
    const index = m.nodos.find((n) => n.id === "index.html")!;
    expect(index.usa.sort()).toEqual(["app.js", "styles.css"]);
    expect(m.nodos.find((n) => n.id === "app.js")!.loUsan).toEqual(["index.html"]);
    expect(m.nodos.find((n) => n.id === "notas.md")!.usa).toEqual([]);
  });

  it("la última versión de un archivo es la que manda", () => {
    const m = mapaDelProyecto([
      ...conversacion,
      { role: "assistant", content: bloque("index.html", "<p>sin enlaces</p>") },
    ]);
    expect(m.nodos.find((n) => n.id === "index.html")!.usa).toEqual([]);
  });

  it("sin archivos, mapa vacío", () => {
    expect(mapaDelProyecto([{ role: "user", content: "hola" }])).toEqual({ nodos: [], aristas: [] });
  });

  it("grafoDeArchivos sigue siendo el mismo grafo, sin dirección", () => {
    const archivos = new Map([
      ["index.html", { text: '<script src="a.js"></script>' }],
      ["a.js", { text: "" }],
    ]);
    expect(aristasDeArchivos(archivos)).toEqual([{ de: "index.html", a: "a.js" }]);
    const g = grafoDeArchivos(archivos);
    expect([...g.get("a.js")!]).toEqual(["index.html"]);
    expect([...g.get("index.html")!]).toEqual(["a.js"]);
  });
});

describe("cerebro · disposición", () => {
  it("es determinista y cabe dentro del lienzo con margen", () => {
    const m = mapaDelProyecto(conversacion);
    const a = disponerMapa(m, 340, 240);
    const b = disponerMapa(m, 340, 240);
    expect([...a.entries()]).toEqual([...b.entries()]);
    for (const p of a.values()) {
      expect(p.x).toBeGreaterThanOrEqual(36);
      expect(p.x).toBeLessThanOrEqual(340 - 36);
      expect(p.y).toBeGreaterThanOrEqual(36);
      expect(p.y).toBeLessThanOrEqual(240 - 36);
    }
  });

  it("no deja dos archivos encima uno de otro", () => {
    const pos = [...disponerMapa(mapaDelProyecto(conversacion), 340, 240).values()];
    for (let i = 0; i < pos.length; i++)
      for (let j = i + 1; j < pos.length; j++) expect(Math.hypot(pos[i].x - pos[j].x, pos[i].y - pos[j].y)).toBeGreaterThan(20);
  });

  it("uno solo va al centro; ninguno, nada", () => {
    const uno = mapaDelProyecto([{ role: "assistant", content: bloque("index.html", "<p>x</p>") }]);
    expect(disponerMapa(uno, 300, 200).get("index.html")).toEqual({ x: 150, y: 100 });
    expect(disponerMapa({ nodos: [], aristas: [] }, 300, 200).size).toBe(0);
  });
});

describe("cerebro · utilidades", () => {
  it("tipoDeArchivo", () => {
    expect(tipoDeArchivo("index.html")).toBe("html");
    expect(tipoDeArchivo("src/a.tsx")).toBe("js");
    expect(tipoDeArchivo("estilo.scss")).toBe("css");
    expect(tipoDeArchivo("datos.json")).toBe("datos");
    expect(tipoDeArchivo("logo.svg?v=2")).toBe("imagen");
    expect(tipoDeArchivo("LICENSE")).toBe("otro");
  });

  it("preguntaSobre nombra el archivo y sus relaciones", () => {
    expect(preguntaSobre({ id: "app.js", usa: ["datos.js"], loUsan: ["index.html"] })).toBe(
      "Sobre `app.js` (usa datos.js; lo usan index.html): "
    );
    expect(preguntaSobre({ id: "notas.md", usa: [], loUsan: [] })).toBe("Sobre `notas.md`: ");
  });
});
