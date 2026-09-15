/** Prism AI — Web Studio: workflow especializado en construir y verificar interfaces web.
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
    "MODO WEB STUDIO DE PRISM",
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
