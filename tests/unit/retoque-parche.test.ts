import { describe, it, expect } from "vitest";
import { bloquesConNombre, filesFromAnswer } from "../../src/lib/forja/answer-files";
import {
  aplicarRetoque,
  archivosRecortados,
  bloqueResultado,
  neutralizarRecortados,
  pedirSinOmitir,
  MIN_CHARS_PARCHE,
  pedirArchivoCompleto,
  usaParches,
} from "../../src/lib/forja/retoque-parche";

const relleno = "<p>texto de relleno</p>\n".repeat(Math.ceil(MIN_CHARS_PARCHE / 24));
const html = `<!doctype html>\n<html>\n<body>\n  <button class="cta" style="background: blue">Reservar</button>\n${relleno}</body>\n</html>`;
const css = `body { margin: 0 }\n.cta { color: white }\n${"/* x */\n".repeat(250)}`;
const vigentes = new Map([
  ["index.html", { text: html }],
  ["styles.css", { text: css }],
]);

describe("usaParches", () => {
  it("solo en retoques, sin agente y con algún archivo grande", () => {
    expect(usaParches({ nivel: 2, agente: false, archivos: vigentes })).toBe(true);
    expect(usaParches({ nivel: 3, agente: false, archivos: vigentes })).toBe(false);
    expect(usaParches({ nivel: 2, agente: true, archivos: vigentes })).toBe(false);
    expect(usaParches({ nivel: 2, agente: false, archivos: new Map([["a.html", { text: "<p>hola</p>" }]]) })).toBe(false);
  });
});

describe("aplicarRetoque", () => {
  it("aplica cada bloque a su archivo y el resultado lo lee la vista previa", () => {
    const respuesta = [
      "Cambio el botón a verde.",
      "",
      "**index.html**",
      "```html",
      "<<<<<<< SEARCH",
      '  <button class="cta" style="background: blue">Reservar</button>',
      "=======",
      '  <button class="cta" style="background: green">Reservar mesa</button>',
      ">>>>>>> REPLACE",
      "```",
      "",
      "styles.css:",
      "<<<<<<< SEARCH",
      ".cta { color: white }",
      "=======",
      ".cta { color: white; font-weight: 700 }",
      ">>>>>>> REPLACE",
    ].join("\n");
    const r = aplicarRetoque(respuesta, vigentes);
    expect(r.huboParches).toBe(true);
    expect(r.fallidos).toEqual([]);
    expect(r.parcheados.map((p) => p.path).sort()).toEqual(["index.html", "styles.css"]);
    const nuevoHtml = r.parcheados.find((p) => p.path === "index.html")!.text;
    expect(nuevoHtml).toContain("background: green");
    expect(nuevoHtml).toContain(relleno.slice(0, 50)); // el resto, intacto

    // la respuesta guardada = parche + archivos completos: el último bloque de
    // cada archivo es el bueno, que es lo que leen la vista previa y el ZIP
    const guardada = `${respuesta}\n\n${r.parcheados.map(bloqueResultado).join("\n\n")}`;
    const archivos = filesFromAnswer(guardada);
    expect(archivos.find((f) => f.path === "index.html")?.text).toBe(nuevoHtml);
  });

  it("con un solo archivo en el proyecto, los bloques sin nombre van a ese", () => {
    const solo = new Map([["index.html", { text: html }]]);
    const r = aplicarRetoque(
      '<<<<<<< SEARCH\n>Reservar</button>\n=======\n>Pedir</button>\n>>>>>>> REPLACE',
      solo
    );
    expect(r.parcheados[0]?.text).toContain(">Pedir</button>");
  });

  it("si un bloque no casa, ese archivo NO se toca (rollback) y se pide completo", () => {
    const r = aplicarRetoque(
      [
        "**index.html**",
        "<<<<<<< SEARCH",
        '<button class="cta" style="background: blue">Reservar</button>',
        "=======",
        "<button>ok</button>",
        ">>>>>>> REPLACE",
        "<<<<<<< SEARCH",
        "<footer>no existe</footer>",
        "=======",
        "<footer>x</footer>",
        ">>>>>>> REPLACE",
      ].join("\n"),
      vigentes
    );
    expect(r.parcheados).toEqual([]);
    expect(r.fallidos.map((f) => f.path)).toEqual(["index.html"]);
    expect(pedirArchivoCompleto(r.fallidos)).toMatch(/COMPLETOS/);
  });

  it("una respuesta sin bloques no hace nada", () => {
    expect(aplicarRetoque("```html\n<p>archivo entero</p>\n```", vigentes)).toEqual({
      huboParches: false,
      parcheados: [],
      fallidos: [],
      sinArchivo: 0,
    });
  });
});

describe("Quality Gate: archivos con partes omitidas", () => {
  it("detecta «el resto igual» en un archivo mucho más corto que el anterior", () => {
    const recortado = `<!doctype html>\n<html>\n<body>\n  <button style="background: green">Reservar</button>\n  <!-- ... resto del código igual ... -->\n</body>\n</html>`;
    const r = archivosRecortados([{ path: "index.html", text: recortado }], vigentes);
    expect(r.map((x) => x.path)).toEqual(["index.html"]);
    expect(pedirSinOmitir(r)).toMatch(/COMPLETOS/);
  });

  it("no acusa a un archivo nuevo, ni a uno completo, ni a uno corto sin marca", () => {
    expect(archivosRecortados([{ path: "nuevo.js", text: "// resto igual" }], vigentes)).toEqual([]);
    expect(archivosRecortados([{ path: "index.html", text: html.replace("blue", "green") }], vigentes)).toEqual([]);
    expect(archivosRecortados([{ path: "index.html", text: "<p>página nueva y corta</p>" }], vigentes)).toEqual([]);
  });

  it("neutraliza el bloque recortado: la vista previa no lo toma como bueno", () => {
    const respuesta = `Listo.\n\n**index.html**\n\n\`\`\`html\n<body>\n<!-- resto igual -->\n</body>\n\`\`\``;
    const r = archivosRecortados(bloquesConNombre(respuesta), vigentes);
    const limpia = neutralizarRecortados(respuesta, r);
    expect(filesFromAnswer(limpia).find((f) => f.path === "index.html")).toBeUndefined();
    expect(limpia).toContain("sigue valiendo la versión anterior");
  });
});
