import { describe, it, expect } from "vitest";
import { hallazgosQA, hayQueCorregirQA, promptDeQA, resumenQA } from "../../src/lib/forja/qa-responsive";
import type { QAResult } from "../../src/lib/forja/visual-qa";

const qa = (items: QAResult["items"], extra: Partial<QAResult> = {}): QAResult => ({ width: 390, ok: !items.length, items, at: 0, ...extra });

describe("hallazgosQA", () => {
  it("agrupa por tipo, cuenta, y ordena de más a menos grave", () => {
    const h = hallazgosQA(
      qa([
        { tipo: "toque-pequeno", detalle: "a.icono 16×16" },
        { tipo: "contraste", detalle: "p.suave 2.1:1" },
        { tipo: "contraste", detalle: "span.nota 3.0:1" },
        { tipo: "scroll", detalle: "documento 612px > 390px" },
      ])
    );
    expect(h.map((x) => x.tipo)).toEqual(["scroll", "contraste", "toque-pequeno"]);
    expect(h[1].veces).toBe(2);
    expect(h[1].ejemplos).toEqual(["p.suave 2.1:1", "span.nota 3.0:1"]);
    expect(resumenQA(h)).toBe("Scroll horizontal · Contraste ×2 · Objetivo de toque pequeño");
  });

  it("sin medida, o si el medidor no respondió, no inventa nada", () => {
    expect(hallazgosQA(null)).toEqual([]);
    expect(hallazgosQA(qa([{ tipo: "scroll", detalle: "x" }], { noRespondio: true }))).toEqual([]);
  });
});

describe("qué dispara una corrección", () => {
  it("scroll, fuera de pantalla, sin nombre y contraste sí", () => {
    for (const tipo of ["scroll", "fuera", "sin-nombre", "contraste"] as const) {
      expect(hayQueCorregirQA(hallazgosQA(qa([{ tipo, detalle: "d" }]))), tipo).toBe(true);
    }
  });

  it("texto pequeño, sin alt o toque pequeño solos no gastan una llamada", () => {
    expect(hayQueCorregirQA(hallazgosQA(qa([{ tipo: "texto", detalle: "d" }, { tipo: "sin-alt", detalle: "d" }, { tipo: "toque-pequeno", detalle: "d" }])))).toBe(false);
  });

  it("la corrección lleva lo medido y la regla, y deja fuera lo de severidad baja", () => {
    const p = promptDeQA(
      hallazgosQA(qa([{ tipo: "scroll", detalle: "documento 612px > 390px" }, { tipo: "toque-pequeno", detalle: "a 16×16" }])),
      390,
      "index.html"
    );
    expect(p).toContain("390 px");
    expect(p).toContain("documento 612px > 390px");
    expect(p).toMatch(/max-width/);
    expect(p).not.toContain("toque");
  });
});
