import { describe, it, expect } from "vitest";
import {
  hayFicha,
  lineasDeFicha,
  titularDeFicha,
  type FichaRespuesta,
} from "../../src/lib/forja/ficha-respuesta";

describe("ficha de respuesta", () => {
  it("una ficha vacía no tiene nada que enseñar", () => {
    expect(hayFicha(undefined)).toBe(false);
    expect(hayFicha({})).toBe(false);
    expect(lineasDeFicha({})).toEqual([]);
  });

  it("lo que no se sabe NO sale como línea", () => {
    const l = lineasDeFicha({ modelo: "Groq · x" });
    expect(l).toHaveLength(1);
    // nada de «sin dato» repartido por catorce filas
    expect(l.some((x) => x.valor.includes("sin dato"))).toBe(false);
  });

  it("los intentos fallidos salen con su código y su decisión", () => {
    const f: FichaRespuesta = {
      modelo: "Groq · b",
      intentos: [{ modelo: "a", proveedor: "OpenRouter", status: 404, decision: "siguiente" }],
    };
    const v = lineasDeFicha(f).find((x) => x.etiqueta === "Antes fallaron")?.valor ?? "";
    expect(v).toContain("a");
    expect(v).toContain("404");
    expect(v).toContain("siguiente");
  });

  it("un intento sin respuesta se dice, no se pinta como 0", () => {
    const v =
      lineasDeFicha({
        intentos: [{ modelo: "a", proveedor: "p", status: 0, decision: "failover" }],
      }).find((x) => x.etiqueta === "Antes fallaron")?.valor ?? "";
    expect(v).toContain("sin respuesta");
    expect(v).not.toContain("(0 ");
  });

  it("el dinero solo aparece con importe; si falta una mitad se dice cuál", () => {
    const con = lineasDeFicha({ coste: 0.00021, precioDe: "2026-09-01" });
    const linea = con.find((x) => x.etiqueta === "Coste estimado")?.valor ?? "";
    expect(linea).toContain("2026-09-01");
    expect(linea).not.toBe("");

    const sin = lineasDeFicha({
      sinCoste: "sin dato: este modelo no está en el catálogo de precios",
    });
    expect(sin.find((x) => x.etiqueta === "Coste estimado")?.valor).toContain("catálogo");
  });

  it("nunca hay importe sin la fuente del precio al lado", () => {
    // si algún día se guarda `coste` sin `precioDe`, esto lo caza
    const l = lineasDeFicha({ coste: 1, precioDe: "2026-09-01" });
    const v = l.find((x) => x.etiqueta === "Coste estimado")?.valor ?? "";
    expect(v).toMatch(/precios de \d{4}-\d{2}-\d{2}/);
  });

  it("el titular cuenta lo más llamativo que pasó", () => {
    expect(
      titularDeFicha({
        intentos: [
          { modelo: "a", proveedor: "p", status: 404, decision: "siguiente" },
          { modelo: "b", proveedor: "p", status: 429, decision: "siguiente" },
        ],
      })
    ).toContain("3º modelo");

    expect(titularDeFicha({ recortados: 4, resumido: true })).toContain("resumen");
    expect(titularDeFicha({ recortados: 4, resumido: false })).toContain("para que cupiera");
    expect(titularDeFicha({ tokensEntrada: 100, tokensCache: 300 })).toContain("75 %");
  });

  it("sin nada reseñable no se inventa titular", () => {
    expect(titularDeFicha({ modelo: "x", ms: 900 })).toBeNull();
  });

  it("los tokens se atribuyen al proveedor, no a nosotros", () => {
    const l = lineasDeFicha({ tokensEntrada: 10, tokensSalida: 5 });
    expect(l[0].etiqueta).toContain("dice el proveedor");
  });
});
