"use client";
/** FORJA IA — Cliente del motor para el Estudio (/forja).
 *
 * Antes el motor llegaba como un paquete precompilado (`public/motor-forja.mjs`)
 * que se importaba en runtime con `new Function` para que el bundler no lo
 * viera: sin tipos (`Record<string, any>`), sin lint y con una copia del
 * código que nadie podía regenerar desde la app. Ahora el motor vive en
 * `src/lib/forja/motor/` y esto es un import dinámico normal: Next lo parte en
 * su propio trozo (el Estudio lo carga al abrirse, el chat no paga por él
 * hasta que lo usa) y TypeScript comprueba cada llamada. */
import { VERSION_FORJA } from "./motor/version";

export type Motor = typeof import("./motor");

let promesa: Promise<Motor> | null = null;

/** Versión del motor, para enseñarla junto a la de la app. */
export const MOTOR_VERSION = VERSION_FORJA;

export function cargarMotor(): Promise<Motor> {
  if (!promesa) {
    promesa = import("./motor").catch((e) => {
      promesa = null; // permite reintentar si falló la red o el SW
      throw e;
    });
  }
  return promesa;
}
