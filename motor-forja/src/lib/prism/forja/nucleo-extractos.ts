/** FORJA IA — Extractores de texto de FORJA IA.
 *
 * Utilidades puras para sacar artefactos de las respuestas de los modelos.
 * Viven en un archivo propio para que nucleo.ts y maqueta.ts compartan la
 * misma lógica sin importarse entre sí (evita ciclos de módulos).
 */

/** Extrae el primer bloque de código cercado del texto del Codificador. */
export function extraerCodigo(texto: string): string {
  const m = texto.match(/```[a-zA-Z]*\s*\n([\s\S]*?)```/);
  if (m) return m[1].trim();
  // sin cercado: si parece HTML va tal cual (algunos modelos lo sueltan así)
  const recorte = texto.match(/(<!DOCTYPE[\s\S]*|<html[\s\S]*)/i);
  return recorte ? recorte[1].trim() : texto.trim();
}

/** Extrae las decisiones del Codificador para alimentar la memoria. */
export function extraerDecisiones(texto: string): string[] {
  const m = texto.match(/<decisiones>([\s\S]*?)<\/decisiones>/i);
  if (!m) return [];
  return m[1]
    .split(/\n+/)
    .map((l) => l.trim().replace(/^[-*\d.)\s]+/, "").trim())
    .filter(Boolean);
}
