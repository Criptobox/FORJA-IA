/** Forja IA — Guarda (o consulta) el Client ID / Secret de Google que cada
 * persona crea en su propio Google Cloud. Google no tiene registro
 * automático como el manifiesto de GitHub Apps, así que esto reemplaza a
 * ese paso: se pegan una vez y quedan en una cookie del propio despliegue. */
import { NextResponse } from "next/server";
import { guardRequest, guardResponse } from "@/lib/forja/api-guard";
import { GD_APP_COOKIE, appOrigin, cookieHeader, credsFrom, envCreds } from "@/lib/forja/gdrive-oauth-server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const env = !!envCreds();
  const creds = credsFrom(req);
  return NextResponse.json({
    configured: !!creds,
    source: env ? "env" : creds ? "cookie" : null,
  });
}

export async function POST(req: Request) {
  const guard = guardRequest(req);
  if (!guard.ok) return guardResponse(guard);
  const origin = appOrigin(req);
  let body: { clientId?: string; clientSecret?: string };
  try {
    body = (await req.json()) as { clientId?: string; clientSecret?: string };
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  const clientId = (body.clientId ?? "").trim();
  const clientSecret = (body.clientSecret ?? "").trim();
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Faltan el Client ID o el Client Secret" }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true });
  res.headers.append(
    "Set-Cookie",
    cookieHeader(GD_APP_COOKIE, JSON.stringify({ clientId, clientSecret }), origin, 60 * 60 * 24 * 365)
  );
  return res;
}

export async function DELETE(req: Request) {
  const guard = guardRequest(req);
  if (!guard.ok) return guardResponse(guard);
  const origin = appOrigin(req);
  const res = NextResponse.json({ ok: true });
  res.headers.append("Set-Cookie", cookieHeader(GD_APP_COOKIE, "", origin, 0));
  return res;
}
