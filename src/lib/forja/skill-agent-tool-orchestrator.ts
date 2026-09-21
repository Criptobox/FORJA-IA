/** Forja IA — Skill/Agent/Tool Orchestrator (V24).
 *
 * Une las decisiones de Skills, subagentes, herramientas, recetas y límites
 * en un único plan declarativo. No ejecuta herramientas ni activa Skills por
 * sí mismo; entrega un contrato al runtime que puede ser aprobado/ejecutado.
 */
import type { SkillItem } from "./types";
import { recommendSkills, type SkillRecommendationContext } from "./skill-recommender";
import { agentDefinition, buildAgentSequence, type AgentRuntimeInput, type ForjaAgentId } from "./agent-runtime";
import { searchForjaRecipes } from "./recipe-builder";
import { recipeCanBeReused } from "./recipe-quality-gate";
import { recipeConfidence, shouldDemoteRecipe } from "./recipe-feedback";
import type { KBSmartQuery } from "./kb-smart-retrieval";
import { recommendRadarTools, type RadarArea, type TechnologyRadarMatch } from "./technology-radar";

export interface OrchestratorInput {
  brief: string;
  taskKind?: SkillRecommendationContext["taskKind"];
  framework?: string;
  technologies?: string[];
  existingProject?: boolean;
  hasTests?: boolean;
  hasRepo?: boolean;
  needsVisualReference?: boolean;
  requiresWebResearch?: boolean;
  skills?: SkillItem[];
  maxAgents?: number;
  maxRecipes?: number;
  maxContextChars?: number;
  maxToolCalls?: number;
  radarAreas?: RadarArea[];
  radarLocalOnly?: boolean;
  maxRadarTools?: number;
}

export interface OrchestratedSkill {
  id: string;
  name: string;
  score: number;
  required: boolean;
  reasons: string[];
}

export interface OrchestratedRecipe {
  id: string;
  name: string;
  confidence: number;
  reason: string;
}

export interface AgentBudget {
  maxIterations: number;
  maxToolCalls: number;
  maxContextChars: number;
}

export interface AgentAssignment {
  agent: ForjaAgentId;
  objective: string;
  preferredTools: string[];
  effects: string[];
  dependsOn: ForjaAgentId[];
}

export interface ForjaOrchestrationPlan {
  version: 1;
  brief: string;
  strategy: string;
  skills: OrchestratedSkill[];
  recipes: OrchestratedRecipe[];
  agents: AgentAssignment[];
  toolPolicy: string[];
  budget: AgentBudget;
  contextSources: string[];
  gates: string[];
  technologyRadar: TechnologyRadarMatch[];
}

const DEFAULT_BUDGET: AgentBudget = {
  maxIterations: 2,
  maxToolCalls: 24,
  maxContextChars: 30000,
};

/** Sin `max` explícito, `fallback` no debe truncar nada: por eso los
 * llamadores pasan `sequence.length` como fallback en vez de una constante
 * fija (ver más abajo por qué una constante desalineada con la secuencia
 * real corta silenciosamente el último paso). */
function cap<T>(items: T[], max: number | undefined, fallback: number): T[] {
  return items.slice(0, Math.max(1, max ?? fallback));
}

