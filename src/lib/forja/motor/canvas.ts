/** FORJA IA — CANVAS tipo Stitch de FORJA STUDIO (v4.0.0, fase 4 del plan).
 *
 * El plan define la pantalla del estudio:
 *
 *   ┌─────────────┬──────────────────────────────┬─────────────┐
 *   │ DIRECCIONES │           CANVAS             │ FORJA CRITIC│
 *   │  A B C      │   (preview vivo, streaming)  │ identidad UX │
 *   │ + generar   │                              │ acces. gen.  │
 *   ├─────────────┴──────────────────────────────┴─────────────┤
 *   │ [Iterar] [Fusionar] [Comparar] [Código] [Exportar]      │
 *   └───────────────────────────────────────────────────────────┘
 *
 * Este módulo es la MÁQUINA DE ESTADOS del canvas y el STEERING semántico:
 * el usuario escribe «hazlo más exclusivo» y FORJA lo traduce a decisiones
 * concretas (voz.ts), jamás a gradientes automáticos. Las acciones del
 * pie (iterar/fusionar/comparar/código/exportar) son las del plan, cada una
 * con su contrato. El canvas NO copia la UI de Stitch: implementa el flujo.
 *
 * Todo determinista y sin red: la máquina de estados es pura; el resultado
 * visual del canvas es un OpenDesignArtifact (adapter-opendesign.ts).
 */

import type { AdnVisual2, ComandoSemantico } from "./tipos-v4";
import { interpretarVoz, textoComandos, aplicarComandos } from "./voz";
import type { Vision2 } from "./director2";
import type { OpenDesignArtifact } from "./adapter-opendesign";

/* ------------------------------- estados ----------------------------------- */

/** Fase del canvas. `esperando` = sin generación aún. */
export type FaseCanvas =
  | "esperando"
  | "generando-direcciones"
  | "direcciones-listas"
  | "generando-canvas"
  | "canvas-listo"
  | "iterando"
  | "comparando"
  | "listo-para-codigo"
  | "exportado";

export type AccionCanvas = "iterar" | "fusionar" | "comparar" | "codigo" | "exportar";

/** Estado completo del canvas en un momento dado. */
export interface EstadoCanvas {
  fase: FaseCanvas;
  /** visión activa en el canvas (A/B/C) */
  activa: "A" | "B" | "C" | "fusion";
  /** las visiones del Director 2.0 disponibles en la barra lateral */
  visiones: Vision2[];
  /** el artefacto visible en el canvas */
  artifact: OpenDesignArtifact | null;
  /** historial de versiones del canvas (para comparar y revertir) */
  historial: { etiqueta: string; artifact: OpenDesignArtifact; score: number }[];
  /** el steering acumulado (comandos semánticos aplicados) */
  steering: ComandoSemantico[];
  /** el ADN ajustado por el steering (lo que viaja a la próxima generación) */
  adnAjustado: AdnVisual2 | null;
  /** acciones disponibles ahora mismo (para pintar el pie) */
  acciones: AccionCanvas[];
}

export function estadoCanvasInicial(): EstadoCanvas {
  return {
    fase: "esperando",
    activa: "A",
    visiones: [],
    artifact: null,
    historial: [],
    steering: [],
    adnAjustado: null,
    acciones: [],
  };
}

/* ------------------------------- steering ----------------------------------- */

/** Resultado de un steering: qué entendió + cómo queda el estado. */
export interface ResultadoSteering {
  comandos: ComandoSemantico[];
  /** texto «esto entendí» para la UI */
  interpretacion: string;
  /** el ejemplo canónico del plan: lo que NO se hace automáticamente */
  prohibidoAutomatico: string[];
  nuevoAdn: AdnVisual2 | null;
}

/** Traduce una instrucción del usuario («más exclusivo») a decisiones con
 *cretas. NUNCA añade gradientes ni glassmorphism automáticos (regla del
 * plan, sección 10). */
export function steerCanvas(_estado: EstadoCanvas, frase: string, adn: AdnVisual2): ResultadoSteering {
  const comandos = interpretarVoz(frase);
  const nuevoAdn = comandos.length ? aplicarComandos(adn, comandos) : null;
  return {
    comandos,
    interpretacion: textoComandos(comandos),
    prohibidoAutomatico: [
      "añadir gradientes automáticamente",
      "añadir glassmorphism automáticamente",
      "cambiar la estructura sin pedirlo",
    ],
    nuevoAdn,
  };
}

/* ------------------------------ transiciones -------------------------------- */

/** Marca la acción que corresponde tras cada fase (reglas del flujo). */
function accionesDeFase(f: FaseCanvas): AccionCanvas[] {
  switch (f) {
    case "direcciones-listas":
      return ["iterar"];
    case "canvas-listo":
      return ["iterar", "fusionar", "comparar", "codigo"];
    case "iterando":
    case "comparando":
      return ["iterar", "comparar"];
    case "listo-para-codigo":
      return ["codigo", "exportar"];
    case "exportado":
      return ["exportar"];
    default:
      return [];
  }
}

/** Transición pura: «canvas en fase X tras evento Y». La UI solo pinta. */
export function transicionCanvas(estado: EstadoCanvas, nuevaFase: FaseCanvas, cambios: Partial<EstadoCanvas> = {}): EstadoCanvas {
  const siguiente: EstadoCanvas = { ...estado, ...cambios, fase: nuevaFase };
  siguiente.acciones = accionesDeFase(nuevaFase);
  return siguiente;
}

/** Registra una versión nueva en el historial (máx 10: las viejas caen). */
export function guardarVersion(estado: EstadoCanvas, etiqueta: string, artifact: OpenDesignArtifact, score: number): EstadoCanvas {
  const historial = [...estado.historial, { etiqueta, artifact, score }].slice(-10);
  return transicionCanvas(estado, estado.fase, { historial });
}

/** Compara dos versiones del historial y devuelve el veredicto. */
export function compararVersiones(estado: EstadoCanvas, a: number, b: number): {
  mejor: string;
  detalle: string;
} | null {
  const va = estado.historial[a];
  const vb = estado.historial[b];
  if (!va || !vb) return null;
  const mejor = vb.score >= va.score ? vb : va;
  const peor = mejor === va ? vb : va;
  return {
    mejor: `${mejor.etiqueta} (score ${mejor.score})`,
    detalle: `Diferencia de score: ${mejor.score - peor.score} puntos a favor de ${mejor.etiqueta}.`,
  };
}

/** El resumen del FORJA CRITIC lateral (identidad/UX/accesibilidad/genericidad)
 * a partir del último informe del revisor visual (texto ya formateado). */
export function textoCritic(resumenRevisor: string, identidad: number, genericidadNivel: string): string {
  return [
    `# FORJA CRITIC`,
    `Identidad: ${identidad}/100`,
    `Genericidad: ${genericidadNivel}`,
    resumenRevisor,
  ].join("\n");
}
