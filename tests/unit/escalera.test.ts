import { describe, it, expect } from "vitest";
import { avisoParada, decidirPeldano, firmaDe, type PasoRevision } from "../../src/lib/forja/escalera";

describe("firmaDe", () => {
  it("el mismo fallo con otros números o en otro orden es el mismo problema", () => {
    expect(firmaDe("consola", ["TypeError: x is undefined (línea 12)", "«3» errores"])).toBe(
      firmaDe("consola", ["3 errores", "TypeError: x is undefined (línea 40)"])
    );
    expect(firmaDe("consola", ["a"])).not.toBe(firmaDe("movil", ["a"]));
    expect(firmaDe("generico", ["hero-centrado"])).not.toBe(firmaDe("generico", ["tarjetas-iguales"]));
  });
});

describe("decidirPeldano", () => {
  const A = "groq::llama";
  const B = "gemini::flash";
  const f = firmaDe("movil", ["scroll"]);

  it("un problema nuevo se corrige con el mismo modelo", () => {
    expect(decidirPeldano([], f, A, true)).toBe("mismo");
    expect(decidirPeldano([{ firma: firmaDe("consola", ["x"]), modelo: A }], f, A, true)).toBe("mismo");
  });

  it("si vuelve tras corregirlo, sube a otro modelo (si hay)", () => {
    const h: PasoRevision[] = [{ firma: f, modelo: A }];
    expect(decidirPeldano(h, f, A, true)).toBe("otro-modelo");
    expect(decidirPeldano(h, f, A, false)).toBe("parar");
  });

  it("si ya lo probó otro modelo y sigue, para", () => {
    const h: PasoRevision[] = [
      { firma: f, modelo: A },
      { firma: f, modelo: B },
    ];
    expect(decidirPeldano(h, f, B, true)).toBe("parar");
    expect(avisoParada(h, f)).toMatch(/Se acabaron los intentos automáticos: .*2 correcciones \(llama, flash\)/);
  });
});
