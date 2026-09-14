import { describe, expect, it } from "vitest";
import {
  EDIT_PILOT_SCRIPT,
  aplicarEdicionTexto,
  injectEditPilot,
} from "../../src/lib/prism/editar-preview";

describe("localizar y aplicar la edición en el código fuente", () => {
  it("sustituye el texto cuando aparece una sola vez", () => {
    const contenido = "```html\n<h1>Bienvenido</h1>\n<p>hola</p>\n```";
    const r = aplicarEdicionTexto(contenido, "Bienvenido", "Hola de nuevo");
    expect(r.ok).toBe(true);
    expect(r.contenido).toContain("<h1>Hola de nuevo</h1>");
    expect(r.contenido).not.toContain("Bienvenido");
  });

  it("se rechaza si el texto aparece más de una vez: no adivina cuál", () => {
    const contenido = "```html\n<button>Ver más</button><button>Ver más</button>\n```";
    const r = aplicarEdicionTexto(contenido, "Ver más", "Descubrir");
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/2 veces/);
    expect(r.motivo).toMatch(/Sandbox/);
  });

  it("se rechaza si no encuentra el texto: nunca corrompe el archivo a ciegas", () => {
    const contenido = "```html\n<h1>Otra cosa</h1>\n```";
    const r = aplicarEdicionTexto(contenido, "Esto no está", "Nuevo");
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/no se encontró/i);
  });

  it("prueba también la forma escapada: el navegador ya decodificó las entidades", () => {
    const contenido = "```html\n<p>Café &amp; Té</p>\n```";
    const r = aplicarEdicionTexto(contenido, "Café & Té", "Solo café");
    expect(r.ok).toBe(true);
    expect(r.contenido).toContain("<p>Solo café</p>");
  });

  it("el reemplazo también se escapa si hace falta: no rompe el HTML", () => {
    const contenido = "```html\n<p>hola</p>\n```";
    const r = aplicarEdicionTexto(contenido, "hola", "Tú & yo");
    expect(r.ok).toBe(true);
    // el nuevo texto se escribe como texto válido, no como HTML crudo
    expect(r.contenido).toContain("Tú &amp; yo");
    expect(r.contenido).not.toContain("Tú & yo</p>");
  });

  it("no hace nada si el texto no cambió", () => {
    const contenido = "```html\n<p>igual</p>\n```";
    const r = aplicarEdicionTexto(contenido, "igual", "igual");
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/no cambió/);
  });

  it("rechaza un texto vacío", () => {
    expect(aplicarEdicionTexto("<p>x</p>", "x", "  ").ok).toBe(false);
    expect(aplicarEdicionTexto("<p>x</p>", "", "y").ok).toBe(false);
  });

  it("solo toca la ÚNICA aparición, deja el resto del archivo intacto", () => {
    const contenido = "```html\n<h1>Uno</h1><p>Resto del texto que no se toca</p>\n```\n\nAquí tienes la web.";
    const r = aplicarEdicionTexto(contenido, "Uno", "Primero");
    expect(r.ok).toBe(true);
    expect(r.contenido).toContain("Resto del texto que no se toca");
    expect(r.contenido).toContain("Aquí tienes la web.");
  });
});

describe("el piloto de edición inyectado en la vista previa", () => {
  it("es JavaScript válido", () => {
    expect(() => new Function(EDIT_PILOT_SCRIPT)).not.toThrow();
  });

  it("es idempotente y solo edita hojas del árbol (nunca estructura)", () => {
    expect(EDIT_PILOT_SCRIPT).toContain("__prismEdit");
    expect(EDIT_PILOT_SCRIPT).toMatch(/children.*length > 0.*return false/);
  });

  it("escribe el cambio como texto, nunca como HTML", () => {
    // `textContent`, no `innerHTML`: es lo que impide que un tache de edición
    // inyecte una etiqueta.
    expect(EDIT_PILOT_SCRIPT).not.toMatch(/\.innerHTML\s*=/);
  });

  it("se inyecta una sola vez", () => {
    const html = "<html><body><h1>x</h1></body></html>";
    const una = injectEditPilot(html);
    expect(una).toContain("__prismEdit");
    const dos = injectEditPilot(una);
    expect(dos).toBe(una);
  });

  it("cabe en un documento sin </body>", () => {
    const html = "<h1>x</h1>";
    expect(injectEditPilot(html)).toContain("__prismEdit");
  });
});
