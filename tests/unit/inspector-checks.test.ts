import { describe, it, expect } from "vitest";
import {
  inspeccionar,
  colorOpaco,
  reglasInspector,
  type ElementoInspeccionable,
} from "../../src/lib/prism/inspector-checks";

/* Las reglas del Inspector se prueban con elementos falsos: si una regla
 * cambia de criterio (el umbral, la severidad, quién la dispara), este test
 * es el que obliga a hacerlo a sabiendas. */

const VIEWPORT = { ancho: 1440, alto: 780 };

/** Elemento modelo: pasa TODAS las reglas. Cada test rompe UNA cosa. */
function el(sobre: Partial<ElementoInspeccionable> = {}): ElementoInspeccionable {
  return {
    etiqueta: "BUTTON",
    rol: null,
    nombreAccesible: "Enviar mensaje",
    esImagen: false,
    alt: null,
    clickeable: true,
    rect: { left: 100, right: 200, top: 100, bottom: 140 },
    recortado: false,
    colorTexto: "#ffffff",
    colorFondo: "#000000",
    px: 14,
    peso: 400,
    textoDirecto: true,
    pista: "«cabecera»",
    ...sobre,
  };
}

describe("inspector — regla sin-nombre-accesible", () => {
  it("un clickeable sin aria-label ni texto es hallazgo ALTA", () => {
    const r = inspeccionar([el({ nombreAccesible: "" })], VIEWPORT);
    const h = r.hallazgos.find((x) => x.regla === "sin-nombre-accesible");
    expect(h?.severidad).toBe("alta");
    expect(r.porRegla["sin-nombre-accesible"]).toBe(1);
  });

  it("con nombre accesible no hay hallazgo", () => {
    const r = inspeccionar([el()], VIEWPORT);
    expect(r.porRegla["sin-nombre-accesible"]).toBe(0);
  });

  it("un DIV no clickeable nunca dispara la regla (no es objetivo interactivo)", () => {
    const r = inspeccionar([el({ etiqueta: "DIV", clickeable: false, nombreAccesible: "" })], VIEWPORT);
    expect(r.porRegla["sin-nombre-accesible"]).toBe(0);
  });
});

describe("inspector — regla imagen-sin-alt", () => {
  it("img sin atributo alt dispara; alt=\"\" no (decorativa declarada)", () => {
    const sinAlt = inspeccionar([el({ etiqueta: "IMG", esImagen: true, clickeable: false, alt: null })], VIEWPORT);
    expect(sinAlt.porRegla["imagen-sin-alt"]).toBe(1);

    const decorativa = inspeccionar(
      [el({ etiqueta: "IMG", esImagen: true, clickeable: false, alt: "", nombreAccesible: "" })],
      VIEWPORT
    );
    expect(decorativa.porRegla["imagen-sin-alt"]).toBe(0);
  });
});

describe("inspector — regla fuera-viewport", () => {
  it("elemento que se sale a la derecha y nadie lo recorta: hallazgo MEDIA", () => {
    const r = inspeccionar(
      [el({ etiqueta: "DIV", clickeable: false, rect: { left: 1400, right: 1500, top: 0, bottom: 40 } })],
      VIEWPORT
    );
    const h = r.hallazgos.find((x) => x.regla === "fuera-viewport");
    expect(h?.severidad).toBe("media");
    expect(h?.detalle).toContain("1440");
  });

  it("el mismo desborde con un ancestro que recorta NO es hallazgo (mismo criterio que responsive.spec)", () => {
    const r = inspeccionar(
      [
        el({
          etiqueta: "DIV",
          clickeable: false,
          recortado: true,
          rect: { left: 1400, right: 1500, top: 0, bottom: 40 },
        }),
      ],
      VIEWPORT
    );
    expect(r.porRegla["fuera-viewport"]).toBe(0);
  });

  it("la tolerancia de 1px no convierte el borde exacto en desborde", () => {
    const r = inspeccionar(
      [el({ etiqueta: "DIV", clickeable: false, rect: { left: 0, right: 1441, top: 0, bottom: 40 } })],
      VIEWPORT
    );
    expect(r.porRegla["fuera-viewport"]).toBe(0);
  });
});

