import { describe, it, expect } from "vitest";
import {
  archivosRelevantes,
  archivosVigentes,
  grafoDeArchivos,
  podarIrrelevantes,
  referenciasDe,
} from "../../src/lib/forja/grafo-proyecto";

const relleno = (marca: string) => `// ${marca}\n` + `const x${marca.replace(/\W/g, "")} = 1;\n`.repeat(60);
const bloque = (ruta: string, lang: string, codigo: string) => `**${ruta}**\n\n\`\`\`${lang}\n${codigo}\n\`\`\``;

// Una app en módulos ES, como la entrega el Modo App
const indexHtml = `<!doctype html><html><head><link rel="stylesheet" href="styles.css"></head><body><div id="app"></div><script type="module" src="app.js"></script></body></html>`;
const appJs = `import { store } from "./store.js";\nimport { vistaLista } from "./views/lista.js";\nimport { vistaAjustes } from "./views/ajustes.js";\n${relleno("app")}`;
const storeJs = `export const store = { items: [] };\n${relleno("store")}`;
const listaJs = `import { store } from "../store.js";\nexport function vistaLista() { return "<ul class='inventario'></ul>"; }\n${relleno("lista")}`;
const ajustesJs = `export function vistaAjustes() { return "<form class='tema oscuro'></form>"; }\n${relleno("ajustes")}`;
const menuJs = `export function menuMovil() { document.querySelector('.hamburguesa'); }\n${relleno("menu")}`;
const css = `@import url("fuentes.css");\nbody { margin: 0 }\n${"/* css */\n".repeat(80)}`;

const conversacion = [
  { role: "user", content: "haz una app de inventario" },
  {
    role: "assistant",
    content: [
      bloque("index.html", "html", indexHtml),
      bloque("styles.css", "css", css),
      bloque("app.js", "js", appJs),
      bloque("store.js", "js", storeJs),
      bloque("views/lista.js", "js", listaJs),
      bloque("views/ajustes.js", "js", ajustesJs),
      bloque("menu.js", "js", menuJs),
    ].join("\n\n"),
  },
];

describe("referencias y grafo", () => {
  it("lee script/link del HTML, imports de JS y @import de CSS", () => {
    expect(referenciasDe("index.html", indexHtml).sort()).toEqual(["app.js", "styles.css"]);
    expect(referenciasDe("app.js", appJs)).toEqual(["store.js", "views/lista.js", "views/ajustes.js"]);
    expect(referenciasDe("styles.css", css)).toEqual(["fuentes.css"]);
    expect(referenciasDe("x.js", `const m = await import("./lazy.js"); require('./cjs.js')`)).toEqual(["lazy.js", "cjs.js"]);
  });

  it("resuelve rutas relativas desde otras carpetas y sin extensión", () => {
    const g = grafoDeArchivos(archivosVigentes(conversacion));
    expect([...g.get("views/lista.js")!]).toContain("store.js");
    expect([...g.get("app.js")!].sort()).toEqual(["index.html", "store.js", "views/ajustes.js", "views/lista.js"]);
    expect(g.get("menu.js")!.size).toBe(0);
  });
});

describe("archivosRelevantes", () => {
  const archivos = archivosVigentes(conversacion);

  it("un archivo nombrado trae a sus vecinos y a la entrada", () => {
    const r = archivosRelevantes("en ajustes.js cambia el texto del botón", archivos)!;
    expect([...r].sort()).toEqual(["app.js", "index.html", "styles.css", "views/ajustes.js"]);
  });

  it("sin nombre, busca las palabras en el contenido", () => {
    const r = archivosRelevantes("la hamburguesa del menú no abre", archivos)!;
    expect(r.has("menu.js")).toBe(true);
    expect(r.has("views/lista.js")).toBe(false);
  });

  it("sin pistas, o en un proyecto pequeño, no decide (null = no quitar nada)", () => {
    expect(archivosRelevantes("arréglalo porfa", archivos)).toBeNull();
    const pequeno = new Map([
      ["index.html", { text: indexHtml }],
      ["app.js", { text: appJs }],
    ]);
    expect(archivosRelevantes("cambia app.js", pequeno)).toBeNull();
  });
});

describe("podarIrrelevantes", () => {
  it("quita solo los archivos no relevantes y deja un marcador con su nombre", () => {
    const rel = archivosRelevantes("en ajustes.js cambia el texto del botón", archivosVigentes(conversacion));
    const r = podarIrrelevantes(conversacion, rel);
    expect(r.omitidos.sort()).toEqual(["menu.js", "store.js", "views/lista.js"]);
    const texto = r.mensajes[1].content;
    expect(texto).toContain("«menu.js»");
    expect(texto).toContain("vistaAjustes");
    expect(texto).toContain("import { store }"); // app.js, vecino, intacto
    expect(r.ahorrados).toBeGreaterThan(1000);
  });

  it("con null no toca nada, y el mensaje protegido nunca se modifica", () => {
    expect(podarIrrelevantes(conversacion, null).mensajes).toEqual(conversacion);
    const r = podarIrrelevantes(conversacion, new Set(["index.html"]), 1);
    expect(r.mensajes[1]).toBe(conversacion[1]);
  });
});
