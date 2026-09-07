import { describe, expect, it } from "vitest";
import {
  MARGEN,
  avisoNoCabeNiRecortando,
  avisoRecorte,
  recortar,
  tokensDe,
} from "../../src/lib/prism/recorte-contexto";

const m = (role: string, chars: number, marca = "x") => ({ role, content: marca.repeat(chars) });

describe("recortar para que quepa", () => {
  it("si ya cabe, no toca nada", () => {
    const msgs = [m("user", 40)];
    const r = recortar(msgs, 1000);
    expect(r.quitados).toBe(0);
    expect(r.mensajes).toEqual(msgs);
    expect(r.cabe).toBe(true);
  });

  it("quita los más VIEJOS, que es donde sobra el contexto", () => {
    const msgs = [
      m("user", 4000, "a"),
      m("assistant", 4000, "b"),
      m("user", 4000, "c"),
      m("assistant", 4000, "d"),
      m("user", 40, "z"),
    ];
    const r = recortar(msgs, 2000); // objetivo = 1700 tokens
    expect(r.quitados).toBeGreaterThan(0);
    // el último (la pregunta viva) sigue estando y entero
    expect(r.mensajes[r.mensajes.length - 1].content).toBe("z".repeat(40));
    // y lo que sobrevive es la cola, no la cabeza
    expect(r.mensajes[0].content.startsWith("a")).toBe(false);
  });

  it("NUNCA se lleva la pregunta viva, aunque sea enorme", () => {
    const msgs = [m("assistant", 400, "a"), m("user", 80_000, "viva")];
    const r = recortar(msgs, 1000);
    expect(r.mensajes.some((x) => x.content.startsWith("viva"))).toBe(true);
    // y avisa de que ni así cabe, en vez de fingir que sí
    expect(r.cabe).toBe(false);
  });

  it("deja margen por debajo del límite: la medida es aproximada", () => {
    const msgs = [m("user", 4000, "a"), m("assistant", 4000, "b"), m("user", 40, "z")];
    const r = recortar(msgs, 1000);
    if (r.cabe) expect(r.tokens).toBeLessThanOrEqual(1000 * MARGEN);
  });

  it("quita turnos ENTEROS: nada de medias frases", () => {
    const msgs = [m("user", 8000, "a"), m("user", 40, "z")];
    const r = recortar(msgs, 100);
    for (const x of r.mensajes) {
      expect(x.content === "a".repeat(8000) || x.content === "z".repeat(40)).toBe(true);
    }
  });

  it("una lista vacía no revienta", () => {
    expect(recortar([], 100)).toEqual({ mensajes: [], quitados: 0, tokens: 0, cabe: true });
  });

  it("cuenta en tokens aproximados, como el resto de la app", () => {
    expect(tokensDe([m("user", 400)])).toBe(100);
  });
});

describe("lo que se le dice al usuario", () => {
  it("sin recorte no hay aviso: uno que sale siempre se deja de leer", () => {
    expect(avisoRecorte({ mensajes: [], quitados: 0, tokens: 0, cabe: true }, "x")).toBeNull();
  });

  it("con recorte se dice cuántos y que la pregunta va entera", () => {
    const a = avisoRecorte({ mensajes: [], quitados: 3, tokens: 10, cabe: true }, "qwen")!;
    expect(a).toMatch(/3 mensajes viejos/);
    expect(a).toMatch(/entera/);
  });

  it("y el callejón se dice distinto del apaño que funcionó", () => {
    expect(avisoNoCabeNiRecortando("qwen", 7000)).toMatch(/otro modelo/);
  });
});
