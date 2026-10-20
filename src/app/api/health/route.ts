/** Forja IA — Health check: «¿estás viva y quién eres?» en una llamada.
 *
 * No toca red ni proxies: todo lo que responde lo sabe el proceso local
 * (versión, uptime, memoria) o el manifiesto (identidad del proyecto). Un
 * health que depende de servicios externos no distingue «me caí» de «se cayó
 * otro», y para eso no hace falta un endpoint.
 *
 * `dynamic = "force-dynamic"`: el uptime cambia en cada llamada, cachearlo
 * enseñaría una mentira cómoda.
 */
import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/forja/app-version";
import { resumenManifest } from "@/lib/project-manifest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const mem = process.memoryUsage();
  return NextResponse.json({
    estado: "ok",
    version: APP_VERSION,
    uptimeSeg: Math.round(process.uptime()),
    node: process.version,
    memoriaMb: Math.round(mem.rss / 1024 / 1024),
    proyecto: resumenManifest(),
    ts: new Date().toISOString(),
  });
}
