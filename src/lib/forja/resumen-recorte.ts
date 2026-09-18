/** Forja IA — Resumir lo que se recorta, en vez de tirarlo.
 *
 * La v4.6.0 dejó de morir cuando la conversación no cabía: quita los mensajes
 * viejos y reintenta. Funciona, pero **lo que quita se pierde**. Si en el
 * turno 3 acordasteis el nombre del proyecto y la paleta, y en el turno 40 eso
 * se recorta, el modelo deja de saberlo y empieza a contradecirse. El usuario
 * ve una app que «se olvida», que es peor que una que falla: al menos el fallo
 * se ve.
 *
 * Esto sustituye el hueco por una nota: un resumen del tramo que se fue.
 *
 * ——— Las reglas ———
 *
 *  · **Se marca como resumen, siempre.** Va con un encabezado explícito para
 *    que el modelo sepa que eso no lo dijo nadie con esas palabras: es un
 *    apunte de la app. Colarlo como si fuera un mensaje real del usuario es
 *    ponerle palabras en la boca.
 *  · **Cuesta una llamada, y se dice.** No es gratis; por eso solo se hace al
 *    recortar, una vez, y nunca en un tramo minúsculo que no compensa.
 *  · **Si falla, se sigue sin resumen.** Un resumen es una mejora, no un
 *    requisito: si el modelo no contesta, el recorte a secas ya funcionaba.
 *  · **Hechos, no impresiones.** Lo que hay que conservar de una conversación
 *    larga son decisiones, nombres, rutas y lo que quedó pendiente. Un resumen
 *    literario de lo simpático que fue el turno 8 no sirve para nada.
 */

/** Por debajo de esto no se resume: gastar una llamada para conservar cuatro
 * líneas no compensa, y el propio encabezado del resumen ya ocuparía casi lo
 * mismo que el texto original. */
export const MIN_CHARS_PARA_RESUMIR = 1200;

/** Y por encima, tampoco: un tramo gigantesco no cabría en la llamada del
 * resumen, que es justo el problema del que venimos. Se recorta a esto. */
export const MAX_CHARS_A_RESUMIR = 24_000;

export interface MensajeSimple {
  role: string;
  content: string;
}

/** Encabezado con el que viaja el resumen. Se usa también para reconocerlo:
 * un resumen no se vuelve a resumir. */
export const MARCA_RESUMEN = "[Resumen automático de la parte antigua de esta conversación]";

export function esResumen(m: MensajeSimple): boolean {
  return m.content.startsWith(MARCA_RESUMEN);
}

/** Convierte el tramo que se va en el texto que se le manda al modelo.
 *
 * Se recorta por el PRINCIPIO si no cabe: lo más viejo de lo viejo es lo que
 * menos falta hace, y así el resumen cubre al menos lo más reciente del tramo
 * perdido. */
export function textoDelTramo(mensajes: readonly MensajeSimple[]): string {
  const lineas = mensajes.map((m) => `${m.role === "user" ? "Usuario" : "Asistente"}: ${m.content}`);
  let texto = lineas.join("\n\n");
  if (texto.length > MAX_CHARS_A_RESUMIR) {
    texto = "…(recortado)…\n\n" + texto.slice(texto.length - MAX_CHARS_A_RESUMIR);
  }
  return texto;
}

/** ¿Merece la pena gastar una llamada en resumir esto? */
export function mereceResumen(mensajes: readonly MensajeSimple[]): boolean {
  if (mensajes.length === 0) return false;
  // Un tramo que ya es un resumen no se re-resume: cada pasada pierde algo, y
  // resumir un resumen tres veces deja una frase que no dice nada.
  const utiles = mensajes.filter((m) => !esResumen(m));
  if (utiles.length === 0) return false;
  return utiles.reduce((a, m) => a + m.content.length, 0) >= MIN_CHARS_PARA_RESUMIR;
}

/** La instrucción. Pide hechos y prohíbe adornos, porque lo que se conserva
 * tiene que servirle al modelo para seguir trabajando, no para hacerse una
 * idea general. */
export function promptDeResumen(tramo: string): string {
  return [
    "Resume este tramo de conversación para que otro modelo pueda continuarla sin haberlo leído.",
    "",
    "Reglas:",
    "- Solo hechos: decisiones tomadas, nombres propios, rutas de archivo, versiones, datos que se acordaron y lo que quedó pendiente.",
    "- Nada de valoraciones ni de resumir el tono. Si algo no se decidió, dilo como pendiente.",
    "- Máximo 200 palabras. Lista con guiones.",
    "- Escribe en español y sin preámbulo: empieza directamente por el primer guion.",
    "",
    "--- TRAMO ---",
    tramo,
  ].join("\n");
}

/** El mensaje que ocupa el hueco de lo recortado. */
export function notaDeResumen(resumen: string, quitados: number): MensajeSimple {
  const limpio = resumen.trim();
  return {
    role: "user",
    content: [
      MARCA_RESUMEN,
      `Se apartaron ${quitados} mensaje(s) antiguos para que la conversación cupiera. Esto es lo que decían:`,
      "",
      limpio,
      "",
      "(Fin del resumen. Lo que sigue son mensajes literales.)",
    ].join("\n"),
  };
}

/** ¿Sirve lo que contestó el modelo? Un resumen vacío o de dos palabras es
 * peor que ninguno: ocupa sitio y no dice nada. */
export function resumenUtil(texto: string): boolean {
  return texto.trim().length >= 40;
}
