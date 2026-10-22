/** Contrato entre la interfaz web de Forja IA y el ejecutor OpenCode nativo de Android.
 * La app Android debe implementar window.ForjaOpenCodeNative desde un WebView confiable.
 * No se usa localhost desde el navegador: evita CORS, HTTPS/mixed-content y puertos expuestos.
 */
export type AndroidOpenCodeModel = {
  id: string;
  name: string;
  providerID: string;
  /** Solo true si el catálogo del proveedor informa coste de entrada y salida igual a cero. */
  free: boolean;
  context?: number;
};

export type AndroidOpenCodeStatus = {
  available: boolean;
  running: boolean;
  version?: string;
  message: string;
};

export type AndroidOpenCodeResult = {
  ok: boolean;
  sessionID?: string;
  model?: string;
  text?: string;
  error?: string;
};

export interface ForjaOpenCodeNative {
  getStatus(): Promise<AndroidOpenCodeStatus>;
  listModels(): Promise<AndroidOpenCodeModel[]>;
  runTask(input: { prompt: string; model: string; sessionID?: string }): Promise<AndroidOpenCodeResult>;
  openRuntimeSettings?(): void;
}

declare global {
  interface Window {
    ForjaOpenCodeNative?: ForjaOpenCodeNative;
  }
}

export function getAndroidOpenCodeBridge(): ForjaOpenCodeNative | null {
  if (typeof window === "undefined") return null;
  const bridge = window.ForjaOpenCodeNative;
  if (!bridge || typeof bridge.getStatus !== "function" || typeof bridge.listModels !== "function" || typeof bridge.runTask !== "function") return null;
  return bridge;
}

export function validateAndroidTask(input: { prompt: string; model: string; sessionID?: string }): string | null {
  if (!input.prompt.trim()) return "Escribe una tarea antes de enviarla.";
  if (input.prompt.length > 20_000) return "La tarea supera el límite de 20 000 caracteres.";
  if (!input.model.trim()) return "Selecciona un modelo gratuito verificado.";
  if (input.sessionID && !/^[a-zA-Z0-9_-]{1,128}$/.test(input.sessionID)) return "El identificador de sesión no es válido.";
  return null;
}

/** Nunca permite que una selección manipulada eluda el filtro de gratuidad del catálogo nativo. */
export async function runAndroidOpenCodeTask(
  input: { prompt: string; model: string; sessionID?: string },
  bridge: ForjaOpenCodeNative | null = getAndroidOpenCodeBridge(),
): Promise<AndroidOpenCodeResult> {
  const validationError = validateAndroidTask(input);
  if (validationError) return { ok: false, error: validationError };
  if (!bridge) return { ok: false, error: "El motor local Android no está conectado. Abre Forja IA desde su aplicación Android compatible." };
  try {
    const models = await bridge.listModels();
    const selected = models.find((item) => `${item.providerID}/${item.id}` === input.model);
    if (!selected || selected.free !== true) {
      return { ok: false, error: "Ese modelo no aparece como gratuito verificado. No se ha enviado la tarea." };
    }
    const status = await bridge.getStatus();
    if (!status.available || !status.running) {
      return { ok: false, error: status.message || "El motor local no está iniciado." };
    }
    const result = await bridge.runTask(input);
    if (!result || result.ok !== true) return { ok: false, error: result?.error || "OpenCode no pudo completar la tarea." };
    return { ...result, model: `${selected.providerID}/${selected.id}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Error de comunicación con el motor local." };
  }
}
