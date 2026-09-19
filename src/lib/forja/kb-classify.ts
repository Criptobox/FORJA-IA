/** Forja IA — Clasificar un recurso subido con el modelo activo de la
 * conversación (Knowledge Base, Fase 2/3 combinadas para "Importar
 * recursos"). Mismo patrón que `pedirCritica` en `use-agent-tools.ts`
 * (visual_review): una llamada de un solo turno a `streamChat`, con el
 * MISMO proveedor/modelo/clave configurados — no hay un "modelo de
 * clasificación" aparte. Si no hay modelo configurado o la llamada falla,
 * se devuelve `null` y quien llame deja el recurso como "pendiente": jamás
 * se inventa una categoría para rellenar el hueco.
 */
import { streamChat, type StreamMessage } from "./chat-client";
import type { AppSettings, ProviderConfig, ProviderId } from "./types";

export interface KBClassifyDeps {
  providerId: ProviderId;
  modelId: string;
  config: ProviderConfig;
  settings: AppSettings;
  signal: AbortSignal;
  stream: typeof streamChat;
}

export interface KBClassifyInput {
  name: string;
  mimeType: string;
  sizeBytes: number;
  /** primeras ~2000 letras si es un archivo de texto legible; vacío si no aplica. */
  textExcerpt?: string;
  /** categorías que ya existen en el índice, para reutilizar en vez de inventar sinónimos. */
  existingCategories: string[];
}

export interface KBClassifyResult {
  category: string;
  technology: string;
  tags: string[];
}

function buildPrompt(input: KBClassifyInput): string {
  const categorias = input.existingCategories.length ? input.existingCategories.join(", ") : "(ninguna todavía)";
  const contenido = input.textExcerpt
    ? `Primeras líneas del contenido:\n${input.textExcerpt}`
    : "(sin contenido de texto legible: clasifica solo por nombre y tipo)";
  return [
    "Clasifica este recurso para una Knowledge Base de diseño y código. Responde SOLO con JSON, sin explicación ni markdown, con esta forma exacta:",
    '{"category": "...", "technology": "...", "tags": ["...", "..."]}',
    "",
    "Reglas:",
    `- "category": una palabra o frase corta en minúscula (ej. "componentes-ui", "referencias-visuales"). Si alguna de estas categorías ya existentes encaja, ÚSALA TAL CUAL en vez de inventar una parecida: ${categorias}.`,
    '- "technology": la tecnología principal si se puede inferir (ej. "React", "Figma", "Python"), o "" si no aplica.',
    '- "tags": de 2 a 5 palabras clave en minúscula.',
    "",
    `Archivo: "${input.name}" (${input.mimeType || "tipo desconocido"}, ${input.sizeBytes} bytes).`,
    contenido,
  ].join("\n");
}

/** Saca el primer bloque `{...}` del texto y lo valida — los modelos a
 * veces envuelven el JSON en explicación o en una valla de código pese a
 * que se les pidió que no lo hicieran. */
export function parseClassifyReply(text: string): KBClassifyResult | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const j = parsed as Record<string, unknown>;
  if (typeof j.category !== "string" || !j.category.trim()) return null;
  return {
    category: j.category.trim(),
    technology: typeof j.technology === "string" ? j.technology.trim() : "",
    tags: Array.isArray(j.tags) ? j.tags.filter((t): t is string => typeof t === "string" && t.trim() !== "").slice(0, 5) : [],
  };
}

export async function classifyFile(deps: KBClassifyDeps, input: KBClassifyInput): Promise<KBClassifyResult | null> {
  try {
    const texto = await deps.stream({
      providerId: deps.providerId,
      config: deps.config,
      modelId: deps.modelId,
      messages: [{ role: "user", content: buildPrompt(input) }] as StreamMessage[],
      settings: deps.settings,
      signal: deps.signal,
      onDelta: () => {},
      onDone: () => {},
    });
    return parseClassifyReply(texto);
  } catch {
    return null;
  }
}

/** Tipos MIME donde vale la pena leer un extracto de texto para clasificar
 * mejor (código, config, markdown…). Para el resto (imágenes, binarios,
 * zips) clasificar solo por nombre y tipo es lo honesto: no hay forma
 * barata de "ver" una imagen sin una llamada de visión aparte. */
const TEXT_LIKE = /^(text\/|application\/(json|javascript|xml|x-yaml|x-sh))/;

export function isTextLike(mimeType: string, name: string): boolean {
  if (TEXT_LIKE.test(mimeType)) return true;
  return /\.(md|txt|json|ya?ml|toml|ini|env|csv|tsx?|jsx?|css|html?|py|rb|go|rs|java|c|cpp|h)$/i.test(name);
}

export async function readTextExcerpt(file: File, maxChars = 2000): Promise<string> {
  const text = await file.slice(0, maxChars * 2).text();
  return text.slice(0, maxChars);
}
