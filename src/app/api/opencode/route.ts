import { NextResponse } from "next/server";
import { normalizeOpenCodeModels, openCodeBaseUrl, openCodeFetch } from "@/lib/forja/opencode";
import { guardRequest, guardResponse } from "@/lib/forja/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Diagnóstico y catálogo del motor OpenCode. Nunca expone credenciales. */
export async function GET(request: Request) {
  const guard = guardRequest(request);
  if (!guard.ok) return guardResponse(guard);
  if (!openCodeBaseUrl()) {
    return NextResponse.json({ configured: false, connected: false, freeOnly: true, models: [], message: "Configura OPENCODE_BASE_URL para conectar OpenCode." });
  }
  try {
    const [healthResponse, providerResponse] = await Promise.all([
      openCodeFetch("/global/health"),
      openCodeFetch("/provider"),
    ]);
    if (!healthResponse.ok) throw new Error(`OpenCode health HTTP ${healthResponse.status}`);
    if (!providerResponse.ok) throw new Error(`OpenCode providers HTTP ${providerResponse.status}`);
    const health = await healthResponse.json() as { healthy?: boolean; version?: string };
    const providers = await providerResponse.json();
    const models = normalizeOpenCodeModels(providers);
    const freeModels = models.filter((model) => model.free);
    return NextResponse.json({
      configured: true,
      connected: health.healthy === true,
      version: health.version ?? null,
      freeOnly: true,
      providersConnected: Array.isArray((providers as { connected?: unknown }).connected) ? (providers as { connected: string[] }).connected : [],
      models: freeModels,
      excludedPaidModels: models.length - freeModels.length,
      message: freeModels.length ? "OpenCode conectado. Se muestran solo modelos identificados con coste cero." : "OpenCode está conectado, pero no se han podido verificar modelos gratuitos. No se seleccionará ningún modelo de pago.",
    });
  } catch (error) {
    return NextResponse.json({ configured: true, connected: false, freeOnly: true, models: [], message: error instanceof Error ? error.message : "No se pudo conectar con OpenCode." }, { status: 502 });
  }
}

/** Ejecuta una tarea con un modelo que el catálogo de OpenCode identifica como gratuito. */
export async function POST(request: Request) {
  const guard = guardRequest(request);
  if (!guard.ok) return guardResponse(guard);
  let body: { prompt?: unknown; model?: unknown; sessionID?: unknown };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ error: "El cuerpo debe ser JSON válido." }, { status: 400 }); }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt || prompt.length > 20_000) return NextResponse.json({ error: "La tarea debe tener entre 1 y 20 000 caracteres." }, { status: 400 });
  const modelID = typeof body.model === "string" ? body.model.trim() : "";

  try {
    const catalogResponse = await openCodeFetch("/provider");
    if (!catalogResponse.ok) throw new Error(`No se pudo leer el catálogo de OpenCode (HTTP ${catalogResponse.status}).`);
    const catalog = await catalogResponse.json();
    const freeModels = normalizeOpenCodeModels(catalog).filter((model) => model.free);
    const selected = modelID ? freeModels.find((model) => `${model.providerID}/${model.id}` === modelID) : freeModels[0];
    if (!selected) return NextResponse.json({ error: "No hay un modelo gratuito verificado seleccionado. Revisa la conexión y el catálogo de OpenCode." }, { status: 409 });

    let sessionID = typeof body.sessionID === "string" ? body.sessionID.trim() : "";
    if (!sessionID) {
      const created = await openCodeFetch("/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "Tarea desde Forja IA" }) });
      if (!created.ok) throw new Error(`No se pudo crear la sesión (HTTP ${created.status}).`);
      const session = await created.json() as { id?: string };
      sessionID = session.id ?? "";
    }
    if (!sessionID || !/^[a-zA-Z0-9_-]{1,128}$/.test(sessionID)) throw new Error("OpenCode devolvió un identificador de sesión inválido.");

    const messageResponse = await openCodeFetch(`/session/${encodeURIComponent(sessionID)}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: { providerID: selected.providerID, modelID: selected.id },
        parts: [{ type: "text", text: `Trabaja como agente de Forja IA. Usa solo las herramientas disponibles en el proyecto y no realices acciones destructivas sin autorización.\n\nTAREA:\n${prompt}` }],
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!messageResponse.ok) throw new Error(`OpenCode no pudo ejecutar la tarea (HTTP ${messageResponse.status}).`);
    const result = await messageResponse.json() as { info?: { id?: string }; parts?: Array<{ type?: string; text?: string }> };
    return NextResponse.json({ ok: true, sessionID, model: `${selected.providerID}/${selected.id}`, free: true, text: (result.parts ?? []).filter((part) => part.type === "text" && typeof part.text === "string").map((part) => part.text).join("\n"), messageID: result.info?.id ?? null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error al ejecutar la tarea con OpenCode." }, { status: 502 });
  }
}
