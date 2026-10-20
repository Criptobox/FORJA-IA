/** Forja IA — recuperación de contenido bajo demanda desde Knowledge Base.
 *
 * El índice local decide QUÉ recursos son relevantes. Este módulo decide
 * CUÁNTO contenido remoto merece viajar al modelo. Se descarga únicamente
 * el archivo ganador y se limita el tamaño; no se recorre ni se copia la
 * biblioteca completa.
 *
 * Dos lectores remotos, con papeles distintos:
 *   - Google Drive (varias cuentas): conocimiento — fichas .md, .json de
 *     metadatos/decisiones, datasets .jsonl, documentos nativos de Google.
 *   - MEGA: solo código.
 */
import { createMegaProvider } from "./mega-provider";
import { gdReadKBFile } from "./gdrive-kb";
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
  /** Alterna proveedores (Drive, MEGA…) al leer, conservando el orden
   * dentro de cada uno, para que el código de MEGA no se coma todo el cupo
   * y deje fuera el conocimiento de Drive (o al revés). */
  balanceProviders?: boolean;
}

const DEFAULTS: Required<KBContentOptions> = {
  maxCharsPerFile: 12000,
  maxTotalChars: 36000,
  maxBytesPerFile: 5 * 1024 * 1024,
  maxFiles: 4,
  balanceProviders: true,
};

const TEXT_EXTENSIONS = /\.(?:tsx?|jsx?|css|scss|sass|less|html?|md|mdx|txt|csv|json|jsonc|jsonl|ndjson|yaml|yml|toml|xml|svg|py|go|rs|java|kt|kts|swift|php|rb|sh|sql|graphql|gql|vue|svelte)$/i;
const BINARY_EXTENSIONS = /\.(?:zip|7z|rar|gz|tar|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|pdf|mp4|mov|webm|mp3|wav|xlsx?|docx?|pptx?)$/i;

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

/** Documentos nativos de Google que Drive exporta a texto. */
const GOOGLE_TEXT_MIMES = /^application\/vnd\.google-apps\.(?:document|spreadsheet|presentation)$/;
/** MEGA es solo código: lo que no sea código/config no se lee de allí. */
const CODE_EXTENSIONS = /\.(?:tsx?|jsx?|mjs|cjs|css|scss|sass|less|html?|md|mdx|json|jsonc|yaml|yml|toml|xml|svg|py|go|rs|java|kt|kts|swift|php|rb|sh|sql|graphql|gql|vue|svelte|astro)$/i;

function isLikelyText(resource: KBResource): boolean {
  if (BINARY_EXTENSIONS.test(resource.name)) return false;
  if (TEXT_EXTENSIONS.test(resource.name)) return true;
  if (resource.sourceProvider === "google-drive" && GOOGLE_TEXT_MIMES.test(resource.mimeType)) return true;
  return /^text\//i.test(resource.mimeType);
}

type RemoteReader = { label: string; read: (resource: KBResource) => Promise<Uint8Array> };

/** El lector de cada proveedor. Los recursos indexados antes de que
 * existiera `sourceProvider` (subidos con «Importar recursos» o añadidos
 * desde la lista de archivos de Drive) son todos archivos de Drive: su `id`
 * es el id de Drive y `accountEmail` la cuenta dueña. */
function readerFor(resource: KBResource): RemoteReader | null {
  if (resource.sourceProvider === "mega" && resource.remoteId) {
    const remoteId = resource.remoteId;
    return { label: "contenido remoto MEGA", read: () => createMegaProvider().read(remoteId) };
  }
  const isDrive =
    resource.sourceProvider === "google-drive" ||
    (!resource.sourceProvider && resource.sourceKind !== "mega" && resource.sourceKind !== "url");
  if (isDrive && resource.accountEmail) {
    return { label: "contenido remoto Google Drive", read: (r) => gdReadKBFile(r) };
  }
  return null;
}

function trimText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 80))}\n… [recortado por Forja: ${text.length - maxChars} caracteres más]`;
}

/** Lee un recurso remoto concreto: Drive (conocimiento) o MEGA (código). */
export async function readKBResource(
  resource: KBResource,
  options: KBContentOptions = {},
): Promise<KBContentHit> {
  const opts = { ...DEFAULTS, ...options };
  const reader = readerFor(resource);

  if (!reader) {
    return {
      resource,
      score: 0,
      reasons: [],
      skipped: "Este recurso no tiene un lector remoto de contenido (solo se leen Google Drive y MEGA).",
    };
  }

  if (resource.sourceProvider === "mega" && !CODE_EXTENSIONS.test(resource.name)) {
    return {
      resource,
      score: 0,
      reasons: [],
      skipped: "MEGA es solo para código; este archivo no es código y no se lee de allí.",
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

  const bytes = await reader.read(resource);
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
    reasons: [reader.label],
    content: trimText(decodeUtf8(bytes), opts.maxCharsPerFile),
  };
}

/** Alterna proveedores conservando el orden dentro de cada uno: el mejor
 * de Drive, el mejor de MEGA, el segundo de Drive… Con un solo proveedor
 * devuelve la lista tal cual. */
export function interleaveByProvider<T extends { resource: KBResource }>(results: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const r of results) {
    const key = r.resource.sourceProvider ?? r.resource.sourceKind ?? "otro";
    const g = groups.get(key);
    if (g) g.push(r);
    else groups.set(key, [r]);
  }
  if (groups.size < 2) return results;
  const queues = [...groups.values()];
  const out: T[] = [];
  for (let i = 0; out.length < results.length; i++) {
    for (const q of queues) if (i < q.length) out.push(q[i]!);
  }
  return out;
}

/**
 * Toma los candidatos ya puntuados por `retrieveKB` y solo lee unos pocos.
 * El ranking se conserva: los primeros candidatos consumen primero el
 * presupuesto de contexto.
 *
 * Recorre TODOS los candidatos en orden (no solo los `maxFiles` primeros):
 * cortar la lista antes de intentar leer contaba contra el cupo cualquier
 * candidato sin lector remoto (lo que no venga de Drive ni de MEGA) — con
 * varios así por delante en el ranking, `maxFiles` se agotaba en omisiones
 * sin haber recuperado ni un solo archivo real, aunque más abajo en la
 * lista sí hubiera algo legible. El cupo ahora solo lo consumen
 * los archivos que de verdad aportaron contenido.
 *
 * Con `balanceProviders` (por defecto) los candidatos se leen alternando
 * proveedor (`interleaveByProvider`).
 */
export async function retrieveKBContent(
  results: KBRetrievalResult[],
  options: KBContentOptions = {},
): Promise<KBContentHit[]> {
  const opts = { ...DEFAULTS, ...options };
  const out: KBContentHit[] = [];
  let totalChars = 0;
  let filesWithContent = 0;

  const ordered = opts.balanceProviders ? interleaveByProvider(results) : results;
  for (const result of ordered) {
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
    // Drive puede tener varias cuentas: se nombra también cuál, para que
    // el modelo sepa de qué área (diseño, …) sale cada ficha.
    const proveedor = PROVIDER_LABEL[hit.resource.sourceProvider ?? ""] ?? hit.resource.sourceProvider ?? "desconocida";
    const fuente = hit.resource.sourceProvider === "google-drive" && hit.resource.accountEmail ? `${proveedor} (${hit.resource.accountEmail})` : proveedor;
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
