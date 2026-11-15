/** Forja IA — ¿Qué clave quedó guardada, y tiene pinta de serlo?
 *
 * Cuando «Probar modelos» devolvía 401 en casi todos, el panel decía «la clave
 * no es válida» sin enseñar CUÁL clave había guardada. Y casi siempre el
 * problema no es la cuenta sino lo que se pegó: un marcador del ejemplo de la
 * documentación (`$NVIDIA_API_KEY`, `YOUR_API_KEY`), la palabra «Bearer »
 * delante, comillas, un salto de línea, o la clave de otro proveedor.
 *
 * Aquí se resume lo guardado sin revelarlo entero (inicio, final y longitud) y
 * se avisa de lo que huele mal. Puro y sin red: no prueba que la clave sirva,
 * solo detecta lo que NO puede servir.
 */

/** Cómo empiezan las claves de cada proveedor (solo los que lo hacen siempre). */
const PREFIJO: Record<string, { prefijo: string; ejemplo: string }> = {
  nvidia: { prefijo: "nvapi-", ejemplo: "nvapi-…" },
  groq: { prefijo: "gsk_", ejemplo: "gsk_…" },
  openrouter: { prefijo: "sk-or-", ejemplo: "sk-or-…" },
  gemini: { prefijo: "AIza", ejemplo: "AIza…" },
  anthropic: { prefijo: "sk-ant-", ejemplo: "sk-ant-…" },
  cerebras: { prefijo: "csk-", ejemplo: "csk-…" },
};

/** Lo que se pega por error en lugar de la clave: variables y ejemplos. */
const MARCADOR =
  /^\$|\$\{|^%|^<.*>$|^\{.*\}$|(^|[_-])(your|tu|mi)[_-]?(api)?[_-]?(key|clave|token)|api[_-]?key[_-]?(here|aqui|required)|required_if|^x{4,}|\*{3,}|…|\.{3,}|^(null|undefined|none|changeme|placeholder|pega)/i;

/** «nvapi-Ab…x9 · 70 caracteres»: reconocible sin dejar la clave a la vista. */
export function huellaDeClave(clave: string): string {
  const k = (clave ?? "").trim();
  if (!k) return "";
  const n = [...k].length;
  if (n <= 8) return `${k.slice(0, 2)}… · ${n} caracteres`;
  return `${k.slice(0, Math.min(8, Math.max(4, n - 6)))}…${k.slice(-2)} · ${n} caracteres`;
}

/** Lo que huele mal en la clave guardada. Vacío = nada que objetar. */
export function revisarClave(proveedor: string, clave: string): string[] {
  const k = clave ?? "";
  if (!k.trim()) return [];
  const t = k.trim();
  const avisos: string[] = [];

  if (/\s/.test(t)) avisos.push("Tiene espacios o saltos de línea: una clave va de una sola pieza.");
  if (/^bearer\s/i.test(t)) avisos.push("Empieza por «Bearer »: eso es de la cabecera, no de la clave. Quítalo.");
  if (/^["'“”‘’`]|["'“”‘’`]$/.test(t)) avisos.push("Lleva comillas pegadas: quítalas.");
  if (/^https?:\/\//i.test(t)) avisos.push("Es una dirección web, no una clave.");
  if (MARCADOR.test(t)) avisos.push("Parece un marcador del ejemplo de la documentación, no una clave real.");
  else if ([...t].length < 16) avisos.push("Es muy corta para ser una clave.");

  // NVIDIA: «nvapi-» + 64 caracteres. Más larga suele ser una clave pegada
  // encima de otra (el campo va oculto con puntos y no se ve lo que había).
  if (proveedor === "nvidia" && !avisos.length && t.startsWith("nvapi-") && [...t].length !== 70) {
    avisos.push(
      `Las claves de NVIDIA suelen tener 70 caracteres y esta tiene ${[...t].length}: puede que se pegara encima de otra. Borra el campo entero y pégala de nuevo.`
    );
  }

  const p = PREFIJO[proveedor];
  if (p && !avisos.length && !t.startsWith(p.prefijo)) {
    avisos.push(`Las claves de este proveedor empiezan por «${p.prefijo}». ¿Es de otro?`);
  }
  return avisos;
}
