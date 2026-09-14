import { describe, expect, it } from "vitest";
import {
  MEDIDAS_VACIAS,
  MINIMO_ELEMENTOS,
  esGenerica,
  promptDeGenerico,
  reglaDeGenerico,
  resumenGenerico,
  senasGenericas,
  type MedidasGenerico,
} from "../../src/lib/prism/generico";
import { REGLAS_DE_CONTENIDO, promptDireccion, DIRECCIONES } from "../../src/lib/prism/design-directions";

/** Una página decente de base: bastantes elementos, escala tipográfica real,
 * pareja de fuentes, nada centrado de más. Cada prueba rompe UNA cosa. */
function pagina(p: Partial<MedidasGenerico> = {}): MedidasGenerico {
  return {
    ...MEDIDAS_VACIAS,
    elementos: 120,
    tamanos: [13, 16, 22, 34, 64],
    familiaTitular: "Playfair Display, serif",
    familiaCuerpo: "Source Sans 3, sans-serif",
    bloques: 20,
    centrados: 2,
    radios: 2,
    radioMasRepetido: 3,
    ...p,
  };
}

describe("medidor de página genérica", () => {
  it("una página bien hecha no genera ni una seña", () => {
    expect(senasGenericas(pagina())).toEqual([]);
    expect(esGenerica(pagina())).toBe(false);
    expect(resumenGenerico([])).toContain("Sin señas");
  });

  it("una página pequeña no se juzga: corta no es genérica", () => {
    // Acusar a un ejemplo de tres párrafos gastaría una vuelta de corrección
    // en arreglar algo que no está mal.
    const corta = pagina({ elementos: MINIMO_ELEMENTOS - 1, relleno: ["Lorem ipsum dolor sit amet"] });
    expect(senasGenericas(corta)).toEqual([]);
  });

  it("caza el texto de relleno y lo cita", () => {
    const s = senasGenericas(pagina({ relleno: ["Lorem ipsum dolor sit amet"] }));
    expect(s.map((x) => x.id)).toContain("relleno");
    expect(s.find((x) => x.id === "relleno")?.detalle).toContain("Lorem ipsum");
  });

  it("caza las imágenes de relleno de servicios externos", () => {
    const s = senasGenericas(pagina({ imagenesRelleno: ["https://placehold.co/600x400"] }));
    expect(s.map((x) => x.id)).toContain("imagen-relleno");
    expect(s.find((x) => x.id === "imagen-relleno")?.arreglo).toMatch(/no hay internet/i);
  });

  it("sin escala tipográfica lo dice con los números", () => {
    const s = senasGenericas(pagina({ tamanos: [16, 18, 20] }));
    const sena = s.find((x) => x.id === "sin-escala");
    expect(sena).toBeTruthy();
    expect(sena?.detalle).toContain("16");
  });

  it("un titular al doble del cuerpo con cuatro escalones NO se marca", () => {
    expect(senasGenericas(pagina({ tamanos: [14, 16, 24, 48] })).map((x) => x.id)).not.toContain("sin-escala");
  });

  it("titular y cuerpo con la misma fuente es una seña", () => {
    const s = senasGenericas(pagina({ familiaTitular: "Inter", familiaCuerpo: "Inter" }));
    expect(s.map((x) => x.id)).toContain("sin-pareja");
  });

  it("el titular con la fuente por defecto del navegador es otra", () => {
    const s = senasGenericas(pagina({ familiaTitular: "system-ui", familiaCuerpo: "Georgia" }));
    expect(s.map((x) => x.id)).toContain("fuente-por-defecto");
  });

  it("no acusa dos veces por lo mismo", () => {
    // misma fuente Y por defecto: es UNA seña, no dos
    const ids = senasGenericas(pagina({ familiaTitular: "system-ui", familiaCuerpo: "system-ui" })).map((x) => x.id);
    expect(ids.filter((i) => i === "sin-pareja" || i === "fuente-por-defecto")).toHaveLength(1);
  });

  it("caza la fila de tarjetas clonadas", () => {
    expect(senasGenericas(pagina({ gruposIguales: 1 })).map((x) => x.id)).toContain("tarjetas-iguales");
  });

  it("el mismo redondeo en todo es la marca de agua de una plantilla", () => {
    expect(senasGenericas(pagina({ radios: 1, radioMasRepetido: 14 })).map((x) => x.id)).toContain("radio-uniforme");
    // pocos elementos con el mismo radio es normal, no se acusa
    expect(senasGenericas(pagina({ radios: 1, radioMasRepetido: 4 })).map((x) => x.id)).not.toContain("radio-uniforme");
  });

  it("un emoji suelto no es una seña; cuatro titulares con emoji sí", () => {
    expect(senasGenericas(pagina({ emojiEnTitulos: 1 })).map((x) => x.id)).not.toContain("emoji-titulares");
    expect(senasGenericas(pagina({ emojiEnTitulos: 4 })).map((x) => x.id)).toContain("emoji-titulares");
  });

  it("centrarlo casi todo se avisa, pero se admite que sea a propósito", () => {
    const s = senasGenericas(pagina({ bloques: 10, centrados: 9 }));
    const sena = s.find((x) => x.id === "todo-centrado");
    expect(sena).toBeTruthy();
    expect(sena?.arreglo, "deja salida si la dirección lo pide").toMatch(/si tu dirección/i);
  });

  it("el hero centrado con un botón se nombra por lo que es", () => {
    const s = senasGenericas(pagina({ heroCentrado: true }));
    expect(s.find((x) => x.id === "hero-centrado")?.arreglo).toMatch(/por defecto de todos los generadores/i);
  });

  it("cada seña trae QUÉ HACER, no solo qué pasa", () => {
    const todas = senasGenericas(
      pagina({
        relleno: ["Lorem ipsum"],
        gruposIguales: 2,
        emojiEnTitulos: 3,
        heroCentrado: true,
        radios: 1,
        radioMasRepetido: 12,
      })
    );
    expect(todas.length).toBeGreaterThan(3);
    for (const s of todas) {
      expect(s.arreglo.length, `${s.id} sin arreglo`).toBeGreaterThan(30);
      expect(s.detalle.length).toBeGreaterThan(10);
    }
  });
});

