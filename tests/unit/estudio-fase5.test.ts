import { describe, expect, it } from "vitest";
import { DIRECCIONES, promptDireccion } from "../../src/lib/forja/design-directions";
import { crearProyecto, direccionDe } from "../../src/lib/forja/estudio/proyecto";
import { direccionCompacta, pedidoPantalla, promptPlan, promptSistema } from "../../src/lib/forja/estudio/prompts";
import {
  bloqueGustos,
  LIMITE_GUSTOS,
  rasgosDeHtml,
  resumenGustos,
  textoRasgo,
  type VotoGusto,
} from "../../src/lib/forja/estudio/gustos";
import { MAX_PROBLEMAS_REVISION, necesitaRevision, problemasDeRevision } from "../../src/lib/forja/estudio/revisor";
import type { CriticaPantalla } from "../../src/lib/forja/estudio/critica";

describe("estudio · prompt compacto (ahorro de tokens)", () => {
  it("la dirección compacta ocupa menos de la mitad que la del chat y conserva la identidad", () => {
    for (const d of DIRECCIONES) {
      const corta = direccionCompacta(d);
      const larga = promptDireccion({ direccion: d, origen: "proyecto" });
      expect(corta.length, d.id).toBeLessThan(larga.length / 2);
      expect(corta).toContain(d.fuentes.display);
      expect(corta).toContain(d.composicion);
      expect(corta).toContain(d.detalle);
      expect(corta).toContain("forja-fx.css");
      // la paleta ya va en las variables CSS: no se repite en texto
      expect(corta).not.toContain(d.paleta.acento);
    }
  });

  it("el system prompt de cada pantalla cabe en ~3.200 caracteres con cualquier dirección", () => {
    const p = crearProyecto({ brief: "App de reservas para una peluquería de barrio", tipo: "app" });
    for (const d of DIRECCIONES) {
      const s = promptSistema({ ...p, direccionId: d.id }, d);
      expect(s.length, d.id).toBeLessThan(3_200);
      expect(s).toContain("--color-acento:"); // los tokens siguen ahí
    }
  });

  it("promptPlan pide un número exacto en el modo autónomo", () => {
    expect(promptPlan("peluquería", "app", 3)).toContain("exactamente 3");
    expect(promptPlan("peluquería", "app", 99)).toContain("exactamente 6");
    expect(promptPlan("peluquería", "app")).toContain("entre 3 y 6");
  });
});

const css = (reglas: string) => `<!doctype html><html><head><style>${reglas}</style></head><body><h1>x</h1></body></html>`;

describe("estudio · memoria de gustos", () => {
  it("rasgosDeHtml mide sin modelo", () => {
    expect(rasgosDeHtml(css(".c{border-radius:18px;box-shadow:0 20px 40px #0002}"))).toEqual(
      expect.arrayContaining(["redondeado", "sombras"])
    );
    expect(rasgosDeHtml(css(".c{border-radius:0;border-radius:2px}"))).toContain("recto");
    expect(rasgosDeHtml(css(":root{--g:linear-gradient(red,blue)} .x{color:red}"))).not.toContain("degradados");
    expect(rasgosDeHtml(css(".x{background:linear-gradient(red,blue)}"))).toContain("degradados");
    expect(rasgosDeHtml(css("h1{font-size:56px}"))).toContain("titular-grande");
    expect(rasgosDeHtml(css("nav{position:fixed;bottom:0}").replace("<h1>x</h1>", "<nav>a</nav>"))).toContain("barra-inferior");
    expect(rasgosDeHtml(css("")).length).toBe(0);
  });

  const voto = (rasgos: string[], v: "si" | "no", cuando: number): VotoGusto => ({ rasgos, voto: v, cuando });

  it("con un solo voto no dice nada: hace falta un patrón", () => {
    expect(bloqueGustos([voto(["redondeado"], "si", 1)])).toBe("");
  });

  it("lo que se repite en lo aprobado gusta, lo que se repite en lo descartado se evita", () => {
    const votos = [
      voto(["redondeado", "sombras"], "si", 1),
      voto(["redondeado", "aire"], "si", 2),
      voto(["degradados", "emoji"], "no", 3),
      voto(["degradados"], "no", 4),
    ];
    const r = resumenGustos(votos);
    expect(r.gusta).toContain("redondeado");
    expect(r.evita).toContain("degradados");
    expect(r.gusta).not.toContain("sombras"); // solo una vez: aún no es patrón
    const linea = bloqueGustos(votos);
    expect(linea).toContain(textoRasgo("redondeado"));
    expect(linea).toContain(textoRasgo("degradados"));
    expect(linea.length).toBeLessThanOrEqual(LIMITE_GUSTOS);
  });

  it("un rasgo aprobado y descartado a la vez se anula", () => {
    const r = resumenGustos([voto(["redondeado"], "si", 1), voto(["redondeado"], "no", 2), voto(["aire"], "si", 3), voto(["aire"], "si", 4)]);
    expect(r.gusta).toEqual(["aire"]);
    expect(r.evita).toEqual([]);
  });

  it("los gustos viajan en el pedido de la pantalla, en una línea", () => {
    const p = crearProyecto({ brief: "App de reservas", tipo: "app" });
    const linea = bloqueGustos([voto(["redondeado"], "si", 1), voto(["redondeado"], "si", 2)]);
    expect(pedidoPantalla(p, { nombre: "Inicio", proposito: "" }, linea)).toContain("Gustos de esta persona");
    expect(pedidoPantalla(p, { nombre: "Inicio", proposito: "" })).not.toContain("Gustos");
  });
});

const critica = (c: Partial<CriticaPantalla>): CriticaPantalla => ({
  identidad: 80,
  nivelGenerico: "bajo",
  motivo: "",
  sintomas: [],
  avisos: [],
  patrones: [],
  ...c,
});

describe("estudio · revisor antes de mostrar", () => {
  it("solo gasta una llamada por fallos que importan", () => {
    expect(necesitaRevision(critica({}))).toBe(false);
    expect(necesitaRevision(critica({ avisos: ["Falta meta description"] }))).toBe(false);
    expect(necesitaRevision(critica({ patrones: ["Falta la navegación"] }))).toBe(true);
    expect(necesitaRevision(critica({ nivelGenerico: "alto" }))).toBe(true);
    expect(necesitaRevision(critica({ identidad: 30 }))).toBe(true);
  });

  it("la lista es corta y lo concreto va primero", () => {
    const c = critica({
      nivelGenerico: "alto",
      patrones: ["p1", "p2", "p3"],
      sintomas: [
        { nombre: "Hero centrado", alternativa: "composición asimétrica" },
        { nombre: "Tres tarjetas", alternativa: "un protagonista" },
      ],
      avisos: ["seo"],
    });
    const pr = problemasDeRevision(c);
    expect(pr).toHaveLength(MAX_PROBLEMAS_REVISION);
    expect(pr.slice(0, 3)).toEqual(["p1", "p2", "p3"]);
    expect(pr).not.toContain("seo");
  });
});

it("la dirección del proyecto sigue siendo la misma que usa el chat (mismos datos)", () => {
  const p = crearProyecto({ brief: "x", tipo: "web" });
  const d = direccionDe(p);
  expect(DIRECCIONES.map((x) => x.id)).toContain(d.id);
});
