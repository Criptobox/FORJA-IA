import { describe, expect, it } from "vitest";
import * as motor from "../../src/lib/forja/motor";
import {
  MIN_HTML_AUDITABLE,
  aplicaPlanoContenido,
  piezaPlanoContenido,
  planoDelEncargo,
  resumenRevisionDetalle,
  revisionDeDetalle,
} from "../../src/lib/forja/motor-chat";
import { paginaCompletaDesdeMensaje } from "../../src/lib/forja/forja-pagina-demo";

const BARBERIA = "hazme una landing para mi barbería en Valencia, corte 15€, barba 10€, abrimos de lunes a sábado de 10 a 20h, tel 612 345 678";

describe("cuándo se aplica el plano del motor", () => {
  it("al crear una página, sí", () => {
    expect(aplicaPlanoContenido(BARBERIA)).toBe(true);
    expect(aplicaPlanoContenido("crea una web para una cafetería")).toBe(true);
  });
  it("en un retoque, en una app o en una pregunta, no", () => {
    expect(aplicaPlanoContenido("cambia el color del botón a verde")).toBe(false);
    expect(aplicaPlanoContenido("crea una app de lista de tareas")).toBe(false);
    expect(aplicaPlanoContenido("¿qué es flexbox?")).toBe(false);
  });
});

describe("piezaPlanoContenido", () => {
  const pieza = piezaPlanoContenido(BARBERIA)!;
  it("lleva el plano con los datos del encargo tal cual", () => {
    expect(pieza.texto).toContain("# PLANO DE CONTENIDO");
    expect(pieza.texto).toMatch(/15€/);
    expect(pieza.texto).toMatch(/612 345 678/);
    expect(pieza.texto).toMatch(/Valencia/);
  });
  it("lleva iconos SVG del motor y su CSS, no emojis", () => {
    expect(pieza.texto).toContain("# ICONOS");
    expect(pieza.texto.match(/<svg class="f-ico"/g)?.length).toBeGreaterThanOrEqual(6);
    expect(pieza.texto).toContain(".f-ico{");
  });
  it("cabe: plano completo e iconos compactos, por debajo de 9.000 caracteres", () => {
    expect(pieza.texto.length).toBeLessThan(9_000);
  });
  it("el nivel del chat tiene techo en producción (showcase se corta a medias)", () => {
    const largo = `${BARBERIA}. ${"Quiero una web muy completa con todo el detalle posible. ".repeat(8)}`;
    expect(planoDelEncargo(largo).nivel).toBe("produccion");
    expect(piezaPlanoContenido(largo)!.resumen).toMatch(/detalle produccion/);
  });
  it("es determinista: el mismo encargo, el mismo plano (la auditoría lo recalcula)", () => {
    expect(piezaPlanoContenido(BARBERIA)!.texto).toBe(pieza.texto);
  });
  it("no aplica → null", () => {
    expect(piezaPlanoContenido("cambia el título")).toBeNull();
  });
});

describe("revisionDeDetalle", () => {
  it("una página corta no se audita: no es una landing a medias", () => {
    expect(revisionDeDetalle("<html><body><h1>Hola</h1></body></html>", BARBERIA)).toBeNull();
  });
  it("una página larga pero con dos secciones y poco texto pide ampliarla", () => {
    const relleno = "<p>" + "Cortes clásicos y modernos. ".repeat(10) + "</p>";
    const html = `<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width"><style>a:hover{color:red}a:focus-visible{outline:2px solid}</style></head><body><main><section id="hero"><h1>Barbería</h1>${relleno}</section><section id="oferta"><h2>Servicios</h2>${relleno}</section></main></body></html>`.padEnd(MIN_HTML_AUDITABLE + 10, " ");
    const r = revisionDeDetalle(html, BARBERIA)!;
    expect(r.reparacion).toMatch(/REPARACIÓN DE DETALLE/);
    expect(r.reparacion).toMatch(/menos secciones de las prometidas/);
    expect(resumenRevisionDetalle(r.informe)).toMatch(/^Detalle \d+\/100: /);
  });
  it("una página que cumple el plano no gasta una vuelta", () => {
    const { html: base } = paginaCompletaDesdeMensaje(motor, BARBERIA, null, ":root{--acento:#f97316}", "Barbería Norte");
    // la maqueta sin IA del Estudio usa textos cortos (el motor la marca como
    // «contenido fino»); con un párrafo de verdad por sección, cumple
    const parrafo =
      "<p>Trabajamos con cita previa para que nadie espere de pie, afilamos cada navaja antes de cada cliente y te explicamos el corte antes de empezar. " +
      "Si es tu primera visita, dedicamos cinco minutos a mirar cómo te crece el pelo y qué mantenimiento quieres hacer en casa, sin venderte productos que no vas a usar. " +
      "Los precios están a la vista, el turno de tarde llega hasta las ocho y los sábados abrimos todo el día.</p>";
    const html = base.replace(/<\/section>/g, `${parrafo}</section>`);
    const r = revisionDeDetalle(html, BARBERIA)!;
    expect(r).not.toBeNull();
    expect(r.informe.hallazgos.filter((h) => h.gravedad === "critico").map((h) => h.id)).toEqual([]);
    expect(r.reparacion).toBeNull();
  });
  it("en un retoque no se audita contra ningún plano", () => {
    expect(revisionDeDetalle("x".repeat(5000), "cambia el color")).toBeNull();
  });
});
