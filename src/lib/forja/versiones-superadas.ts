/** Forja IA — No volver a mandar archivos que ya tienen una versión más nueva.
 *
 * En una conversación de Web Studio el gasto de tokens no está en las
 * instrucciones ni en la prosa: está en el código. Cada vuelta de «cambia el
 * color del botón» devuelve el `index.html` entero, y el historial lo vuelve a
 * mandar en TODOS los turnos siguientes. Con cinco vueltas sobre una página de
 * 20.000 caracteres, el modelo recibe 100.000 caracteres de HTML, de los que
 * solo sirven los últimos 20.000: el resto son versiones que ya nadie usa.
 *
 * La compresión (`compress.ts`) no puede con esto porque protege el código a
 * propósito —reescribirlo lo rompería—. Aquí no se reescribe nada: la versión
 * vieja se sustituye entera por una línea que dice qué había y dónde está la
 * buena. La última versión de cada archivo viaja intacta.
 *
 * ——— Las reglas, y por qué ———
 *
 *  · **Solo se quita lo que tiene sustituto.** Un bloque sale únicamente si
 *    un mensaje POSTERIOR trae el mismo archivo. Sin sustituto no hay nada que
 *    quitar: es la única copia.
 *  · **Un fragmento no sustituye a un archivo.** «Cambia esta línea» suele
 *    llegar con un bloque de tres líneas que también se llama `index.html`.
 *    Si se tomara como versión nueva, la página entera desaparecería del
 *    contexto y el modelo tendría que adivinarla. Por eso la versión nueva
 *    tiene que medir al menos la mitad que la vieja.
 *  · **Lo pequeño no se toca.** Por debajo de `MIN_CHARS` el ahorro no
 *    compensa perder el detalle.
 *  · **La pregunta viva no se toca.** Igual que en la compresión: lo que el
 *    usuario acaba de escribir va tal cual.
 *  · **Determinista.** Mismo historial, mismo resultado. Así el prefijo de la
 *    conversación solo cambia cuando llega una versión nueva de un archivo, y
 *    la caché del proveedor sigue sirviendo el resto del tiempo.
 *
 * Funciones puras: se prueban sin navegador.
 */
import { bloquesConNombre } from "./answer-files";

/** Por debajo de esto, el bloque viejo se deja: no merece la pena. */
export const MIN_CHARS = 600;

/** La versión nueva tiene que medir al menos esta fracción de la vieja para
 *  contar como sustituta y no como fragmento. */
export const FRACCION_SUSTITUTO = 0.5;

export interface MensajePodable {
  role: string;
  content: string;
}

export interface Poda<T extends MensajePodable> {
  mensajes: T[];
  /** bloques sustituidos por su marcador */
  bloques: number;
  /** caracteres que dejan de viajar (≥ 0) */
  ahorrados: number;
}

/** El texto que ocupa el lugar del bloque viejo. Corto, y dice dónde mirar. */
export function marcador(ruta: string, chars: number): string {
  return `[«${ruta}» (${chars.toLocaleString("es")} caracteres) omitido: hay una versión más reciente más abajo en la conversación]`;
}

/**
 * Sustituye las versiones viejas de cada archivo por un marcador.
 *
 * `protegido`: índice de un mensaje que no se modifica nunca (la pregunta
 * viva). Sus bloques sí cuentan como versión nueva de los anteriores.
 */
export function podarVersionesSuperadas<T extends MensajePodable>(
  mensajes: readonly T[],
  protegido = -1
): Poda<T> {
  // Tamaño de la versión más reciente de cada archivo, vista desde el final.
  // Se recorre hacia atrás: al llegar a un mensaje, `masNueva` tiene lo que
  // traen los mensajes POSTERIORES a él, que es lo único que puede sustituirlo.
  const masNueva = new Map<string, number>();
  const cortes: Array<Array<{ inicio: number; fin: number; ruta: string; chars: number }>> = mensajes.map(() => []);

  for (let i = mensajes.length - 1; i >= 0; i--) {
    const bloques = bloquesConNombre(mensajes[i].content);
    if (i !== protegido) {
      for (const b of bloques) {
        const nueva = masNueva.get(b.path);
        if (nueva === undefined) continue;
        if (b.text.length < MIN_CHARS) continue;
        if (nueva < b.text.length * FRACCION_SUSTITUTO) continue;
        cortes[i].push({ inicio: b.inicio, fin: b.fin, ruta: b.path, chars: b.text.length });
      }
    }
    // Dentro de un mismo mensaje, si un archivo sale dos veces, el que vale
    // para los mensajes anteriores es el último.
    for (const b of bloques) masNueva.set(b.path, b.text.length);
  }

  let bloques = 0;
  let ahorrados = 0;
  const out = mensajes.map((m, i) => {
    const c = cortes[i];
    if (!c.length) return m;
    let texto = m.content;
    // de atrás adelante para que las posiciones sigan valiendo
    for (const k of [...c].sort((a, b) => b.inicio - a.inicio)) {
      const nuevo = marcador(k.ruta, k.chars);
      ahorrados += k.fin - k.inicio - nuevo.length;
      bloques++;
      texto = texto.slice(0, k.inicio) + nuevo + texto.slice(k.fin);
    }
    return { ...m, content: texto };
  });

  return { mensajes: out, bloques, ahorrados: Math.max(0, ahorrados) };
}
