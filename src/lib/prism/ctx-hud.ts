/** Prism AI — HUD de contexto del compositor (idea D4 del PLAN-V7).
 *
 * El chip «ctx −%» de cada respuesta llega DESPUÉS de gastar el
 * contexto. Este módulo estima cuánto lleva la conversación ANTES de
 * enviar, para que el usuario decida (comprimir, hilo nuevo) con la
 * cifra delante y no a ciegas.
 *
 * Honestidad primero (regla de la casa: sin números inventados):
 *  - No hay una TABLA de ventanas por modelo en Prism (los modelos
 *    gratis cambian cada semana; una tabla sería mentir con cariño).
 *    Se usa una VENTANA DE REFERENCIA ajustable en Ajustes.
 *  - Pero si el PROVEEDOR ya dijo un número real para este modelo —
 *    `limites-medidos.ts`, aprendido de un rechazo real, no inventado—,
 *    `ventanaReferencia()` lo usa en vez de la referencia genérica. Nunca
 *    al revés: un dato real nunca se descarta por uno de fábrica, y un
 *    límite aprendido nunca ENSANCHA la ventana, solo la ajusta cuando
 *    hay algo mejor que la estimación.
 *  - Los tokens se ESTIMAN desde caracteres (≈4 chars/token), la misma
 *    métrica que ya usa `usage.ts` para el volumen. Se marca con «≈»:
 *    es una estimación, no un dato del proveedor.
 */
import { VIGENCIA_MS, type Limites } from "./limites-medidos";

/** Ventana de referencia por defecto (tokens). 32k es un punto medio
 * honesto entre los gratis de ventana corta (8k) y los amplios (128k):
 * si tu modelo es de otro mundo, se cambia en Ajustes y ya. */
export const VENTANA_DEFECTO = 32_000;

/** Umbral a partir del cual el HUD avisa (amarillo). */
export const UMBRAL_AVISO = 80;

/** Umbral a partir del cual el HUD se pone rojo: aquí casi cualquier
 * modelo gratis ya está recortando. */
export const UMBRAL_ROJO = 95;

/** Caracteres por token para la estimación. El 4 es el clásico de la
 * familia de tokenizadores BPE para texto mixto español/código. */
export const CHARS_POR_TOKEN = 4;

export type NivelCtx = "ok" | "aviso" | "rojo";

/** Estima tokens desde caracteres. Redondeo hacia arriba: mejor avisar
 * un pelín antes que después. */
export function estimarTokensChars(chars: number): number {
  return Math.ceil(Math.max(0, chars) / CHARS_POR_TOKEN);
}

/** Estima los tokens de la conversación actual (mensajes ya enviados +
 * lo que hay escrito en el compositor, que también viajará). */
export function estimarTokensConversacion(
  mensajes: { role: string; content: string }[],
  inputExtra = 0
): number {
  const chars = mensajes.reduce(
    (n, m) => n + Math.max(0, m.content?.length ?? 0),
    Math.max(0, inputExtra)
  );
  return estimarTokensChars(chars);
}

/** Nivel del HUD según el porcentaje de ventana usado. */
export function nivelCtx(pct: number): NivelCtx {
  if (pct >= UMBRAL_ROJO) return "rojo";
  if (pct >= UMBRAL_AVISO) return "aviso";
  return "ok";
}

/** Formatea tokens para el HUD: 12.400 → «12,4k», 820 → «820». */
export function fmtTokens(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    // un decimal, coma decimal (español), sin ceros de relleno
    return `${k.toFixed(1).replace(/\.0$/, "").replace(".", ",")}k`;
  }
  return String(n);
}

/** Toda la información del HUD en un objeto: lo calcula el componente
 * y lo pinta tal cual. `pct` con un decimal, techo 999. */
export function calcularHud(
  tokensEstimados: number,
  ventana: number
): { tokens: number; pct: number; nivel: NivelCtx } {
  const v = Math.max(1000, ventana || VENTANA_DEFECTO);
  const pct = Math.min(999, Math.round((tokensEstimados / v) * 1000) / 10);
  return { tokens: tokensEstimados, pct, nivel: nivelCtx(pct) };
}

/** La ventana de referencia, mejorada con un dato real si lo hay.
 *
 * `limites-medidos.ts` aprende reactivamente el tope de tokens de entrada
 * cuando un proveedor lo rechaza de verdad («Limit 7000, Requested
 * 21138»). Si ese aprendizaje sigue fresco (misma vigencia que usa
 * `cabe()`, para no quedarse con un número de hace semanas) y es MÁS
 * PEQUEÑO que la ventana configurada, se usa él: es un dato real del
 * proveedor sobre ESTE modelo, mejor que la estimación genérica. Nunca al
 * revés — un límite aprendido nunca ensancha la ventana, solo la ajusta
 * cuando hay algo mejor que adivinar. */
export function ventanaReferencia(
  limites: Limites,
  modelKey: string | null | undefined,
  ventanaConfigurada: number,
  ahora: number = Date.now()
): number {
  const base = ventanaConfigurada || VENTANA_DEFECTO;
  if (!modelKey) return base;
  const m = limites[modelKey];
  if (!m || m.limite == null) return base;
  if (ahora - m.at > VIGENCIA_MS) return base;
  return Math.min(base, m.limite);
}
