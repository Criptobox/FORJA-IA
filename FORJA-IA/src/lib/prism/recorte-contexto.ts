/** Forja IA — Cuando la conversación no cabe, recortarla en vez de morir.
 *
 * Hasta ahora, un «Request too large … Limit 7000, Requested 21138» tenía dos
 * finales: saltar a otro modelo, o —si no quedaba ninguno— dejar el error rojo
 * en pantalla. Los dos son malos cuando el modelo que no puede es justo el que
 * quieres usar: el problema no es el modelo, es que le estás mandando una
 * conversación de veintiún mil tokens para preguntarle «qué hacemos».
 *
 * Esto hace lo que haría cualquiera a mano: quitar lo viejo y volver a probar.
 *
 * ——— Las reglas, y por qué ———
 *
 *  · **La pregunta viva NUNCA se toca.** Es lo único que el usuario acaba de
 *    escribir; recortarla sería contestar a otra cosa.
 *  · **Se quitan turnos enteros, de los más viejos.** Cortar un mensaje por la
 *    mitad deja al modelo leyendo una frase sin final y respondiendo a un
 *    fantasma. Fuera el turno completo o se queda entero.
 *  · **Se dice exactamente qué se quitó.** Un recorte silencioso es la peor
 *    versión de esto: el modelo pierde el hilo, la respuesta sale rara y no
 *    hay forma de saber por qué. Por eso `recortar()` devuelve el número y el
 *    aviso, y quien llama tiene que enseñarlo.
 *  · **Si ni así cabe, se dice que no.** Cuando lo único que queda es la
 *    pregunta viva y sigue sin caber, no hay recorte posible: eso es un
 *    mensaje demasiado grande para ese modelo, y hay que cambiar de modelo.
 *
 * ——— Lo aproximado, dicho ———
 *
 * El tamaño se estima en caracteres ÷ 4, la misma regla del medidor de
 * contexto. No es el contador del proveedor. Por eso se recorta con un margen
 * por debajo del límite: apurar al carácter con una medida aproximada es pedir
 * un segundo rechazo.
 */

/** Lo mínimo que hace falta de un mensaje para poder medirlo y quitarlo. */
export interface MensajeMedible {
  role: string;
  content: string;
}

/** Cuánto se deja por debajo del límite del proveedor.
 *
 * 15 %: la estimación de caracteres ÷ 4 se queda corta con el español y con el
 * código, y el prompt de sistema (que viaja aparte y aquí no se cuenta) también
 * ocupa. Apurar al límite exacto con una medida aproximada garantiza volver a
 * fallar, y un segundo rechazo cuesta otra petición. */
export const MARGEN = 0.85;

/** Tokens aproximados de un texto. Caracteres ÷ 4, como el resto de la app. */
export function tokensAprox(texto: string): number {
  return Math.ceil(texto.length / 4);
}

export function tokensDe(mensajes: readonly MensajeMedible[]): number {
  return mensajes.reduce((a, m) => a + tokensAprox(m.content), 0);
}

export interface Recorte<T extends MensajeMedible> {
  /** los mensajes que se mandarán */
  mensajes: T[];
  /** cuántos se quitaron (0 = no hizo falta) */
  quitados: number;
  /** tokens aproximados que quedan */
  tokens: number;
  /** `false` si ni quitándolo todo cabe: entonces no hay recorte que valga */
  cabe: boolean;
}

/**
 * Recorta el historial para que quepa en `limite` tokens.
 *
 * Deja SIEMPRE el último mensaje del usuario (la pregunta viva) y va quitando
 * desde el principio —lo más viejo primero— hasta que la cuenta baja del
 * objetivo. Devuelve `cabe: false` si con la pregunta viva sola ya se pasa.
 */
export function recortar<T extends MensajeMedible>(
  mensajes: readonly T[],
  limite: number
): Recorte<T> {
  const objetivo = Math.max(1, Math.floor(limite * MARGEN));
  const total = tokensDe(mensajes);
  if (mensajes.length === 0 || total <= objetivo) {
    return { mensajes: [...mensajes], quitados: 0, tokens: total, cabe: true };
  }

  // La pregunta viva: el último `user`. Si no hay ninguno (raro), el último.
  let vivo = -1;
  for (let i = mensajes.length - 1; i >= 0; i--) {
    if (mensajes[i].role === "user") {
      vivo = i;
      break;
    }
  }
  if (vivo < 0) vivo = mensajes.length - 1;

  // Se quita desde el más viejo, sin tocar nunca el vivo ni lo que venga
  // después de él (con semilla de continuación, ahí va el trozo a empalmar).
  let desde = 0;
  const restantes = () => tokensDe(mensajes.slice(desde));
  while (desde < vivo && restantes() > objetivo) desde++;

  const out = mensajes.slice(desde);
  const tokens = tokensDe(out);
  return { mensajes: [...out], quitados: desde, tokens, cabe: tokens <= objetivo };
}

/** El aviso para la pantalla. `null` si no se quitó nada: un aviso que sale
 * siempre se deja de leer. */
export function avisoRecorte(r: Recorte<MensajeMedible>, modelId: string): string | null {
  if (r.quitados <= 0) return null;
  const m = r.quitados === 1 ? "1 mensaje viejo" : `${r.quitados} mensajes viejos`;
  return `No cabía en «${modelId}»: se quitaron ${m} del historial y se reintentó. La pregunta que acabas de escribir va entera.`;
}

/** Lo que se dice cuando ni recortando cabe. Distinto del anterior a
 * propósito: uno explica un apaño que funcionó, el otro un callejón. */
export function avisoNoCabeNiRecortando(modelId: string, limite: number): string {
  return `Ni quitando todo el historial cabe en «${modelId}» (admite ${limite.toLocaleString("es")} tokens). Hace falta otro modelo o un mensaje más corto.`;
}
