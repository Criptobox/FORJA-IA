/** Forja IA — recuperación de conocimiento estructural de repositorios.
 *
 * Permite encontrar componentes, patrones y archivos relevantes a partir del
 * manifiesto de un ZIP/repositorio sin volver a leer el proyecto completo.
 */
import type { KBRepoAnalysis, KBRepoFile } from "./kb-repo-analyzer";

export interface KBProjectQuery {
  text: string;
  technology?: string;
  pattern?: string;
  component?: string;
  limit?: number;
}

export interface KBProjectHit {
  project: KBRepoAnalysis;
  file?: KBRepoFile;
  score: number;
  reasons: string[];
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const tokens = (s: string) => norm(s).split(/[^a-z0-9áéíóúüñ]+/i).filter(x => x.length > 2).slice(0, 20);

function scoreFile(file: KBRepoFile, q: KBProjectQuery): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const hay = norm([file.path, file.componentNames.join(" "), file.patterns.join(" "), file.technology.join(" ")].join(" "));
  for (const token of tokens(q.text)) {
    if (hay.includes(token)) { score += file.path.toLowerCase().includes(token) ? 3 : 1; reasons.push(`texto:${token}`); }
  }
  if (q.technology && file.technology.some(x => norm(x) === norm(q.technology!))) { score += 5; reasons.push("tecnología"); }
  if (q.pattern && file.patterns.some(x => norm(x) === norm(q.pattern!))) { score += 5; reasons.push("patrón"); }
  if (q.component && file.componentNames.some(x => norm(x).includes(norm(q.component!)))) { score += 6; reasons.push("componente"); }
  // Solo desempata ENTRE archivos que ya tenían alguna coincidencia real: si
  // no, CUALQUIER consulta (aunque no case con nada) devolvería todos los
  // archivos "source" de todos los proyectos con score 0.2 > 0 — justo lo
  // contrario de "el Cerebro recibe únicamente los archivos relevantes".
  if (file.kind === "source" && reasons.length) score += 0.2;
  return { score, reasons: [...new Set(reasons)] };
}

export function retrieveProjectKnowledge(
  q: KBProjectQuery,
  projects: KBRepoAnalysis[],
): KBProjectHit[] {
  const hits: KBProjectHit[] = [];
  for (const project of projects) {
    const projectText = norm([project.name, project.technologies.join(" "), project.frameworks.join(" "), project.components.join(" "), project.patterns.join(" ")].join(" "));
    let projectScore = 0;
    const projectReasons: string[] = [];
    for (const token of tokens(q.text)) {
      if (projectText.includes(token)) { projectScore += 1; projectReasons.push(`proyecto:${token}`); }
    }
    if (q.technology && project.technologies.concat(project.frameworks).some(x => norm(x) === norm(q.technology!))) { projectScore += 4; projectReasons.push("tecnología-proyecto"); }
    if (q.pattern && project.patterns.some(x => norm(x) === norm(q.pattern!))) { projectScore += 4; projectReasons.push("patrón-proyecto"); }
    if (q.component && project.components.some(x => norm(x).includes(norm(q.component!)))) { projectScore += 5; projectReasons.push("componente-proyecto"); }

    if (projectScore > 0) hits.push({ project, score: projectScore, reasons: [...new Set(projectReasons)] });
    for (const file of project.files) {
      const local = scoreFile(file, q);
      if (local.score > 0) hits.push({ project, file, score: local.score + projectScore * 0.25, reasons: [...new Set([...local.reasons, ...projectReasons])] });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, Math.max(1, Math.min(q.limit ?? 20, 50)));
}

export function projectKnowledgeContext(hits: KBProjectHit[], maxChars = 4200): string {
  const lines = ["[FORJA PROJECT KNOWLEDGE RETRIEVAL]"];
  for (const hit of hits) {
    const f = hit.file;
    const line = f
      ? `- ${hit.project.name} :: ${f.path} | ${f.technology.join(", ")} | componentes:${f.componentNames.slice(0, 8).join(", ")} | patrones:${f.patterns.join(", ")}`
      : `- ${hit.project.name} | framework:${hit.project.frameworks.join(", ")} | componentes:${hit.project.components.slice(0, 12).join(", ")} | patrones:${hit.project.patterns.join(", ")}`;
    if ((lines.join("\n") + "\n" + line).length > maxChars) break;
    lines.push(line);
  }
  return lines.join("\n");
}
