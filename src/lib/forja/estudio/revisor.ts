/** FORJA IA — Estudio: el revisor que corrige antes de enseñar (fase 5).
 *
 * Toda pantalla nueva pasa por la crítica (anti-genérico + auditoría +
 * patrones de sus skills), que es determinista y no gasta tokens. Solo si
 * encuentra fallos CONCRETOS y que importan se gasta UNA llamada de
 * corrección, con una lista corta de problemas — nunca un bucle:
 *
 *  · patrones de la pantalla que no cumple (un formulario sin etiquetas,
 *    una navegación que no marca dónde estás…): siempre se arreglan;
 *  · aspecto de plantilla con identidad baja: se arregla;
 *  · avisos sueltos de SEO o rendimiento: NO disparan una llamada por sí
 *    solos (salen en la crítica para quien quiera «Corregir con IA»).
 *
 * Así una pantalla que sale bien no cuesta nada más, y una que sale mal se
 * arregla una vez con un pedido de pocos cientos de caracteres de
 * instrucciones (más el HTML, que hace falta para corregirlo). */

import type { CriticaPantalla } from "./critica";

/** Problemas que viajan como mucho en la corrección automática. */
export const MAX_PROBLEMAS_REVISION = 4;
/** Por debajo de esta identidad, la pantalla parece plantilla. */
export const UMBRAL_IDENTIDAD = 45;

/** ¿Merece una corrección automática antes de enseñarla? */
export function necesitaRevision(c: CriticaPantalla): boolean {
  return c.patrones.length > 0 || c.nivelGenerico === "alto" || c.identidad < UMBRAL_IDENTIDAD;
}

/** La lista corta que se le pide arreglar: lo concreto primero. */
export function problemasDeRevision(c: CriticaPantalla): string[] {
  const genericos =
    c.nivelGenerico === "alto" || c.identidad < UMBRAL_IDENTIDAD ? c.sintomas.map((s) => `${s.nombre}: ${s.alternativa}`) : [];
  return [...c.patrones, ...genericos].slice(0, MAX_PROBLEMAS_REVISION);
}

/** Etiqueta de la versión corregida por el revisor. */
export const PEDIDO_REVISION = "Revisión automática";
