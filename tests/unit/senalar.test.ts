import { describe, expect, it } from "vitest";
import { agregarSenalado, ampliarASeccion, etiquetaCorta, MAX_SENALADOS, normalizarSenalado, textoParaModelo } from "../../src/lib/forja/senalar";

const crudo = {
  etiqueta: "BUTTON",
  selector: "body > main > form > button",
  texto: "  Añadir   tarea ",
  html: '<button type="submit">Añadir tarea</button>',
  seccion: { etiqueta: "form", selector: "body > main > form", texto: "Nueva tarea Añadir", html: "<form>…</form>" },
};

describe("normalizarSenalado", () => {
  it("valida, normaliza espacios y conserva el apartado", () => {
    const e = normalizarSenalado(crudo, "a")!;
    expect(e.etiqueta).toBe("button");
    expect(e.texto).toBe("Añadir tarea");
    expect(e.seccion?.etiqueta).toBe("form");
  });
  it("rechaza lo que no parece un elemento", () => {
    expect(normalizarSenalado(null, "a")).toBeNull();
    expect(normalizarSenalado({ ...crudo, etiqueta: "<script>" }, "a")).toBeNull();
    expect(normalizarSenalado({ ...crudo, selector: "" }, "a")).toBeNull();
  });
  it("recorta el HTML largo y lo dice", () => {
    const e = normalizarSenalado({ ...crudo, html: "x".repeat(5000) }, "a")!;
    expect(e.html.length).toBeLessThan(1700);
    expect(e.html).toMatch(/recortado: 3500 caracteres más/);
  });
});

describe("lista y etiquetas", () => {
  it("no repite el mismo elemento y tiene tope", () => {
    const e = normalizarSenalado(crudo, "a")!;
    expect(agregarSenalado([e], { ...e, id: "b" })).toHaveLength(1);
    let l: ReturnType<typeof agregarSenalado> = [];
    for (let i = 0; i < 8; i++) l = agregarSenalado(l, { ...e, id: String(i), selector: `#x${i}` });
    expect(l).toHaveLength(MAX_SENALADOS);
    expect(l[l.length - 1].selector).toBe("#x7");
  });
  it("ampliar sube al apartado y conserva el id", () => {
    const e = normalizarSenalado(crudo, "a")!;
    const s = ampliarASeccion(e);
    expect(s).toMatchObject({ id: "a", etiqueta: "form", selector: "body > main > form" });
    expect(s.seccion).toBeUndefined();
  });
  it("la etiqueta corta es legible", () => {
    expect(etiquetaCorta(normalizarSenalado(crudo, "a")!)).toBe("<button> «Añadir tarea»");
  });
});

describe("textoParaModelo", () => {
  it("lleva selector, texto y HTML, y pide conservar el resto", () => {
    const t = textoParaModelo([normalizarSenalado(crudo, "a")!]);
    expect(t).toContain("Selector: `body > main > form > button`");
    expect(t).toContain("«Añadir tarea»");
    expect(t).toContain('<button type="submit">Añadir tarea</button>');
    expect(t).toMatch(/conserva igual el resto/);
  });
  it("vacío no añade nada", () => {
    expect(textoParaModelo([])).toBe("");
  });
});
