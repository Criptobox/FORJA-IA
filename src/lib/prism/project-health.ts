/** Forja IA — Project Health: puntuación derivada, no opinión del modelo.
 * Cada componente solo suma si existe evidencia local. Un dato ausente no se convierte en 100%.
 */
import type { ProjectMap } from "./types";
import type { QAResult, QATipo } from "./visual-qa";
import type { FailureEntry } from "./failures";
import { scanSecurity } from "./security-center";

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

  const TIPOS_ACCESIBILIDAD: readonly QATipo[] = ["sin-nombre", "sin-alt", "toque-pequeno"];
  const esAccesibilidad = (tipo: QATipo) => (TIPOS_ACCESIBILIDAD as string[]).includes(tipo);

  const qa = input.qa?.filter(Boolean) ?? [];
  if (qa.length) {
    const measured = qa.filter((r) => !r.noRespondio);
    if (measured.length) {
      const visualBad = measured.reduce((n, r) => n + r.items.filter((it) => !esAccesibilidad(it.tipo)).length, 0);
      const a11yBad = measured.reduce((n, r) => n + r.items.filter((it) => esAccesibilidad(it.tipo)).length, 0);
      const visualScore = Math.max(0, Math.round(100 - Math.min(100, visualBad * 15)));
      const a11yScore = Math.max(0, Math.round(100 - Math.min(100, a11yBad * 15)));
      metrics.push({ id: "visual", label: "Visual QA", score: visualScore, detail: visualBad ? `${visualBad} hallazgo(s) medido(s)` : "Sin hallazgos en las medidas disponibles" });
      metrics.push({ id: "accesibilidad", label: "Accesibilidad", score: a11yScore, detail: a11yBad ? `${a11yBad} hallazgo(s) medido(s)` : "Sin hallazgos de accesibilidad en las medidas disponibles" });
      if (visualBad) blockers.push(`${visualBad} hallazgo(s) visual(es) requieren revisión`);
      if (a11yBad) blockers.push(`${a11yBad} hallazgo(s) de accesibilidad requieren revisión`);
    } else {
      metrics.push({ id: "visual", label: "Visual QA", score: null, detail: "El medidor no respondió" });
      metrics.push({ id: "accesibilidad", label: "Accesibilidad", score: null, detail: "El medidor no respondió" });
    }
  } else {
    metrics.push({ id: "visual", label: "Visual QA", score: null, detail: "Todavía no se ha medido" });
    metrics.push({ id: "accesibilidad", label: "Accesibilidad", score: null, detail: "Todavía no se ha medido" });
  }

  const failures = input.failures ?? [];
  if (input.failures) {
    const recent = failures.filter((f) => f.nivel === "error").length;
    const score = Math.max(0, 100 - Math.min(100, recent * 20));
    metrics.push({ id: "reliability", label: "Fiabilidad local", score, detail: recent ? `${recent} fallo(s) de tipo error en memoria local` : "Sin fallos de error registrados" });
    if (recent) blockers.push(`${recent} fallo(s) verificado(s) en memoria`);
  } else metrics.push({ id: "reliability", label: "Fiabilidad local", score: null, detail: "Sin historial de fallos disponible" });

  const html = input.html ?? "";
  if (html) {
    // mismo motor que Security Center: una sola fuente de verdad para lo que
    // cuenta como riesgo, en vez de reinventar aquí una versión más pobre
    const seguridad = scanSecurity(html);
    const altos = seguridad.findings.filter((f) => f.severity === "high");
    metrics.push({
      id: "safety",
      label: "Seguridad básica",
      score: seguridad.score,
      detail: seguridad.findings.length
        ? `${seguridad.findings.length} hallazgo(s): ${[...new Set(seguridad.findings.map((f) => f.rule))].join(", ")}`
        : "No se detectaron patrones básicos de riesgo",
    });
    if (altos.length) blockers.push(`Posible secreto/API key embebido en el código (${altos.length})`);
  } else metrics.push({ id: "safety", label: "Seguridad básica", score: null, detail: "Sin código para inspeccionar" });

  const available = metrics.filter((m) => m.score != null).map((m) => m.score as number);
  return { score: available.length ? Math.round(available.reduce((a, b) => a + b, 0) / available.length) : null, metrics, blockers };
}
