/** Forja IA — Google redirige aquí con ?code= tras autorizar. */
import { NextResponse } from "next/server";
import {
  GD_STATE_COOKIE,
  appOrigin,
  credsFrom,
  exchangeGoogleCode,
  gdriveResultHtml,
  googleDriveAbout,
  readCookie,
  unpackState,
} from "@/lib/forja/gdrive-oauth-server";

export const runtime = "nodejs";

function html(origin: string, payload: Parameters<typeof gdriveResultHtml>[1], status = 200) {
  return new NextResponse(gdriveResultHtml(origin, payload), {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(req: Request) {
  const origin = appOrigin(req);
  const url = new URL(req.url);
  const err = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (err) return html(origin, { error: err });

  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  if (!code) return html(origin, { error: "Google no devolvió un código de autorización" }, 400);

  const packed = unpackState(readCookie(req, GD_STATE_COOKIE));
  if (!packed || packed.state !== state) {
    return html(origin, { error: "La sesión de Google no coincide. Prueba a conectar otra vez." }, 400);
  }

  const creds = credsFrom(req);
  if (!creds) {
    return html(origin, { error: "Faltan las credenciales de Google. Pégalas de nuevo en el diálogo de Drive." }, 400);
  }

  try {
    const tokenRes = await exchangeGoogleCode({
      creds,
      code,
      redirectUri: `${origin}/api/gdrive/oauth/callback`,
    });
    if (!tokenRes.access_token) {
      return html(
        origin,
        { error: tokenRes.error_description || tokenRes.error || "Google no entregó el token" },
        400
      );
    }
    const about = await googleDriveAbout(tokenRes.access_token);
    return html(origin, {
      accessToken: tokenRes.access_token,
      refreshToken: tokenRes.refresh_token,
      expiresIn: tokenRes.expires_in,
      email: about.email,
      name: about.name,
      avatar: about.avatar,
      quota: about.quota,
    });
  } catch (e) {
    return html(origin, { error: e instanceof Error ? e.message : String(e) }, 502);
  }
}
