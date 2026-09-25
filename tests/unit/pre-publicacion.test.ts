import { describe, it, expect } from "vitest";
import { datosPendientes, puertaPublicacion } from "../../src/lib/forja/pre-publicacion";
import { verifyWebProject } from "../../src/lib/forja/web-verifier";

const pagina = (cuerpo: string, head = "") =>
  `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Café La Ola</title><meta name="description" content="Café de especialidad en Cádiz">${head}</head><body><main><h1>Café La Ola</h1>${cuerpo}</main></body></html>`;
const sinErrores = { executed: true, errors: 0, errorLines: [], qa: { ok: true, items: [] } };
const etapa = (p: ReturnType<typeof puertaPublicacion>, id: string) => p.etapas.find((e) => e.id === id);

describe("puertaPublicacion", () => {
  it("una página sana pasa sin bloqueos, con las siete etapas en orden", () => {
    const files = { "index.html": pagina("<p>Desayunos hasta mediodía. Teléfono 956 123 456.</p>") };
    const p = puertaPublicacion(verifyWebProject(files, sinErrores), files["index.html"], datosPendientes(files));
    expect(p.etapas.map((e) => e.id)).toEqual(["build", "pruebas", "seguridad", "seo", "accesibilidad", "rendimiento", "datos"]);
    expect(p.bloquea).toBe(false);
    expect(etapa(p, "build")?.estado).toBe("ok");
    expect(etapa(p, "seguridad")?.estado).toBe("ok");
  });

  it("una clave en el código bloquea en Seguridad", () => {
    const files = { "index.html": pagina("<p>hola</p>"), "app.js": `const KEY = "${"s" + "k-"}abcdefghijklmnopqrstuvwxyz123456";` }; // por trozos: ver higiene-repo
    const p = puertaPublicacion(verifyWebProject(files, sinErrores), files["index.html"], []);
    expect(etapa(p, "seguridad")?.estado).toBe("bloquea");
    expect(p.bloquea).toBe(true);
  });

  it("un archivo local enlazado que no existe bloquea en Build", () => {
    const files = { "index.html": pagina('<p>hola</p><script src="app.js"></script>') };
    const p = puertaPublicacion(verifyWebProject(files, sinErrores), files["index.html"], []);
    expect(etapa(p, "build")?.estado).toBe("bloquea");
  });

  it("errores al ejecutarla bloquean en Pruebas; sin ejecución no hay dato, no un OK", () => {
    const files = { "index.html": pagina("<p>hola</p>") };
    const conErrores = puertaPublicacion(
      verifyWebProject(files, { executed: true, errors: 1, errorLines: ["TypeError: x is null"], qa: null }),
      files["index.html"],
      []
    );
    expect(etapa(conErrores, "pruebas")?.estado).toBe("bloquea");
    const sinEjecutar = puertaPublicacion(verifyWebProject(files), files["index.html"], []);
    expect(etapa(sinEjecutar, "pruebas")?.estado).toBe("sin-dato");
  });

  it("los datos pendientes avisan, no bloquean", () => {
    const files = { "index.html": pagina("<p>Teléfono: pendiente</p><p>Horario por confirmar</p>") };
    const pend = datosPendientes(files);
    expect(pend.length).toBe(2);
    const p = puertaPublicacion(verifyWebProject(files, sinErrores), files["index.html"], pend);
    expect(etapa(p, "datos")?.estado).toBe("aviso");
    expect(p.bloquea).toBe(false);
  });

  it("lo pendiente dentro de un <script> o un comentario no cuenta: solo lo que se ve", () => {
    expect(datosPendientes({ "index.html": pagina("<!-- pendiente --><script>// por confirmar</script><p>ok</p>") })).toEqual([]);
  });
});
