import { describe, expect, it } from "vitest";
import { archivosEditables, filesFromAnswer, reemplazarArchivo } from "../../src/lib/forja/answer-files";

const RESP = [
  "Aquí va.",
  "```html — index.html",
  "<h1>Hola</h1>",
  "```",
  "```css — styles.css",
  "h1{color:red}",
  "```",
  "y una corrección:",
  "```css — styles.css",
  "h1{color:blue}",
  "```",
].join("\n");

describe("editar un archivo de la respuesta", () => {
  it("lista cada archivo una vez, con su última versión", () => {
    expect(archivosEditables(RESP)).toEqual([
      { path: "index.html", text: "<h1>Hola</h1>" },
      { path: "styles.css", text: "h1{color:blue}" },
    ]);
  });
  it("cambia el último bloque de ese archivo y deja el resto igual", () => {
    const r = reemplazarArchivo(RESP, "styles.css", "h1{color:green}\n");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.contenido).toContain("h1{color:red}");
    expect(r.contenido).toContain("h1{color:green}");
    expect(r.contenido).not.toContain("h1{color:blue}");
    expect(filesFromAnswer(r.contenido).find((f) => f.path === "styles.css")?.text).toBe("h1{color:green}");
    expect(filesFromAnswer(r.contenido).find((f) => f.path === "index.html")?.text).toBe("<h1>Hola</h1>");
  });
  it("no rompe la respuesta con ``` dentro ni inventa archivos", () => {
    expect(reemplazarArchivo(RESP, "styles.css", "a ``` b").ok).toBe(false);
    expect(reemplazarArchivo(RESP, "app.js", "x").ok).toBe(false);
  });
});
