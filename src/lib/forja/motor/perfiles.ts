/** FORJA IA — Perfiles de coste de FORJA IA (v4.0.0, sección 26 del plan).
 *
 * «La Arena puede consumir muchas llamadas». El plan define 4 perfiles
 * INTERNOS AL MOTOR (no planes comerciales, no mensajes de marketing):
 *
 *   FREE — 1 dirección, 1 maqueta, revisión básica
 *   SMART — 3 direcciones, anti-genérico, revisión
 *   ARENA — 2/3 equipos, jueces, fusión
 *   LAB — múltiples modelos, experimentación, benchmark
 *
 * Cada receta dice exactamente qué piezas del motor se activan y cuántas
 * llamadas de modelo consume el flujo COMPLETO (estimación, porque las
 * rondas de corrección dependen del Revisor).
 *
 * Regla de etiquetado del plan: nunca «IA ilimitada gratis»; técnicamente
 * «el motor tiene perfiles de presupuesto y el usuario controla el motor».
 */

/* -------------------------------- tipos ------------------------------------ */

export type PerfilCosto = "FREE" | "SMART" | "ARENA" | "LAB";

export interface RecetaCosto {
  /** visiones que explora el Director */
  visiones: 1 | 2 | 3;
  /** maquetas que se construyen (0 = solo ficha) */
  maquetas: 0 | 1 | 2 | 3;
  /** jueces del panel (0 = sin panel) */
  jueces: 0 | 1 | 3 | 5;
  /** ¿director final + fusión? */
  fusion: boolean;
  /** rondas máximas de corrección código → revisión */
  rondas: number;
  /** ¿bucle de mejora automático (revisor-visual)? */
  bucleMejora: boolean;
  /** ¿benchmark + métricas al terminar? */
  benchmark: boolean;
  /** estimación de llamadas del flujo completo */
  llamadasEstimadas: string;
  /** una línea para la UI */
  descripcion: string;
}

export const RECETAS_COSTO: Record<PerfilCosto, RecetaCosto> = {
  FREE: {
    visiones: 1,
    maquetas: 1,
    jueces: 0,
    fusion: false,
    rondas: 2,
    bucleMejora: false,
    benchmark: false,
    llamadasEstimadas: "3-5",
    descripcion: "1 dirección, 1 maqueta, revisión básica. El mínimo honesto.",
  },
  SMART: {
    visiones: 3,
    maquetas: 1,
    jueces: 0,
    fusion: false,
    rondas: 3,
    bucleMejora: true,
    benchmark: false,
    llamadasEstimadas: "6-9",
    descripcion: "3 direcciones con anti-genérico activo, 1 maqueta, bucle de mejora.",
  },
  ARENA: {
    visiones: 3,
    maquetas: 3,
    jueces: 3,
    fusion: true,
    rondas: 3,
    bucleMejora: true,
    benchmark: true,
    llamadasEstimadas: "12-16",
    descripcion: "3 visiones, 3 maquetas, panel de jueces con evidencia, fusión del Director.",
  },
  LAB: {
    visiones: 3,
    maquetas: 3,
    jueces: 5,
    fusion: true,
    rondas: 4,
    bucleMejora: true,
    benchmark: true,
    llamadasEstimadas: "18-25",
    descripcion: "Como ARENA + 5 jueces, 4 rondas, benchmark y métricas. Para experimentar.",
  },
};

export const PERFIL_COSTO_DEFECTO: PerfilCosto = "SMART";

/** Sanea un perfil de coste con fallback. */
export function perfilCostoSeguro(p: string | undefined | null): PerfilCosto {
  return p === "FREE" || p === "SMART" || p === "ARENA" || p === "LAB" ? p : PERFIL_COSTO_DEFECTO;
}

/** Mapa del perfil de coste → el perfil de recursos v3 más cercano
 * (compatibilidad: ConfigForja.perfil sigue existiendo). */
export function perfilRecursosDesdeCosto(p: PerfilCosto): "ligero" | "equilibrado" | "profundo" {
  switch (p) {
    case "FREE":
      return "ligero";
    case "LAB":
      return "profundo";
    default:
      return "equilibrado";
  }
}

/** El plan de ejecución concreto de un perfil: qué pasos corre el MVP
 * (nucleo-v4.ts) y en qué orden. Es la fuente única de verdad del flujo. */
export const PLANES_MVP: Record<PerfilCosto, string[]> = {
  FREE: ["adn", "direcciones(1)", "maqueta(1)", "codigo", "revision"],
  SMART: ["adn", "direcciones(3)", "antigenerico", "maqueta(1)", "codigo", "revision", "bucle"],
  ARENA: ["adn", "direcciones(3)", "antigenerico", "maquetas(3)", "jueces(3)", "fusion", "codigo", "revision", "bucle", "metricas"],
  LAB: ["adn", "direcciones(3)", "antigenerico", "maquetas(3)", "jueces(5)", "fusion", "codigo", "revision", "bucle", "metricas", "benchmark"],
};

export function planMvp(p: PerfilCosto): readonly string[] {
  return PLANES_MVP[p];
}
