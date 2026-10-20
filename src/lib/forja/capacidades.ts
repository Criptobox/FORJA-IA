"use client";
/** Forja IA — Qué sabe hacer cada modelo, empezando por VER (Plan Maestro 2026 §60).
 *
 * El plan pide elegir modelos por capacidades y no por nombre. La primera que
 * falta de verdad es la visión. Si adjuntas una imagen, Auto elegía por encaje
 * con la tarea sin mirar si el modelo ve imágenes. El proveedor contestaba
 * «does not support image input» y se perdía un intento (a veces dos).
 *
 * Dos fuentes, y la segunda manda sobre la primera:
 *
 *  1. **El nombre**: familias que se sabe que aceptan imágenes (Gemini, GPT-4o
 *     y sucesores, Claude, Llama 4, Pixtral, Qwen-VL, GLM-4V, Kimi-VL…). Es
 *     solo una pista y sirve para ORDENAR, nunca para quitar un modelo.
 *  2. **La evidencia**: un modelo que ya contestó «no admito imágenes» en este
 *     dispositivo se apunta y, con imágenes, sale de la cadena de Auto. Si
 *     luego responde bien a un turno con imágenes, se borra la marca: los
 *     proveedores actualizan modelos.
 *
 * Aprendizaje operativo, como pide el §47: no se entrena nada, se recuerda lo
 * que ha pasado.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { safeLocalStorage } from "./store";

/** Familias con entrada de imagen conocida. Se ordena por ellas, no se filtra. */
const VISION_POR_NOMBRE =
  /(gemini|gemma-3|gpt-4o|gpt-4\.1|gpt-5|\bo[34]\b|o4-mini|claude|llama-4|llama-3\.2-(?:11|90)b-vision|pixtral|mistral-(?:small|medium)-3|qwen[\d.]*-?vl|qvq|glm-4(?:\.\d)?v|kimi-(?:vl|k2\.5|k3)|vision|grok-(?:2-vision|4)|phi-4-multimodal|internvl|minicpm-v|llava)/i;

/** Pista por nombre: ¿esta familia suele aceptar imágenes? */
export function visionPorNombre(modelId: string): boolean {
  return VISION_POR_NOMBRE.test(modelId);
}

export interface SinVision {
  /** cuándo lo dijo el proveedor (epoch ms) */
  at: number;
}

/** ¿Puede este modelo recibir las imágenes del turno?
 *  `false` solo con evidencia: lo que no sabemos, no lo negamos. */
export function puedeVer(sinVision: Record<string, SinVision>, modelKey: string): boolean {
  return !sinVision[modelKey];
}

/**
 * Ordena la cadena para un turno con imágenes. Primero salen los modelos que
 * ya dijeron que no ven, y luego los que lo parecen por su nombre suben
 * delante manteniendo su orden relativo. Si al quitar no queda nadie, se
 * devuelve la cadena ordenada sin quitar: mejor intentarlo que no responder.
 */
export function ordenarParaVision<T extends { providerId: string; modelId: string }>(
  cadena: readonly T[],
  sinVision: Record<string, SinVision>
): T[] {
  const clave = (c: T) => `${c.providerId}::${c.modelId}`;
  const utiles = cadena.filter((c) => puedeVer(sinVision, clave(c)));
  const base = utiles.length ? utiles : [...cadena];
  return [...base.filter((c) => visionPorNombre(c.modelId)), ...base.filter((c) => !visionPorNombre(c.modelId))];
}

interface CapacidadesState {
  /** por `modelKey`: modelos que contestaron «no admito imágenes» */
  sinVision: Record<string, SinVision>;
  marcarSinVision: (modelKey: string) => void;
  /** vio imágenes sin quejarse: la marca ya no vale */
  confirmarVision: (modelKey: string) => void;
}

export const useCapacidades = create<CapacidadesState>()(
  persist(
    (set) => ({
      sinVision: {},
      marcarSinVision: (modelKey) =>
        set((s) => ({ sinVision: { ...s.sinVision, [modelKey]: { at: Date.now() } } })),
      confirmarVision: (modelKey) =>
        set((s) => {
          if (!s.sinVision[modelKey]) return s;
          const { [modelKey]: _fuera, ...resto } = s.sinVision;
          return { sinVision: resto };
        }),
    }),
    { name: "forja-capacidades-v1", storage: createJSONStorage(safeLocalStorage) }
  )
);
