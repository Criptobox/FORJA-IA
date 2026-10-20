/** Forja IA — Agent Runtime / Subagents.
 *
 * Orquestación declarativa para que Cerebro pueda coordinar agentes
 * especializados sin acoplarlos a un proveedor de modelo. No ejecuta
 * herramientas por sí mismo: prepara el contrato, permisos y handoff.
 */
import type { EfectoTool } from "./tool-permissions";

export type ForjaAgentId = "planner" | "designer" | "coder" | "browser" | "qa" | "repair";
export type AgentStatus = "pending" | "running" | "completed" | "blocked" | "failed";

export interface AgentDefinition {
  id: ForjaAgentId;
  label: string;
  objective: string;
  effects: readonly EfectoTool[];
  preferredTools: readonly string[];
  dependsOn: readonly ForjaAgentId[];
}

export const FORJA_SUBAGENTS: readonly AgentDefinition[] = [
  { id: "planner", label: "Planner", objective: "Convertir el brief en un plan verificable.", effects: ["lee_proyecto"], preferredTools: ["list_files", "ask_memory", "kb_search"], dependsOn: [] },
  { id: "designer", label: "Designer", objective: "Definir arquitectura, composición y dirección visual sin generar código final.", effects: ["lee_proyecto"], preferredTools: ["kb_search", "read_file"], dependsOn: ["planner"] },
  { id: "coder", label: "Coder", objective: "Implementar directamente los archivos responsables siguiendo el plan.", effects: ["lee_proyecto", "escribe_proyecto"], preferredTools: ["read_file", "edit_file", "write_file", "apply_patch"], dependsOn: ["designer"] },
  { id: "browser", label: "Browser", objective: "Ejecutar la web y recoger evidencia de consola y comportamiento.", effects: ["lee_proyecto", "ejecuta"], preferredTools: ["run_project", "read_console"], dependsOn: ["coder"] },
  { id: "qa", label: "QA", objective: "Evaluar la implementación con evidencia verificable.", effects: ["lee_proyecto", "ejecuta", "red"], preferredTools: ["verify_project", "visual_review", "check_definition_of_done"], dependsOn: ["browser"] },
  { id: "repair", label: "Repair", objective: "Corregir directamente los hallazgos y devolver el trabajo a QA.", effects: ["lee_proyecto", "escribe_proyecto", "ejecuta"], preferredTools: ["diagnose_project", "edit_file", "apply_patch", "run_project"], dependsOn: ["qa"] },
];

export interface AgentHandoff {
  from: ForjaAgentId;
  to: ForjaAgentId;
  summary: string;
  evidence: string[];
  artifacts: string[];
}

export interface AgentRun {
  id: string;
  task: string;
  status: AgentStatus;
  active: ForjaAgentId;
  completed: ForjaAgentId[];
  blocked: ForjaAgentId[];
  handoffs: AgentHandoff[];
  iteration: number;
  maxIterations: number;
}

export interface AgentRuntimeInput {
  task: string;
  existingProject?: boolean;
  requiresWebResearch?: boolean;
  maxIterations?: number;
}

function definition(id: ForjaAgentId): AgentDefinition {
  return FORJA_SUBAGENTS.find((a) => a.id === id)!;
}

/** Devuelve el orden base. Repair se repite después de cada QA que no cierre. */
export function buildAgentSequence(input: AgentRuntimeInput): ForjaAgentId[] {
  const sequence: ForjaAgentId[] = ["planner", "designer", "coder", "browser", "qa"];
  if (input.maxIterations && input.maxIterations > 1) sequence.push("repair", "qa");
  return sequence;
}

/** Construye un contrato compacto que puede inyectarse al prompt del modelo. */
export function buildAgentRuntimePrompt(input: AgentRuntimeInput): string {
  const sequence = buildAgentSequence(input);
  return [
    "[FORJA AGENT RUNTIME]",
    `TAREA: ${input.task.trim()}`,
    `PROYECTO EXISTENTE: ${input.existingProject === false ? "no" : "sí"}`,
    `SECUENCIA: ${sequence.join(" → ")}`,
    "Cada subagente recibe solo el contexto necesario y debe devolver evidencia/artifacts para el siguiente.",
    "Planner no edita. Designer decide arquitectura visual. Coder edita directamente. Browser ejecuta. QA verifica. Repair corrige directamente y devuelve a QA.",
    input.requiresWebResearch ? "Research web: usar únicamente cuando Planner determine que falta evidencia externa." : "Research web: no es necesario salvo que aparezca una carencia de evidencia.",
    "Nunca declarar completado un agente sin evidencia suficiente para su responsabilidad.",
  ].join("\n");
}

export function createAgentRun(input: AgentRuntimeInput): AgentRun {
  return {
    id: `forja-agent-${Date.now()}`,
    task: input.task,
    status: "pending",
    active: "planner",
    completed: [],
    blocked: [],
    handoffs: [],
    iteration: 0,
    maxIterations: Math.max(1, Math.round(input.maxIterations ?? 1)),
  };
}

/**
 * Avanza el estado solo cuando el agente anterior entregó evidencia.
 *
 * La posición en la secuencia se calcula a partir de `run.iteration`, no de
 * `sequence.indexOf(agent)`: con `maxIterations > 1` la secuencia repite
 * "qa" dos veces (`... qa, repair, qa`) y `indexOf` siempre habría resuelto
 * la PRIMERA aparición. Al cerrar el ciclo de reparación, el QA final habría
 * calculado su "siguiente" a partir del primer QA (es decir, "repair" otra
 * vez) en lugar de terminar, dejando el run atascado alternando entre
 * repair y qa sin poder llegar nunca a "completed".
 */
export function advanceAgentRun(run: AgentRun, agent: ForjaAgentId, evidence: string[] = [], artifacts: string[] = []): AgentRun {
  if (run.status === "failed" || run.status === "blocked") return run;
  const completed = run.completed.includes(agent) ? run.completed : [...run.completed, agent];
  const sequence = buildAgentSequence({ task: run.task, maxIterations: run.maxIterations });
  const index = run.iteration;
  const next = sequence[index + 1];
  if (!next) return { ...run, completed, status: "completed", active: agent, iteration: run.iteration + 1 };
  return {
    ...run,
    completed,
    status: "running",
    active: next,
    iteration: run.iteration + 1,
    handoffs: [...run.handoffs, { from: agent, to: next, summary: `${definition(agent).label} terminó y entrega contexto al siguiente agente.`, evidence, artifacts }],
  };
}

export function agentDefinition(id: ForjaAgentId): AgentDefinition {
  return definition(id);
}