describe("inspector — regla contraste-bajo", () => {
  it("texto normal con ratio ~2.3:1 es hallazgo ALTA (no llega ni al piso 3:1)", () => {
    const r = inspeccionar(
      [el({ colorTexto: "#aaaaaa", colorFondo: "#ffffff", px: 14, peso: 400 })],
      VIEWPORT
    );
    const h = r.hallazgos.find((x) => x.regla === "contraste-bajo");
    expect(h?.severidad).toBe("alta");
    expect(h?.detalle).toMatch(/ratio \d+\.\d+:1/);
  });

  it("ratio 4:1 en texto normal es MEDIA (pasa componente, falla AA texto)", () => {
    // #767676 sobre blanco ≈ 4.54… usamos uno por debajo pero sobre 3
    const r = inspeccionar(
      [el({ colorTexto: "#7b7b7b", colorFondo: "#ffffff", px: 14, peso: 400 })],
      VIEWPORT
    );
    const h = r.hallazgos.find((x) => x.regla === "contraste-bajo");
    expect(h?.severidad).toBe("media");
  });

  it("texto grande (24px) con ratio 3.2 pasa AA grande: sin hallazgo", () => {
    const r = inspeccionar(
      [el({ colorTexto: "#7b7b7b", colorFondo: "#ffffff", px: 24, peso: 400 })],
      VIEWPORT
    );
    expect(r.porRegla["contraste-bajo"]).toBe(0);
  });

  it("sin texto propio o con colores no medibles, la regla calla (no inventa números)", () => {
    const sinTexto = inspeccionar([el({ textoDirecto: false, colorTexto: "#777777", colorFondo: "#ffffff" })], VIEWPORT);
    expect(sinTexto.porRegla["contraste-bajo"]).toBe(0);

    const conAlfa = inspeccionar(
      [el({ colorTexto: "rgba(0,0,0,0.4)", colorFondo: "#ffffff" })],
      VIEWPORT
    );
    expect(conAlfa.porRegla["contraste-bajo"]).toBe(0);
  });
});

describe("inspector — regla toque-pequeno", () => {
  it("un objetivo de 20×20 es hallazgo BAJA; uno de 40×40 no", () => {
    const chico = inspeccionar(
      [el({ rect: { left: 0, right: 20, top: 0, bottom: 20 } })],
      VIEWPORT
    );
    expect(chico.porRegla["toque-pequeno"]).toBe(1);
    expect(chico.hallazgos[0]?.severidad).toBe("baja");

    const grande = inspeccionar([el()], VIEWPORT);
    expect(grande.porRegla["toque-pequeno"]).toBe(0);
  });
});

describe("inspector — resumen y severidades", () => {
  it("porRegla arranca a cero para las CINCO reglas aunque no haya hallazgos", () => {
    const r = inspeccionar([], VIEWPORT);
    expect(Object.keys(r.porRegla)).toHaveLength(5);
    expect(Object.values(r.porRegla).every((n) => n === 0)).toBe(true);
    expect(r.examinados).toBe(0);
  });

  it("examinados cuenta los elementos, no los hallazgos", () => {
    const r = inspeccionar([el({ nombreAccesible: "" }), el()], VIEWPORT);
    expect(r.examinados).toBe(2);
    expect(r.hallazgos.length).toBe(1);
    expect(r.porSeveridad.alta).toBe(1);
    expect(r.porSeveridad.media + r.porSeveridad.baja).toBe(0);
  });

  it("las cinco reglas están declaradas con título y explicación para el humano", () => {
    const reglas = reglasInspector();
    expect(reglas).toHaveLength(5);
    for (const regla of reglas) {
      expect(regla.titulo.trim()).toBeTruthy();
      expect(regla.explicacion.trim()).toBeTruthy();
      expect(["alta", "media", "baja"]).toContain(regla.severidad);
    }
  });
});

describe("inspector — colorOpaco", () => {
  it("rgb() opaco → hex; rgba con alfa < 1 → null; transparent → null", () => {
    expect(colorOpaco("rgb(255, 0, 0)")).toBe("#ff0000");
    expect(colorOpaco("rgb(0, 0, 0)")).toBe("#000000");
    expect(colorOpaco("rgba(0,0,0,0.4)")).toBeNull();
    expect(colorOpaco("transparent")).toBeNull();
    expect(colorOpaco("")).toBeNull();
  });

  it("hex de 3 y 6 dígitos pasan tal cual; css variables no se pueden medir", () => {
    expect(colorOpaco("#fff")).toBe("#fff");
    expect(colorOpaco("#8b5cf6")).toBe("#8b5cf6");
    expect(colorOpaco("var(--fondo)")).toBeNull();
  });
});
