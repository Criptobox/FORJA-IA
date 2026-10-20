/** Forja IA — Research Agent.
 *
 * Orden obligatorio: Knowledge Base primero; web solo cuando la KB no basta.
 * Este módulo no decide qué es verdadero: conserva la procedencia para que el
 * Cerebro pueda distinguir evidencia interna, fuente externa y dato pendiente.
 */
import { retrieveKB, type KBRetrievalResult } from "./knowledge-retrieval";
import type { KBResource } from "./kb-index";
import { buscarEnWeb, type ResultadoWeb } from "./busqueda-web";

export type ResearchSourceKind = "knowledge-base" | "web" | "unknown";

export interface ResearchSource {
  kind: ResearchSourceKind;
  title: string;
  url?: string;
  license?: string;
  confidence: "indexed" | "found" | "unverified";
}

export interface ResearchResult {
  query: string;
  usedKnowledgeBase: boolean;
  usedWeb: boolean;
  kb: KBRetrievalResult[];
  web: ResultadoWeb[];
  sources: ResearchSource[];
  context: string;
}

function sourceFromKb(r: KBRetrievalResult): ResearchSource {
  return {
    kind: "knowledge-base",
    title: r.resource.name,
    url: r.resource.webViewLink || undefined,
    license: r.resource.license || undefined,
    confidence: "indexed",
  };
}

function compact(results: ResearchResult, maxChars = 4200): string {
  const lines = [
    "[FORJA RESEARCH]",
    `Consulta: ${results.query}`,
    `Knowledge Base: ${results.usedKnowledgeBase ? "consultada" : "sin coincidencias"}`,
    `Web: ${results.usedWeb ? "consultada" : "no necesaria"}`,
  ];
  if (results.kb.length) {
    lines.push("KB:");
    for (const r of results.kb.slice(0, 8)) {
      lines.push(`- ${r.resource.name} | ${r.resource.category || "sin categoría"} | ${r.resource.technology || ""}`);
    }
  }
  if (results.web.length) {
    lines.push("WEB:");
    for (const r of results.web.slice(0, 5)) lines.push(`- ${r.titulo} | ${r.url} | ${r.resumen}`);
  }
  const text = lines.join("\n");
  return text.length <= maxChars ? text : text.slice(0, maxChars - 1) + "…";
}

export async function research(
  query: string,
  resources: KBResource[],
  options: { allowWeb?: boolean; minKbResults?: number } = {},
): Promise<ResearchResult> {
  const kb = retrieveKB({ text: query, limit: 8 }, resources);
  const enough = kb.length >= (options.minKbResults ?? 1);
  let web: ResultadoWeb[] = [];
  if (!enough && options.allowWeb !== false) {
    const result = await buscarEnWeb(query);
    if (result.ok) web = result.resultados;
  }
  const out: ResearchResult = {
    query,
    usedKnowledgeBase: kb.length > 0,
    usedWeb: web.length > 0,
    kb,
    web,
    sources: [
      ...kb.map(sourceFromKb),
      ...web.map((r) => ({ kind: "web" as const, title: r.titulo, url: r.url, confidence: "found" as const })),
    ],
    context: "",
  };
  out.context = compact(out);
  return out;
}
