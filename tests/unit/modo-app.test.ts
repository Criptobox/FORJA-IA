import { describe, expect, it } from "vitest";
import { esEncargoDeApp, INSTRUCCION_APP } from "../../src/lib/forja/modo-app";
import { BUILTIN_SKILLS } from "../../src/lib/forja/skills-data";
import { bundlePreview, filesFromAnswer } from "../../src/lib/forja/answer-files";

describe("esEncargoDeApp", () => {
  it("reconoce aplicaciones con estado y pantallas", () => {
    for (const p of [
      "crea una app de lista de tareas",
      "hazme un dashboard de ventas",
      "necesito un gestor de inventario para mi almacén",
      "un CRM sencillo para mis clientes",
      "aplicación de control de gastos",
      "un kanban como Trello",
      "panel de administración de usuarios",
    ]) expect(esEncargoDeApp(p), p).toBe(true);
  });

  it("una página de presentación no es una app, aunque la nombre", () => {
    expect(esEncargoDeApp("hazme una landing para mi app de meditación")).toBe(false);
    expect(esEncargoDeApp("portfolio para un fotógrafo")).toBe(false);
    expect(esEncargoDeApp("una web para mi cafetería")).toBe(false);
    expect(esEncargoDeApp("")).toBe(false);
  });

  it("no se dispara con palabras que solo contienen «app»", () => {
    expect(esEncargoDeApp("una web sobre happy hour")).toBe(false);
    expect(esEncargoDeApp("mapa de la ciudad")).toBe(false);
  });
});

describe("INSTRUCCION_APP", () => {
  it("pide módulos ES, persistencia, rutas y manifest, sin build ni CDN", () => {
    expect(INSTRUCCION_APP).toMatch(/type="module"/);
    expect(INSTRUCCION_APP).toMatch(/js\/store\.js/);
    expect(INSTRUCCION_APP).toMatch(/localStorage/);
    expect(INSTRUCCION_APP).toMatch(/hash/);
    expect(INSTRUCCION_APP).toMatch(/manifest\.webmanifest/);
    expect(INSTRUCCION_APP).toMatch(/sin build ni CDN/);
  });

  it("amplía la skill web (no la sustituye) y la skill sigue mandando un solo archivo por defecto", () => {
    expect(INSTRUCCION_APP).toMatch(/Amplía la skill/);
    const web = BUILTIN_SKILLS.find((s) => s.id === "skill-web-dev");
    expect(web?.instructions).toMatch(/único archivo HTML/);
  });
});


describe("una respuesta en Modo App se monta en la vista previa", () => {
  const F = "```";
  const respuesta = [
    "Gestor de tareas con módulos.",
    `${F}html — index.html`,
    '<!doctype html><html lang="es"><head><link rel="stylesheet" href="styles.css"><link rel="manifest" href="manifest.webmanifest"></head><body><main id="vista"></main><script type="module" src="js/app.js"></script></body></html>',
    F,
    `${F}css — styles.css`,
    ":root{--acento:#f97316} body{color:var(--acento)}",
    F,
    `${F}js — js/store.js`,
    'export const CLAVE = "tareas:v1";\nexport function leer(){ try { return JSON.parse(localStorage.getItem(CLAVE) || "[]"); } catch { return []; } }',
    F,
    `${F}js — js/views/lista.js`,
    'import { leer } from "../store.js";\nexport function lista(el){ el.textContent = String(leer().length); }',
    F,
    `${F}js — js/app.js`,
    'import { lista } from "./views/lista.js";\nlista(document.getElementById("vista"));',
    F,
  ].join("\n");

  it("nombra cada archivo con su carpeta y enlaza el grafo de módulos", () => {
    const files = filesFromAnswer(respuesta);
    expect(files.map((f) => f.path).sort()).toEqual(["index.html", "js/app.js", "js/store.js", "js/views/lista.js", "styles.css"]);
    const html = bundlePreview(files.find((f) => f.path === "index.html")!.text, files);
    expect(html).toMatch(/importmap/);
    expect(html).toContain("--acento"); // CSS inlineado
    // los tres módulos viajan dentro del documento (no quedan como rutas sueltas)
    expect(html).not.toMatch(/src="js\/app\.js"/);
  });
});
