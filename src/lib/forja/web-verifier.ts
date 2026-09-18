/** Forja Web — verificador independiente del agente.
 *
 * No confía en lo que diga el modelo. Combina comprobaciones estáticas sobre
 * los archivos con evidencia de ejecución que llega de `run_project`.
 * Es deliberadamente puro para poder probarlo sin React ni navegador.
 */
export type VerificationSeverity = "error" | "warning" | "info";
export type VerificationSource = "static" | "runtime" | "visual";

export interface VerificationFinding {
  id: string;
  severity: VerificationSeverity;
  source: VerificationSource;
  message: string;
  evidence?: string;
  path?: string;
}

export interface WebVerification {
  passed: boolean;
  evidenceComplete: boolean;
  findings: VerificationFinding[];
  checked: {
    files: number;
    entry: string | null;
    html: boolean;
    accessibility: boolean;
    security: boolean;
    runtime: boolean;
    visual: boolean;
  };
  at: number;
}

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/sk-[A-Za-z0-9_-]{20,}/g, "posible clave de API (sk-…)"],
  [/AIza[0-9A-Za-z_-]{20,}/g, "posible clave de Google (AIza…)"],
  [/ghp_[A-Za-z0-9]{20,}/g, "posible token de GitHub (ghp_…)"],
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, "clave privada PEM"],
];

function add(
  out: VerificationFinding[],
  id: string,
  severity: VerificationSeverity,
  source: VerificationSource,
  message: string,
  path?: string,
  evidence?: string
) {
  out.push({ id, severity, source, message, ...(path ? { path } : {}), ...(evidence ? { evidence } : {}) });
}

function isExternal(value: string): boolean {
  return /^(?:https?:)?\/\//i.test(value) || /^(?:data|blob|mailto|tel|javascript):/i.test(value);
}

