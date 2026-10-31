import { describe, it, expect } from "vitest";
import { indiceRadioTrasTecla } from "../../src/lib/forja/radio-teclado";

describe("indiceRadioTrasTecla", () => {
  it("las flechas avanzan y retroceden dando la vuelta", () => {
    expect(indiceRadioTrasTecla("ArrowRight", 0, 3)).toBe(1);
    expect(indiceRadioTrasTecla("ArrowDown", 2, 3)).toBe(0);
    expect(indiceRadioTrasTecla("ArrowLeft", 0, 3)).toBe(2);
    expect(indiceRadioTrasTecla("ArrowUp", 1, 3)).toBe(0);
  });

  it("Inicio y Fin van a los extremos", () => {
    expect(indiceRadioTrasTecla("Home", 2, 3)).toBe(0);
    expect(indiceRadioTrasTecla("End", 0, 3)).toBe(2);
  });

  it("sin opción elegida, las flechas parten de la primera", () => {
    expect(indiceRadioTrasTecla("ArrowRight", -1, 3)).toBe(1);
  });

  it("las demás teclas no son del grupo", () => {
    expect(indiceRadioTrasTecla("Tab", 0, 3)).toBeNull();
    expect(indiceRadioTrasTecla("Enter", 0, 3)).toBeNull();
    expect(indiceRadioTrasTecla("ArrowRight", 0, 0)).toBeNull();
  });
});
