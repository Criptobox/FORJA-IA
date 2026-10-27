/** Forja IA — Reenvío del razonamiento al continuar una conversación con
 * herramientas.
 *
 * Los modelos que razonan (DeepSeek V4, MiMo, y los que sirve OpenCode Zen)
 * devuelven su razonamiento en `reasoning_content`. Cuando piden una
 * herramienta y el agente vuelve a llamar con el resultado, la API EXIGE que
 * ese razonamiento vuelva en el mensaje del asistente; si no, contesta 400
 * («Upstream request failed»). Sin tools el mismo modelo responde 200, por eso
 * un «Hola» funciona y el modo agente se rompe en la segunda vuelta
 * (anomalyco/opencode #36354).
 *
 * Solo se reenvía donde está documentado: mandar un campo desconocido a otro
 * proveedor (OpenAI, Groq…) puede dar 400 por el motivo contrario. Todo puro. */

/** ¿Este proveedor/modelo quiere su `reasoning_content` de vuelta? */
export function reenviaRazonamiento(providerId: string, modelId: string): boolean {
  if (providerId === "deepseek" || providerId === "opencode") return true;
  return /deepseek|mimo/i.test(modelId);
}

/** Campo extra del mensaje del asistente, o nada. Nunca manda vacío. */
export function camposDeRazonamiento(
  providerId: string,
  modelId: string,
  razonamiento: string | undefined
): { reasoning_content: string } | Record<string, never> {
  const r = (razonamiento ?? "").trim();
  if (!r || !reenviaRazonamiento(providerId, modelId)) return {};
  return { reasoning_content: razonamiento as string };
}
