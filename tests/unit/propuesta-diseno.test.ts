import { describe, it, expect } from "vitest";
import {
  construirPropuesta,
  datosPendientes,
  debeProponer,
  instruccionPendientes,
} from "../../src/lib/forja/propuesta-diseno";

const base = { hayDireccionFijada: false, pideCambioDeEstilo: false, imagenes: 0, activada: true };

describe("debeProponer", () => {
  it("propone en una web nueva", () => {
    expect(debeProponer({ ...base, texto: "hazme una landing para una cafetería en Cádiz" })).toBe(true);
  });

  it("no propone en retoques, apps, con referencia, «directo», apagada o con identidad fijada", () => {
    expect(debeProponer({ ...base, texto: "cambia el color del botón" })).toBe(false);
    expect(debeProponer({ ...base, texto: "crea una app de lista de tareas" })).toBe(false);
    expect(debeProponer({ ...base, texto: "hazme una landing como esta", imagenes: 1 })).toBe(false);
    expect(debeProponer({ ...base, texto: "hazme una landing directo" })).toBe(false);
    expect(debeProponer({ ...base, texto: "hazme una landing", activada: false })).toBe(false);
    expect(debeProponer({ ...base, texto: "hazme una landing", hayDireccionFijada: true })).toBe(false);
  });

  it("con identidad fijada, sí propone si se pide otro estilo", () => {
    expect(
      debeProponer({ ...base, texto: "hazme una web nueva con otro estilo", hayDireccionFijada: true, pideCambioDeEstilo: true })
    ).toBe(true);
  });
});

describe("construirPropuesta", () => {
  it("tres direcciones distintas, la recomendada primero, y es determinista", () => {
    const a = construirPropuesta("hazme una landing para una cafetería en Cádiz");
    const b = construirPropuesta("hazme una landing para una cafetería en Cádiz");
    expect(a).toEqual(b);
    expect(a.variantes).toHaveLength(3);
    expect(new Set(a.variantes.map((v) => v.id)).size).toBe(3);
    expect(a.variantes[0].recomendada).toBe(true);
    expect(a.secciones.length).toBeGreaterThan(2);
  });

  it("si el encargo pide un estilo, esa va primero y se marca como pedida", () => {
    const p = construirPropuesta("hazme una landing minimalista para mi estudio");
    expect(p.variantes[0].id).toBe("minimal");
    expect(p.variantes[0].pedidaPorElUsuario).toBe(true);
  });

  it("evita las direcciones recientes en las alternativas", () => {
    const p = construirPropuesta("hazme una web para mi negocio", ["editorial", "tech"]);
    const alternativas = p.variantes.slice(1).map((v) => v.id);
    expect(alternativas).not.toContain("editorial");
    expect(alternativas).not.toContain("tech");
  });

  it("separa los datos dados de los que faltan, y los que faltan no se inventan", () => {
    const p = construirPropuesta("hazme una web para mi barbería en Sevilla, teléfono 955 123 456");
    expect(p.datos.find((d) => d.campo === "Teléfono")?.valor).toContain("955");
    const faltan = datosPendientes(p);
    expect(faltan).toContain("correo");
    expect(faltan).not.toContain("teléfono");
    expect(instruccionPendientes(faltan)).toMatch(/nunca un número, correo o dirección inventados/);
    expect(instruccionPendientes([])).toBeNull();
  });
});