export function buildForjaOrchestration(input: OrchestratorInput): ForjaOrchestrationPlan {
  const budget: AgentBudget = {
    maxIterations: Math.min(4, Math.max(1, DEFAULT_BUDGET.maxIterations)),
    maxToolCalls: Math.max(8, input.maxToolCalls ?? DEFAULT_BUDGET.maxToolCalls),
    maxContextChars: Math.max(8000, input.maxContextChars ?? DEFAULT_BUDGET.maxContextChars),
  };

  const recommendations = recommendSkills({
    brief: input.brief,
    taskKind: input.taskKind,
    framework: input.framework,
    technologies: input.technologies,
    existingProject: input.existingProject,
    hasTests: input.hasTests,
    hasRepo: input.hasRepo,
    needsVisualReference: input.needsVisualReference,
  }, input.skills ?? [], 8);

  // El límite de salida (`maxRecipes`) NO debe estrechar el pool de
  // candidatos que se puntúa: si un llamador pide `maxRecipes: 3` (como
  // hace `cerebro-web.ts`), buscar solo 3 candidatos ANTES de filtrar por
  // `recipeCanBeReused`/`shouldDemoteRecipe` puede descartar de entrada
  // recetas buenas que habrían sobrevivido el filtro, y devolver menos
  // resultados (incluso cero) aunque existan recetas reutilizables reales.
  const recipePoolSize = Math.max(6, input.maxRecipes ?? 6);

  const technologyRadar = recommendRadarTools({
    brief: input.brief,
    areas: input.radarAreas,
    localOnly: input.radarLocalOnly,
    limit: input.maxRadarTools ?? 5,
  });

  const recipes = searchForjaRecipes(input.brief, recipePoolSize)
    .filter(recipeCanBeReused)
    .filter((recipe) => !shouldDemoteRecipe(recipe))
    .map((recipe) => ({
      id: recipe.id,
      name: recipe.name,
      confidence: recipeConfidence(recipe),
      reason: `Coincide con el brief; confianza actual ${recipeConfidence(recipe)}/100 y evidencia reutilizable disponible.`,
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, input.maxRecipes ?? 3);

  const runtimeInput: AgentRuntimeInput = {
    task: input.brief,
    existingProject: input.existingProject,
    requiresWebResearch: input.requiresWebResearch,
    maxIterations: budget.maxIterations,
  };
  const fullSequence = buildAgentSequence(runtimeInput);
  // Fallback = la secuencia completa: con `maxIterations` de `DEFAULT_BUDGET`
  // (2, fijo) la secuencia real repite "qa" tras "repair" (7 pasos). Un
  // fallback fijo en 6 (contando solo los seis ROLES distintos, sin la
  // repetición) truncaba SIEMPRE el "qa" final por defecto —justo el que
  // verifica que la reparación funcionó— contradiciendo el propio gate del
  // orquestador: "Si QA falla, devolver el trabajo a Repair y después
  // repetir QA dentro del presupuesto".
  const sequence = cap(fullSequence, input.maxAgents, fullSequence.length);
  const agents = sequence.map((id) => {
    const definition = agentDefinition(id);
    return {
      agent: id,
      objective: definition.objective,
      preferredTools: [...definition.preferredTools],
      effects: [...definition.effects],
      dependsOn: definition.dependsOn.filter((dependency) => sequence.includes(dependency)),
    };
  });

  const contextSources = ["project-map", "knowledge-base-index", "project-knowledge", "recipe-library"];
  if (input.needsVisualReference) contextSources.push("vision-analysis");
  if (input.requiresWebResearch) contextSources.push("web-research");
  if (input.hasRepo) contextSources.push("repository");

  const gates = [
    "No activar una Skill solo porque fue recomendada; comprobar disponibilidad y permisos.",
    "No ejecutar una herramienta fuera de los efectos permitidos por el agente.",
    "No usar una receta rechazada o democionada por feedback negativo.",
    "No entregar éxito sin evidencia de Browser/QA cuando la tarea genera o modifica una web.",
    "Si QA falla, devolver el trabajo a Repair y después repetir QA dentro del presupuesto.",
  ];

  return {
    version: 1,
    brief: input.brief,
    strategy: "El Cerebro selecciona solo los recursos necesarios y coordina agentes por dependencias; el usuario no necesita escogerlos manualmente.",
    skills: recommendations.map((r) => ({ id: r.skill.id, name: r.skill.name, score: r.score, required: r.required, reasons: r.reasons })),
    recipes,
    agents,
    toolPolicy: [
      "Leer antes de editar.",
      "Preferir herramientas especializadas antes que acciones genéricas.",
      "Limitar llamadas y contexto por tarea.",
      "Conservar evidencia y artefactos en cada handoff.",
      "Editar directamente los archivos responsables; no crear capas de parche para ocultar errores.",
    ],
    budget,
    contextSources,
    gates,
    technologyRadar,
  };
}

export function orchestrationContext(plan: ForjaOrchestrationPlan): string {
  const lines = [
    "[FORJA ORCHESTRATOR V24]",
    `Estrategia: ${plan.strategy}`,
    `Agentes: ${plan.agents.map((a) => a.agent).join(" → ")}`,
    plan.skills.length ? `Skills recomendadas: ${plan.skills.map((s) => `${s.name}${s.required ? " [IMPORTANTE]" : ""}`).join(", ")}` : "Skills recomendadas: ninguna adicional.",
    plan.recipes.length ? `Recetas candidatas: ${plan.recipes.map((r) => `${r.name} (${r.confidence}/100)`).join(", ")}` : "Recetas candidatas: ninguna.",
    plan.technologyRadar.length ? `Radar tecnológico: ${plan.technologyRadar.map((r) => `${r.name} (${r.score})`).join(", ")}` : "Radar tecnológico: ningún candidato.",
    `Fuentes de contexto: ${plan.contextSources.join(", ")}`,
    `Presupuesto: ${plan.budget.maxToolCalls} llamadas · ${plan.budget.maxContextChars} caracteres · ${plan.budget.maxIterations} iteraciones`,
    "Gates:",
    ...plan.gates.map((gate) => `- ${gate}`),
  ];
  return lines.join("\n").slice(0, plan.budget.maxContextChars);
}

/** Construye una consulta KB mínima a partir del plan, para reutilizar el mismo
 * contrato de retrieval sin obligar al orquestador a descargar contenido. */
export function orchestrationKBQuery(plan: ForjaOrchestrationPlan): KBSmartQuery {
  return {
    text: plan.brief,
    limit: Math.min(12, Math.max(4, plan.agents.length + plan.recipes.length)),
    codeFirst: true,
  };
}
