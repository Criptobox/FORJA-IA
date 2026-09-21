/** Forja IA — Technology Radar (V27).
 *
 * Catálogo interno de tecnologías y librerías que el Cerebro puede consultar
 * para elegir una estrategia. No instala dependencias ni ejecuta código.
 * Las entradas son candidatos de arquitectura, no recomendaciones ciegas.
 */

export type RadarArea =
  | "agents"
  | "rag"
  | "embeddings"
  | "reranking"
  | "evaluation"
  | "observability"
  | "routing"
  | "context"
  | "structured-output"
  | "security"
  | "local-inference"
  | "data";

export type RadarMaturity = "experimental" | "candidate" | "established";

export interface TechnologyRadarEntry {
  id: string;
  name: string;
  area: RadarArea;
  description: string;
  license: string;
  maturity: RadarMaturity;
  integration: "native" | "adapter" | "reference";
  localFriendly: boolean;
  costProfile: "free-open-source" | "mixed" | "paid-service";
  signals: string[];
  caveats?: string[];
  source?: string;
}

const RADAR: TechnologyRadarEntry[] = [
  { id: "langgraph", name: "LangGraph", area: "agents", description: "Orquestación de agentes y flujos con estado.", license: "Apache-2.0", maturity: "candidate", integration: "adapter", localFriendly: true, costProfile: "free-open-source", signals: ["agent", "agents", "workflow", "orchestration", "state"], caveats: ["Evitar introducir un segundo runtime si el Agent Runtime propio ya cubre la tarea."], source: "llm-engineer-toolkit" },
  { id: "llamaindex", name: "LlamaIndex", area: "rag", description: "Patrones para ingestión, índices y recuperación de conocimiento.", license: "MIT", maturity: "candidate", integration: "adapter", localFriendly: true, costProfile: "free-open-source", signals: ["rag", "knowledge", "retrieval", "documents", "index"], caveats: ["Forja ya posee KB y retrieval; usarlo como referencia o adaptador."], source: "llm-engineer-toolkit" },
  { id: "haystack", name: "Haystack", area: "rag", description: "Pipelines de búsqueda y RAG componibles.", license: "Apache-2.0", maturity: "candidate", integration: "adapter", localFriendly: true, costProfile: "free-open-source", signals: ["rag", "retrieval", "pipeline", "search"], source: "llm-engineer-toolkit" },
  { id: "sentence-transformers", name: "Sentence-Transformers", area: "embeddings", description: "Embeddings y similitud semántica locales.", license: "Apache-2.0", maturity: "established", integration: "adapter", localFriendly: true, costProfile: "free-open-source", signals: ["embedding", "embeddings", "semantic", "similarity"], source: "llm-engineer-toolkit" },
  { id: "rerankers", name: "Rerankers", area: "reranking", description: "Reranking de candidatos recuperados para mejorar precisión.", license: "Apache-2.0", maturity: "candidate", integration: "adapter", localFriendly: true, costProfile: "free-open-source", signals: ["rerank", "reranking", "ranking", "relevance"], source: "llm-engineer-toolkit" },
  { id: "ragas", name: "Ragas", area: "evaluation", description: "Evaluación de sistemas RAG y calidad de recuperación.", license: "Apache-2.0", maturity: "candidate", integration: "adapter", localFriendly: true, costProfile: "free-open-source", signals: ["rag", "evaluation", "eval", "quality"], source: "llm-engineer-toolkit" },
  { id: "deepeval", name: "DeepEval", area: "evaluation", description: "Evaluación de aplicaciones y agentes LLM.", license: "Apache-2.0", maturity: "candidate", integration: "adapter", localFriendly: true, costProfile: "free-open-source", signals: ["evaluation", "eval", "agent", "quality", "test"], source: "llm-engineer-toolkit" },
  { id: "langfuse", name: "Langfuse", area: "observability", description: "Trazas, métricas y logs de aplicaciones con LLMs; permite auditar qué hizo cada agente y por qué.", license: "MIT", maturity: "candidate", integration: "adapter", localFriendly: true, costProfile: "mixed", signals: ["observability", "observabilidad", "tracing", "trace", "logs", "metrics", "monitor", "debug"], caveats: ["El self-host (MIT) es la vía local/gratuita; la nube gestionada es de pago."], source: "llm-engineer-toolkit" },
  { id: "route-llm", name: "RouteLLM", area: "routing", description: "Patrones para enrutar tareas entre modelos según capacidad/coste.", license: "Apache-2.0", maturity: "candidate", integration: "adapter", localFriendly: true, costProfile: "free-open-source", signals: ["route", "routing", "model", "cost", "cheap"], source: "llm-engineer-toolkit" },
  { id: "llmlingua", name: "LLMLingua", area: "context", description: "Compresión de prompts/contexto para reducir tokens.", license: "MIT", maturity: "candidate", integration: "adapter", localFriendly: true, costProfile: "free-open-source", signals: ["context", "compression", "tokens", "prompt", "long"], source: "llm-engineer-toolkit" },
  { id: "instructor", name: "Instructor", area: "structured-output", description: "Generación y validación de salidas estructuradas.", license: "MIT", maturity: "candidate", integration: "adapter", localFriendly: true, costProfile: "free-open-source", signals: ["json", "structured", "schema", "output", "validation"], source: "llm-engineer-toolkit" },
  { id: "guardrails", name: "Guardrails", area: "security", description: "Validación y restricciones para salidas de modelos.", license: "Apache-2.0", maturity: "candidate", integration: "adapter", localFriendly: true, costProfile: "free-open-source", signals: ["security", "guardrail", "validation", "safety"], source: "llm-engineer-toolkit" },
  { id: "llama-cpp", name: "llama.cpp", area: "local-inference", description: "Inferencia local de modelos compatibles con GGUF y variantes.", license: "MIT", maturity: "established", integration: "adapter", localFriendly: true, costProfile: "free-open-source", signals: ["local", "offline", "inference", "gguf", "model"], source: "llm-engineer-toolkit" },
  { id: "ollama", name: "Ollama", area: "local-inference", description: "Ejecución local de modelos mediante una API sencilla.", license: "MIT", maturity: "established", integration: "adapter", localFriendly: true, costProfile: "free-open-source", signals: ["local", "offline", "ollama", "model", "inference"], source: "llm-engineer-toolkit" },
  { id: "data-prep-kit", name: "Data Prep Kit", area: "data", description: "Preparación y transformación de grandes colecciones de datos.", license: "Apache-2.0", maturity: "candidate", integration: "reference", localFriendly: true, costProfile: "free-open-source", signals: ["dataset", "data", "prepare", "corpus", "clean"], source: "llm-engineer-toolkit" },
];

