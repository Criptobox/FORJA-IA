import { describe, expect, it } from "vitest";
import * as motor from "../../src/lib/forja/motor";

/** Las pruebas funcionales del motor (v4.4-v4.7, sin red) corrían a mano
 * contra el paquete precompilado. Ahora el motor es código de la app y sus
 * 319 comprobaciones corren en CI contra el mismo módulo que usan el chat y
 * el Estudio. Los scripts siguen funcionando por línea de comandos contra un
 * paquete construido (`node tests/motor/verificacion-v47.mjs <paquete>`). */
declare global {
  var __FORJA_MOTOR__: unknown;
  var __FORJA_VERIF__: { pasados: number; fallados: number; fallos: string[] } | undefined;
}

/** Se lee por función: tras asignarle `undefined` justo antes, TypeScript
 *  estrecha el global a `never` y no sabe que el script lo rellena. */
const resultado = () => globalThis.__FORJA_VERIF__;

describe("motor — verificación funcional", () => {
  // nº de comprobaciones de cada versión: si baja, un bloque dejó de correr
  const ESPERADAS: Record<number, number> = { 44: 52, 45: 86, 46: 86, 47: 95 };
  for (const v of [44, 45, 46, 47]) {
    it(`v4.${v - 40}: todas las comprobaciones pasan`, async () => {
      globalThis.__FORJA_MOTOR__ = motor;
      globalThis.__FORJA_VERIF__ = undefined;
      await import(`../motor/verificacion-v${v}.mjs`);
      const r = resultado();
      expect(r, "el script no devolvió resultado").toBeDefined();
      expect(r!.fallos).toEqual([]);
      expect(r!.pasados).toBe(ESPERADAS[v]);
    });
  }
});
