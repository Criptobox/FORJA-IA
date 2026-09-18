import { describe, it, expect } from "vitest";
import {
  accesibilidadEstado,
  tituloPorDefecto,
  admiteAccion,
} from "../../src/lib/forja/estados";

/* La config de estados es el contrato a11y de TODOS los paneles: si un día
 * alguien cambia «error» a aria-live="off" «para que no moleste», este test es
 * lo que se lo impide. */

describe("estados — accesibilidad por variante", () => {
  it("cargando: status + polite (se entera sin interrumpir)", () => {
    expect(accesibilidadEstado("cargando")).toEqual({ rol: "status", ariaLive: "polite" });
  });

  it("error: alert + assertive (un fallo sí interrumpe)", () => {
    expect(accesibilidadEstado("error")).toEqual({ rol: "alert", ariaLive: "assertive" });
  });

  it("vacío: sin roles (es contenido, no un aviso; anunciado sería ruido)", () => {
    expect(accesibilidadEstado("vacio")).toEqual({ rol: null, ariaLive: null });
  });

  it("las tres variantes están cubiertas y ninguna devuelve rol sin aria-live", () => {
    for (const v of ["cargando", "error", "vacio"] as const) {
      const a = accesibilidadEstado(v);
      expect((a.rol === null) === (a.ariaLive === null)).toBe(true);
    }
  });
});

describe("estados — títulos por defecto y acciones", () => {
  it("ningún título por defecto viene vacío: el olvido no se pinta como hueco mudo", () => {
    for (const v of ["cargando", "error", "vacio"] as const) {
      expect(tituloPorDefecto(v).trim().length).toBeGreaterThan(0);
    }
  });

  it("cargando no admite botón de acción; error y vacío sí", () => {
    expect(admiteAccion("cargando")).toBe(false);
    expect(admiteAccion("error")).toBe(true);
    expect(admiteAccion("vacio")).toBe(true);
  });
});
