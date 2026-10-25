import { NextResponse } from "next/server";
import { guardRequest, guardResponse } from "@/lib/forja/api-guard";
import {
  OPENCODE_FALLBACK,
  catalogoGratis,
  parseModelsDev,
  parseZenIds,
  type OpenCodeFreeModel,
} from "@/lib/forja/opencode-catalog";

export const dynamic = "force-dynamic";

/** Catálogo vivo de modelos gratis de OpenCode Zen: datos públicos, sin clave.
 *  Caché en memoria de 15 min para no martillar models.dev ni la pasarela. */
let cache: { at: number; live: boolean; models: OpenCodeFreeModel[] } | null = null;
const TTL = 15 * 60 * 1000;

async function pedirJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function montar(): Promise<{ live: boolean; models: OpenCodeFreeModel[] }> {
  const [dev, zen] = await Promise.allSettled([
    pedirJson("https://models.dev/api.json"),
    pedirJson("https://opencode.ai/zen/v1/models"),
  ]);
  const deDev = dev.status === "fulfilled" ? parseModelsDev(dev.value) : [];
  const deZen = zen.status === "fulfilled" ? parseZenIds(zen.value) : [];
  const lista = catalogoGratis(deDev, deZen);
  if (lista.length === 0) return { live: false, models: OPENCODE_FALLBACK };
  return { live: true, models: lista };
}

export async function GET(req: Request) {
  const guard = guardRequest(req);
  if (!guard.ok) return guardResponse(guard);
  if (cache && Date.now() - cache.at < TTL) {
    return NextResponse.json({ live: cache.live, models: cache.models, fetchedAt: new Date(cache.at).toISOString(), cached: true });
  }
  const { live, models } = await montar();
  // lo no vivo no se cachea: que el siguiente intento vuelva a probar la red
  if (live) cache = { at: Date.now(), live, models };
  return NextResponse.json({ live, models, fetchedAt: new Date().toISOString(), cached: false });
}
