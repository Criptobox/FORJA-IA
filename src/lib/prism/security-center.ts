/** Prism AI — Security Center: análisis local conservador del código visible.
 * Es diagnóstico, no un escáner de seguridad completo. Nunca afirma ausencia de vulnerabilidades.
 */
export interface SecurityFinding {
  severity: "high" | "medium" | "low";
  rule: string;
  detail: string;
  evidence: string;
}
export interface SecurityReport { findings: SecurityFinding[]; score: number | null; disclaimer: string; }

const rules: Array<{ re: RegExp; severity: SecurityFinding["severity"]; rule: string; detail: string }> = [
  { re: /(?:sk-[A-Za-z0-9]{16,}|AIza[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,})/g, severity: "high", rule: "secret-inline", detail: "Parece haber una credencial incrustada en el código visible." },
  { re: /(?:^|[^a-z])http:\/\//gi, severity: "medium", rule: "insecure-http", detail: "Recurso HTTP sin cifrar; usa HTTPS cuando el recurso lo soporte." },
  { re: /\beval\s*\(/gi, severity: "medium", rule: "eval", detail: "eval() ejecuta código dinámico y amplía la superficie de riesgo." },
  { re: /\binnerHTML\s*=/gi, severity: "medium", rule: "innerHTML", detail: "innerHTML requiere sanitización cuando el contenido no es totalmente confiable." },
  { re: /<script\b[^>]+src=["'](?!https:\/\/|\/)/gi, severity: "low", rule: "external-script", detail: "Script remoto o relativo detectado; revisa su procedencia y necesidad." },
];

export function scanSecurity(text: string): SecurityReport {
  const findings: SecurityFinding[] = [];
  const seen = new Set<string>();
  for (const r of rules) {
    r.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = r.re.exec(text)) && findings.length < 30) {
      const evidence = text.slice(Math.max(0, m.index - 45), Math.min(text.length, m.index + 90)).replace(/\s+/g, " ");
      const key = `${r.rule}|${evidence.slice(0, 80)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({ severity: r.severity, rule: r.rule, detail: r.detail, evidence });
      if (!r.re.global) break;
    }
  }
  const penalty = findings.reduce((n, f) => n + (f.severity === "high" ? 35 : f.severity === "medium" ? 15 : 5), 0);
  return {
    findings,
    score: text ? Math.max(0, 100 - Math.min(100, penalty)) : null,
    disclaimer: "Diagnóstico estático local: no sustituye una auditoría de seguridad ni demuestra ausencia de vulnerabilidades.",
  };
}
