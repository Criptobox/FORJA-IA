/** Prism AI — Cuando el modelo pide una herramienta como TEXTO, no como
 * `tool_calls` estructurado.
 *
 * Reportado por un usuario dos veces seguidas en la misma conversación
 * (nvidia/nemotron vía OpenRouter, modo agente activo): la burbuja del
 * chat enseñaba literal `<function=write_file> <parameter=path>
 * index.html</parameter> <parameter=content>...` en vez de escribir el
 * archivo. El modelo SÍ intentaba llamar a la herramienta — con la
 * plantilla de function-calling de su propio entrenamiento (variante
 * Llama-3/Hermes), no con el campo `tool_calls` que pide la API de
 * OpenAI. El proveedor la deja pasar tal cual, como texto normal:
 * `tools-translate.ts` (`parseToolCallsFromChunk`) solo mira
 * `delta.tool_calls`, así que nunca la ve, y `ejecutarConTools` no tenía
 * dónde mirar más.
 *
 * Esto reconoce esa plantilla y la convierte en `ToolCall[]` de verdad,
 * para que se ejecute igual que si hubiera llegado estructurada — en vez
 * de enseñarle al usuario la sintaxis interna de un modelo.
 *
 * Formato reconocido:
 *   <function=NOMBRE>
 *     <parameter=CLAVE>VALOR</parameter>
 *     ...
 *   </function>
 *
 * Nunca lanza: un cierre roto (respuesta cortada a mitad) simplemente no
 * cuenta como llamada — mejor no ejecutar nada que ejecutar con un
 * argumento a medias.
 */

import type { ToolCall } from "./tools-catalog";

const RE_FUNCION = /<function=([a-z_][a-z0-9_]*)>([\s\S]*?)<\/function>/gi;
const RE_PARAMETRO = /<parameter=([a-z_][a-z0-9_]*)>([\s\S]*?)<\/parameter>/gi;

/** Comprobación barata: ¿vale la pena correr el parser completo? Evita
 * pasar cada trozo de texto normal por dos regex globales. */
export function pareceLlamadaEnTexto(texto: string): boolean {
  return /<function=[a-z_]/i.test(texto);
}

/** Extrae las llamadas completas (con su `</function>` de cierre). Una
 * llamada cortada a mitad de una respuesta truncada no se cuenta: sin
 * cierre no hay forma de saber si el último parámetro quedó completo. */
export function parseLlamadasEnTexto(texto: string): ToolCall[] {
  const llamadas: ToolCall[] = [];
  RE_FUNCION.lastIndex = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = RE_FUNCION.exec(texto))) {
    const nombre = m[1];
    const cuerpo = m[2];
    const args: Record<string, unknown> = {};
    RE_PARAMETRO.lastIndex = 0;
    let p: RegExpExecArray | null;
    while ((p = RE_PARAMETRO.exec(cuerpo))) {
      args[p[1]] = p[2].trim();
    }
    llamadas.push({ id: `call_texto_${i++}`, name: nombre, args });
  }
  return llamadas;
}

/** Lo que queda del texto sin las llamadas — normalmente nada, si el
 * modelo solo escribió la plantilla. Lo poco que sobre (una frase antes o
 * después) sí merece enseñarse. */
export function quitarLlamadasEnTexto(texto: string): string {
  return texto.replace(RE_FUNCION, "").trim();
}
