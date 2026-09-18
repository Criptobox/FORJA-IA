import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PRECIOS_FECHA, PRECIOS_FUENTE } from "../../src/lib/forja/precios-datos";
import { MODELOS_FECHA, MODELOS_FUENTE } from "../../src/lib/forja/modelos-datos";
import { OFERTAS_BASE } from "../../src/lib/forja/ofertas";

/** La regla de la casa, comprobada: `docs/DATOS-QUE-ENVEJECEN.md`.
 *
 * «Todo dato que envejece necesita fecha, fuente y un `npm run` que lo
 * regenere». Un documento que dice eso y nadie comprueba es exactamente el
 * tipo de dato que la regla prohíbe, así que aquí está la comprobación. */

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));

describe("todo dato que envejece: fecha, fuente y comando", () => {
  it.each([
    ["precios", PRECIOS_FECHA, PRECIOS_FUENTE],
    ["modelos", MODELOS_FECHA, MODELOS_FUENTE],
  ])("%s tiene fecha, fuente y su npm run", (comando, fecha, fuente) => {
    expect(fecha, "fecha en ISO").toMatch(ISO);
    expect(Number.isNaN(Date.parse(fecha)), "fecha real").toBe(false);
    expect(fuente, "fuente comprobable").toMatch(/^https:\/\//);
    expect(pkg.scripts[comando], `npm run ${comando} regenera el dato`).toBeTruthy();
  });

  it("el kit de efectos no se separa de su fuente", () => {
    // No envejece solo, pero sí puede separarse: si alguien edita el CSS y no
    // ejecuta `npm run efectos`, la app sirve el de antes y nada avisa.
    expect(pkg.scripts.efectos, "npm run efectos regenera el kit").toBeTruthy();
  });

  it("las ofertas llevan fecha PROPIA, no una constante compartida", () => {
    // El fallo real: una sola `OFERTAS_VERIFICADO` para las catorce ofertas.
    // Comprobabas una y todas pasaban a decir «verificado hoy».
    const sellos = OFERTAS_BASE.map((o) => o.verificado);
    expect(sellos.length).toBeGreaterThan(1);
    const distintos = new Set(sellos.map((s) => String(s)));
    expect(distintos.size, "no todas comparten el mismo sello").toBeGreaterThan(1);
    for (const s of sellos) {
      // o una fecha de verdad, o `null` diciendo que nadie lo ha comprobado
      if (s !== null) expect(s).toMatch(ISO);
    }
  });

  it("una oferta sin comprobar se declara sin comprobar, no se estima", () => {
    for (const o of OFERTAS_BASE) {
      expect(o.verificado === null || ISO.test(o.verificado)).toBe(true);
    }
  });
});
