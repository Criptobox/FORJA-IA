import { describe, it, expect } from "vitest";
import { escanear, REGLAS } from "../../scripts/check-secretos.mjs";
import { join } from "node:path";

/* Guard de higiene: el repo no debe contener patrones que los escáneres
 * externos (GitHub, plataformas de subida) confunden con credenciales reales.
 * Si este test falla, lo que se acaba de añadir tiene pinta de clave: ensámblala
 * en runtime (ver el helper `sec` de sandbox-review.test.ts) o sácala del repo. */
describe("higiene del repo — sin patrones de credenciales", () => {
  it("el código fuente está limpio de patrones de secretos", () => {
    const raiz = join(import.meta.dirname, "../..");
    const hallazgos = escanear(raiz);
    const resumen = hallazgos
      .map((h) => `${h.archivo}:${h.linea} (${h.regla})`)
      .join("\n");
    expect(hallazgos, resumen).toHaveLength(0);
  });

  it("el detector funciona: caza una clave literal ensamblada en memoria", () => {
    // clave con forma real pero construida en runtime: el guard la caza igual
    const clave = ["sk", "-abc123def456ghi789jkl012"].join("");
    const texto = `const k = "${clave}";`;
    const reglaOpenAI = REGLAS.find((r) => r.nombre.startsWith("clave OpenAI"));
    expect(reglaOpenAI?.re.test(texto)).toBe(true);
  });

  it("los fixtures runtime-built del repo no disparan al guard", () => {
    // el helper `sec` parte los patrones: el fuente debe seguir limpio aunque
    // los tests usen claves con forma real en ejecución
    const fuente = 'const K_AWS = sec("AK", "IAIOSFODNN7EXAMPLE");';
    const reglaAWS = REGLAS.find((r) => r.nombre.includes("AWS"));
    expect(reglaAWS?.re.test(fuente)).toBe(false);
  });
});