describe("lo que se le devuelve al modelo", () => {
  it("el mensaje lleva la página, las señas y el arreglo de cada una", () => {
    const senas = senasGenericas(pagina({ relleno: ["Lorem ipsum"], gruposIguales: 1 }));
    const p = promptDeGenerico(senas, "index.html");
    expect(p).toContain("index.html");
    expect(p).toContain("Lorem ipsum");
    expect(p).toContain("→");
    // y deja al modelo defender una decisión en vez de obedecer a ciegas
    expect(p).toMatch(/decisión deliberada/i);
  });

  it("sin señas no se manda nada: no se molesta al modelo por gusto", () => {
    expect(promptDeGenerico([], "index.html")).toBe("");
  });

  it("cada seña se puede guardar como regla del proyecto", () => {
    const s = senasGenericas(pagina({ relleno: ["Lorem ipsum"] }))[0];
    const r = reglaDeGenerico(s);
    expect(r.titulo).toContain("relleno");
    expect(r.regla).toBe(s.arreglo);
  });
});

describe("las reglas de contenido viajan en el prompt", () => {
  it("el bloque de dirección las lleva", () => {
    const b = promptDireccion({ direccion: DIRECCIONES[0], origen: "sistema" });
    expect(b).toContain("CERO RELLENO");
    expect(b).toMatch(/esto se mide después/i);
  });

  it("son afirmaciones concretas, no buenos deseos", () => {
    for (const r of REGLAS_DE_CONTENIDO) {
      expect(r.length).toBeGreaterThan(40);
      expect(r).toMatch(/[A-ZÁÉÍÓÚÑ]{4,}/); // cada una empieza por su etiqueta en mayúsculas
    }
  });
});
