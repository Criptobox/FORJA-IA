import { describe, it, expect } from "vitest";
import { esEncargoDeCreacion, progresoCreacion } from "../../src/lib/forja/progreso-creacion";

const encargo = "hazme una landing para mi cafetería en Cádiz";
const estados = (p: ReturnType<typeof progresoCreacion>) => p.pasos.map((x) => `${x.id}:${x.estado}`);

describe("esEncargoDeCreacion", () => {
  it("una web o una app sí; un saludo, una pregunta o un retoque no", () => {
    expect(esEncargoDeCreacion(encargo)).toBe(true);
    expect(esEncargoDeCreacion("crea una app de inventario")).toBe(true);
    expect(esEncargoDeCreacion("hola")).toBe(false);
    expect(esEncargoDeCreacion("¿qué es flexbox?")).toBe(false);
    expect(esEncargoDeCreacion("cambia el botón a verde")).toBe(false);
  });
});

describe("progresoCreacion", () => {
  it("antes del primer carácter: pensando, con el plano previsto en el encargo", () => {
    const p = progresoCreacion({ encargo, contenido: "", streaming: true, modelo: "groq::llama-3.3-70b" });
    expect(estados(p)).toEqual(["encargo:done", "modelo:done", "pensando:running", "escribiendo:pending", "entrega:pending"]);
    expect(p.loader).toBe("pensando");
    expect(p.actual).toBe(2);
    expect(p.pasos[0].meta).toMatch(/L3 · feature · \d+ secciones previstas/);
    expect(p.pasos[1].meta).toBe("llama-3.3-70b");
  });

  it("escribiendo: enseña los archivos que van saliendo y las secciones escritas", () => {
    const contenido = "Aquí va:\n\n**index.html**\n```html\n<!doctype html><section>a</section><section>b</section>\n```\n\n**styles.css**\n```css\nbody{}";
    const p = progresoCreacion({ encargo, contenido, streaming: true, modelo: "x::y" });
    expect(estados(p)).toEqual(["encargo:done", "modelo:done", "pensando:done", "escribiendo:running", "entrega:pending"]);
    expect(p.loader).toBe("trabajando");
    expect(p.archivos).toEqual(["index.html", "styles.css"]);
    expect(p.pasos[3].meta).toMatch(/^index\.html · styles\.css ✎ · 2 de \d+ secciones · ~\d+ tokens$/);
  });

  it("terminado: todo hecho, con tiempo y tokens reales; FORJA WEB no nombra al proveedor", () => {
    const p = progresoCreacion({
      encargo,
      contenido: "**index.html**\n```html\n<p>x</p>\n```",
      streaming: false,
      modelo: "kimi::k3",
      ocultarModelo: true,
      final: { ms: 12400, tokensSalida: 4100 },
    });
    expect(p.terminado).toBe(true);
    expect(p.pasos.every((x) => x.estado === "done")).toBe(true);
    expect(p.loader).toBe("finalizado");
    expect(p.pasos[1].meta).toBe("Forja IA");
    expect(p.pasos[4].meta).toBe("12,4 s · 4100 tokens") // en español, 4 cifras no se agrupan;
    expect(p.pasos[3].meta).not.toContain("✎");
  });
});
