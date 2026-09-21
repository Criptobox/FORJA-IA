/** FORJA IA — CONTINUACIÓN A NIVEL NÚCLEO (v4.2): el segundo cinturón
 * anti-truncamiento, y el que ahorra tokens de verdad.
 *
 * ─── Por qué dos cinturones ───
 * El adaptador-resiliente (v4.1) ya continúa cuando el PROVEEDOR lo dice:
 * `finish_reason = length`. Pero esa señal no siempre está disponible (un
 * chat-client simple no mira finish_reason) y no siempre basta: cuando se
 * agotan las continuaciones del adaptador, el texto sigue saliendo cortado
 * y el bucle normal lo pasaría al Revisor — que lo rechaza — para luego
 * REGENERAR la página entera desde la ficha. Esa regeneración es la llamada
 * más cara del pipeline: ficha + ADN + código actual re-pagados en cada ronda.
 *
 * ─── La solución ───
 * El núcleo mira la SALIDA con un chequeo estructural GRATIS (determinista,
 * sin modelo): ¿hay una cerca ``` sin cerrar? ¿un <html> sin </html>? ¿un
 * <style> o <script> abierto? Si la salida está estructuralmente rota, el
 * núcleo pide CONTINUAR EXACTAMENTE donde se cortó (misma disciplina del
 * continuar.ts del host) y concatena — antes de gastar un Revisor o una
 * ronda entera de regeneración.
 *
 * Los dos cinturones NO se pisan: si el adaptador ya compuso un texto
 * completo, `esTruncadoEstructural` da falso y aquí no se llama a nadie.
 * Si el adaptador no pudo terminar el trabajo, el núcleo cierra la herida
 * con contexto completo (rol, ronda, streaming) y a coste de cola.
 *
 * Reglas de la casa: sin red, sin React, sin storage. TypeScript estricto.
 */

import type { LlamadaModelo, RolForja } from "./tipos";

/* ══════════════════════════ detección ══════════════════════════ */

/** ¿La salida quedó estructuralmente rota? Chequeo 100% determinista:
 *
 *  1. Cercados ``` impares: el Codificador envuelve el código en ```html
 *     … ``` — un impar significa que el corte cayó DENTRO del bloque.
 *  2. `<html` sin `</html>`: página a medias (el caso más caro).
 *  3. `<style>`/`<script>` abierto sin cerrar: el CSS/JS quedó por la mitad.
 *  4. La salida termina con un `<` solitario o en una etiqueta abierta
 *     evidente (`<div cl`): el modelo quedó escribiendo una etiqueta.
 *
 * FALSOS POSITIVOS controlados: un texto que MUESTRE html escapado o cite
 * etiquetas sueltas no abre `<html` con `<` real y no dispara la regla 2;
 * las reglas 1 y 3 exigen que el texto sea largo (>= 200 caracteres) para
 * no dispararse con respuestas cortas que citan una cerca a modo de ejemplo.
 */
