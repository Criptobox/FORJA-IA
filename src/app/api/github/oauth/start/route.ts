/** Forja IA — Arranca el login de GitHub (popup o pestaña). */
import { NextResponse } from "next/server";
import { GH_APP_COOKIE, githubManifestPayload } from "@/lib/forja/github-oauth";
import {
  GH_STATE_COOKIE,
  appOrigin,
  authorizeRedirect,
  cookieHeader,
  credsFrom,
  envCreds,
  newPkce,
  packState,
} from "@/lib/forja/github-oauth-server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const origin = appOrigin(req);
  const pkce = newPkce();
  const packed = packState(pkce.state, pkce.verifier);
  // «Conectar otra cuenta»: la App guardada en la cookie es PRIVADA de la
  // cuenta que la registró, y otra cuenta no puede instalarla ni autorizarla.
  // Se olvida y se registra una nueva en la cuenta que entra ahora. Con
  // credenciales del servidor (una sola App para todos) basta con dejar
  // elegir la cuenta en GitHub.
  const otraCuenta = new URL(req.url).searchParams.get("cuenta") === "otra";
  const creds = otraCuenta ? envCreds() : credsFrom(req);

  if (creds) {
    const url = authorizeRedirect(creds, origin, packed, otraCuenta);
    const res = NextResponse.redirect(url);
    res.headers.append("Set-Cookie", cookieHeader(GH_STATE_COOKIE, packed, origin, 600));
    return res;
  }

  // Sin OAuth App en el servidor: el usuario registra una GitHub App en su
  // cuenta (un clic) y a continuación autoriza. Cero variables de entorno.
  const manifest = JSON.stringify(githubManifestPayload(origin));
  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <title>Conectar GitHub · Forja</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:ui-sans-serif,system-ui,sans-serif;background:#0b0b12;color:#eee}
    p{opacity:.7;font-size:.9rem}
  </style>
</head>
<body>
  <p>Te llevamos a GitHub para conectar tu cuenta…</p>
  <form id="f" action="https://github.com/settings/apps/new?state=${encodeURIComponent(pkce.state)}" method="post">
    <input type="hidden" name="manifest" value="${manifest.replace(/"/g, "&quot;")}">
  </form>
  <script>document.getElementById("f").submit()</script>
</body>
</html>`;
  const res = new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
  res.headers.append("Set-Cookie", cookieHeader(GH_STATE_COOKIE, packed, origin, 600));
  if (otraCuenta) res.headers.append("Set-Cookie", cookieHeader(GH_APP_COOKIE, "", origin, 0));
  return res;
}
