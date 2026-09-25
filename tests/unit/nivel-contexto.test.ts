import { describe, it, expect } from "vitest";
import { nivelDeContexto, piezasPorNivel } from "../../src/lib/forja/nivel-contexto";

const nivel = (texto: string, trivial = false) => nivelDeContexto({ texto, trivial });

describe("nivelDeContexto", () => {
  it("L0 cuando el turno es trivial", () => {
    expect(nivel("hola", true)).toBe(0);
  });

  it("L1 para preguntas que no piden cambios", () => {
    expect(nivel("¿Qué hace la función renderMenu?")).toBe(1);
    expect(nivel("explícame cómo funciona el carrito")).toBe(1);
    expect(nivel("por qué usas grid aquí")).toBe(1);
  });

  it("L2 para retoques sobre lo que ya existe", () => {
    expect(nivel("cambia el color del botón a verde")).toBe(2);
    expect(nivel("el menú móvil no funciona")).toBe(2);
    expect(nivel("¿puedes quitar el pie de página?")).toBe(2);
  });

  it("L3 para UI nueva o funcionalidades", () => {
    expect(nivel("hazme una landing para una hamburguesería")).toBe(3);
    expect(nivel("añade una sección de reservas con formulario")).toBe(3);
  });

  it("L4 para trabajo de proyecto entero y L5 para auditorías", () => {
    expect(nivel("refactoriza la arquitectura en módulos")).toBe(4);
    expect(nivel("audita el proyecto y dime qué falla")).toBe(5);
  });

  it("ante la duda, sube a L3 (lo que viajaba antes)", () => {
    expect(nivel("quiero algo con más personalidad para la marca")).toBe(3);
    expect(nivel("```js\nconst a = 1\n```\n¿esto?")).toBe(3);
    expect(nivel("")).toBe(3);
  });
});

describe("piezasPorNivel", () => {
  it("la pregunta no lleva diseño, el retoque solo el contrato, la feature todo", () => {
    expect(piezasPorNivel(1).diseno).toBe("nada");
    expect(piezasPorNivel(2).diseno).toBe("contrato");
    expect(piezasPorNivel(3)).toEqual({ diseno: "completo", arquitecturaWeb: true, memoriaCompleta: false });
    expect(piezasPorNivel(5).memoriaCompleta).toBe(true);
  });
});
