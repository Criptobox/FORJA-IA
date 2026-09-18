import { describe, expect, it } from "vitest";
import {
  esEncargoDeTiendaOCatalogo,
  INSTRUCCION_TIENDA_INTERACTIVA,
} from "../../src/lib/forja/catalogo-interactivo";

describe("esEncargoDeTiendaOCatalogo", () => {
  it("detecta tiendas, restaurantes y catálogos", () => {
    expect(esEncargoDeTiendaOCatalogo("hazme una tienda de ropa")).toBe(true);
    expect(esEncargoDeTiendaOCatalogo("quiero el menú de mi restaurante")).toBe(true);
    expect(esEncargoDeTiendaOCatalogo("una página para mi cafetería con carta de platos")).toBe(true);
    expect(esEncargoDeTiendaOCatalogo("catálogo de productos con carrito")).toBe(true);
    expect(esEncargoDeTiendaOCatalogo("app de pedidos a domicilio")).toBe(true);
    expect(esEncargoDeTiendaOCatalogo("un marketplace de artesanías")).toBe(true);
  });

  it("una landing normal, un blog o un portfolio NO lo disparan", () => {
    expect(esEncargoDeTiendaOCatalogo("hazme un portfolio para mi fotografía")).toBe(false);
    expect(esEncargoDeTiendaOCatalogo("una landing para mi startup de software")).toBe(false);
    expect(esEncargoDeTiendaOCatalogo("un blog de viajes")).toBe(false);
    expect(esEncargoDeTiendaOCatalogo("")).toBe(false);
  });

  it("no distingue mayúsculas", () => {
    expect(esEncargoDeTiendaOCatalogo("QUIERO UNA TIENDA ONLINE")).toBe(true);
  });
});

describe("INSTRUCCION_TIENDA_INTERACTIVA", () => {
  it("exige carrito, detalle de producto, checkout que termina y reseñas", () => {
    expect(INSTRUCCION_TIENDA_INTERACTIVA).toMatch(/carrito/i);
    expect(INSTRUCCION_TIENDA_INTERACTIVA).toMatch(/CLICABLE/);
    expect(INSTRUCCION_TIENDA_INTERACTIVA).toMatch(/checkout/i);
    expect(INSTRUCCION_TIENDA_INTERACTIVA).toMatch(/reseñas/i);
    expect(INSTRUCCION_TIENDA_INTERACTIVA).toMatch(/addEventListener/);
  });

  it("prohíbe explícitamente los botones decorativos sin manejador", () => {
    expect(INSTRUCCION_TIENDA_INTERACTIVA).toMatch(/sin manejador|sin acción/i);
  });
});
