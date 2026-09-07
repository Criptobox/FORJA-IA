import { describe, expect, it } from "vitest";
import {
  MIN_LLAMADAS_FIABLES,
  avisoDePerfil,
  hayPerfil,
  lineasDePerfil,
  mejorTareaDe,
  perfilDe,
  perfiles,
} from "../../src/lib/prism/perfil-modelo";
import { VIGENCIA_MS } from "../../src/lib/prism/limites-medidos";
import type { ModelUsage } from "../../src/lib/prism/usage";

const AHORA = Date.parse("2026-09-07T12:00:00Z");

function uso(p: Partial<ModelUsage>): ModelUsage {
  return {
    requests: 0,
    ok: 0,
    fail: 0,
    totalMs: 0,
    ms: [],
    charsIn: 0,
    charsOut: 0,
    savedChars: 0,
    lastUsed: AHORA,
    ...p,
  };
}

describe("perfil de modelo", () => {
  it("un modelo sin nada medido no tiene ficha", () => {
    const p = perfilDe("groq::x", undefined, undefined, undefined, AHORA);
    expect(hayPerfil(p)).toBe(false);
    expect(avisoDePerfil(p, AHORA)).toBeNull();
    expect(lineasDePerfil(p)[0].valor).toContain("sin probar");
  });

  it("con pocas llamadas NO se afirma un porcentaje", () => {
    const p = perfilDe("groq::x", uso({ requests: 2, ok: 1, fail: 1 }), undefined, undefined, AHORA);
    expect(MIN_LLAMADAS_FIABLES).toBeGreaterThan(2);
    expect(p.fiabilidad).toBeNull();
    expect(lineasDePerfil(p)[0].valor).toContain("pocos para un porcentaje");
    expect(lineasDePerfil(p)[0].valor).not.toContain("%");
  });

  it("con historial suficiente sí hay porcentaje", () => {
    const p = perfilDe("groq::x", uso({ requests: 10, ok: 9, fail: 1 }), undefined, undefined, AHORA);
    expect(p.fiabilidad).toBeCloseTo(0.9);
    expect(lineasDePerfil(p)[0].valor).toContain("90 %");
  });

  it("lo más grave manda: roto por encima de techo", () => {
    const p = perfilDe(
      "groq::x",
      uso({ requests: 10, ok: 9 }),
      { status: 404, at: AHORA },
      { limite: 7000, rechazado: 21000, at: AHORA },
      AHORA
    );
    expect(avisoDePerfil(p, AHORA)).toContain("no lo reconoce");
  });

  it("el techo se dice con el número del proveedor cuando lo dio", () => {
    const p = perfilDe("groq::x", undefined, undefined, { limite: 7000, rechazado: 21000, at: AHORA }, AHORA);
    // en español los de cuatro cifras no llevan separador: 7000, no 7.000
    expect(avisoDePerfil(p, AHORA)).toContain("7000");
    const l = lineasDePerfil(p).find((x) => x.etiqueta === "Techo medido")?.valor ?? "";
    expect(l).toContain("lo dijo el proveedor");
  });

  it("sin número del proveedor solo se dice lo que se le pidió", () => {
    const p = perfilDe("groq::x", undefined, undefined, { limite: null, rechazado: 21000, at: AHORA }, AHORA);
    const aviso = avisoDePerfil(p, AHORA) ?? "";
    expect(aviso).toContain("21.000");
    expect(aviso).not.toContain("Admite");
  });

  it("una medición caducada se marca como tal en vez de mandar", () => {
    const viejo = AHORA - VIGENCIA_MS - 1;
    const p = perfilDe("groq::x", undefined, undefined, { limite: 7000, rechazado: 9000, at: viejo }, AHORA);
    expect(p.techoVigente).toBe(false);
    expect(avisoDePerfil(p, AHORA)).toContain("ya no cuenta");
    expect(lineasDePerfil(p).find((x) => x.etiqueta === "Techo medido")?.valor).toContain("caducada");
  });

  it("un modelo que va bien no genera aviso: el silencio es la respuesta", () => {
    const p = perfilDe("groq::x", uso({ requests: 20, ok: 20 }), undefined, undefined, AHORA);
    expect(avisoDePerfil(p, AHORA)).toBeNull();
  });

  it("la mejor tarea solo se propone si hay diferencia real y datos", () => {
    const sinDatos = perfilDe(
      "groq::x",
      uso({
        requests: 10,
        ok: 8,
        porTarea: { web: { llamadas: 2, ok: 2, charsIn: 0, charsOut: 0, totalMs: 0 } },
      }),
      undefined,
      undefined,
      AHORA
    );
    expect(mejorTareaDe(sinDatos)).toBeNull();

    const parejo = perfilDe(
      "groq::x",
      uso({
        requests: 20,
        ok: 18,
        porTarea: {
          web: { llamadas: 10, ok: 9, charsIn: 0, charsOut: 0, totalMs: 0 },
          code: { llamadas: 10, ok: 9, charsIn: 0, charsOut: 0, totalMs: 0 },
        },
      }),
      undefined,
      undefined,
      AHORA
    );
    expect(mejorTareaDe(parejo)).toBeNull();

    const claro = perfilDe(
      "groq::x",
      uso({
        requests: 20,
        ok: 14,
        porTarea: {
          web: { llamadas: 10, ok: 10, charsIn: 0, charsOut: 0, totalMs: 0 },
          code: { llamadas: 10, ok: 4, charsIn: 0, charsOut: 0, totalMs: 0 },
        },
      }),
      undefined,
      undefined,
      AHORA
    );
    expect(mejorTareaDe(claro)).toBe("web");
  });

  it("la lista pone delante lo que más duele", () => {
    const orden = perfiles(
      {
        "groq::bien": uso({ requests: 30, ok: 30 }),
        "groq::regular": uso({ requests: 10, ok: 5 }),
      },
      { "groq::muerto": { status: 404, at: AHORA } },
      { "groq::techo": { limite: 7000, rechazado: 21000, at: AHORA } },
      AHORA
    ).map((p) => p.modelKey);
    expect(orden).toEqual(["groq::muerto", "groq::techo", "groq::regular", "groq::bien"]);
  });

  it("cuando hay diferencia clara, la ficha dice dónde va mejor", () => {
    const p = perfilDe(
      "groq::x",
      uso({
        requests: 20,
        ok: 14,
        porTarea: {
          web: { llamadas: 10, ok: 10, charsIn: 0, charsOut: 0, totalMs: 0 },
          code: { llamadas: 10, ok: 4, charsIn: 0, charsOut: 0, totalMs: 0 },
        },
      }),
      undefined,
      undefined,
      AHORA
    );
    expect(lineasDePerfil(p).find((l) => l.etiqueta === "Donde mejor va")?.valor).toBe("página web");
    // y sin diferencia no se propone nada: la ficha se calla
    const parejo = perfilDe(
      "groq::y",
      uso({
        requests: 20,
        ok: 18,
        porTarea: {
          web: { llamadas: 10, ok: 9, charsIn: 0, charsOut: 0, totalMs: 0 },
          code: { llamadas: 10, ok: 9, charsIn: 0, charsOut: 0, totalMs: 0 },
        },
      }),
      undefined,
      undefined,
      AHORA
    );
    expect(lineasDePerfil(parejo).some((l) => l.etiqueta === "Donde mejor va")).toBe(false);
  });

  it("una clave sin proveedor no tumba nada", () => {
    const p = perfilDe("rarito", uso({ requests: 1, ok: 1 }), undefined, undefined, AHORA);
    expect(p.modelId).toBe("rarito");
  });
});
