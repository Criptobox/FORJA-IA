import { describe, it, expect } from "vitest";
import { expandirIconos, iconoPorId } from "../../src/lib/forja/motor/iconos";
import { bundlePreview, filesFromAnswer } from "../../src/lib/forja/answer-files";

const pagina = (cuerpo: string) => `<!doctype html><html><head><title>x</title></head><body>${cuerpo}</body></html>`;
// un id que exista en el catálogo, sea cual sea
const ID = ["estrella", "pin", "reloj", "telefono"].find((i) => iconoPorId(i)) ?? "estrella";

describe("expandirIconos", () => {
  it("sustituye la marca por el SVG real y añade la CSS una vez", () => {
    const html = expandirIconos(pagina(`<p><i data-icono="${ID}"></i> Uno</p><p><i data-icono="${ID}" class="f-ico--acento"></i> Dos</p>`));
    expect(html.match(/<svg class="f-ico[^"]*"/g)?.length).toBe(2);
    expect(html).toContain('class="f-ico f-ico--acento"');
    expect(html).not.toContain("data-icono");
    expect(html.match(/<style>/g)?.length).toBe(1);
    expect(html.indexOf("<style>")).toBeLessThan(html.indexOf("</head>"));
  });

  it("con aria-label el icono es semántico; sin él, decorativo", () => {
    expect(expandirIconos(`<i data-icono="${ID}" aria-label="Valoración"></i>`)).toContain('role="img" aria-label="Valoración"');
    expect(expandirIconos(`<i data-icono="${ID}"></i>`)).toContain('aria-hidden="true"');
  });

  it("un id que no existe se deja tal cual, y sin marcas no cambia nada", () => {
    expect(expandirIconos('<i data-icono="no-existe-xyz"></i>')).toBe('<i data-icono="no-existe-xyz"></i>');
    const sin = pagina("<p>hola</p>");
    expect(expandirIconos(sin)).toBe(sin);
  });

  it("la vista previa, el ZIP y la revisión ven ya los SVG (filesFromAnswer y bundlePreview)", () => {
    const respuesta = `**index.html**\n\`\`\`html\n${pagina(`<i data-icono="${ID}"></i>`)}\n\`\`\``;
    expect(filesFromAnswer(respuesta)[0].text).toContain("<svg");
    expect(bundlePreview(pagina(`<i data-icono="${ID}"></i>`), [])).toContain("<svg");
  });
});
