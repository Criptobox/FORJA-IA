"use client";
/** Forja IA — Lo que cada modelo demostró sobre CÓMO pide las herramientas.
 *
 * `tools-probe.ts` solo comprueba que un proveedor ACEPTA el parámetro
 * `tools` (un código HTTP). Eso no dice nada sobre si el modelo va a
 * rellenar `tool_calls` de verdad — nvidia/nemotron vía OpenRouter pasa el
 * probe como "sí soporta tools" y aun así entrega la llamada con SU PROPIA
 * plantilla de texto (`tool-calls-texto.ts`, v4.15.0). El probe es ciego a
 * eso: solo una generación REAL lo demuestra.
 *
 * Esto lo recuerda, con el mismo patrón reactivo que `limites-medidos.ts`:
 * nada se adivina, solo se guarda lo que ya se VIO pasar de verdad — y
 * caduca solo, porque un proveedor puede cambiar el modelo detrás del
 * mismo id sin avisar.
 *
 * Deliberadamente NO cambia `ToolsSupport` ni `supportsTools()`: el modelo
 * SÍ soporta tools (el fallback las ejecuta igual), así que apagarlas
 * sería peor que la plantilla en texto. Esto es información aparte, para
 * quien quiera saber por qué un modelo concreto se apoya en el fallback.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { safeLocalStorage } from "./store";

/** Cuánto dura la marca. Un proveedor puede sustituir silenciosamente el
 * modelo detrás del mismo id; releer cada cierto tiempo evita quedarse con
 * una etiqueta que ya no es cierta para siempre. Más generoso que la
 * vigencia de `limites-medidos.ts` (que vigila cupos por minuto): esto es
 * un rasgo del propio modelo, no algo que se repone solo. */
export const VIGENCIA_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

export interface LlamadaTextoMedida {
  /** cuántas veces se ha visto el patrón de verdad */
  veces: number;
  at: number;
}

export type LlamadasTexto = Record<string, LlamadaTextoMedida>;

/** ¿Ya vimos a ESTE modelo pedir tools como texto plano, y sigue fresco? */
export function pideComoTexto(
  medidas: LlamadasTexto,
  modelKey: string,
  ahora: number = Date.now()
): boolean {
  const m = medidas[modelKey];
  if (!m) return false;
  return ahora - m.at <= VIGENCIA_MS;
}

interface LlamadasTextoState {
  medidas: LlamadasTexto;
  /** se llama cada vez que el fallback de `tool-calls-texto.ts` reconoce y
   * ejecuta de verdad una llamada en texto — nunca por sospecha. */
  anotar: (modelKey: string, at?: number) => void;
}

/** Mensaje corto para la UI, cuando haga falta explicar por qué un modelo
 * concreto va más despacio o se ve distinto: ya se sabe de él, no es una
 * sospecha. */
export function mensajeLlamadaComoTexto(vista: boolean): string | null {
  if (!vista) return null;
  return "Este modelo pide las herramientas como texto, con su propia plantilla, en vez de la respuesta estructurada de la API. Forja lo reconoce y lo ejecuta igual.";
}

export const useLlamadasTexto = create<LlamadasTextoState>()(
  persist(
    (set) => ({
      medidas: {},
      anotar: (modelKey, at = Date.now()) =>
        set((s) => {
          const previo = s.medidas[modelKey];
          return {
            medidas: {
              ...s.medidas,
              [modelKey]: { veces: (previo?.veces ?? 0) + 1, at },
            },
          };
        }),
    }),
    { name: "forja-llamadas-texto-v1", storage: createJSONStorage(safeLocalStorage) }
  )
);
