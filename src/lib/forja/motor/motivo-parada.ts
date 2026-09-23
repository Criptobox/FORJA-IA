/** FORJA IA — Por qué paró el modelo, según el propio proveedor.
 *
 * Los tres protocolos (OpenAI, Anthropic, Gemini) mandan un campo diciendo
 * por qué terminaron (`finish_reason`, `stop_reason`, `finishReason`) y el
 * flujo de FORJA no lo leía. La detección de respuestas cortadas va por la
 * FORMA del texto —un cercado ``` sin pareja, un </html> ausente—, que
 * funciona pero es un indicio. Esto es el proveedor diciéndolo con todas
 * las letras.
 *
 * Importa donde el indicio falla: un texto largo que se corta a mitad de
 * una frase, sin bloque de código de por medio, no deja ninguna señal en la
 * forma. `finish_reason: "length"` sí.
 *
 * Portado del módulo finish-reason.ts del host (FORJA IA, antes prism-ai)
 * para que el módulo siga siendo AUTOCONTENIDO: cero dependencias, sin red,
 * sin React. La fuente de la verdad de la traducción vive aquí; si el host
 * ya tiene su copia, ambas entienden los mismos valores crudos.
 *
 * Quién lo usa: `adaptador-resiliente.ts`. El transporte extrae el campo
 * crudo de su protocolo y aquí se traduce a `MotivoParada`.
 */

export type MotivoParada =
  /** terminó de decir lo que tenía que decir */
  | "fin"
  /** se quedó sin presupuesto de salida: la respuesta está CORTADA */
  | "longitud"
  /** paró para llamar a una herramienta */
  | "herramienta"
  /** el proveedor lo cortó por su filtro de contenido */
  | "filtro"
  /** el proveedor no dijo nada, o dijo algo que no conocemos */
  | "desconocido";

/** Valores literales de cada protocolo. Se comparan en minúsculas porque
 *  Gemini los manda en mayúsculas y los routers copian de todo. */
const LONGITUD = [
  "length",
  "max_tokens",
  "maxtokens",
  "max_output_tokens",
  "model_length",
];
const HERRAMIENTA = ["tool_calls", "tool_use", "function_call", "tool"];
const FILTRO = [
  "content_filter",
  "safety",
  "recitation",
  "blocklist",
  "prohibited_content",
];
const FIN = ["stop", "end_turn", "stop_sequence", "eos", "complete"];

/** Traduce el valor crudo de cualquiera de los tres protocolos. */
export function motivoDeParada(raw: unknown): MotivoParada {
  if (typeof raw !== "string" || !raw.trim()) return "desconocido";
  const v = raw.trim().toLowerCase();
  if (LONGITUD.includes(v)) return "longitud";
  if (HERRAMIENTA.includes(v)) return "herramienta";
  if (FILTRO.includes(v)) return "filtro";
  if (FIN.includes(v)) return "fin";
  return "desconocido";
}

/** Saca el motivo del cuerpo (o del chunk) de cada protocolo.
 *
 * Se mira el ÚLTIMO que llegue con valor: en streaming, los chunks
 * intermedios traen `finish_reason: null` y solo el último lo rellena.
 * El transporte de turno puede usar esto si recibe el JSON entero, o
 * extraer el campo a mano y pasarle `motivoDeParada` directamente. */
export function motivoDeRespuesta(
  protocolo: "openai" | "anthropic" | "gemini",
  json: unknown
): MotivoParada | null {
  if (!json || typeof json !== "object") return null;
  const j = json as Record<string, unknown>;

  if (protocolo === "anthropic") {
    // no-streaming: {stop_reason}. streaming: {type:"message_delta", delta:{stop_reason}}
    const delta = j.delta as Record<string, unknown> | undefined;
    const raw = j.stop_reason ?? delta?.stop_reason;
    return raw == null ? null : motivoDeParada(raw);
  }

  if (protocolo === "gemini") {
    const cands = j.candidates as { finishReason?: unknown }[] | undefined;
    const raw = cands?.[0]?.finishReason;
    return raw == null ? null : motivoDeParada(raw);
  }

  const choices = j.choices as { finish_reason?: unknown }[] | undefined;
  const raw = choices?.[0]?.finish_reason;
  return raw == null ? null : motivoDeParada(raw);
}

/** ¿Es este motivo una respuesta cortada por falta de sitio?
 *  El disparador de la CONTINUACIÓN automática del adaptador. */
export function esCortePorLongitud(m: MotivoParada | null): boolean {
  return m === "longitud";
}

/** Frase para la interfaz o el registro. `null` cuando no hay nada que
 *  contar: un final normal no merece un aviso, y un motivo desconocido
 *  tampoco —decir algo ahí sería inventarse un dato. */
export function mensajeParada(m: MotivoParada | null): string | null {
  switch (m) {
    case "longitud":
      return "El proveedor cortó la respuesta por longitud.";
    case "filtro":
      return "El proveedor cortó la respuesta con su filtro de contenido.";
    default:
      return null;
  }
}
