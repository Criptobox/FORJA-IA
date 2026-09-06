import { describe, expect, it } from "vitest";
import {
  avisoModelo,
  cuantosRetirados,
  diasDeLaFoto,
  estadoModelo,
  retiradoEl,
  type TablaRetirados,
} from "../../src/lib/prism/modelos-viejos";
import { RETIRADOS } from "../../src/lib/prism/modelos-datos";
import { PROVIDERS } from "../../src/lib/prism/providers";

const TABLA: TablaRetirados = {
  xai: { "grok-3": "2026-05-15" },
  gemini: { "gemini-3-pro-preview": "2027-01-01" },
};
const HOY = "2026-09-06";

describe("saber si un modelo está muerto", () => {
  it("lo que ya pasó es «retirado»", () => {
    expect(estadoModelo("xai", "grok-3", HOY, TABLA)).toEqual({
      estado: "retirado",
      fecha: "2026-05-15",
    });
  });

  it("lo que está anunciado avisa ANTES, que es cuando sirve", () => {
    expect(estadoModelo("gemini", "gemini-3-pro-preview", HOY, TABLA).estado).toBe("se-retira");
  });

  it("lo que el catálogo no menciona es «vivo», que aquí significa «no consta»", () => {
    expect(estadoModelo("xai", "grok-9000", HOY, TABLA).estado).toBe("vivo");
    expect(retiradoEl("proveedor-desconocido", "x", TABLA)).toBeNull();
  });

  it("encuentra el modelo aunque venga decorado por la pasarela", () => {
    expect(retiradoEl("xai", "GROK-3", TABLA)).toBe("2026-05-15");
    expect(retiradoEl("xai", "xai/grok-3:free", TABLA)).toBe("2026-05-15");
  });

  it("el aviso solo sale cuando hay algo que decir", () => {
    expect(avisoModelo("xai", "grok-3", HOY, TABLA)).toMatch(/retirado el 2026-05-15/);
    expect(avisoModelo("gemini", "gemini-3-pro-preview", HOY, TABLA)).toMatch(/anunciada/);
    expect(avisoModelo("xai", "grok-4.6", HOY, TABLA)).toBeNull();
  });

  it("cuenta cuántos de una lista están muertos", () => {
    expect(cuantosRetirados("xai", ["grok-3", "grok-4.6"], HOY, TABLA)).toBe(1);
  });

  it("la edad de la foto se cuenta en días y nunca es negativa", () => {
    expect(diasDeLaFoto("2026-09-01", Date.parse("2026-09-06T12:00:00Z"))).toBe(5);
    expect(diasDeLaFoto("2026-09-30", Date.parse("2026-09-06T12:00:00Z"))).toBe(0);
    expect(diasDeLaFoto("no es fecha", Date.now())).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("las listas que la app ofrece", () => {
  /** La razón de ser de todo esto: la app ofrecía ocho modelos que sus
   * proveedores ya habían retirado, y nadie se enteraba hasta el 404. Esta
   * prueba es la que impide que vuelva a pasar en silencio. */
  it("NINGÚN modelo ofrecido consta retirado en el catálogo", () => {
    const hoy = new Date().toISOString().slice(0, 10);
    const muertos: string[] = [];
    for (const p of PROVIDERS) {
      for (const m of p.defaultModels ?? []) {
        const { estado, fecha } = estadoModelo(p.id, m, hoy, RETIRADOS);
        if (estado === "retirado") muertos.push(`${p.id}::${m} (retirado el ${fecha})`);
      }
    }
    expect(muertos, "ejecuta «npm run modelos» para ver qué poner en su lugar").toEqual([]);
  });

  it("la tabla de retirados no está vacía: si lo estuviera, la prueba de arriba no probaría nada", () => {
    expect(Object.keys(RETIRADOS).length).toBeGreaterThan(0);
  });
});
