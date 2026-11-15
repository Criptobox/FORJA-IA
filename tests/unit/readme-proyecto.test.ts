import { describe, expect, it } from "vitest";
import { faltaReadme, readmeDelProyecto } from "../../src/lib/forja/readme-proyecto";

describe("README del ZIP", () => {
  const paths = ["index.html", "styles.css", "js/app.js", "js/store.js", "js/views/inicio.js", "manifest.webmanifest"];
  it("explica cómo verlo (módulos → servidor local) y qué es cada archivo", () => {
    const r = readmeDelProyecto("Tareas", paths);
    expect(r).toContain("# Tareas");
    expect(r).toContain("npx serve");
    expect(r).toContain("`js/store.js` — los datos");
    expect(r).toContain("`js/views/inicio.js` — una pantalla");
    expect(r).toContain("netlify");
  });
  it("un HTML suelto solo se abre en el navegador", () => {
    const r = readmeDelProyecto("", ["index.html"]);
    expect(r).toContain("# Mi proyecto");
    expect(r).not.toContain("npx serve");
  });
  it("no pisa un README de la IA", () => {
    expect(faltaReadme(["index.html", "README.md"])).toBe(false);
    expect(faltaReadme(["index.html"])).toBe(true);
  });
});
