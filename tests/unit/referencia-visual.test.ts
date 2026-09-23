import { describe, expect, it } from "vitest";
import { instruccionReferencia, pideDisenoDeReferencia } from "../../src/lib/forja/referencia-visual";

describe("pideDisenoDeReferencia", () => {
  it("sin imagen nunca", () => {
    expect(pideDisenoDeReferencia("hazla como esta", 0)).toBe(false);
  });
  it("con imagen y un encargo de diseño o una referencia explícita", () => {
    expect(pideDisenoDeReferencia("hazme una landing como esta", 1)).toBe(true);
    expect(pideDisenoDeReferencia("inspirado en esta captura", 1)).toBe(true);
    expect(pideDisenoDeReferencia("crea el dashboard", 2)).toBe(true);
  });
  it("una imagen que no es de diseño no se trata como referencia", () => {
    expect(pideDisenoDeReferencia("¿qué planta es esta?", 1)).toBe(false);
    expect(pideDisenoDeReferencia("traduce el texto de la foto", 1)).toBe(false);
  });
});

describe("instruccionReferencia", () => {
  const t = instruccionReferencia(2);
  it("usa el contrato del Vision Designer y cuenta las referencias", () => {
    expect(t).toContain("[FORJA VISION DESIGNER]");
    expect(t).toContain("REFERENCIAS: 2");
  });
  it("pide leer antes de construir, no copiar y sacar tokens de :root", () => {
    expect(t).toMatch(/Lectura de la referencia/);
    expect(t).toMatch(/nada de copiar sus textos, marca, logos/);
    expect(t).toMatch(/:root/);
  });
});
