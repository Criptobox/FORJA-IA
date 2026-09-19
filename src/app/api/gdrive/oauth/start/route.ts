/** Forja IA — Arranca el login de Google Drive (popup).
 * A diferencia de GitHub, Google no tiene un "manifiesto" de registro
 * automático: si no hay credenciales guardadas, esta ruta explica cómo
 * crearlas en vez de intentar un flujo imposible sin ellas. */
import { NextResponse } from "next/server";
import {
  GD_STATE_COOKIE,
  appOrigin,
  authorizeRedirect,
  cookieHeader,
  credsFrom,
  newPkce,
  packState,
} from "@/lib/forja/gdrive-oauth-server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const origin = appOrigin(req);
  const creds = credsFrom(req);

  if (!creds) {
    const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <title>Conectar Google Drive · Forja</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:ui-sans-serif,system-ui,sans-serif;background:#0b0b12;color:#eee;padding:1.5rem}
    .c{max-width:26rem;text-align:center}
    p{opacity:.75;font-size:.9rem;line-height:1.5}
  </style>
</head>
<body>
  <div class="c">
    <p>Todavía no hay credenciales de Google guardadas. Cierra esta ventana y pega tu Client ID y Client Secret en el diálogo de Drive de Forja.</p>
  </div>
</body>
</html>`;
    return new NextResponse(html, {
      status: 409,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const pkce = newPkce();
  const packed = packState(pkce.state, pkce.verifier);
  const url = authorizeRedirect(creds, origin, packed);
  const res = NextResponse.redirect(url);
  res.headers.append("Set-Cookie", cookieHeader(GD_STATE_COOKIE, packed, origin, 600));
  return res;
}
