/**
 * Forja IA — Cerebro Web.
 *
 * Punto único de decisión para el producto especializado en creación web.
 * El Cerebro no sustituye al modelo: decide qué contexto, arquitectura,
 * conocimiento, QA y herramientas necesita el modelo activo.
 */

import { buildAgentRuntimePrompt } from "./agent-runtime";
import { buildDesignArchitecture, designArchitecturePrompt, type DesignArchitecture } from "./design-architect";
import { kbContext, type KBRetrievalQuery } from "./knowledge-retrieval";
import { kbContentContext } from "./kb-content-retrieval";
import { retrieveSmartKB, retrieveSmartKBWithContent, smartKBContext } from "./kb-smart-retrieval";
import { visionDesignerPrompt, compactVisionContext, type VisionAnalysis } from "./vision-designer";
import { buildWebStudioPrompt, type WebStudioOptions } from "./web-studio";

export type CerebroTask =
  | "create-web"
  | "modify-web"
  | "visual-reference"
  | "repair"
  | "audit";

export interface CerebroInput {
  task: CerebroTask;
  brief: string;
  webStudio?: Omit<WebStudioOptions, "brief">;
  previousDirectionIds?: string[];
  kb?: KBRetrievalQuery;
  vision?: VisionAnalysis;
  hasExistingProject?: boolean;
}

export interface CerebroPlan {
  task: CerebroTask;
  architecture: DesignArchitecture;
  prompt: string;
  retrievalCount: number;
  stages: string[];
  toolPolicy: string[];
}

/** Versión asíncrona que, después de filtrar por metadatos, recupera solo
 * los archivos de código remotos que realmente aportan al brief. Mantiene
 * `buildCerebroPlan` síncrono para no romper integraciones existentes.
 *
 * Una sola llamada a `retrieveSmartKBWithContent` (que ya calcula el
 * ranking Y el contenido): pedirlo dos veces por separado —una para el
 * ranking, otra dentro de la recuperación de contenido— repetía el mismo
 * trabajo síncrono (incluida una relectura de `kbGetResources()`/
 * `kbGetProjectManifests()`) sin ninguna necesidad. */
export async function buildCerebroPlanWithKnowledge(input: CerebroInput): Promise<CerebroPlan> {
  const plan = buildCerebroPlan(input);
  const query = input.kb ?? { text: input.brief, limit: 12, codeFirst: true };
  const bundle = await retrieveSmartKBWithContent(query, { maxFiles: 4, maxCharsPerFile: 12000, maxTotalChars: 30000 });
  const smartContext = smartKBContext(bundle.results, 5000);
  const remoteContext = kbContentContext(bundle.content, 30000);
  if (smartContext.length > "[FORJA SMART KNOWLEDGE RETRIEVAL]".length) {
    plan.prompt = `${plan.prompt}\n\n${smartContext}\n\nREGLA DE RECUPERACIÓN: prioriza los componentes, patrones y rutas marcados como coincidencias estructurales. No supongas que otro archivo del repositorio fue leído.`;
  }
  if (remoteContext.includes("\n## ")) {
    plan.prompt = `${plan.prompt}\n\n${remoteContext}\n\nREGLA DE CONTENIDO: usa el código recuperado como referencia verificable. No inventes que has leído archivos que aparecen como "no leído".`;
  }
  return plan;
}

export function buildCerebroPlan(input: CerebroInput): CerebroPlan {
  const architecture = buildDesignArchitecture({
    brief: input.brief,
    previousDirectionIds: input.previousDirectionIds,
  });

  const results = retrieveSmartKB(input.kb ?? { text: input.brief, limit: 12, codeFirst: true });

  const visual = input.vision
    ? compactVisionContext(input.vision)
    : visionDesignerPrompt(0);

  const studio = buildWebStudioPrompt({
    brief: input.brief,
    ...(input.webStudio ?? {}),
    visualDirection: architecture.direction.nombre,
    useExistingProject: input.hasExistingProject ?? true,
  });

  const prompt = [
    "[FORJA CEREBRO WEB — DECISIÓN CENTRAL]",
    `TAREA: ${input.task}`,
    studio,
    designArchitecturePrompt(architecture),
    buildAgentRuntimePrompt({ task: input.brief, existingProject: input.hasExistingProject ?? true, maxIterations: 2 }),
    visual,
    kbContext(results),
    "",
    "REGLA CENTRAL: el usuario describe el resultado; Forja decide automáticamente la estrategia.",
    "No pedir al usuario que elija template, design system, agente o proveedor salvo que sea estrictamente necesario.",
    "Usar herramientas y contexto solo cuando aporten evidencia al trabajo.",
  ].join("\n");

  return {
    task: input.task,
    architecture,
    prompt,
    retrievalCount: results.length,
    stages: ["brief", "architecture", "knowledge", "build", "preview", "visual-qa", "repair", "regression", "publish"],
    toolPolicy: [
      "Inspeccionar antes de editar.",
      "Editar directamente el archivo responsable.",
      "Ejecutar preview después de cambios verificables.",
      "Usar Visual QA y reparar hallazgos verificables.",
      "No declarar éxito sin evidencia.",
    ],
  };
}
