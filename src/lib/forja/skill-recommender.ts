/** Forja IA — Skill Recommender (V23).
 *
 * Analiza el brief y el perfil del proyecto para proponer las skills que
 * conviene tener disponibles. No instala ni activa nada automáticamente.
 * La idea está inspirada en el patrón público de Anthropic que analiza un
 * codebase y recomienda skills/subagents/hooks según las señales detectadas.
 */
import type { SkillItem } from "./types";
import type { TaskKind } from "./task-router";

export interface SkillRecommendationContext {
  brief: string;
  taskKind?: TaskKind;
  framework?: string;
  technologies?: string[];
  existingProject?: boolean;
  hasTests?: boolean;
  hasRepo?: boolean;
  needsVisualReference?: boolean;
}

export interface SkillRecommendation {
  skill: SkillItem;
  score: number;
  reasons: string[];
  required: boolean;
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const signals: Array<{ keys: string[]; reasons: string[]; weight: number }> = [
  { keys: ["web", "landing", "sitio", "website", "tienda", "dashboard", "frontend", "react", "next", "ui", "ux"], reasons: ["La tarea es de construcción web/UI."], weight: 5 },
  { keys: ["screenshot", "captura", "referencia visual", "recrea", "diseño"], reasons: ["Hay una necesidad visual o de referencia."], weight: 6 },
  { keys: ["bug", "error", "falla", "repar", "debug", "arregla"], reasons: ["La tarea requiere diagnóstico y reparación."], weight: 6 },
  { keys: ["test", "prueba", "qa", "regression", "regresión"], reasons: ["La tarea menciona verificación o pruebas."], weight: 5 },
  { keys: ["api", "endpoint", "fetch", "backend", "database", "base de datos"], reasons: ["Hay integración de datos o APIs."], weight: 4 },
  { keys: ["accesibilidad", "a11y", "aria", "seo", "rendimiento", "performance"], reasons: ["La tarea contiene requisitos de calidad web."], weight: 5 },
  { keys: ["git", "github", "repo", "repositorio", "commit", "pull request"], reasons: ["La tarea trabaja con control de versiones o repositorios."], weight: 4 },
];

function skillMatches(text: string, skill: SkillItem): number {
  const hay = norm([skill.name, skill.description, ...(skill.kinds ?? [])].join(" "));
  return signals.reduce((sum, signal) => sum + (signal.keys.some((k) => hay.includes(norm(k)) && text.includes(norm(k))) ? signal.weight : 0), 0);
}

function skillReasons(text: string, skill: SkillItem, ctx: SkillRecommendationContext): string[] {
  const reasons: string[] = [];
  const hay = norm([skill.name, skill.description, skill.instructions].join(" "));
  for (const signal of signals) {
    if (signal.keys.some((k) => text.includes(norm(k)) && hay.includes(norm(k)))) reasons.push(...signal.reasons);
  }
  if (ctx.needsVisualReference && /visual|frontend|design|ui|ux|acces/i.test(hay)) reasons.push("El proyecto tiene una referencia visual pendiente de analizar.");
  if (ctx.hasTests && /test|qa|review|quality|calidad/i.test(hay)) reasons.push("El proyecto ya tiene pruebas que pueden aprovecharse como gate.");
  if (ctx.hasRepo && /git|repo|code|codigo|commit/i.test(hay)) reasons.push("El proyecto está conectado a un repositorio.");
  return [...new Set(reasons)];
}

export function recommendSkills(ctx: SkillRecommendationContext, skills: SkillItem[], limit = 5): SkillRecommendation[] {
  const text = norm([ctx.brief, ctx.framework ?? "", ...(ctx.technologies ?? [])].join(" "));
  return skills
    .filter((skill) => !skill.enabled)
    .map((skill) => {
      const reasons = skillReasons(text, skill, ctx);
      let score = skillMatches(text, skill);
      if (ctx.taskKind && (skill.kinds ?? []).includes(ctx.taskKind)) score += 4;
      if (ctx.framework && norm(skill.instructions).includes(norm(ctx.framework))) score += 3;
      return { skill, score, reasons, required: score >= 10 };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name))
    .slice(0, limit);
}

export function skillsPlanContext(recommendations: SkillRecommendation[]): string {
  if (!recommendations.length) return "[FORJA SKILL PLAN]\nNo se detectaron skills adicionales con evidencia suficiente.";
  return [
    "[FORJA SKILL PLAN]",
    "Las siguientes skills fueron detectadas como útiles para esta tarea. Son recomendaciones, no activaciones automáticas.",
    ...recommendations.map((r) => `- ${r.skill.name}${r.required ? " [IMPORTANTE]" : ""}: ${r.reasons.join(" ") || "encaja con el tipo de tarea."}`),
  ].join("\n");
}
