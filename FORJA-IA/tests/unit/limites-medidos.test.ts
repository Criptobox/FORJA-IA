import { describe, expect, it } from "vitest";
import {
  VIGENCIA_MS,
  anotar,
  cabe,
  motivoNoCabe,
  type Limites,
} from "../../src/lib/prism/limites-medidos";

const AHORA = Date.parse("2026-09-06T12:00:00Z");
const K = "groq::qwen/qwen3.8-27b";

describe("recordar lo que un modelo rechazó por tamaño", () => {
  it("sin nada medido, todo cabe: esto aparta con pruebas, no con sospechas", () => {
    expect(cabe({}, K, 999_999, AHORA)).toBe(true);
  });

  it("con el número del proveedor, se usa el suyo", () => {
    const l: Limites = { [K]: { limite: 7000, rechazado: 21138, at: AHORA } };
    expect(cabe(l, K, 6999, AHORA)).toBe(true);
    expect(cabe(l, K, 7000, AHORA)).toBe(true);
    expect(cabe(l, K, 7001, AHORA)).toBe(false);
  });

  it("sin número, solo se descarta lo igual de grande o más", () => {
    // Prohibir por debajo sería inventarse un límite que nadie dijo.
    const l: Limites = { [K]: { limite: null, rechazado: 20_000, at: AHORA } };
    expect(cabe(l, K, 19_999, AHORA)).toBe(true);
    expect(cabe(l, K, 20_000, AHORA)).toBe(false);
  });

  it("caduca: muchos de estos topes son por minuto y se reponen", () => {
    const l: Limites = { [K]: { limite: 7000, rechazado: 21138, at: AHORA } };
    expect(cabe(l, K, 99_999, AHORA + VIGENCIA_MS + 1)).toBe(true);
  });

  it("dos negativas seguidas no pueden ampliar el límite", () => {
    const previo = { limite: 7000, rechazado: 21138, at: AHORA };
    const nuevo = anotar(previo, { limite: 12_000, rechazado: 30_000, at: AHORA + 1000 }, AHORA + 1000);
    expect(nuevo.limite).toBe(7000);
    expect(nuevo.rechazado).toBe(21138);
  });

  it("pero una medición de otra época empieza de cero", () => {
    const previo = { limite: 7000, rechazado: 21138, at: AHORA };
    const t = AHORA + VIGENCIA_MS + 1;
    expect(anotar(previo, { limite: 12_000, rechazado: 30_000, at: t }, t).limite).toBe(12_000);
  });

  it("el aviso dice el número cuando el proveedor lo dio, y no lo inventa cuando no", () => {
    expect(motivoNoCabe({ limite: 7000, rechazado: 21138, at: AHORA }, "qwen")).toMatch(/7/);
    expect(motivoNoCabe({ limite: null, rechazado: 21138, at: AHORA }, "qwen")).toMatch(/ya rechazó/);
    expect(motivoNoCabe(undefined, "qwen")).toMatch(/rechazó/);
  });
});
