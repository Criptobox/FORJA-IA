/** Forja IA — Cuando piden un PROYECTO, no una página suelta.
 *
 * La skill «Desarrollador web experto» manda entregar SIEMPRE un único
 * archivo HTML autónomo (`skills-data.ts`) — sin excepción, ni para cuando
 * el encargo es explícitamente «un proyecto para un repo». Es a propósito
 * para la mayoría de encargos: la vista previa en vivo mientras el modelo
 * escribe funciona sin fricción con un solo archivo. Pero es una
 * contradicción real cuando el usuario pide varios archivos y la skill,
 * fija, gana en silencio.
 *
 * Esto detecta esa intención y da la instrucción que la amplía — SOLO en
 * ese caso. El resto de encargos (landing, app, juego) siguen en un solo
 * archivo, tal cual.
 */

const SENALES = /\b(proyecto|repo|repositorio|varios archivos|multi.?archivo|estructura de carpetas|carpetas separadas|separad[oa]s? en (varios )?archivos|varias p[áa]ginas)\b/i;

/** ¿El encargo pide explícitamente un proyecto de VARIOS archivos? */
export function pideVariosArchivos(prompt: string): boolean {
  const t = prompt ?? "";
  if (!t.trim()) return false;
  return SENALES.test(t);
}

/** La excepción a «un único archivo», tal cual se añade al prompt. Se
 * escribe como AMPLIACIÓN de la skill, no como su sustituta: sigue
 * pidiendo lo mismo (responsive, sin dependencias de build, un archivo por
 * bloque de código) salvo en el punto que cambia. */
export const INSTRUCCION_VARIOS_ARCHIVOS = `### Excepción: aquí se pide un PROYECTO, no una página suelta
Se ha pedido explícitamente un proyecto de varios archivos (para un repo, con estructura de carpetas). Amplía la skill de desarrollador web en este punto: en vez de un único HTML autónomo, entrega **index.html, styles.css y app.js separados**, cada uno completo en su propio bloque de código con su nombre de archivo antes o dentro de la cerca (p. ej. \`\`\`html — index.html). Enlázalos de verdad: \`<link rel="stylesheet" href="styles.css">\` en el \`<head>\` y \`<script src="app.js"></script>\` antes de \`</body>\`. Sigue sin dependencias de build.`;
