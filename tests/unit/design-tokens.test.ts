import { describe, it, expect } from "vitest";
import {
  ACCENTS,
  COLORES_SEMANTICOS,
  SUPERFICIES,
  WCAG,
  ANCHO_MINIMO,
  BREAKPOINTS,
  hexARgb,
  luminanciaRelativa,
  ratioContraste,
  esTextoGrande,
  nivelWcag,
  textoLegibleSobre,
  auditarContraste,
  acentosAuditados,
} from "../../src/lib/design-tokens";

/* Los tokens no son una lista de colores bonitos: son un contrato medible.
 * Cada test de aquí es una promesa WCAG que la app hace sobre sí misma — si
 * uno falla, alguien cambió un color sin mirar el número, y el Inspector
 * Visual lo va a cantar en producción. */

describe("design-tokens — matemática de contraste", () => {
  it("parsea hex corto, hex largo y rgb(), y rechaza lo que no entiende", () => {
    expect(hexARgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexARgb("#FFF")).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexARgb("#8b5cf6")).toEqual({ r: 139, g: 92, b: 246 });
    expect(hexARgb("rgb(139, 92, 246)")).toEqual({ r: 139, g: 92, b: 246 });
    expect(hexARgb("rgba(0,0,0,0.5)")).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexARgb("transparent")).toBeNull();
    expect(hexARgb("")).toBeNull();
    expect(hexARgb("rgb(300,0,0)")).toBeNull();
  });

  it("anclas del estándar: negro sobre blanco es 21 y un color consigo mismo es 1", () => {
    expect(ratioContraste("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(ratioContraste("#ffffff", "#000000")).toBeCloseTo(21, 1); // simétrico
    expect(ratioContraste("#8b5cf6", "#8b5cf6")).toBeCloseTo(1, 5);
    expect(luminanciaRelativa("#ffffff")).toBeCloseTo(1, 3);
    expect(luminanciaRelativa("#000000")).toBeCloseTo(0, 3);
  });

  it("devuelve null si alguno de los dos colores no se puede medir", () => {
    expect(ratioContraste("var(--algo)", "#ffffff")).toBeNull();
    expect(auditarContraste("currentColor", "#ffffff", 14, false)).toBeNull();
  });
});

describe("design-tokens — umbrales WCAG (1.4.3 / 1.4.6 / 1.4.11)", () => {
  it("texto grande solo a partir de 24px normal o 18.66px negrita", () => {
    expect(esTextoGrande(24, false)).toBe(true);
    expect(esTextoGrande(23.9, false)).toBe(false);
    expect(esTextoGrande(18.66, true)).toBe(true);
    expect(esTextoGrande(18.5, true)).toBe(false);
    // la negrita NO baja el umbral para texto normal
    expect(esTextoGrande(18.66, false)).toBe(false);
  });

  it("nivelWcag clasifica AAA / AA / falla según texto normal o grande", () => {
    expect(nivelWcag(7.1, false)).toBe("AAA");
    expect(nivelWcag(4.6, false)).toBe("AA");
    expect(nivelWcag(4.4, false)).toBe("falla");
    expect(nivelWcag(3.1, true)).toBe("AA");
    expect(nivelWcag(2.9, true)).toBe("falla");
  });
});

describe("design-tokens — acentos auditados", () => {
  it("los 6 acentos existen y cada uno recibe su mejor texto medido", () => {
    const auditados = acentosAuditados();
    expect(auditados).toHaveLength(6);
    for (const { acento, texto, ratio, llegaAAComponente } of auditados) {
      expect(ACCENTS.some((a) => a.id === acento.id)).toBe(true);
      expect(["#000000", "#ffffff"]).toContain(texto);
      expect(texto).toBe(textoLegibleSobre(acento.hex)); // el elegido ES el mejor
      expect(ratio).toBeGreaterThanOrEqual(WCAG.AA_COMPONENTE);
      expect(llegaAAComponente).toBe(true);
    }
  });

  it("el texto elegido nunca es el peor de los dos: se mide, no se sortea", () => {
    // ámbar medio: blanco «aprueba» 3:1 pero negro da ~10:1 — tiene que elegir negro
    expect(textoLegibleSobre("#f59e0b")).toBe("#000000");
    expect(textoLegibleSobre("#0a0a0a")).toBe("#ffffff");
    expect(textoLegibleSobre("#ffffff")).toBe("#000000");
  });
});

describe("design-tokens — paleta semántica sobre las superficies del tema", () => {
  it("cada variante clara supera AA 4.5:1 sobre superficie clara", () => {
    for (const c of COLORES_SEMANTICOS) {
      const r = ratioContraste(c.claro, SUPERFICIES.clara);
      expect(r, `${c.id} claro ${c.claro} sobre blanco`).not.toBeNull();
      expect(r!, `${c.id} claro ${c.claro} sobre blanco`).toBeGreaterThanOrEqual(WCAG.AA_TEXTO);
    }
  });

  it("cada variante oscura supera AA 4.5:1 sobre superficie oscura y tarjeta", () => {
    for (const c of COLORES_SEMANTICOS) {
      for (const fondo of [SUPERFICIES.oscura, SUPERFICIES.tarjeta]) {
        const r = ratioContraste(c.oscuro, fondo);
        expect(r, `${c.id} oscuro ${c.oscuro} sobre ${fondo}`).not.toBeNull();
        expect(r!, `${c.id} oscuro ${c.oscuro} sobre ${fondo}`).toBeGreaterThanOrEqual(
          WCAG.AA_TEXTO
        );
      }
    }
  });

  it("los cuatro estados están: éxito, aviso, peligro e info, con etiqueta", () => {
    expect(COLORES_SEMANTICOS.map((c) => c.id)).toEqual(["exito", "aviso", "peligro", "info"]);
    expect(COLORES_SEMANTICOS.every((c) => c.etiqueta.length > 0)).toBe(true);
  });
});

describe("design-tokens — medidas de layout", () => {
  it("el suelo responsive es 320px y los breakpoints son los de Tailwind v4", () => {
    expect(ANCHO_MINIMO).toBe(320);
    expect(BREAKPOINTS).toEqual({ sm: 640, md: 768, lg: 1024, xl: 1280, "2xl": 1536 });
  });
});
