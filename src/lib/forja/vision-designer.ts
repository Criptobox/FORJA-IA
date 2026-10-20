/**
 * Forja IA — Vision Designer.
 * Contrato para convertir referencias visuales en señales de diseño sin copiar
 * una obra concreta. El análisis multimodal real sigue correspondiendo al
 * modelo de visión activo; este módulo normaliza el resultado.
 */

export interface VisualReference {
  id: string;
  name: string;
  source?: string;
  kind: "screenshot" | "image" | "url" | "user-upload";
}

export interface VisionAnalysis {
  composition: string[];
  hierarchy: string[];
  spacing: string[];
  typography: string[];
  color: string[];
  surfaces: string[];
  interaction: string[];
  responsive: string[];
  keep: string[];
  improve: string[];
  avoidCopying: string[];
}

export function emptyVisionAnalysis(): VisionAnalysis {
  return {
    composition: [],
    hierarchy: [],
    spacing: [],
    typography: [],
    color: [],
    surfaces: [],
    interaction: [],
    responsive: [],
    keep: [],
    improve: [],
    avoidCopying: [
      "No copiar logos, textos, imágenes, assets o código de una referencia.",
      "Extraer principios visuales y producir una interpretación original.",
    ],
  };
}

export function visionDesignerPrompt(referenceCount: number): string {
  return [
    "[FORJA VISION DESIGNER]",
    `REFERENCIAS: ${referenceCount}`,
    "Analiza la referencia como sistema visual, no como plantilla.",
    "Describe composición, jerarquía, ritmo, espaciado, tipografía, superficies, color, interacción y comportamiento responsive.",
    "Separa lo que debe conservarse como principio de lo que conviene mejorar.",
    "No reproduzcas identidad, textos, logos, imágenes ni código protegido.",
    "La salida debe servir al Design Architect y al Code Agent, no ser una descripción estética vaga.",
  ].join("\n");
}

export function compactVisionContext(a: VisionAnalysis, maxChars = 2600): string {
  const sections: [string, string[]][] = [
    ["COMPOSICIÓN", a.composition],
    ["JERARQUÍA", a.hierarchy],
    ["ESPACIADO", a.spacing],
    ["TIPOGRAFÍA", a.typography],
    ["COLOR", a.color],
    ["SUPERFICIES", a.surfaces],
    ["INTERACCIÓN", a.interaction],
    ["RESPONSIVE", a.responsive],
    ["MEJORAR", a.improve],
  ];
  const out: string[] = ["[FORJA VISION CONTEXT]"];
  for (const [title, items] of sections) {
    if (!items.length) continue;
    out.push(`${title}: ${items.slice(0, 5).join("; ")}`);
  }
  const text = out.join("\n");
  return text.length <= maxChars ? text : text.slice(0, maxChars - 1) + "…";
}
