/** FORJA IA — El equipo de FORJA IA: tres puestos, tres especialidades.
 *
 * Cada rol tiene su propia mentalidad (prompt maestro), su temperatura
 * recomendada y una lista de candidatos de modelo por defecto. La lista de
 * candidatos es SUGERENCIA, no dependencia: si el proveedor de turno no lo
 * tiene, la configuración manual manda (Ajustes → FORJA IA).
 *
 * Por qué así y no un solo prompt gigante: los modelos gratuitos tienen
 * ventana corta y obedecen mejor a una instrucción con UNA profesión que a
 * diez mezcladas. Separar roles también permite dar a cada puesto el modelo
 * que mejor le sirve: un coder fuerte para el código, un modelo barato y
 * literal para auditar contra el checklist.
 */

import type { RolForja } from "./tipos";

/** Datos de un puesto del equipo. */
export interface PuestoForja {
  rol: RolForja;
  /** nombre en la interfaz */
  nombre: string;
  /** una línea: qué aporta al resultado */
  resumen: string;
  /** temperatura recomendada para este puesto */
  temperatura: number;
  /** sugerencias de modelos (providerId, modelId) ordenadas por preferencia.
   * Son puntos de partida verificables contra el catálogo del usuario. */
  sugerencias: { providerId: string; modelId: string; nota: string }[];
}

export const EQUIPO_FORJA: Record<RolForja, PuestoForja> = {
  disenador: {
    rol: "disenador",
    nombre: "Diseñador",
    resumen: "Estrategia, 3 ideas de diseño y la ficha concreta que maqueta el equipo.",
    temperatura: 0.6,
    sugerencias: [
      { providerId: "openrouter", modelId: "deepseek/deepseek-chat:free", nota: "buen criterio visual, gratis" },
      { providerId: "groq", modelId: "llama-3.3-70b-versatile", nota: "rápido y creativo" },
      { providerId: "gemini", modelId: "gemini-2.5-flash", nota: "capa gratuita generosa" },
    ],
  },
  codificador: {
    rol: "codificador",
    nombre: "Codificador",
    resumen: "Escribe el código completo que cumple la ficha al detalle.",
    temperatura: 0.2,
    sugerencias: [
      { providerId: "openrouter", modelId: "qwen/qwen3-coder:free", nota: "especialista en código" },
      { providerId: "groq", modelId: "moonshotai/kimi-k2-instruct", nota: "velocidad para archivos largos" },
      { providerId: "zai", modelId: "glm-4.7-flash", nota: "gratis, buen HTML/CSS" },
    ],
  },
  revisor: {
    rol: "revisor",
    nombre: "Revisor",
    resumen: "Audita el código contra la ficha y el checklist de calidad.",
    temperatura: 0,
    sugerencias: [
      { providerId: "openrouter", modelId: "meta-llama/llama-4-scout:free", nota: "literal y estricto" },
      { providerId: "gemini", modelId: "gemini-2.5-flash", nota: "buen ojo para detalles" },
      { providerId: "cerebras", modelId: "llama-3.3-70b", nota: "auditoría casi instantánea" },
    ],
  },
};

/** Orden fijo del pipeline. Exportado para que el núcleo y la UI coincidan. */
export const ORDEN_PIPELINE: RolForja[] = ["disenador", "codificador", "revisor"];
