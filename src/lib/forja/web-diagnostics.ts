/** Forja IA — Diagnóstico accionable de un proyecto web.
 *
 * Convierte los hallazgos de `web-verifier.ts` en tareas concretas que el
 * agente puede ejecutar: archivo candidato, causa, acción recomendada y
 * criterio de cierre. No inventa líneas exactas ni genera parches — cuando
 * solo puede inferir un archivo lo marca como candidato para que el agente
 * lo lea primero (con `read_file`) antes de tocarlo.
 */
export type DiagnosticAction = "inspect" | "patch" | "remove-secret" | "runtime" | "visual-review" | "retest";

export interface DiagnosticItem {
  id: string;
  severity: "error" | "warning" | "info";
  source: string;
  cause: string;
  action: DiagnosticAction;
  candidatePaths: string[];
  evidence: string;
  doneWhen: string;
}

export interface ActionableDiagnosis {
  status: "blocked" | "needs-fix" | "ready";
  items: DiagnosticItem[];
  nextStep: string;
}

export interface DiagnosticFindingInput {
  id: string;
  severity: "error" | "warning" | "info";
  source: string;
  message: string;
  evidence?: string;
  path?: string;
}

function candidatos(f: DiagnosticFindingInput, files: string[]): string[] {
  if (f.path) return [f.path];
  if (f.id.includes("runtime")) return files.filter((p) => /package\.json$|(?:^|\/)(?:app|pages|src)\//.test(p)).slice(0, 8);
  if (f.id.includes("visual")) return files.filter((p) => /\.(?:css|scss|html?|tsx?|jsx?)$/i.test(p)).slice(0, 8);
  return files.filter((p) => /\.(?:html?|css|scss|tsx?|jsx?)$/i.test(p)).slice(0, 8);
}

function accion(f: DiagnosticFindingInput): DiagnosticAction {
  if (f.id === "possible-secret") return "remove-secret";
  if (f.source === "runtime") return "runtime";
  if (f.source === "visual") return "visual-review";
  if (f.id.startsWith("missing-") || f.id === "html-lang" || f.id === "html-title" || f.id === "viewport" || f.id === "img-alt" || f.id === "interactive-name") return "patch";
  return f.severity === "error" ? "inspect" : "patch";
}

function cierre(f: DiagnosticFindingInput): string {
  if (f.source === "runtime") return "Volver a ejecutar el proyecto sin ese error y conservar evidencia del runtime.";
  if (f.source === "visual") return "Repetir QA/captura y confirmar que el hallazgo desapareció sin regresiones.";
  if (f.id === "possible-secret") return "El patrón de credencial desaparece del proyecto y se vuelve a ejecutar la auditoría.";
  return "Volver a ejecutar verify_project y comprobar que este hallazgo ya no aparece.";
}

export function diagnoseFindings(findings: readonly DiagnosticFindingInput[], files: readonly string[]): ActionableDiagnosis {
  const items: DiagnosticItem[] = findings.map((f) => ({
    id: f.id,
    severity: f.severity,
    source: f.source,
    cause: f.message,
    action: accion(f),
    candidatePaths: candidatos(f, [...files]),
    evidence: f.evidence || "Hallazgo observado por el verificador; no se infiere una causa adicional.",
    doneWhen: cierre(f),
  }));
  const errors = items.filter((i) => i.severity === "error");
  const warnings = items.filter((i) => i.severity === "warning");
  const status: ActionableDiagnosis["status"] = errors.length ? "blocked" : warnings.length ? "needs-fix" : "ready";
  const nextStep = errors[0]
    ? `${errors[0].action}: inspecciona primero ${errors[0].candidatePaths[0] || "los archivos candidatos"}; después vuelve a verificar.`
    : warnings[0]
      ? `${warnings[0].action}: corrige ${warnings[0].candidatePaths[0] || "el archivo candidato"} y vuelve a verificar.`
      : "No hay hallazgos accionables; ejecuta una regresión si acabas de modificar el proyecto.";
  return { status, items, nextStep };
}

export function summarizeDiagnosis(d: ActionableDiagnosis): string {
  const out = [`Diagnóstico accionable: ${d.status.toUpperCase()}.`, `Siguiente paso: ${d.nextStep}`];
  for (const i of d.items.slice(0, 12)) {
    out.push(`- [${i.severity}] ${i.id}: ${i.action} → ${i.candidatePaths[0] || "archivo por localizar"}. ${i.cause}`);
  }
  if (d.items.length > 12) out.push(`- …y ${d.items.length - 12} hallazgo(s) más.`);
  return out.join("\n");
}
