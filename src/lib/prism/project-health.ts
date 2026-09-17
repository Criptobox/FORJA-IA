/** Forja IA — Project Health: puntuación derivada, no opinión del modelo.
 * Cada componente solo suma si existe evidencia local. Un dato ausente no se convierte en 100%.
 */
import type { ProjectMap } from "./types";
import type { QAResult } from "./visual-qa";
import type { FailureEntry } from "./failures";

export interface HealthMetric {
  id: string;
  label: string;
  score: number | null;
  detail: string;
}
export interface ProjectHealth {
  score: number | null;
  metrics: HealthMetric[];
  blockers: string[];
}

export function calculateProjectHealth(input: {
  map?: ProjectMap | null;
  qa?: QAResult[] | null;
  failures?: FailureEntry[] | null;
  html?: string | null;
}): ProjectHealth {
  const metrics: HealthMetric[] = [];
  const blockers: string[] = [];
  const map = input.map ?? null;
  if (map) {
    const orphan = map.files.filter((f) => f.kind === "html" && !(f.links?.length)).length;
    const score = map.files.length ? Math.max(0, Math.round(100 - Math.min(45, orphan * 12))) : null;
    metrics.push({ id: "structure", label: "Estructura", score, detail: orphan ? `${orphan} página(s) sin enlaces detectados` : "Relaciones del mapa sin huérfanos detectados" });
    if (orphan) blockers.push(`${orphan} página(s) HTML parecen huérfanas`);
  } else {
    metrics.push({ id: "structure", label: "Estructura", score: null, detail: "Sin mapa de proyecto" });
  }

  const qa = input.qa?.filter(Boolean) ?? [];
  if (qa.length) {
    const measured = qa.filter((r) => !r.noRespondio);
    if (measured.length) {
      const bad = measured.reduce((n, r) => n + r.items.length, 0);
      const score = Math.max(0, Math.round(100 - Math.min(100, bad * 15)));
      metrics.push({ id: "visual", label: "Visual QA", score, detail: bad ? `${bad} hallazgo(s) medido(s)` : "Sin hallazgos en las medidas disponibles" });
      if (bad) blockers.push(`${bad} hallazgo(s) visual(es) requieren revisión`);
    } else metrics.push({ id: "visual", label: "Visual QA", score: null, detail: "El medidor no respondió" });
  } else metrics.push({ id: "visual", label: "Visual QA", score: null, detail: "Todavía no se ha medido" });

  const failures = input.failures ?? [];
  if (input.failures) {
    const recent = failures.filter((f) => f.nivel === "error").length;
    const score = Math.max(0, 100 - Math.min(100, recent * 20));
    metrics.push({ id: "reliability", label: "Fiabilidad local", score, detail: recent ? `${recent} fallo(s) de tipo error en memoria local` : "Sin fallos de error registrados" });
    if (recent) blockers.push(`${recent} fallo(s) verificado(s) en memoria`);
  } else metrics.push({ id: "reliability", label: "Fiabilidad local", score: null, detail: "Sin historial de fallos disponible" });

  const html = input.html ?? "";
  if (html) {
    const insecure = (html.match(/http:\/\//gi) ?? []).length;
    const secrets = /(?:sk-[A-Za-z0-9]{16,}|AIza[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,})/.test(html);
    const score = Math.max(0, 100 - Math.min(100, insecure * 15 + (secrets ? 70 : 0)));
    metrics.push({ id: "safety", label: "Seguridad básica", score, detail: secrets ? "Posible secreto embebido detectado" : insecure ? `${insecure} recurso(s) HTTP sin cifrar` : "No se detectaron patrones básicos de riesgo" });
    if (secrets) blockers.push("Posible secreto/API key embebido en el HTML");
  } else metrics.push({ id: "safety", label: "Seguridad básica", score: null, detail: "Sin código para inspeccionar" });

  const available = metrics.filter((m) => m.score != null).map((m) => m.score as number);
  return { score: available.length ? Math.round(available.reduce((a, b) => a + b, 0) / available.length) : null, metrics, blockers };
}
