/** Forja IA — OAuth de Google Drive en el servidor (cookies, intercambio, refresco).
 * No importar desde componentes de cliente.
 *
 * `appOrigin`, `readCookie`, `cookieHeader`, `newPkce`, `packState` y
 * `unpackState` son utilidades genéricas de OAuth sin nada específico de
 * GitHub — se reutilizan tal cual desde `github-oauth-server.ts` en vez de
 * duplicarlas.
 */
import {
  appOrigin,
  cookieHeader,
  newPkce,
  packState,
  readCookie,
  unpackState,
} from "./github-oauth-server";
import {
  GD_APP_COOKIE,
  GD_OAUTH_MSG,
  GD_STATE_COOKIE,
  googleAuthorizeUrl,
  parseAppCredsJson,
  parseGoogleTokenResponse,
  type AppCreds,
  type GDriveQuota,
  type GoogleTokenResult,
} from "./gdrive-oauth";

export { appOrigin, cookieHeader, newPkce, packState, readCookie, unpackState, GD_APP_COOKIE, GD_STATE_COOKIE };

export function envCreds(): AppCreds | null {
  const clientId = (process.env.GOOGLE_CLIENT_ID ?? "").trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET ?? "").trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function credsFrom(req: Request): AppCreds | null {
  return envCreds() || parseAppCredsJson(readCookie(req, GD_APP_COOKIE) ?? "");
}

export function authorizeRedirect(creds: AppCreds, origin: string, packed: string): string {
  const u = unpackState(packed);
  if (!u) throw new Error("state interno no válido");
  // Sin PKCE: el cliente OAuth de Google aquí es "confidencial" (tiene
  // client_secret, que solo ve el servidor), así que el `state` de la
  // cookie ya basta contra CSRF — no hace falta el code_verifier que sí
  // usa GitHub para su flujo público.
  return googleAuthorizeUrl({
    clientId: creds.clientId,
    redirectUri: `${origin}/api/gdrive/oauth/callback`,
    state: u.state,
  });
}

export async function exchangeGoogleCode(opts: {
  creds: AppCreds;
  code: string;
  redirectUri: string;
}): Promise<GoogleTokenResult> {
  const body = new URLSearchParams({
    client_id: opts.creds.clientId,
    client_secret: opts.creds.clientSecret,
    code: opts.code,
    redirect_uri: opts.redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(20000),
  });
  return parseGoogleTokenResponse(await res.text());
}

export async function refreshGoogleToken(opts: {
  creds: AppCreds;
  refreshToken: string;
}): Promise<GoogleTokenResult> {
  const body = new URLSearchParams({
    client_id: opts.creds.clientId,
    client_secret: opts.creds.clientSecret,
    refresh_token: opts.refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(20000),
  });
  return parseGoogleTokenResponse(await res.text());
}

export interface GDriveAbout {
  email: string;
  name: string;
  avatar: string;
  quota: GDriveQuota;
}

/** Un único endpoint (`about`) da el perfil de la cuenta Y su cuota de
 * almacenamiento: evita un segundo viaje a `userinfo` solo para el nombre. */
export async function googleDriveAbout(accessToken: string): Promise<GDriveAbout> {
  const res = await fetch(
    "https://www.googleapis.com/drive/v3/about?fields=user(emailAddress,displayName,photoLink),storageQuota(limit,usage,usageInDrive)",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15000),
    }
  );
  if (!res.ok) throw new Error("No se pudo leer tu cuenta de Google Drive");
  const j = (await res.json()) as {
    user?: { emailAddress?: string; displayName?: string; photoLink?: string };
    storageQuota?: { limit?: string; usage?: string; usageInDrive?: string };
  };
  const q = j.storageQuota ?? {};
  return {
    email: j.user?.emailAddress ?? "",
    name: j.user?.displayName ?? j.user?.emailAddress ?? "",
    avatar: j.user?.photoLink ?? "",
    quota: {
      limit: q.limit ? Number(q.limit) : null,
      usage: q.usage ? Number(q.usage) : 0,
      usageInDrive: q.usageInDrive ? Number(q.usageInDrive) : 0,
    },
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export function gdriveResultHtml(
  origin: string,
  payload: {
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
    email?: string;
    name?: string;
    avatar?: string;
    quota?: GDriveQuota;
    error?: string;
  }
): string {
  const json = JSON.stringify({ type: GD_OAUTH_MSG, ...payload });
  const ok = !payload.error && !!payload.accessToken;
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${ok ? "Google Drive conectado" : "Google Drive"} · Forja</title>
  <style>
    :root { color-scheme: dark; }
    body { margin:0; min-height:100vh; display:grid; place-items:center;
      font-family: ui-sans-serif, system-ui, sans-serif; background:#0b0b12; color:#eee; }
    .c { text-align:center; max-width:22rem; padding:1.5rem; }
    p { opacity:.72; font-size:.9rem; line-height:1.45; }
  </style>
</head>
<body>
  <div class="c">
    <p>${ok ? "Cuenta conectada. Puedes cerrar esta ventana." : payload.error ? escapeHtml(payload.error) : "Volviendo a Forja…"}</p>
  </div>
  <script>
  (function () {
    var payload = ${json};
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(payload, ${JSON.stringify(origin)});
        window.close();
        return;
      }
    } catch (e) {}
    location.replace(${JSON.stringify(origin + "/")});
  })();
  </script>
</body>
</html>`;
}
