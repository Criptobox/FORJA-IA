import { describe, expect, it } from "vitest";
import { INSTRUCCION_VARIOS_ARCHIVOS, pideVariosArchivos } from "../../src/lib/prism/multi-archivo";

describe("pideVariosArchivos", () => {
  it("detecta cuando se pide explícitamente un proyecto para un repo", () => {
    expect(pideVariosArchivos("hazme un proyecto para un repo")).toBe(true);
    expect(pideVariosArchivos("súbelo a mi repositorio con varios archivos")).toBe(true);
    expect(pideVariosArchivos("quiero la estructura de carpetas de un proyecto real")).toBe(true);
  });

  it("una landing o app normal NO lo dispara: eso rompería la vista previa en vivo de siempre", () => {
    expect(pideVariosArchivos("hazme una landing para mi cafetería")).toBe(false);
    expect(pideVariosArchivos("crea una app de lista de tareas")).toBe(false);
    expect(pideVariosArchivos("")).toBe(false);
  });

  it("no distingue mayúsculas ni necesita la palabra exacta «archivos»", () => {
    expect(pideVariosArchivos("MÁNDAME UN PROYECTO completo")).toBe(true);
    expect(pideVariosArchivos("sepáralo en varios archivos, por favor")).toBe(true);
  });
});

describe("INSTRUCCION_VARIOS_ARCHIVOS", () => {
  it("pide los tres archivos separados y enlazados de verdad, sin dependencias de build", () => {
    expect(INSTRUCCION_VARIOS_ARCHIVOS).toContain("index.html");
    expect(INSTRUCCION_VARIOS_ARCHIVOS).toContain("styles.css");
    expect(INSTRUCCION_VARIOS_ARCHIVOS).toContain("app.js");
    expect(INSTRUCCION_VARIOS_ARCHIVOS).toMatch(/link rel="stylesheet"/);
    expect(INSTRUCCION_VARIOS_ARCHIVOS).toMatch(/script src="app\.js"/);
    expect(INSTRUCCION_VARIOS_ARCHIVOS).toMatch(/sin dependencias de build/i);
  });

  it("se presenta como AMPLIACIÓN de la skill, no como su sustituta", () => {
    expect(INSTRUCCION_VARIOS_ARCHIVOS).toMatch(/amplía la skill/i);
  });
});
