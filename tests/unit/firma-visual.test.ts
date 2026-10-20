import { describe, expect, it } from "vitest";
import { COLS_FIRMA, FILAS_FIRMA, compararFirmas, lineaVisual, type FirmaVisual } from "../../src/lib/forja/firma-visual";
import { compareRuns, resumenRegresion, type RunSnapshot } from "../../src/lib/forja/regression";

const lisa = (g = 255): FirmaVisual => ({ cols: COLS_FIRMA, filas: FILAS_FIRMA, gris: Array(COLS_FIRMA * FILAS_FIRMA).fill(g) });
function conFranja(desdeFila: number, hastaFila: number, g = 0): FirmaVisual {
  const f = lisa();
  for (let y = desdeFila; y < hastaFila; y++) for (let x = 0; x < COLS_FIRMA; x++) f.gris[y * COLS_FIRMA + x] = g;
  return f;
}

describe("compararFirmas", () => {
  it("iguales: 0 % y sin zonas", () => {
    expect(compararFirmas(lisa(), lisa())).toEqual({ cambio: 0, zonas: [] });
  });
  it("ignora el ruido por debajo del umbral (compresión JPEG)", () => {
    expect(compararFirmas(lisa(255), lisa(240))?.cambio).toBe(0);
  });
  it("mide cuánto cambió y dónde", () => {
    const d = compararFirmas(lisa(), conFranja(0, 12))!;
    expect(d.cambio).toBeCloseTo(12 / 48);
    expect(d.zonas).toEqual(["arriba"]);
    expect(compararFirmas(lisa(), conFranja(40, 48))!.zonas).toEqual(["abajo"]);
  });
  it("sin firma o de otro tamaño no se compara", () => {
    expect(compararFirmas(null, lisa())).toBeNull();
    expect(compararFirmas({ cols: 2, filas: 2, gris: [0, 0, 0, 0] }, lisa())).toBeNull();
  });
});

describe("lineaVisual", () => {
  it("dice el porcentaje y la zona, o por qué no compara", () => {
    expect(lineaVisual({ cambio: 0.25, zonas: ["arriba"] }, { antes: true, despues: true })).toBe("Aspecto: cambió un 25 % de la página (sobre todo arriba).");
    expect(lineaVisual({ cambio: 0, zonas: [] }, { antes: true, despues: true })).toBe("Aspecto: sin cambios visibles.");
    expect(lineaVisual(null, { antes: false, despues: true })).toMatch(/no hubo captura/);
  });
});

describe("la regresión incluye el aspecto", () => {
  const snap = (firma?: FirmaVisual): RunSnapshot => ({ at: 1, entry: "index.html", logs: [], qa: null, htmlBytes: 100, firma });
  it("con capturas en los dos lados", () => {
    const r = resumenRegresion(compareRuns(snap(lisa()), snap(conFranja(0, 16))));
    expect(r).toMatch(/Aspecto: cambió un 33 % de la página \(sobre todo arriba\)/);
  });
  it("sin capturas en ningún lado no mete ruido", () => {
    expect(resumenRegresion(compareRuns(snap(), snap()))).not.toMatch(/Aspecto/);
  });
});