const norm = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function listTechnologyRadar(): TechnologyRadarEntry[] {
  return RADAR.map((entry) => ({ ...entry, signals: [...entry.signals], caveats: entry.caveats ? [...entry.caveats] : undefined }));
}

export function getTechnologyRadarEntry(id: string): TechnologyRadarEntry | undefined {
  return RADAR.find((entry) => entry.id === id);
}

export interface TechnologyRadarQuery {
  brief: string;
  areas?: RadarArea[];
  localOnly?: boolean;
  limit?: number;
}

export interface TechnologyRadarMatch extends TechnologyRadarEntry {
  score: number;
  reasons: string[];
}

export function recommendRadarTools(query: TechnologyRadarQuery): TechnologyRadarMatch[] {
  const text = norm(query.brief);
  const areas = query.areas ? new Set(query.areas) : undefined;
  return RADAR
    .filter((entry) => !areas || areas.has(entry.area))
    .filter((entry) => !query.localOnly || entry.localFriendly)
    .map((entry) => {
      const reasons: string[] = [];
      let score = 0;
      for (const signal of entry.signals) {
        if (text.includes(norm(signal))) {
          score += 4;
          reasons.push(`La tarea contiene la señal «${signal}».`);
        }
      }
      if (/rapido|rapida|barato|barata|local|offline|sin api|gratis/i.test(text) && entry.localFriendly) {
        score += 2;
        reasons.push("Es compatible con un enfoque local/open-source.");
      }
      if (/qa|test|prueba|evaluacion|eval/i.test(text) && entry.area === "evaluation") {
        score += 3;
        reasons.push("Puede aportar evaluación verificable.");
      }
      return { ...entry, score, reasons: [...new Set(reasons)] };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, Math.max(1, query.limit ?? 6));
}

export function technologyRadarContext(matches: TechnologyRadarMatch[]): string {
  if (!matches.length) return "[FORJA TECHNOLOGY RADAR]\nNo se detectaron tecnologías candidatas con evidencia suficiente.";
  return [
    "[FORJA TECHNOLOGY RADAR]",
    "Candidatos de arquitectura; no son instalaciones ni activaciones automáticas.",
    ...matches.map((entry) => `- ${entry.name} [${entry.area}] score=${entry.score}: ${entry.description}${entry.caveats?.length ? ` Cautelas: ${entry.caveats.join(" ")}` : ""}`),
  ].join("\n");
}
