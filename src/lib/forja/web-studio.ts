/** Forja IA — Web Studio: workflow especializado en construir y verificar interfaces web.
 * No ejecuta nada por sí mismo: prepara un contrato de trabajo para el agente y mantiene
 * un estado explícito. Las mediciones reales siguen viniendo de Sandbox/Visual QA.
 */
export type WebStudioStage = "brief" | "plan" | "build" | "qa" | "fix" | "regression" | "publish";

export const WEB_STUDIO_STAGES: readonly { id: WebStudioStage; label: string }[] = [
  { id: "brief", label: "Brief" },
  { id: "plan", label: "Plan" },
  { id: "build", label: "Build" },
  { id: "qa", label: "Visual QA" },
  { id: "fix", label: "Fix" },
  { id: "regression", label: "Regression" },
  { id: "publish", label: "Publish" },
];

export interface WebStudioOptions {
  brief: string;
  stack?: string;
  visualDirection?: string;
  responsive?: boolean;
  accessibility?: boolean;
  performance?: boolean;
  useExistingProject?: boolean;
}

export function buildWebStudioPrompt(o: WebStudioOptions): string {
  const stack = o.stack?.trim() || "la tecnología que ya exista en el proyecto; no migres sin necesidad";
  const visual = o.visualDirection?.trim() || "evolución premium coherente con la identidad existente";
  const checks = [
    o.responsive !== false ? "responsive real (320, 390, 768 y escritorio)" : "",
    o.accessibility !== false ? "accesibilidad básica (semántica, foco, contraste y nombres accesibles)" : "",
    o.performance !== false ? "evitar dependencias y peso innecesarios" : "",
  ].filter(Boolean);
  return [
    "MODO WEB STUDIO DE FORJA",
    "",
    `OBJETIVO: ${o.brief.trim()}`,
    `STACK: ${stack}`,
    `DIRECCIÓN VISUAL: ${visual}`,
    `REGLAS: ${checks.join("; ")}.`,
    "",
    o.useExistingProject !== false
      ? "Primero inspecciona el proyecto existente y conserva su identidad. No reconstruyas desde cero lo que ya funciona."
      : "Si es un proyecto nuevo, crea la estructura mínima necesaria.",
    "Antes de editar, entrega un plan corto y declara los archivos que tocarás.",
    "Después de cada cambio verificable: ejecuta la vista previa, revisa consola y usa Visual QA cuando esté disponible.",
    "No afirmes que algo pasó una prueba si no existe una medición.",
    "Si aparece un error, corrígelo antes de continuar y explica qué evidencia lo confirmó.",
    "Termina con un resumen de cambios, pruebas ejecutadas y pendientes reales.",
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* Etapas según evidencia                                              */
/* ------------------------------------------------------------------ */

export type EstadoEtapa = "hecha" | "pendiente" | "bloqueada";

/** Lo que el Studio sabe de verdad del proyecto. Nada de lo que no se ha
 *  medido cuenta como hecho. */
export interface EvidenciaStudio {
  brief: string;
  /** se lanzó el trabajo con el agente desde el Studio */
  iniciado: boolean;
  /** hay una página que previsualizar */
  hayHtml: boolean;
  /** mediciones de Visual QA, en orden (la última es la vigente) */
  qa: readonly { ok: boolean; noRespondio?: boolean; hallazgos: number }[][];
  /** tareas abiertas que salieron del QA */
  tareasQaAbiertas: number;
  /** bloqueos verificados (Project Health) y secretos del Security Center */
  bloqueos: number;
}

export interface EstadoStudio {
  etapas: Record<WebStudioStage, EstadoEtapa>;
  siguiente: WebStudioStage | null;
  motivo: string;
}

function hallazgosDe(medida: EvidenciaStudio["qa"][number]): number | null {
  const validas = medida.filter((r) => !r.noRespondio);
  return validas.length ? validas.reduce((n, r) => n + r.hallazgos, 0) : null;
}

export function evaluarEtapas(e: EvidenciaStudio): EstadoStudio {
  const medidas = e.qa.map(hallazgosDe).filter((n): n is number => n != null);
  const ultima = medidas.length ? medidas[medidas.length - 1] : null;
  const etapas: Record<WebStudioStage, EstadoEtapa> = {
    brief: e.brief.trim().length >= 10 || e.iniciado ? "hecha" : "pendiente",
    plan: e.iniciado ? "hecha" : "pendiente",
    build: e.hayHtml ? "hecha" : "pendiente",
    qa: ultima != null ? "hecha" : "pendiente",
    fix: ultima == null ? "pendiente" : ultima === 0 && e.tareasQaAbiertas === 0 ? "hecha" : "pendiente",
    // una regresión es volver a medir DESPUÉS de arreglar: hacen falta dos
    // medidas y que la última esté limpia
    regression: medidas.length >= 2 && ultima === 0 ? "hecha" : "pendiente",
    // publicar nunca se da por hecho desde aquí: no lo vemos
    publish: e.bloqueos > 0 ? "bloqueada" : "pendiente",
  };
  const motivos: Record<WebStudioStage, string> = {
    brief: "Escribe qué quieres conseguir (una frase basta).",
    plan: "Lanza el trabajo con el agente: inspecciona y planifica antes de tocar.",
    build: "Todavía no hay página que previsualizar.",
    qa: "Mide la página con Visual QA: nada cuenta como revisado sin medida.",
    fix: `La última medida dejó ${ultima ?? 0} hallazgo(s) y ${e.tareasQaAbiertas} tarea(s) de QA abiertas.`,
    regression: "Vuelve a medir tras los arreglos para confirmar que no se rompió nada.",
    publish: e.bloqueos > 0 ? `Hay ${e.bloqueos} bloqueo(s) verificados antes de publicar.` : "Todo lo medible está en verde: publica desde Repo Studio.",
  };
  const siguiente = WEB_STUDIO_STAGES.find((s) => etapas[s.id] !== "hecha")?.id ?? null;
  return { etapas, siguiente, motivo: siguiente ? motivos[siguiente] : "" };
}
