/** Forja IA — La mitad de `visual_review` que llama al modelo con visión.
 *
 * `tool-runner.test.ts` prueba la herramienta con un `ctx.visionCritique`
 * falso. Esto prueba la implementación REAL de ese callback
 * (`buildToolContext` en `use-agent-tools.ts`): que arma el adjunto bien,
 * que usa el MISMO modelo/proveedor de la conversación (no uno aparte), y
 * que reconoce el aviso «no admite imágenes» que ya deja `chat-client.ts`
 * en el mensaje del error en vez de reinventar esa detección.
 */
import { describe, expect, it } from "vitest";
import { buildToolContext } from "../../src/lib/prism/use-agent-tools";
import type { StreamOptions } from "../../src/lib/prism/chat-client";
import type { AppSettings } from "../../src/lib/prism/types";

const visionDeps = (stream: (opts: StreamOptions) => Promise<string>) => ({
  providerId: "custom" as const,
  modelId: "modelo-con-vision",
  config: { apiKey: "k", enabled: true, models: [], useProxy: false },
  settings: { stream: false } as unknown as AppSettings,
  signal: new AbortController().signal,
  stream,
});

describe("visionCritique (buildToolContext)", () => {
  it("sin `vision`, no hay visionCritique — la tool lo dice en vez de fingir", () => {
    const ctx = buildToolContext(null);
    expect(ctx.visionCritique).toBeUndefined();
  });

  it("llama al mismo proveedor/modelo de la conversación, con la captura como adjunto", async () => {
    let visto: StreamOptions | null = null;
    const ctx = buildToolContext(
      null,
      null,
      undefined,
      [],
      [],
      visionDeps(async (opts) => {
        visto = opts;
        return "El titular pesa poco frente al hero: falta jerarquía.";
      })
    );
    const r = await ctx.visionCritique!("data:image/jpeg;base64,ABC", "el titular");
    expect(r.ok).toBe(true);
    expect(r.texto).toContain("falta jerarquía");
    expect(visto).not.toBeNull();
    expect(visto!.providerId).toBe("custom");
    expect(visto!.modelId).toBe("modelo-con-vision");
    const msg = visto!.messages[0] as { attachments?: { dataUrl: string; mediaType: string }[]; content: string };
    expect(msg.attachments).toHaveLength(1);
    expect(msg.attachments![0].dataUrl).toBe("data:image/jpeg;base64,ABC");
    expect(msg.attachments![0].mediaType).toBe("image/jpeg");
    expect(msg.content).toContain("el titular");
  });

  it("si el modelo activo no admite imágenes, lo dice claro y no se inventa una crítica", async () => {
    const ctx = buildToolContext(
      null,
      null,
      undefined,
      [],
      [],
      visionDeps(async () => {
        // el mismo aviso que ya arma `assertOk` en chat-client.ts cuando
        // `esFalloDeImagen` reconoce el error del proveedor
        throw new Error("OpenAI 400: no endpoint — ese modelo no admite imágenes: manda solo texto o elige uno con visión");
      })
    );
    const r = await ctx.visionCritique!("data:image/jpeg;base64,ABC");
    expect(r.ok).toBe(false);
    expect(r.texto).toContain("no admite imágenes");
    expect(r.texto).toContain("visual_review");
  });

  it("otro fallo (red, clave inválida…) se reporta con su motivo, no se confunde con «sin visión»", async () => {
    const ctx = buildToolContext(
      null,
      null,
      undefined,
      [],
      [],
      visionDeps(async () => {
        throw new Error("Custom 401: clave inválida");
      })
    );
    const r = await ctx.visionCritique!("data:image/jpeg;base64,ABC");
    expect(r.ok).toBe(false);
    expect(r.texto).toContain("clave inválida");
    expect(r.texto).not.toContain("no admite imágenes");
  });
});
