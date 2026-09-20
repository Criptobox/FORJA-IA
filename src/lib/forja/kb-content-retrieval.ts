/** Forja IA — recuperación de contenido bajo demanda desde Knowledge Base.
 *
 * El índice local decide QUÉ recursos son relevantes. Este módulo decide
 * CUÁNTO contenido remoto merece viajar al modelo. Para MEGA se descarga
 * únicamente el archivo ganador y se limita el tamaño; no se recorre ni se
 * copia la biblioteca completa.
 */
import { createMegaProvider } from "./mega-provider";
import type { KBResource } from "./kb-index";
import type { KBRetrievalResult } from "./knowledge-retrieval";

export interface KBContentHit {
  resource: KBResource;
  score: number;
  reasons: string[];
  content?: string;
  skipped?: string;
}

export interface KBContentOptions {
  /** Máximo de caracteres por archivo que pueden viajar al prompt. */
  maxCharsPerFile?: number;
  /** Máximo de caracteres de todos los archivos recuperados. */
  maxTotalChars?: number;
  /** Máximo de bytes que Forja descargará de un archivo remoto. */
  maxBytesPerFile?: number;
  /** Cuántos candidatos del índice se intentan leer. */
  maxFiles?: number;
}

const DEFAULTS: Required<KBContentOptions> = {
  maxCharsPerFile: 12000,
  maxTotalChars: 36000,
  maxBytesPerFile: 5 * 1024 * 1024,
  maxFiles: 4,
};

const TEXT_EXTENSIONS = /\.(?:tsx?|jsx?|css|scss|sass|less|html?|md|mdx|json|jsonc|yaml|yml|toml|xml|svg|py|go|rs|java|kt|kts|swift|php|rb|sh|sql|graphql|gql|vue|svelte)$/i;
const BINARY_EXTENSIONS = /\.(?:zip|7z|rar|gz|tar|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|pdf|mp4|mov|webm|mp3|wav|xlsx?|docx?|pptx?)$/i;

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function isLikelyText(resource: KBResource): boolean {
  if (BINARY_EXTENSIONS.test(resource.name)) return false;
  if (TEXT_EXTENSIONS.test(resource.name)) return true;
  return /^text\//i.test(resource.mimeType);
}

function trimText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 80))}\n… [recortado por Forja: ${text.length - maxChars} caracteres más]`;
}

/** Lee un recurso remoto concreto. En V17 MEGA es la fuente de código viva. */
export async function readKBResource(
  resource: KBResource,
  options: KBContentOptions = {},
): Promise<KBContentHit> {
  const opts = { ...DEFAULTS, ...options };

  if (resource.sourceProvider !== "mega" || !resource.remoteId) {
    return {
      resource,
      score: 0,
      reasons: [],
      skipped: "Este recurso no tiene un lector remoto de contenido disponible en V17.",
    };
  }

  if (!isLikelyText(resource)) {
    return {
      resource,
      score: 0,
      reasons: [],
      skipped: "Archivo binario o contenedor; Forja usa su metadato/manifest en vez de enviarlo como código.",
    };
  }

  if (resource.sizeBytes > opts.maxBytesPerFile) {
    return {
      resource,
      score: 0,
      reasons: [],
      skipped: `Archivo demasiado grande para recuperación automática (${resource.sizeBytes} bytes).`,
    };
  }

  const bytes = await createMegaProvider().read(resource.remoteId);
  if (bytes.byteLength > opts.maxBytesPerFile) {
    return {
      resource,
      score: 0,
      reasons: [],
      skipped: "La descarga superó el límite de seguridad de contenido.",
    };
  }

  return {
    resource,
    score: 1,
    reasons: ["contenido remoto MEGA"],
    content: trimText(decodeUtf8(bytes), opts.maxCharsPerFile),
  };
}

/**
 * Toma los candidatos ya puntuados por `retrieveKB` y solo lee unos pocos.
 * El ranking se conserva: los primeros candidatos consumen primero el
 * presupuesto de contexto.
 *
 * Recorre TODOS los candidatos en orden (no solo los `maxFiles` primeros):
 * cortar la lista antes de intentar leer contaba contra el cupo cualquier
 * candidato sin lector remoto (hoy, todo lo que no venga de MEGA) — con
 * varios así por delante en el ranking, `maxFiles` se agotaba en omisiones
 * sin haber recuperado ni un solo archivo real, aunque más abajo en la
 * lista sí hubiera código de MEGA legible. El cupo ahora solo lo consumen
 * los archivos que de verdad aportaron contenido.
 */
export async function retrieveKBContent(
  results: KBRetrievalResult[],
  options: KBContentOptions = {},
): Promise<KBContentHit[]> {
  const opts = { ...DEFAULTS, ...options };
  const out: KBContentHit[] = [];
  let totalChars = 0;
  let filesWithContent = 0;

  for (const result of results) {
    if (filesWithContent >= opts.maxFiles) break;
    if (totalChars >= opts.maxTotalChars) break;
    try {
      const hit = await readKBResource(result.resource, opts);
      hit.score = result.score;
      hit.reasons = [...result.reasons, ...hit.reasons];
      if (hit.content) {
        const remaining = opts.maxTotalChars - totalChars;
        if (hit.content.length > remaining) hit.content = trimText(hit.content, remaining);
        totalChars += hit.content.length;
        filesWithContent++;
      }
      out.push(hit);
    } catch (error) {
      out.push({
        resource: result.resource,
        score: result.score,
        reasons: result.reasons,
        skipped: error instanceof Error ? error.message : "No se pudo leer el contenido remoto.",
      });
    }
  }

  return out;
}

const PROVIDER_LABEL: Record<string, string> = {
  mega: "MEGA",
  "google-drive": "Google Drive",
  local: "local",
  url: "URL",
};

export function kbContentContext(hits: KBContentHit[], maxChars = 36000): string {
  const lines = ["[FORJA KNOWLEDGE CONTENT — recuperado bajo demanda]"];
  let used = lines[0]!.length;

  for (const hit of hits) {
    if (!hit.content) {
      if (hit.skipped) lines.push(`- ${hit.resource.name}: no leído (${hit.skipped})`);
      continue;
    }
    // `readKBResource` solo produce `content` para recursos de MEGA hoy,
    // pero el mapa (en vez de un literal fijo) evita que esto quede mal
    // etiquetado el día que se sume un lector remoto para otro proveedor.
    const fuente = PROVIDER_LABEL[hit.resource.sourceProvider ?? ""] ?? hit.resource.sourceProvider ?? "desconocida";
    const header = `\n\n## ${hit.resource.name}\nRuta: ${hit.resource.relativePath || hit.resource.name}\nFuente: ${fuente}\n\`\`\`\n`;
    const footer = "\n```";
    const available = maxChars - used - header.length - footer.length;
    if (available <= 200) break;
    const body = hit.content.length > available ? trimText(hit.content, available) : hit.content;
    lines.push(`${header}${body}${footer}`);
    used += header.length + body.length + footer.length;
  }

  return lines.join("");
}
