/** Forja IA — Nombres de archivo dentro de un texto («index.html», «src/app.js»).
 *
 * Varias partes de la app buscan rutas en lo que escribe la persona o el
 * modelo (contexto automático, reglas «no tocar», memoria, citas). Antes cada
 * una llevaba su propia copia de `/[\w./-]+\.(html?|…)/g`, y ese patrón era
 * CUADRÁTICO: en una palabra larga sin punto (un bloque minificado, una
 * cadena base64, «rrrr…») probaba desde cada letra, se comía la palabra
 * entera y retrocedía buscando el punto. Una conversación con 2 mensajes de
 * 60.000 caracteres tardaba ~30 s en abrirse solo por esto.
 *
 * `(?<![\w./-])` obliga a empezar al principio de una «palabra de ruta»: cada
 * palabra se recorre una vez. Encuentra exactamente lo mismo, porque si una
 * palabra contiene «.html», la coincidencia más a la izquierda ya empezaba
 * en su primera letra. */

/** Extensiones que cuentan como archivo de proyecto. */
export const EXT_RUTA = "html?|css|js|jsx|ts|tsx|json|md|svg|py|mjs|cjs";

/** Patrón lineal de una ruta con extensión (global: úsalo con `match`). */
export const RX_RUTA = new RegExp(`(?<![\\w./-])[\\w./-]+\\.(?:${EXT_RUTA})`, "g");

/** Las rutas que aparecen en un texto, en orden y con repetidos. */
export function rutasEnTexto(texto: string): string[] {
  return texto.match(RX_RUTA) ?? [];
}
