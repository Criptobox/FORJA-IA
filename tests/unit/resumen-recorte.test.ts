import { describe, expect, it } from "vitest";
import {
  MARCA_RESUMEN,
  MAX_CHARS_A_RESUMIR,
  MIN_CHARS_PARA_RESUMIR,
  esResumen,
  mereceResumen,
  notaDeResumen,
  promptDeResumen,
  resumenUtil,
  textoDelTramo,
} from "../../src/lib/forja/resumen-recorte";

const msg = (role: string, n: number, c = "x") => ({ role, content: c.repeat(n) });

describe("cuándo merece la pena resumir", () => {
  it("un tramo minúsculo no: el encabezado ocuparía casi lo mismo", () => {
    expect(mereceResumen([msg("user", 50)])).toBe(false);
  });

  it("un tramo largo sí", () => {
    expect(mereceResumen([msg("user", MIN_CHARS_PARA_RESUMIR + 1)])).toBe(true);
  });

  it("un resumen NO se vuelve a resumir: cada pasada pierde algo", () => {
    const yaResumen = { role: "user", content: MARCA_RESUMEN + "\n" + "y".repeat(5000) };
    expect(esResumen(yaResumen)).toBe(true);
    expect(mereceResumen([yaResumen])).toBe(false);
  });

  it("nada que resumir con la lista vacía", () => {
    expect(mereceResumen([])).toBe(false);
  });
});

describe("el texto que se le manda al modelo", () => {
  it("etiqueta quién dijo qué", () => {
    const t = textoDelTramo([msg("user", 3, "a"), msg("assistant", 3, "b")]);
    expect(t).toContain("Usuario: aaa");
    expect(t).toContain("Asistente: bbb");
  });

  it("si el tramo es gigantesco se recorta por el PRINCIPIO", () => {
    // lo más viejo de lo viejo es lo que menos falta hace
    const t = textoDelTramo([msg("user", MAX_CHARS_A_RESUMIR * 2, "a"), msg("user", 20, "z")]);
    expect(t.length).toBeLessThanOrEqual(MAX_CHARS_A_RESUMIR + 40);
    expect(t.endsWith("z".repeat(20))).toBe(true);
    expect(t).toContain("recortado");
  });

  it("la instrucción pide hechos y prohíbe adornos", () => {
    const p = promptDeResumen("hola");
    expect(p).toMatch(/Solo hechos/);
    expect(p).toMatch(/pendiente/);
    expect(p).toMatch(/200 palabras/);
  });
});

describe("la nota que ocupa el hueco", () => {
  it("va marcada como resumen: no se le ponen palabras en la boca a nadie", () => {
    const n = notaDeResumen("- se decidió X", 7);
    expect(n.content.startsWith(MARCA_RESUMEN)).toBe(true);
    expect(n.content).toContain("7 mensaje(s)");
    expect(n.content).toContain("- se decidió X");
    expect(esResumen(n)).toBe(true);
  });

  it("y se distingue de lo literal que viene detrás", () => {
    expect(notaDeResumen("x".repeat(60), 2).content).toMatch(/literales/);
  });
});

describe("resúmenes que no sirven", () => {
  it("uno vacío o de dos palabras es peor que ninguno: ocupa y no dice nada", () => {
    expect(resumenUtil("")).toBe(false);
    expect(resumenUtil("   ")).toBe(false);
    expect(resumenUtil("ok")).toBe(false);
    expect(resumenUtil("- se acordó el nombre Lumina y la paleta violeta/cian")).toBe(true);
  });
});
