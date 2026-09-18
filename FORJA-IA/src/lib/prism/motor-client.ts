"use client";
/** FORJA IA — Cliente del bundle del motor para el Estudio (/forja).
 *
 * El bundle `/motor-forja.mjs` es un ESM único generado con esbuild desde
 * `src/lib/prism/forja/` del módulo (entrada: workspace/adapter-test/entrada.mjs).
 * Se importa en runtime FUERA del bundler de Next (new Function + import) para
 * que Turbopack no intente resolverlo: es un asset público que habla el mismo
 * idioma que el panel v4.2 y el Laboratorio.
 *
 * El `?v=` fuerza refresco cuando cambia la versión del bundle (service worker
 * mediante): súbelo junto con la versión del módulo. */

type Motor = Record<string, any>; // el bundle es JS sin tipos; las funciones se usan por nombre

let promesa: Promise<Motor> | null = null;

export const MOTOR_VERSION = "47";

export function cargarMotor(): Promise<Motor> {
  if (!promesa) {
    const dinamico = new Function("u", "return import(u)") as (u: string) => Promise<Motor>;
    promesa = dinamico(`/motor-forja.mjs?v=${MOTOR_VERSION}`).catch((e) => {
      promesa = null; // permite reintentar si falló la red o el SW
      throw e;
    });
  }
  return promesa;
}

export type { Motor };
