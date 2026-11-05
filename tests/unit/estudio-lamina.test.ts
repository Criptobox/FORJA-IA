import { describe, expect, it } from "vitest";
import { columnasPara, disposicionLamina, factorDeReduccion, LADO_MAXIMO } from "../../src/lib/forja/estudio/lamina";

const O = { columnas: 3, margen: 10, hueco: 5, cabecera: 20, pie: 8 };

describe("estudio · lámina del lienzo", () => {
  it("columnas: las pantallas estrechas van más juntas, las anchas menos, nunca más que pantallas", () => {
    expect(columnasPara(8, 390)).toBe(4);
    expect(columnasPara(8, 768)).toBe(3);
    expect(columnasPara(8, 1280)).toBe(2);
    expect(columnasPara(2, 390)).toBe(2);
    expect(columnasPara(1, 1280)).toBe(1);
    expect(columnasPara(0, 390)).toBe(1);
  });

  it("coloca en filas de izquierda a derecha y mide lo justo", () => {
    const d = disposicionLamina(
      [
        { ancho: 100, alto: 200 },
        { ancho: 100, alto: 200 },
        { ancho: 100, alto: 200 },
        { ancho: 100, alto: 200 },
      ],
      O
    );
    // fila 1: x = 10, 115, 220; fila 2 vuelve a x = 10
    expect(d.celdas.map((c) => c.x)).toEqual([10, 115, 220, 10]);
    // y: margen + cabecera = 30; la fila siguiente, 30 + 200 + pie 8 + hueco 5
    expect(d.celdas.map((c) => c.y)).toEqual([30, 30, 30, 243]);
    expect(d.ancho).toBe(10 + 3 * 100 + 2 * 5 + 10);
    expect(d.alto).toBe(10 + 20 + 2 * (200 + 8) + 5 + 10);
  });

  it("una fila mide lo que su pantalla más alta, y las demás quedan alineadas arriba", () => {
    const d = disposicionLamina(
      [
        { ancho: 100, alto: 300 },
        { ancho: 100, alto: 120 },
        { ancho: 100, alto: 100 },
      ],
      { ...O, columnas: 2 }
    );
    expect(d.celdas[1].y).toBe(d.celdas[0].y);
    expect(d.celdas[2].y).toBe(30 + 300 + 8 + 5);
  });

  it("con menos pantallas que columnas no deja huecos vacíos a la derecha", () => {
    const d = disposicionLamina([{ ancho: 100, alto: 100 }, { ancho: 100, alto: 100 }], O);
    expect(d.ancho).toBe(10 + 100 + 5 + 100 + 10);
  });

  it("si es demasiado grande se reduce en proporción, no falla", () => {
    expect(factorDeReduccion(1000, 2000)).toBe(1);
    expect(factorDeReduccion(4000, 16_000)).toBe(LADO_MAXIMO / 16_000);
    expect(factorDeReduccion(20_000, 100)).toBe(LADO_MAXIMO / 20_000);
  });
});