function localPath(value: string): string {
  return value.split(/[?#]/)[0].replace(/^\.\//, "").replace(/^\//, "");
}

/** Verificación estática de un proyecto web. */
export function verifyWebProject(
  files: Record<string, string>,
  runtime?: { executed: boolean; errors: number; errorLines?: string[]; qa?: { ok: boolean; noRespondio?: boolean; items?: { tipo: string; detalle: string }[] } | null; htmlBytes?: number }
): WebVerification {
  const findings: VerificationFinding[] = [];
  const paths = Object.keys(files);
  const packagePath = paths.includes("package.json") ? "package.json" : null;
  const htmlPath = paths.find((p) => /(^|\/)index\.html?$/i.test(p)) ?? paths.find((p) => /\.html?$/i.test(p)) ?? null;
  const html = htmlPath ? files[htmlPath] : null;
  const isNodeWeb = !!packagePath && /(?:next|react|vite|astro|webpack|parcel)/i.test(files[packagePath] ?? "");

  if (!paths.length) add(findings, "empty-project", "error", "static", "El proyecto no contiene archivos.");
  if (!htmlPath && !isNodeWeb) add(findings, "missing-entry", "error", "static", "No existe una página HTML de entrada ni un proyecto web Node reconocido." );
  if (isNodeWeb && !packagePath) add(findings, "missing-package", "error", "static", "Falta package.json en el proyecto Node.");

  let hasA11yChecks = false;
  let hasSecurityChecks = false;
  if (html && htmlPath) {
    hasA11yChecks = true;
    hasSecurityChecks = true;
    if (!/<html\b[^>]*\blang\s*=\s*["'][^"']+["']/i.test(html)) {
      add(findings, "html-lang", "warning", "static", "El elemento <html> no declara lang; los lectores de pantalla necesitan el idioma del documento.", htmlPath);
    }
    if (!/<title\b[^>]*>[^<]{1,160}<\/title>/i.test(html)) {
      add(findings, "html-title", "warning", "static", "Falta un <title> útil para SEO y accesibilidad.", htmlPath);
    }
    if (!/<meta\b[^>]*name\s*=\s*["']viewport["']/i.test(html)) {
      add(findings, "viewport", "warning", "static", "Falta meta viewport; el diseño responsive puede no comportarse correctamente en móvil.", htmlPath);
    }
    for (const m of html.matchAll(/<img\b([^>]*)>/gi)) {
      if (!/\balt\s*=\s*["'][^"']*["']/i.test(m[1])) add(findings, "img-alt", "warning", "static", "Una imagen no tiene atributo alt.", htmlPath);
    }
    for (const m of html.matchAll(/<(?:button|a)\b([^>]*)>([\s\S]*?)<\/(?:button|a)>/gi)) {
      const attrs = m[1]; const body = m[2].replace(/<[^>]+>/g, " ").trim();
      const hasName = body || /\baria-(?:label|labelledby)\s*=|\btitle\s*=/i.test(attrs);
      if (!hasName) add(findings, "interactive-name", "warning", "static", "Hay un botón o enlace sin nombre accesible.", htmlPath);
    }
    for (const m of html.matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']/gi)) {
      const ref = m[1];
      if (!ref || isExternal(ref) || ref.startsWith("#")) continue;
      const p = localPath(ref);
      if (!p || p.startsWith("javascript:")) continue;
      const exists = paths.some((candidate) => candidate === p || candidate.endsWith(`/${p}`));
      if (!exists && /\.(?:css|js|mjs|html?|png|jpe?g|gif|svg|webp|ico|json)$/i.test(p)) {
        add(findings, "missing-local-asset", "error", "static", `Referencia local no encontrada: ${p}.`, htmlPath);
      }
    }
  }

  for (const [path, content] of Object.entries(files)) {
    for (const [re, label] of SECRET_PATTERNS) {
      if (re.test(content)) add(findings, "possible-secret", "error", "static", `Se detectó ${label}; no debería entregarse una credencial en el código.`, path);
      re.lastIndex = 0;
    }
    if (/\bon(?:error|load|click)\s*=\s*["']/i.test(content)) {
      add(findings, "inline-handler", "info", "static", "Hay manejadores inline; considera listeners para separar estructura y comportamiento.", path);
    }
    if (/\b(?:position\s*:\s*(?:absolute|fixed)|width\s*:\s*\d{3,4}px|max-width\s*:\s*\d{3,4}px)/i.test(content) && /\b(?:375|390|320)\b/.test(content)) {
      add(findings, "fixed-mobile-risk", "warning", "static", "Se detectan dimensiones rígidas junto con referencias móviles; el QA runtime debe confirmar que no exista overflow.", path);
    }
  }

  const runtimeChecked = !!runtime?.executed;
  if (runtimeChecked && runtime!.errors > 0) {
    for (const line of (runtime!.errorLines ?? []).slice(0, 8)) add(findings, "runtime-error", "error", "runtime", `Error de ejecución: ${line}`);
  }
  if (!runtimeChecked) add(findings, "runtime-missing", "warning", "runtime", "No hay evidencia de una ejecución del proyecto.");

  let visualChecked = false;
  if (runtime?.qa) {
    visualChecked = !runtime.qa.noRespondio;
    if (runtime.qa.noRespondio) add(findings, "visual-no-evidence", "warning", "visual", "El medidor visual no respondió; no se puede declarar aprobado.");
    else if (!runtime.qa.ok) {
      for (const item of runtime.qa.items ?? []) {
        // nombre accesible y alt ya los cubre el chequeo estático de arriba
        // (img-alt, interactive-name): contarlos también aquí duplicaría el
        // mismo hallazgo a dos severidades por el mismo motivo.
        if (item.tipo === "sin-nombre" || item.tipo === "sin-alt") continue;
        add(findings, `visual-${item.tipo}`, "error", "visual", item.detalle);
      }
    }
  } else add(findings, "visual-missing", "warning", "visual", "No hay evidencia de QA visual.");

  const passed = findings.every((f) => f.severity !== "error") && runtimeChecked && visualChecked;
  return {
    passed,
    evidenceComplete: runtimeChecked && visualChecked,
    findings,
    checked: {
      files: paths.length,
      entry: htmlPath,
      html: !!html,
      accessibility: hasA11yChecks || isNodeWeb,
      security: hasSecurityChecks || paths.length > 0,
      runtime: runtimeChecked,
      visual: visualChecked,
    },
    at: Date.now(),
  };
}

export function summarizeVerification(v: WebVerification): string {
  const errors = v.findings.filter((f) => f.severity === "error");
  const warnings = v.findings.filter((f) => f.severity === "warning");
  const lines = [
    `Verificación independiente: ${v.passed ? "PASS" : "NO PASS"}.`,
    `Evidencia: runtime=${v.checked.runtime ? "sí" : "no"}, visual=${v.checked.visual ? "sí" : "no"}.`,
    `Hallazgos: ${errors.length} error(es), ${warnings.length} advertencia(s).`,
  ];
  if (v.findings.length) lines.push(...v.findings.slice(0, 12).map((f) => `- [${f.severity}] ${f.message}${f.path ? ` (${f.path})` : ""}`));
  return lines.join("\n");
}
