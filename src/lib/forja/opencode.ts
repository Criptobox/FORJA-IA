/** Cliente mínimo del servidor HTTP de OpenCode. No envía claves al navegador. */
export type OpenCodeModel = {
  id: string;
  name: string;
  providerID: string;
  free: boolean;
  context?: number;
};

export function openCodeBaseUrl(): string | null {
  const raw = process.env.OPENCODE_BASE_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function headers(): HeadersInit {
  const result: Record<string, string> = { Accept: "application/json" };
  const password = process.env.OPENCODE_SERVER_PASSWORD;
  if (password) {
    const username = process.env.OPENCODE_SERVER_USERNAME || "opencode";
    result.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
  }
  return result;
}

export async function openCodeFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const base = openCodeBaseUrl();
  if (!base) throw new Error("OpenCode no está configurado. Define OPENCODE_BASE_URL en el servidor de Forja IA.");
  return fetch(`${base}${path}`, {
    ...init,
    headers: { ...headers(), ...(init.headers as Record<string, string> | undefined) },
    cache: "no-store",
    signal: init.signal ?? AbortSignal.timeout(12_000),
  });
}

export function isModelFree(model: Record<string, unknown>): boolean {
  const cost = model.cost && typeof model.cost === "object" ? model.cost as Record<string, unknown> : null;
  if (cost && typeof cost.input === "number" && typeof cost.output === "number") {
    return cost.input === 0 && cost.output === 0;
  }
  // Si falta cualquiera de los dos precios, no se marca como gratuito por suposición.
  return false;
}

export function normalizeOpenCodeModels(payload: unknown): OpenCodeModel[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;
  const providers = Array.isArray(root.all) ? root.all : Array.isArray(root.providers) ? root.providers : [];
  const result: OpenCodeModel[] = [];
  for (const item of providers) {
    if (!item || typeof item !== "object") continue;
    const provider = item as Record<string, unknown>;
    const providerID = typeof provider.id === "string" ? provider.id : typeof provider.name === "string" ? provider.name : "";
    const models = provider.models && typeof provider.models === "object" ? Object.entries(provider.models as Record<string, unknown>) : [];
    for (const [id, rawModel] of models) {
      if (!rawModel || typeof rawModel !== "object") continue;
      const model = rawModel as Record<string, unknown>;
      result.push({
        id,
        name: typeof model.name === "string" ? model.name : id,
        providerID,
        free: isModelFree(model),
        ...(typeof (model.limit as Record<string, unknown> | undefined)?.context === "number"
          ? { context: (model.limit as Record<string, unknown>).context as number }
          : {}),
      });
    }
  }
  return result.sort((a, b) => Number(b.free) - Number(a.free) || a.name.localeCompare(b.name));
}