export function esTruncadoEstructural(texto: string): boolean {
  const t = texto ?? "";
  if (!t.trim()) return false;

  // 1. cercados ``` impares (se ignoran los ``` dentro de líneas que solo
  //    los citan: `'''`-style no existe aquí, el formato es uniforme)
  const cercas = (t.match(/```/g) ?? []).length;
  if (cercas % 2 === 1) return true;

  // 2/3. páginas y bloques a medias — solo con texto que aspire a ser página
  const minLargo = 200;
  if (t.length >= minLargo) {
    const abreHtml = /<html[\s>]/i.test(t);
    const cierraHtml = /<\/html\s*>/i.test(t);
    if (abreHtml && !cierraHtml) return true;
    const abreEstilo = /<style[\s>]/i.test(t);
    const cierraEstilo = /<\/style\s*>/i.test(t);
    if (abreEstilo && !cierraEstilo) return true;
    const abreScript = /<script[\s>]/i.test(t);
    const cierraScript = /<\/script\s*>/i.test(t);
    if (abreScript && !cierraScript) return true;
  }

  // 4. termina dentro de una etiqueta abierta: el último '<' visible no
  //    tiene '>' después (y no es un comparador tipo «a < b» seguido de texto)
  const ultima = t.lastIndexOf("<");
  if (ultima !== -1 && ultima > t.length - 80) {
    const cola = t.slice(ultima);
    if (!cola.includes(">") && /^[a-zA-Z!\/]/.test(cola.slice(1))) return true;
  }
  return false;
}

/* ══════════════════════════ el prompt de continuación ════════════════ */

/** La petición de continuación del NÚCLEO: el modelo debe SEGUIR el texto,
 * no reescribirlo. Igual disciplina que la del adaptador (misma función
 * compartida desde v4.2): cola larga (600) porque el corte estructural
 * suele caer dentro de código donde el punto exacto importa más. */
export function promptContinuacion(textoCortado: string): string {
  const cola = textoCortado.slice(-600);
  return `Tu respuesta anterior se CORTÓ por el límite de longitud del proveedor. Esto es lo último que escribiste:

---ÚLTIMAS LÍNEAS---
${cola}
---FIN---

CONTINÚA EXACTAMENTE donde lo dejaste, como si fuera el mismo texto cortado en medio de una palabra:
· NO repitas nada de lo que ya escribiste.
· NO resumas, NO comentes, NO pidas permiso, NO añadas encabezados nuevos.
· Continúa el contenido línea a línea desde el punto exacto del corte.
· Si el corte ocurrió dentro de un bloque de código, continúa el código (no abras un cercado nuevo).
· Si el contenido ya estaba completo, escribe únicamente: FORJA-FIN`;
}

/** Quita el marcador de fin y los cercados redundantes de la pieza de
 * continuación antes de concatenarla. El texto combinado se re-parsea
 * aguas abajo (extraerCodigo), así que el pegado debe ser limpio. */
export function limpiaContinuacion(pieza: string): string {
  let t = pieza.trim();
  t = t.replace(/\s*FORJA-FIN\s*$/, "");
  t = t.replace(/^FORJA-FIN\s*$/, "");
  t = t.replace(/```[a-z]*\s*$/, ""); // cercado de apertura vacío residual
  return t;
}

/* ══════════════════════════ el bucle de continuación ════════════════ */

/** Tope de continuaciones DEL NÚCLEO por llamada. Es el segundo cinturón:
 * con el del adaptador (2) suman un máximo de 4 piezas — y en la práctica
 * con techos de 16k casi nunca se llega ni a la primera. */
export const MAX_CONTINUACIONES_NUCLEO = 2;

/** Opciones de continuarSalidaTruncada(). `continuarCon` es la MISMA llamada
 * (mismo modelo/rol/temperatura/techo) que ya preparó el núcleo, con el
 * mensaje de usuario sustituido por el prompt de continuación. */
export interface OpcionesContinuacion {
  salida: string;
  /** continúa con ESTA llamada (el núcleo la prepara con modelo, rol,
   * temperatura y techo de salida ya resueltos) */
  continuarCon: (user: string) => Promise<string>;
  /** avisos para la UI: n es 1-based por pieza de continuación */
  onContinuacion?: (n: number) => void;
  /** techo de piezas (defecto MAX_CONTINUACIONES_NUCLEO) */
  maxContinuaciones?: number;
}

/** Resultado: el texto final (completo si la continuación lo logró) y
 * cuántas piezas se añadieron — para la telemetría y la traza. */
export interface ResultadoContinuacion {
  texto: string;
  continuaciones: number;
  /** true si AÚN queda rota tras agotar el presupuesto: aguas abajo los
   * chequeos estáticos y el Revisor la recogen (nunca un bucle infinito) */
  sigueTruncada: boolean;
}

/** Continúa una salida estructuralmente rota hasta cerrarla o agotar el
 * presupuesto. NO lanza: si una continuación falla (red, cuota), devuelve
 * lo que haya — que es siempre más útil que la excepción original. */
export async function continuarSalidaTruncada(
  opciones: OpcionesContinuacion
): Promise<ResultadoContinuacion> {
  const { salida, continuarCon, onContinuacion } = opciones;
  const max = opciones.maxContinuaciones ?? MAX_CONTINUACIONES_NUCLEO;

  let texto = salida;
  let n = 0;

  // Un texto casi vacío no se continúa: no hay herida que cerrar y el
  // error real (proveedor caído) ya lo gestionó quien llamó. Se mide la
  // longitud BRUTA: un HTML largo que acaba en espacios sigue siendo largo.
  while (n < max && texto.length > 40 && esTruncadoEstructural(texto)) {
    n += 1;
    onContinuacion?.(n);
    try {
      const pieza = await continuarCon(promptContinuacion(texto));
      if (!pieza.trim()) break; // continuación vacía: no insistir
      texto = `${texto}\n${limpiaContinuacion(pieza)}`;
    } catch {
      break; // red/cuota caída: se entrega lo que hay, detectado aguas abajo
    }
  }

  return { texto, continuaciones: n, sigueTruncada: esTruncadoEstructural(texto) };
}

/** Conveniencia para llamadores que ya tienen la LlamadaModelo y sus args:
 * arma el closure `continuarCon` con el mismo modelo, rol, temperatura y
 * techo de salida. Exportada para que director.ts y bucle-mejora.ts
 * reutilicen exactamente el mismo comportamiento sin duplicar. */
export function continuarConLlamada(
  llamar: LlamadaModelo,
  base: {
    providerId: string;
    modelId: string;
    system: string;
    temperatura: number;
    rol: RolForja;
    maxTokens?: number;
    onFragmento?: (texto: string) => void;
  }
): (user: string) => Promise<string> {
  return (user: string) =>
    llamar({
      providerId: base.providerId,
      modelId: base.modelId,
      system: base.system,
      user,
      temperatura: base.temperatura,
      rol: base.rol,
      maxTokens: base.maxTokens,
      onFragmento: base.onFragmento,
    });
}
