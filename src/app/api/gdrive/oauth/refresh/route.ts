/** Forja IA — Cambia un refresh_token de Google por un access_token nuevo.
 * El access_token dura ~1h; el cliente llama aquí cuando el que tiene
 * guardado está a punto de caducar. Necesita el client_secret, así que no
 * puede hacerse directo desde el navegador. */
import { NextResponse } from "next/server";
import { guardRequest, guardResponse } from "@/lib/forja/api-guard";
import { credsFrom, refreshGoogleToken } from "@/lib/forja/gdrive-oauth-server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const guard = guardRequest(req);
  if (!guard.ok) return guardResponse(guard);
  const creds = credsFrom(req);
  if (!creds) {
    return NextResponse.json({ error: "Faltan las credenciales de Google" }, { status: 400 });
  }
  let body: { refreshToken?: string };
  try {
    body = (await req.json()) as { refreshToken?: string };
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  const refreshToken = (body.refreshToken ?? "").trim();
  if (!refreshToken) return NextResponse.json({ error: "Falta refreshToken" }, { status: 400 });

  const r = await refreshGoogleToken({ creds, refreshToken });
  if (!r.access_token) {
    return NextResponse.json({ error: r.error_description || r.error || "Google no renovó el token" }, { status: 400 });
  }
  return NextResponse.json({ accessToken: r.access_token, expiresIn: r.expires_in ?? 3600 });
}
