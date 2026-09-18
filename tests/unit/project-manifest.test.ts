import { describe, it, expect } from "vitest";
import {
  MANIFEST,
  AREAS,
  capacidadesTotal,
  areaPorId,
  capacidadPorId,
  resumenManifest,
} from "../../src/lib/project-manifest";

/* El manifiesto es contrato: si un test de aquí falla, el JSON quedó mal
 * editado (id duplicado, descripción vacía) y todo lo que lo pinta — salud,
 * Inspector — enseñaría datos rotos sin enterarse. */

describe("project-manifest — integridad del JSON", () => {
  it("tiene nombre, descripción y al menos un área", () => {
    expect(MANIFEST.nombre).toBe("FORJA-IA");
    expect(MANIFEST.descripcion.length).toBeGreaterThan(20);
    expect(AREAS.length).toBeGreaterThanOrEqual(1);
  });

  it("no lleva versión: la versión vive SOLO en package.json", () => {
    // tenerla en dos sitios ya hizo que divergieran una vez
    expect(MANIFEST).not.toHaveProperty("version");
  });

  it("ids de área únicos y con forma de id (kebab, sin espacios)", () => {
    const ids = AREAS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it("ids de capacidad únicos en TODO el manifiesto (no solo por área)", () => {
    const caps = AREAS.flatMap((a) => a.capacidades.map((c) => c.id));
    expect(caps.length).toBeGreaterThanOrEqual(AREAS.length);
    expect(new Set(caps).size).toBe(caps.length);
  });

  it("toda área y capacidad tiene nombre e descripción con contenido", () => {
    for (const area of AREAS) {
      expect(area.nombre.trim().length).toBeGreaterThan(0);
      expect(area.icono.trim().length).toBeGreaterThan(0);
      for (const cap of area.capacidades) {
        expect(cap.nombre.trim().length, `cap ${area.id}/${cap.id}`).toBeGreaterThan(0);
        expect(cap.descripcion.trim().length, `cap ${area.id}/${cap.id}`).toBeGreaterThan(10);
      }
    }
  });
});

describe("project-manifest — helpers", () => {
  it("capacidadesTotal suma las de todas las áreas", () => {
    const sumaManual = AREAS.reduce((n, a) => n + a.capacidades.length, 0);
    expect(capacidadesTotal()).toBe(sumaManual);
    expect(capacidadesTotal()).toBeGreaterThan(10);
  });

  it("areaPorId encuentra «chat» y devuelve undefined para lo inexistente", () => {
    expect(areaPorId("chat")?.nombre).toBeTruthy();
    expect(areaPorId("no-existe")).toBeUndefined();
  });

  it("capacidadPorId busca en todas las áreas (roundtrip con el área dueña)", () => {
    const cap = capacidadPorId("sandbox");
    expect(cap).toBeDefined();
    const duena = AREAS.find((a) => a.capacidades.some((c) => c.id === "sandbox"));
    expect(duena?.capacidades.map((c) => c.id)).toContain("sandbox");
    expect(capacidadPorId("no-existe")).toBeUndefined();
  });

  it("resumenManifest es una línea con nombre, áreas y capacidades", () => {
    const r = resumenManifest();
    expect(r).toContain("FORJA-IA");
    expect(r).toContain(String(AREAS.length));
    expect(r).toContain(String(capacidadesTotal()));
    expect(r.split("\n")).toHaveLength(1);
  });
});
