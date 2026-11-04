import { describe, expect, it } from "vitest";
import { rutasEnTexto } from "../../src/lib/forja/rutas-en-texto";
import { citasDe } from "../../src/lib/forja/evidencia";

/** El patrón de antes, tal cual estaba copiado en cinco sitios: sirve de
 * referencia para comprobar que el nuevo encuentra exactamente lo mismo. */
const ANTES = /[\w./-]+\.(html?|css|js|jsx|ts|tsx|json|md|svg|py|mjs|cjs)/g;

describe("rutasEnTexto", () => {
  const casos = [
    "mira index.html y src/app.js",
    "a.css.b.js",
    "(styles.css), `lib/x.ts`:12",
    "foo_bar-baz.md, otro.json.",
    "sin rutas aquí",
    "v1.2.3 app.min.js y ../a/b.tsx;c.py",
    "x.htmlx y.js",
    "https://ejemplo.com/a/b.svg?v=2",
    "",
  ];

  it("encuentra exactamente lo mismo que el patrón de antes", () => {
    for (const t of casos) expect(rutasEnTexto(t), t).toEqual(t.match(ANTES) ?? []);
  });

  it("es lineal: una palabra de 200.000 letras sin punto no cuelga la app", () => {
    // con el patrón de antes, 20.000 letras ya costaban ~1 s y crecía con el cuadrado
    const t0 = performance.now();
    expect(rutasEnTexto("r".repeat(200_000))).toEqual([]);
    expect(rutasEnTexto(`${"r".repeat(200_000)} index.html`)).toEqual(["index.html"]);
    expect(performance.now() - t0).toBeLessThan(250);
  });
});

describe("citasDe (evidencia)", () => {
  it("sigue leyendo citas archivo:línea", () => {
    const c = citasDe("Mira `src/app.js:12-15` y styles.css: 4");
    expect(c.map((x) => `${x.path}:${x.linea}`)).toEqual(expect.arrayContaining(["src/app.js:12", "styles.css:4"]));
  });

  it("es lineal con palabras largas", () => {
    const t0 = performance.now();
    expect(citasDe("r".repeat(200_000))).toEqual([]);
    expect(performance.now() - t0).toBeLessThan(250);
  });
});
