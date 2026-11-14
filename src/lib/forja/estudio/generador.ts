/** FORJA IA — Estudio de diseño: llamar a los modelos.
 *
 * Usa la misma cadena que el modo Auto del chat (`buildTaskChain` para tareas
 * «web»): el mejor modelo gratis conectado primero y, si falla por cuota o
 * caída, el siguiente — con el registro de salud compartido, así un modelo
 * enfriado en el chat también se salta aquí y viceversa. */

import { streamChat } from "../chat-client";
import {
  cooldownRemaining,
  providerCooldownRemaining,
  retryAfterFromError,
  statusFromError,
  useHealth,
  esFalloDeCuota,
} from "../health";
import { separarEtiquetasPensamiento } from "../razonamiento";
import { useForja } from "../store";
import { buildTaskChain } from "../task-router";
import { ordenarParaVision, useCapacidades } from "../capacidades";
import type { Attachment } from "../types";
import type { LlamadaModelo } from "../motor/tipos";
import { RuntimeModelo } from "../motor/runtime-modelo";
import { isAutoKey, makeModelKey, splitModelKey, type ProviderId } from "../types";

export interface PeticionModelo {
  /** system prompt (streamChat lo toma de settings.systemPrompt) */
  sistema: string;
  usuario: string;
  /** modelKey elegido, o null / AUTO para la cadena automática */
  modeloKey: string | null;
  signal: AbortSignal;
  /** texto acumulado (sin razonamiento) mientras llega */
  onTexto?: (acumulado: string) => void;
  /** se avisa cada vez que se prueba un modelo distinto */
  onModelo?: (modelKey: string) => void;
  maxTokens?: number;
  /** imágenes de referencia: si las hay, primero los modelos que ven */
  imagenes?: { nombre: string; dataUrl: string }[];
}

export interface RespuestaModelo {
  texto: string;
  modelKey: string;
}

export class SinModelosError extends Error {
  constructor() {
    super("No hay modelos conectados. Añade una clave gratis (Gemini, Groq, OpenRouter…) en Ajustes ▸ Proveedores.");
    this.name = "SinModelosError";
  }
}

/** Candidatos en orden: el elegido, o la cadena del modo Auto. */
export function candidatos(modeloKey: string | null, conImagenes = false): { providerId: ProviderId; modelId: string }[] {
  const st = useForja.getState();
  if (modeloKey && !isAutoKey(modeloKey)) {
    const s = splitModelKey(modeloKey);
    return s ? [s] : [];
  }
  const h = useHealth.getState();
  const bloqueado = (pid: ProviderId, mid: string) =>
    cooldownRemaining(h.entries[makeModelKey(pid, mid)]) > 0 ||
    providerCooldownRemaining(h.providerEntries[pid]) > 0;
  const cadena = buildTaskChain("web", st.providers, bloqueado, 6, h.lastGood?.key ?? null);
  // la misma ordenación que usa el chat con imágenes en el turno
  return conImagenes ? ordenarParaVision(cadena, useCapacidades.getState().sinVision) : cadena;
}

export async function pedirAlModelo(p: PeticionModelo): Promise<RespuestaModelo> {
  const imagenes = p.imagenes ?? [];
  const lista = candidatos(p.modeloKey, imagenes.length > 0);
  const adjuntos: Attachment[] = imagenes.map((im, i) => ({
    id: `ref-${i}`,
    name: im.nombre,
    mediaType: im.dataUrl.slice(5, im.dataUrl.indexOf(";")) || "image/jpeg",
    dataUrl: im.dataUrl,
    size: Math.round(im.dataUrl.length * 0.75),
  }));
  if (!lista.length) throw new SinModelosError();
  const st = useForja.getState();
  const salud = useHealth.getState();
  let ultimoError: unknown = null;

  for (const c of lista) {
    if (p.signal.aborted) throw new DOMException("Cancelado", "AbortError");
    const key = makeModelKey(c.providerId, c.modelId);
    p.onModelo?.(key);
    let acumulado = "";
    try {
      const final = await streamChat({
        providerId: c.providerId,
        config: st.providers[c.providerId],
        modelId: c.modelId,
        messages: [{ role: "user", content: p.usuario, ...(adjuntos.length ? { attachments: adjuntos } : {}) }],
        settings: {
          ...st.settings,
          agentMode: false,
          systemPrompt: p.sistema,
          maxTokens: Math.max(st.settings.maxTokens ?? 0, p.maxTokens ?? 12_000),
        },
        signal: p.signal,
        onDelta: (t) => {
          acumulado = t;
          p.onTexto?.(separarEtiquetasPensamiento(t).contenido);
        },
        onDone: () => {},
      });
      const texto = separarEtiquetasPensamiento(final || acumulado).contenido;
      if (!texto.trim()) throw Object.assign(new Error("El modelo respondió vacío"), { status: 0 });
      salud.recordSuccess(key);
      salud.recordProviderSuccess(c.providerId);
      return { texto, modelKey: key };
    } catch (e) {
      if (p.signal.aborted) throw e;
      ultimoError = e;
      const status = statusFromError(e);
      const retry = retryAfterFromError(e);
      salud.recordFailure(key, status, retry);
      if (esFalloDeCuota(status)) salud.recordProviderFailure(c.providerId, status, retry);
      // con un modelo elegido a mano no se salta a otro: el usuario lo eligió
    }
  }
  throw ultimoError instanceof Error ? ultimoError : new Error("Ningún modelo pudo responder");
}

/** Modelos que el Estudio puede usar ahora mismo (gratis y conectados),
 * en el orden en que Auto los probaría. */
export function modelosDisponibles(limite = 60): string[] {
  const st = useForja.getState();
  return buildTaskChain("web", st.providers, undefined, limite).map((c) => c.modelKey);
}

/** La cadena Auto (o el modelo elegido) con la firma `LlamadaModelo` del
 * motor, para enchufarla al runtime del adaptador OpenDesign
 * (`RuntimeModelo`). `ultimo()` dice qué modelo respondió de verdad. */
export function llamadaAuto(
  modeloKey: string | null,
  signal: AbortSignal
): { llamada: LlamadaModelo; ultimo: () => string } {
  let ultimo = "";
  const llamada: LlamadaModelo = async (a) => {
    const r = await pedirAlModelo({
      sistema: a.system,
      usuario: a.user,
      modeloKey,
      signal,
      maxTokens: a.maxTokens,
    });
    ultimo = r.modelKey;
    return r.texto;
  };
  return { llamada, ultimo: () => ultimo };
}

/** Runtime del adaptador OpenDesign sobre los modelos del Estudio. */
export function runtimeEstudio(modeloKey: string | null, signal: AbortSignal): RuntimeModelo {
  const { llamada, ultimo } = llamadaAuto(modeloKey, signal);
  const elegido = modeloKey && !isAutoKey(modeloKey) ? splitModelKey(modeloKey) : null;
  return new RuntimeModelo({
    llamada,
    modelo: elegido ?? { providerId: "auto", modelId: "cadena-gratis" },
    productor: ultimo,
  });
}
