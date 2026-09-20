/**
 * Forja IA — Design Architect.
 * Convierte un brief corto en una decisión de arquitectura visual.
 * No genera HTML: prepara decisiones compactas para el Code Agent.
 */
import { detectIndustry, type IndustryStrategy } from "./industry-strategies";
import { DIRECCIONES, elegirDireccion, type DireccionVisual } from "./design-directions";

export interface DesignArchitecture {
  industry: IndustryStrategy;
  direction: DireccionVisual;
  layoutPrinciples: string[];
  responsiveRules: string[];
  interactionRules: string[];
  forbiddenPatterns: string[];
  rationale: string[];
}

export interface DesignArchitectInput {
  brief: string;
  directionId?: string;
  previousDirectionIds?: string[];
}

/** Sin `directionId` explícito (quien ya eligió una dirección en otro
 * sitio y quiere que el Architect la use, no que decida otra), delega en
 * `elegirDireccion`: el mismo hash del brief que ya usa el resto de la
 * app (mismo encargo decide igual, encargos distintos varían, evitando
 * las direcciones recientes). Reinventar la rotación aquí duplicaba la
 * lógica y, sin `previousDirectionIds` reales, siempre caía en la
 * primera del catálogo — cero variedad entre encargos. */
function chooseDirection(input: DesignArchitectInput): DireccionVisual {
  if (input.directionId) {
    const exact = DIRECCIONES.find((d) => d.id === input.directionId);
    if (exact) return exact;
  }
  return elegirDireccion(input.brief, input.previousDirectionIds ?? []).direccion;
}

export function buildDesignArchitecture(input: DesignArchitectInput): DesignArchitecture {
  const industry = detectIndustry(input.brief);
  const direction = chooseDirection(input);

  const layoutPrinciples = [
    `La estructura debe servir primero al objetivo: ${industry.primaryGoal}.`,
    `Usar la lógica de navegación: ${industry.navigation}.`,
    `Patrón de conversión: ${industry.conversionPattern}.`,
    `Composición de la dirección: ${direction.composicion}.`,
    "Crear jerarquía de una idea principal por viewport; no rellenar huecos con tarjetas.",
    "Variar ritmos: combinar bloques de contenido, imagen, lista, datos y espacios de descanso.",
  ];

  const responsiveRules = [
    `En móvil: ${industry.mobilePattern}.`,
    "Diseñar primero el orden móvil y después ampliar a tablet/escritorio.",
    "No reducir simplemente el escritorio: cambiar columnas, navegación y controles cuando sea necesario.",
    "Probar al menos 320, 390, 768 y escritorio.",
  ];

  const interactionRules = [
    "Cada interacción importante debe tener estado hover/focus/active/loading/disabled cuando corresponda.",
    "Preferir microinteracciones cortas con propósito; no animar por decorar.",
    "Los drawers, sheets, filtros y navegación móvil deben tener foco y cierre accesibles.",
  ];

  const forbiddenPatterns = [
    ...industry.avoid,
    "hero centrado genérico con tres cards idénticas salvo que el brief lo exija",
    "una sola tipografía system-ui para toda la página cuando la dirección exige personalidad",
    "contenido de relleno inventado para llenar espacio",
  ];

  return {
    industry,
    direction,
    layoutPrinciples,
    responsiveRules,
    interactionRules,
    forbiddenPatterns,
    rationale: [
      `Industria detectada: ${industry.id}.`,
      `Dirección visual: ${direction.nombre}.`,
      `Se evita una plantilla universal y se decide la composición antes del código.`,
    ],
  };
}

export function designArchitecturePrompt(a: DesignArchitecture): string {
  return [
    "[FORJA DESIGN ARCHITECT]",
    `INDUSTRIA: ${a.industry.id}`,
    `OBJETIVO: ${a.industry.primaryGoal}`,
    `DIRECCIÓN: ${a.direction.nombre}`,
    `PALETA: ${JSON.stringify(a.direction.paleta)}`,
    `TIPOGRAFÍA: ${a.direction.fuentes.display} + ${a.direction.fuentes.cuerpo}`,
    `COMPOSICIÓN: ${a.direction.composicion}`,
    `DETALLE: ${a.direction.detalle}`,
    "PRINCIPIOS:",
    ...a.layoutPrinciples.map((x) => `- ${x}`),
    "RESPONSIVE:",
    ...a.responsiveRules.map((x) => `- ${x}`),
    "INTERACCIÓN:",
    ...a.interactionRules.map((x) => `- ${x}`),
    "NO HACER:",
    ...a.forbiddenPatterns.map((x) => `- ${x}`),
  ].join("\n");
}
